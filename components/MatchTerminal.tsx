"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Zap, Activity, Shield, Search, TrendingUp, 
  ChevronRight, Cpu, LayoutGrid, Fingerprint, Layers, 
  Clock, AlertTriangle, Trophy, Target, 
  BarChart3, Globe, Star, Loader2, MousePointer2,
  CheckCircle2, Info, Wallet, BarChart, X, Menu,
  LineChart as LineChartIcon, SlidersHorizontal,
  CalendarDays, Flame, Bell, User, ExternalLink, MessageSquare, Send, Bot, Heart
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { AgentResult, MatchData as BaseMatchData } from '@/lib/agents/orchestrator';
import { KellyResult } from '@/lib/kelly';

export interface MatchData extends BaseMatchData {
  kellyResult?: KellyResult;
  sport?: 'soccer' | 'baseball' | 'basketball' | 'football' | 'tennis';
}

const getMatchSport = (matchId: string): 'soccer' | 'baseball' | 'basketball' | 'football' | 'tennis' => {
  if (matchId === 'm3') return 'baseball';
  if (matchId === 'm5') return 'basketball';
  return 'soccer';
};

const getLeagueNameKorean = (league: string): string => {
  const l = league.toLowerCase();
  if (l.includes('premier league') || l.includes('epl')) return 'EPL';
  if (l.includes('la liga')) return '라리가';
  if (l.includes('bundesliga')) return '분데스리가';
  if (l.includes('k league')) return 'K리그';
  if (l.includes('kbo')) return 'KBO';
  if (l.includes('mlb')) return 'MLB';
  if (l.includes('nba')) return 'NBA';
  return league;
};

const EMPTY_MATCH: MatchData = { id: '', code: '', teams: { home: '', away: '' }, league: '', odds: { win: 0, draw: 0, loss: 0 }, startTime: '' };
const enrichMatches = (data: BaseMatchData[]): MatchData[] => data.map(m => ({ ...m, sport: 'soccer', kellyResult: undefined }));
const formatOdds = (n: number) => Number.isFinite(n) && n > 1 ? String(n) : '미수집';

const getNicknameFromEmail = (email?: string | null): string => {
  if (!email) return '사용자';
  const prefix = email.split('@')[0];
  return prefix ? prefix.trim() : '사용자';
};

export const MatchTerminal: React.FC = () => {
  const [dataError, setDataError] = useState('');
  const [loadingMatches, setLoadingMatches] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [isInferring, setIsInferring] = useState(false);
  const [results, setResults] = useState<AgentResult[]>([]);
  const [matches, setMatches] = useState<MatchData[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<MatchData>(EMPTY_MATCH);
  const [betPick, setBetPick] = useState<'WIN' | 'DRAW' | 'LOSS' | null>(null);
  const [isBetPlaced, setIsBetPlaced] = useState(false);

  const formattedToday = useMemo(() => {
    const kstTime = new Date().getTime() + (9 * 60 * 60 * 1000);
    const d = new Date(kstTime);
    const month = d.getUTCMonth() + 1;
    const date = d.getUTCDate();
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const day = dayNames[d.getUTCDay()];
    return `${month}월 ${date}일 (${day})`;
  }, []);
  
  // Navigation & Filtering States
  const [activeTab, setActiveTab] = useState<'home' | 'analysis' | 'strategy' | 'chat' | 'profile' | 'notifications'>('home');
  const [selectedSport, setSelectedSport] = useState<string>('all');
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showOnlyValueBets, setShowOnlyValueBets] = useState<boolean>(false);
  
  // Capital & Accordion States
  const [capital, setCapital] = useState<number>(1000000); 
  const [isDetailsOpen, setIsDetailsOpen] = useState<boolean>(false);

  // Chat States
  const [chatHistory, setChatHistory] = useState<{role: string, content: string}[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);

  const handleSendChat = async (text: string) => {
    if (!text.trim()) return;
    const newHistory = [...chatHistory, { role: 'user', content: text }];
    setChatHistory(newHistory);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history: chatHistory })
      });
      const data = await res.json();
      if (data.success) {
        setChatHistory([...newHistory, { role: 'assistant', content: data.text }]);
      } else {
        setChatHistory([...newHistory, { role: 'assistant', content: '오류가 발생했습니다: ' + (data.error || '알 수 없는 오류') }]);
      }
    } catch (err) {
      setChatHistory([...newHistory, { role: 'assistant', content: '네트워크 오류가 발생했습니다.' }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // Auth & Profile States
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'none'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [authError, setAuthError] = useState('');

  // Supabase Bookmark States
  const [deviceId, setDeviceId] = useState<string>('');
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [bookmarkedMatches, setBookmarkedMatches] = useState<any[]>([]);

  useEffect(() => {
    let localId = localStorage.getItem('asm_device_id');
    if (!localId) {
      localId = 'dev_' + Math.random().toString(36).substring(2, 9) + Date.now();
      localStorage.setItem('asm_device_id', localId);
    }
    const safeLocalId = localId;

    const fetchBookmarks = async (targetId: string) => {
      const { data } = await supabase.from('bookmarks').select('*').eq('device_id', targetId);
      if (data) {
        setBookmarkedIds(new Set(data.map(b => b.match_id)));
        setBookmarkedMatches(data);
      } else {
        setBookmarkedIds(new Set());
        setBookmarkedMatches([]);
      }
    };

    const fetchProfile = async (user: any) => {
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      const defaultNickname = getNicknameFromEmail(user.email);

      if (data) {
        if (!data.nickname || data.nickname.startsWith('User_')) {
          const updatedProfile = { ...data, nickname: defaultNickname };
          setProfile(updatedProfile);
          setCapital(Number(data.capital));
          await supabase.from('profiles').update({ nickname: defaultNickname }).eq('id', user.id);
        } else {
          setProfile(data);
          setCapital(Number(data.capital));
        }
      } else {
        const newProfile = { id: user.id, email: user.email, nickname: defaultNickname, capital: 1000000, grade: 'free' };
        await supabase.from('profiles').insert(newProfile);
        setProfile(newProfile);
        setCapital(1000000);
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        setDeviceId(session.user.id);
        fetchBookmarks(session.user.id);
        fetchProfile(session.user);
      } else {
        setDeviceId(safeLocalId);
        fetchBookmarks(safeLocalId);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session) {
        const userId = session.user.id;
        setDeviceId(userId);
        
        if (safeLocalId) {
          const { data: localBookmarks } = await supabase.from('bookmarks').select('id').eq('device_id', safeLocalId);
          if (localBookmarks && localBookmarks.length > 0) {
            await supabase.from('bookmarks').update({ device_id: userId }).eq('device_id', safeLocalId);
          }
        }
        
        fetchBookmarks(userId);
        fetchProfile(session.user);
      } else {
        setDeviceId(safeLocalId);
        fetchBookmarks(safeLocalId);
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleEmailAuth = async () => {
    setAuthError('');
    if (!email.trim() || !password.trim()) {
      setAuthError('이메일과 비밀번호를 입력해주세요.');
      return;
    }

    if (authMode === 'signup') {
      if (!confirmPassword.trim()) {
        setAuthError('비밀번호 확인을 입력해주세요.');
        return;
      }
      if (password !== confirmPassword) {
        setAuthError('비밀번호가 일치하지 않습니다.');
        return;
      }
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setAuthError(error.message);
      else {
        alert('회원가입이 완료되었습니다. 로그인해주세요.');
        setAuthMode('login');
        setConfirmPassword('');
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setAuthError(error.message);
      else setAuthMode('none');
    }
  };

  const toggleAuthMode = () => {
    setAuthError('');
    setAuthMode(prev => prev === 'signup' ? 'login' : 'signup');
  };

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const updateCapital = async (newVal: number) => {
    setCapital(newVal);
    if (session && profile) {
      setProfile({ ...profile, capital: newVal });
      await supabase.from('profiles').update({ capital: newVal }).eq('id', session.user.id);
    }
  };


  const toggleBookmark = async (match: MatchData, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!deviceId) return;
    
    const isBookmarked = bookmarkedIds.has(match.id);
    
    if (isBookmarked) {
      // Remove
      setBookmarkedIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(match.id);
        return newSet;
      });
      setBookmarkedMatches(prev => prev.filter(b => b.match_id !== match.id));
      
      await supabase
        .from('bookmarks')
        .delete()
        .eq('device_id', deviceId)
        .eq('match_id', match.id);
    } else {
      // Add
      setBookmarkedIds(prev => new Set(prev).add(match.id));
      
      const matchPick = null; // No validated prediction is available.

      const newBookmark = {
        device_id: deviceId,
        match_id: match.id,
        home_team: match.teams.home,
        away_team: match.teams.away,
        league: match.league,
        predicted_score: '',
        kelly_percent: match.kellyResult?.fractionalKelly || 0,
        is_value_bet: !!match.kellyResult?.isValueBet,
        pick: matchPick,
        kickoff_time: match.startTime,
        bet_date: match.startTime
      };
      
      const { data } = await supabase
        .from('bookmarks')
        .insert(newBookmark)
        .select()
        .single();
        
      if (data) {
        setBookmarkedMatches(prev => [...prev, data]);
      }
    }
  };

  const updateBookmarkResult = async (id: string, isCorrect: boolean) => {
    setBookmarkedMatches(prev => prev.map(b => b.id === id ? { ...b, is_correct: isCorrect } : b));
    
    await supabase
      .from('bookmarks')
      .update({ is_correct: isCorrect })
      .eq('id', id);
  };


  // Dynamic Notifications Data
  const notifications = useMemo(() => {
    const valueBets = matches.filter(m => m.kellyResult?.isValueBet);
    const now = new Date();
    const timeString = now.toLocaleTimeString('ko-KR', { 
      hour: '2-digit', 
      minute: '2-digit',
      timeZone: 'Asia/Seoul'
    });

    return valueBets.map((match, index) => {
      const leagueStr = getLeagueNameKorean(match.league);
      return {
        id: index + 1,
        title: "AI 분석 완료 및 추천 매치 감지",
        desc: `${leagueStr} ${match.teams.home} vs ${match.teams.away} 경기에 대해 기대값 우위가 검증되었습니다. Quarter Kelly에 기반한 포트폴리오 비중 편입을 추천합니다.`,
        time: timeString,
        tag: "베팅 추천"
      };
    });
  }, [matches]);

  useEffect(() => {
    setMounted(true);
    const loadMatches = async () => {
      try {
        const res = await fetch('/api/matches?t=' + Date.now());
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error('경기 데이터를 가져올 수 없습니다. 잠시 후 다시 시도해주세요.');
        if (json.success) {
          const dataList = json.data || [];
          const enriched = enrichMatches(dataList);
          setMatches(enriched);
          if (enriched.length > 0) {
            setSelectedMatch(enriched[0]);
          }
        }
      } catch (error) {
        setDataError('경기 데이터를 가져올 수 없습니다. 잠시 후 다시 시도해주세요.');
        setMatches([]);
      } finally {
        setLoadingMatches(false);
      }
    };
    loadMatches();
  }, []);

  // Reset helper for Global Home recovery
  const resetToHome = () => {
    setActiveTab('home');
    setSelectedSport('all');
    setSearchQuery('');
    setIsSearchOpen(false);
    setShowOnlyValueBets(false);
  };

  const aiRecommendedCount = useMemo(() => {
    return matches.filter(m => m.kellyResult?.isValueBet).length;
  }, [matches]);

  const filteredMatches = useMemo(() => {
    let result = matches;
    
    // 1. Sport category filtering
    if (selectedSport !== 'all') {
      result = result.filter(m => m.sport === selectedSport);
    }
    
    // 2. Recommend only filter (Value Bet)
    if (showOnlyValueBets) {
      result = result.filter(m => m.kellyResult?.isValueBet);
    }
    
    // 3. Search query filtering (home team, away team, league)
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      result = result.filter(m => 
        m.teams.home.toLowerCase().includes(q) ||
        m.teams.away.toLowerCase().includes(q) ||
        m.league.toLowerCase().includes(q)
      );
    }
    
    return result;
  }, [matches, selectedSport, showOnlyValueBets, searchQuery]);

  const groupedMatches = useMemo(() => {
    const sorted = [...filteredMatches].sort((a, b) => {
      return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
    });

    const groups: { dateLabel: string; matches: MatchData[] }[] = [];
    
    const nowKstTime = new Date().getTime() + (9 * 60 * 60 * 1000);
    const nowKst = new Date(nowKstTime);
    const tomorrowKst = new Date(nowKstTime + (24 * 60 * 60 * 1000));

    const getDateLabel = (dateStr: string) => {
      const d = new Date(dateStr);
      const kstTime = d.getTime() + (9 * 60 * 60 * 1000);
      const kstD = new Date(kstTime);
      const month = kstD.getUTCMonth() + 1;
      const date = kstD.getUTCDate();
      const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
      const day = dayNames[kstD.getUTCDay()];
      
      const label = `${month}월 ${date}일 (${day})`;
      
      const isToday = nowKst.getUTCFullYear() === kstD.getUTCFullYear() && 
                      nowKst.getUTCMonth() === kstD.getUTCMonth() && 
                      nowKst.getUTCDate() === kstD.getUTCDate();
                      
      if (isToday) return `${label} (오늘)`;
      
      const isTomorrow = tomorrowKst.getUTCFullYear() === kstD.getUTCFullYear() && 
                         tomorrowKst.getUTCMonth() === kstD.getUTCMonth() && 
                         tomorrowKst.getUTCDate() === kstD.getUTCDate();
                         
      if (isTomorrow) return `${label} (내일)`;
      
      return label;
    };

    sorted.forEach(match => {
      const label = getDateLabel(match.startTime);
      let group = groups.find(g => g.dateLabel === label);
      if (!group) {
        group = { dateLabel: label, matches: [] };
        groups.push(group);
      }
      group.matches.push(match);
    });

    return groups;
  }, [filteredMatches]);

  if (!mounted) return null;

  return (
    <div id="mobile-app-root" className="mobile-app-container">
      
      {/* 3-Row Sticky Top Wrapper: Bundles Header, Recommend Bar & Tabs securely */}
      <div className="sticky-top-wrapper">
        {/* Row 1: App Header */}
        <header className="app-header">
          <div className="header-logo" onClick={resetToHome}>
            ALPHA <span>SPORTS</span>
          </div>
          <div className="header-actions">
            <div 
              className={`bell-container ${activeTab === 'notifications' ? 'active' : ''}`}
              onClick={() => setActiveTab('notifications')}
            >
              <Bell size={22} className="bell-icon" />
              {notifications.length > 0 && <span className="bell-badge">{notifications.length}</span>}
            </div>
            <Search 
              size={22} 
              className={`search-icon ${isSearchOpen ? 'active' : ''}`} 
              onClick={() => {
                setIsSearchOpen(!isSearchOpen);
                if (isSearchOpen) setSearchQuery(''); // Clear query when closing
              }}
            />
          </div>
        </header>

        {/* Row 1.5: Expandable Real-time Search Overlay */}
        <AnimatePresence>
          {isSearchOpen && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="search-overlay-bar"
            >
              <div className="search-input-wrapper">
                <Search size={16} className="search-inner-icon" />
                <input 
                  type="text" 
                  placeholder="팀명 또는 리그명으로 전술 검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input-field"
                  autoFocus
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="search-clear-btn">
                    <X size={14} />
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Row 2: Today's Pick Bar */}
        <div className="recommend-bar">
          <span className="recommend-title">{formattedToday} 추천</span>
          <span 
            className={`recommend-action ${showOnlyValueBets ? 'filtering-active' : ''}`}
            onClick={() => {
              setShowOnlyValueBets(!showOnlyValueBets);
              setSelectedSport('all'); // Show all sports when analyzing recommendations
              setActiveTab('home');
            }}
          >
            {showOnlyValueBets ? '전체 보기' : `AI 추천 ${aiRecommendedCount}경기 ›`}
          </span>
        </div>

        {/* Row 3: Sport Navigation Tabs */}
        <nav className="sport-tabs-bar">
          {[
            { id: 'all', label: '전체', icon: null },
            { id: 'soccer', label: '축구', icon: '⚽' },
            { id: 'baseball', label: '야구', icon: '⚾' },
            { id: 'basketball', label: '농구', icon: '🏀' },
            { id: 'football', label: '미식', icon: '🏈' },
            { id: 'tennis', label: '테니스', icon: '🎾' }
          ].map(tab => (
            <button 
              key={tab.id}
              className={`sport-tab-btn ${selectedSport === tab.id && !showOnlyValueBets ? 'active' : ''}`}
              onClick={() => {
                setSelectedSport(tab.id);
                setShowOnlyValueBets(false); // Disable recommendation-only filter when clicking tab
                setActiveTab('home');
              }}
            >
              {tab.icon && <span className="sport-icon">{tab.icon}</span>}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Main Body - Viewport Area with Scroll (Strict Height Locked Scroll Area) */}
      <main className="app-body-content custom-scrollbar">
        {activeTab === 'home' && (
          <div className="home-view-wrapper">
            <div className="today-section-header">
              <span className="section-title">
                {showOnlyValueBets ? 'AI 추천 분석 매치' : searchQuery ? `'${searchQuery}' 검색 결과` : `7일간 일정`}
              </span>
              {(showOnlyValueBets || searchQuery) && (
                <span className="section-link reset" onClick={resetToHome}>필터 해제</span>
              )}
            </div>

            <div className="match-cards-list">
              {groupedMatches.length > 0 ? (
                groupedMatches.map(group => (
                  <div key={group.dateLabel} style={{ marginBottom: '24px' }}>
                    <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#00e5ff', padding: '10px 15px', borderBottom: '1px solid rgba(0, 229, 255, 0.2)', marginBottom: '12px' }}>
                      {group.dateLabel}
                    </div>
                    {group.matches.map(match => {
                      const isValue = match.kellyResult?.isValueBet;
                      const sportEmoji = match.sport === 'baseball' ? '⚾' : match.sport === 'basketball' ? '🏀' : '⚽';
                      const formattedTime = new Date(match.startTime).toLocaleTimeString('ko-KR', {
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true,
                        timeZone: 'Asia/Seoul'
                      });
                      return (
                        <div 
                          key={match.id}
                          className={`m-match-card ${selectedMatch.id === match.id ? 'selected' : ''} ${isValue ? 'bet-match' : 'skip-match'}`}
                          onClick={() => {
                            setSelectedMatch(match);
                            setResults([]);
                            setIsBetPlaced(false);
                            setBetPick(null);
                            setActiveTab('analysis');
                          }}
                        >
                          <div className="card-header-row">
                            <span className="league-name">{sportEmoji} {getLeagueNameKorean(match.league)}</span>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <button 
                                className="bookmark-btn" 
                                onClick={(e) => toggleBookmark(match, e)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                              >
                                <Heart size={18} color={bookmarkedIds.has(match.id) ? '#ff3d00' : '#666'} fill={bookmarkedIds.has(match.id) ? '#ff3d00' : 'none'} />
                              </button>
                              <div className={`decision-pill-badge ${isValue ? 'bet' : 'skip'}`}>
                                {'예측 모델 검증 대기'}

                              </div>
                            </div>
                          </div>

                          <div className="card-teams-row">
                            <span className="team-name">{match.teams.home}</span>
                            <span className="vs-divider">VS</span>
                            <span className="team-name">{match.teams.away}</span>
                          </div>

                          <div className="card-footer-row">
                            <span className="match-time-label">{formattedTime}</span>
                            <div className="match-odds-group">
                              {match.odds.win > 0 ? (
                                <>
                                  <span className={`odds-box ${isValue ? 'highlight' : ''}`}>승 {match.odds.win}</span>
                                  <span className="odds-box">무 {match.odds.draw}</span>
                                  <span className="odds-box">패 {match.odds.loss}</span>
                                </>
                              ) : (
                                <span className="odds-box" style={{ flex: 1, textAlign: 'center', background: 'rgba(255,255,255,0.03)', color: '#888' }}>배당 정보 없음</span>
                              )}
                            </div>
                            {match.kellyResult && match.odds.win > 0 && (
                              <div className="kelly-percent-badge">
                                {(match.kellyResult.fractionalKelly * 100).toFixed(1)}%
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))
              ) : (
                <div className="no-matches-screen">
                  <Flame size={40} className="no-match-glow-icon" />
                  <p className="no-match-primary">{loadingMatches ? '경기 데이터 조회 중' : dataError || '해당 기간 경기가 없습니다'}</p>
                  <span className="no-match-sub">경기 조회와 예측 분석의 제공 상태는 별도로 표시됩니다.</span>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'analysis' && (
          <div className="analysis-view-wrapper">
            <div className="details-card-container">
              <h2 className="analysis-teams-title">{selectedMatch.id ? `${selectedMatch.teams.home} vs ${selectedMatch.teams.away}` : '선택된 경기가 없습니다'}</h2>
              <div className="recommendation-banner skip">
                <div className="banner-title">예측 제공 준비 중</div>
                <p className="banner-desc">검증된 예측 모델이 연결되기 전까지 예상 스코어, 승률, 신뢰도 및 추천 금액을 제공하지 않습니다.</p>
              </div>
              {selectedMatch.id && (
                <div className="metric-box-card">
                  <p>경기 출처: {selectedMatch.dataSource || '미확인'}</p>
                  <p>경기 상태: {selectedMatch.fixtureStatus || '미확인'}</p>
                  <p>수집 시각: {selectedMatch.fetchedAt ? new Date(selectedMatch.fetchedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) : '미확인'} (한국시간)</p>
                  <p>배당 출처: {selectedMatch.bookmaker || '미수집'}</p>
                  <p>승 {formatOdds(selectedMatch.odds.win)} / 무 {formatOdds(selectedMatch.odds.draw)} / 패 {formatOdds(selectedMatch.odds.loss)}</p>
                  <p>해외 배당은 국내 구매 배당과 다를 수 있습니다.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'strategy' && (
          <div className="strategy-view-wrapper">
            <div className="slip-main-card">
              <h3>예측 모델 검증 대기</h3>
              <p>검증된 확률과 경기 전 기록이 준비될 때까지 추천 금액과 전표 접수 기능을 제공하지 않습니다.</p>
              <p>이 앱에서 실제 구매나 베팅은 실행되지 않습니다.</p>
            </div>
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="notifications-view-wrapper">
            <div className="notif-box-container">
              <div className="notif-header">
                <Bell size={20} color="#00e676" />
                <h3 className="notif-title">알림 내역</h3>
              </div>
              
              <div className="notif-list">
                {notifications.map(item => (
                  <div key={item.id} className="notif-item-card">
                    <div className="notif-badge-row">
                      <span className="notif-tag-pill">{item.tag}</span>
                      <span className="notif-time-label">{item.time}</span>
                    </div>
                    <h4 className="notif-card-title">{item.title}</h4>
                    <p className="notif-card-desc">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'chat' && (
          <div className="chat-view-wrapper">
            <div className="chat-empty-state">
              <Bot size={40} className="bot-icon" />
              <h3>분석 채팅 준비 중</h3>
              <p>검증된 경기 근거와 예측 모델이 연결된 뒤 제공됩니다. 현재는 홈에서 경기 정보와 배당 수집 상태를 확인해 주세요.</p>
            </div>
          </div>
        )}

        {activeTab === 'profile' && (() => {
          const thisMonthStr = new Date().toISOString().substring(0, 7);
          const thisMonthMatches = bookmarkedMatches.filter(b => b.bet_date && b.bet_date.startsWith(thisMonthStr) && typeof b.is_correct === 'boolean');
          const thisMonthHits = thisMonthMatches.filter(b => b.is_correct).length;
          const thisMonthRate = thisMonthMatches.length > 0 ? Math.round((thisMonthHits / thisMonthMatches.length) * 100) : 0;
          
          const totalResolved = bookmarkedMatches.filter(b => typeof b.is_correct === 'boolean').length;
          const totalHits = bookmarkedMatches.filter(b => b.is_correct).length;
          const totalRate = totalResolved > 0 ? Math.round((totalHits / totalResolved) * 100) : 0;

          return (
            <div className="profile-view-wrapper">
              <div className="profile-header" style={{ display: session ? 'flex' : 'none' }}>
                <User size={20} color="#00e676" />
                <h3>내 베팅 히스토리</h3>
              </div>

              <div className="profile-auth-section" style={{ display: session ? 'flex' : 'none' }}>
                {session && (
                  <div className="auth-user-box">
                    <div className="user-info">
                      <span className="user-nickname">
                        {profile?.nickname && !profile.nickname.startsWith('User_')
                          ? profile.nickname
                          : getNicknameFromEmail(session?.user?.email || profile?.email)}
                      </span>
                      <span className="user-email">{session.user.email}</span>
                      <span className={`user-grade ${profile?.grade === 'premium' ? 'premium' : ''}`}>
                        {profile?.grade === 'premium' ? '👑 Premium' : '⭐ 일반 회원'}
                      </span>
                    </div>
                    
                    <div className="profile-capital-setting">
                      <span className="label">기본 자본금 설정</span>
                      <div className="input-group">
                        <input type="number" value={capital} onChange={e => updateCapital(Math.max(0, parseInt(e.target.value) || 0))} />
                        <span>원</span>
                      </div>
                    </div>

                    <div className="user-actions">
                      <button className="auth-btn outline sm" onClick={handleLogout}>로그아웃</button>
                    </div>
                  </div>
                )}
              </div>
              
              {!session && (
                <div className="auth-full-container">
                  <div className="auth-full-header">
                    <Trophy size={48} color="#00e676" />
                    <h2 className="auth-logo-text">ALPHA SPORTS</h2>
                    <h3 className="auth-title">
                      {authMode === 'signup' ? '회원가입' : '로그인'}
                    </h3>
                    <p className="auth-subtitle">찜한 경기와 베팅 히스토리를 저장하세요</p>
                  </div>

                  <div className="auth-full-form">
                    <input 
                      type="email" 
                      placeholder="이메일 주소" 
                      value={email} 
                      onChange={e => setEmail(e.target.value)} 
                      onKeyDown={e => { if (e.key === 'Enter') handleEmailAuth(); }}
                    />
                    <input 
                      type="password" 
                      placeholder="비밀번호" 
                      value={password} 
                      onChange={e => setPassword(e.target.value)} 
                      onKeyDown={e => { if (e.key === 'Enter') handleEmailAuth(); }}
                    />
                    {authMode === 'signup' && (
                      <input 
                        type="password" 
                        placeholder="비밀번호 확인" 
                        value={confirmPassword} 
                        onChange={e => setConfirmPassword(e.target.value)} 
                        onKeyDown={e => { if (e.key === 'Enter') handleEmailAuth(); }}
                      />
                    )}
                    {authError && <p className="auth-error">{authError}</p>}
                    
                    <button className="auth-full-btn primary" onClick={handleEmailAuth}>
                      {authMode === 'signup' ? '회원가입' : '로그인'}
                    </button>

                    <div className="auth-divider">
                      <span>또는</span>
                    </div>

                    <button className="auth-full-btn google" onClick={handleGoogleLogin}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                      Google로 계속하기
                    </button>

                    <div
                      className="auth-footer-text"
                      onClick={toggleAuthMode}
                      onTouchEnd={(e) => { e.preventDefault(); toggleAuthMode(); }}
                      style={{ cursor: 'pointer' }}
                    >
                      {authMode === 'signup' ? (
                        <>이미 계정이 있으신가요? <span style={{ textDecoration: 'underline' }}>로그인</span></>
                      ) : (
                        <>계정이 없으신가요? <span style={{ textDecoration: 'underline' }}>회원가입</span></>
                      )}
                    </div>
                  </div>
                </div>
              )}
              
              <div className="history-list custom-scrollbar" style={{ display: session ? 'flex' : 'none' }}>
                {bookmarkedMatches.length === 0 ? (
                  <div className="history-empty-state">
                    <p>아직 찜한 경기가 없습니다.</p>
                  </div>
                ) : (
                  bookmarkedMatches.map(bm => (
                    <div key={bm.id} className="history-item-card">
                      <div className="history-date">{bm.bet_date}</div>
                      <div className="history-match">
                        <span className="history-league">{getLeagueNameKorean(bm.league)}</span>
                        <span>{bm.home_team} vs {bm.away_team}</span>
                      </div>
                      <div className="history-actions">
                        <button 
                          className={`result-btn hit ${bm.is_correct === true ? 'active' : ''}`}
                          onClick={() => updateBookmarkResult(bm.id, true)}
                        >
                          ✅ 적중
                        </button>
                        <button 
                          className={`result-btn miss ${bm.is_correct === false ? 'active' : ''}`}
                          onClick={() => updateBookmarkResult(bm.id, false)}
                        >
                          ❌ 꽝
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="history-stats" style={{ display: session ? 'grid' : 'none' }}>
                <div className="stat-box">
                  <span className="stat-label">총 찜</span>
                  <span className="stat-value">{bookmarkedMatches.length}</span>
                </div>
                <div className="stat-box">
                  <span className="stat-label">적중</span>
                  <span className="stat-value">{totalHits}</span>
                </div>
                <div className="stat-box">
                  <span className="stat-label">사용자 기록 적중률</span>
                  <span className="stat-value">{totalRate}%</span>
                </div>
                <div className="stat-box">
                  <span className="stat-label">이번달 사용자 기록</span>
                  <span className="stat-value">{thisMonthRate}%</span>
                </div>
              </div>
            </div>
          );
        })()}
      </main>

      {/* 5. Sticky Bottom Tabbar - Compact 60px height (Strictly Locked to Bottom) */}
      <footer className="app-bottom-tabbar">
        {[
          { id: 'home', label: '홈', icon: LayoutGrid },
          { id: 'analysis', label: '분석', icon: Cpu },
          { id: 'strategy', label: '베팅', icon: ExternalLink },
          { id: 'chat', label: '채팅', icon: MessageSquare },
          { id: 'profile', label: '내정보', icon: User }
        ].map(menu => {
          const Icon = menu.icon;
          const isActive = activeTab === menu.id;
          return (
            <button 
              key={menu.id}
              className={`tab-menu-item ${isActive ? 'active' : ''}`}
              onClick={() => {
                if (menu.id === 'strategy') {
                  window.open('https://www.betman.co.kr', '_blank');
                } else if (menu.id === 'home') {
                  resetToHome();
                } else {
                  setActiveTab(menu.id as any);
                }
              }}
            >
              <Icon size={20} className="tab-icon" />
              <span className="tab-label">{menu.label}</span>
            </button>
          );
        })}
      </footer>

      {/* Standard Vanilla CSS implementation scoped to JSX */}
      <style jsx>{`
        .mobile-app-container {
          background-color: #0a0a0a;
          color: #ffffff;
          max-width: 480px;
          margin: 0 auto;
          height: 100vh; /* Locked Viewport Height */
          overflow: hidden; /* Prevent Global Scrolling */
          display: flex;
          flex-direction: column;
          font-family: 'Inter', -apple-system, sans-serif;
          position: relative;
          box-shadow: 0 0 40px rgba(0,0,0,0.8);
        }

        /* 3-Row Sticky Header Container (Strictly Locked Top) */
        .sticky-top-wrapper {
          position: sticky;
          top: 0;
          z-index: 100;
          background-color: #0a0a0a;
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
          box-shadow: 0 4px 30px rgba(0, 0, 0, 0.5);
          display: flex;
          flex-direction: column;
          flex-shrink: 0; /* Never shrink the top header */
        }

        /* Header Styles */
        .app-header {
          height: 56px;
          padding: 0 1.25rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid rgba(255, 255, 255, 0.02);
        }
        .header-logo {
          font-size: 1.2rem;
          font-weight: 900;
          letter-spacing: -0.03em;
          color: #ffffff;
          cursor: pointer;
        }
        .header-logo span {
          color: #00e676;
        }
        .header-actions {
          display: flex;
          align-items: center;
          gap: 1.1rem;
          color: #ffffff;
        }
        .bell-container {
          position: relative;
          cursor: pointer;
          transition: transform 0.2s;
        }
        .bell-container.active {
          color: #00e676;
        }
        .bell-badge {
          position: absolute;
          top: -3px;
          right: -3px;
          width: 14px;
          height: 14px;
          background-color: #ff3d00;
          border-radius: 50%;
          color: #ffffff;
          font-size: 8px;
          font-weight: 900;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .search-icon {
          cursor: pointer;
          opacity: 0.8;
          transition: all 0.2s ease-in-out;
        }
        .search-icon.active {
          color: #00e676;
          opacity: 1;
        }
        .search-icon:hover {
          opacity: 1;
        }

        /* Search Overlay Bar */
        .search-overlay-bar {
          background-color: #0c0c0c;
          padding: 0.6rem 1.25rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.03);
          overflow: hidden;
        }
        .search-input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 0.8rem;
          padding: 0 0.75rem;
        }
        .search-inner-icon {
          color: #888888;
          flex-shrink: 0;
        }
        .search-input-field {
          flex: 1;
          background: transparent;
          border: none;
          padding: 0.5rem 0.5rem;
          color: #ffffff;
          font-size: 0.85rem;
          outline: none;
        }
        .search-input-field::placeholder {
          color: #555555;
        }
        .search-clear-btn {
          background: none;
          border: none;
          color: #888888;
          cursor: pointer;
          display: flex;
          align-items: center;
          padding: 0.2rem;
        }

        /* Today's Recommend Bar */
        .recommend-bar {
          padding: 0.7rem 1.25rem 0.4rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .recommend-title {
          font-size: 0.9rem;
          font-weight: 700;
          color: #888888;
        }
        .recommend-action {
          font-size: 0.85rem;
          font-weight: 700;
          color: #00e676;
          cursor: pointer;
          padding: 0.2rem 0.5rem;
          border-radius: 0.4rem;
          transition: all 0.2s;
        }
        .recommend-action.filtering-active {
          background: rgba(0, 230, 118, 0.12);
          border: 1px solid rgba(0, 230, 118, 0.25);
        }

        /* Sport Tabs Bar */
        .sport-tabs-bar {
          padding: 0.4rem 1.25rem 0.8rem;
          display: flex;
          gap: 0.5rem;
          overflow-x: auto;
          scrollbar-width: none;
        }
        .sport-tabs-bar::-webkit-scrollbar {
          display: none;
        }
        .sport-tab-btn {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.05);
          padding: 0.4rem 0.9rem;
          border-radius: 2rem;
          font-size: 0.8rem;
          font-weight: 600;
          color: #888888;
          white-space: nowrap;
          display: flex;
          align-items: center;
          gap: 0.25rem;
          cursor: pointer;
          transition: all 0.2s ease-in-out;
        }
        .sport-tab-btn:hover {
          background: rgba(255, 255, 255, 0.06);
          color: #ffffff;
        }
        .sport-tab-btn.active {
          background: rgba(0, 230, 118, 0.1);
          border-color: #00e676;
          color: #00e676;
          font-weight: 700;
        }
        .sport-icon {
          font-size: 0.9rem;
        }

        /* App Body Scroll Content (Strict Height Locked Scroll Area) */
        .app-body-content {
          flex: 1;
          overflow-y: auto; /* Only allow scrolling inside this specific block */
          display: flex;
          flex-direction: column;
        }

        /* Home View Styles */
        .home-view-wrapper {
          display: flex;
          flex-direction: column;
        }
        .today-section-header {
          padding: 0.8rem 1.25rem 0.6rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .today-section-header .section-title {
          font-size: 1.05rem;
          font-weight: 800;
          color: #ffffff;
        }
        .today-section-header .section-link {
          font-size: 0.8rem;
          font-weight: 700;
          color: #00e676;
          cursor: pointer;
        }
        .today-section-header .section-link.reset {
          background: rgba(255, 255, 255, 0.05);
          padding: 0.2rem 0.6rem;
          border-radius: 0.4rem;
          font-size: 0.75rem;
          color: #aaaaaa;
          border: 1px solid rgba(255,255,255,0.08);
        }
        .match-cards-list {
          padding: 0 1.25rem 2rem;
          display: flex;
          flex-direction: column;
          gap: 0.8rem;
        }
        
        /* Mobile Premium Card Item */
        .m-match-card {
          background: #141414;
          border-radius: 1rem;
          padding: 1.1rem 1.2rem;
          border: 1px solid rgba(255, 255, 255, 0.04);
          display: flex;
          flex-direction: column;
          gap: 0.8rem;
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .m-match-card:hover {
          background: #181818;
          transform: translateY(-2px);
        }
        .m-match-card.selected {
          border-color: #00e676;
          background: rgba(0, 230, 118, 0.02);
        }
        .m-match-card.bet-match {
          border: 1px solid rgba(0, 230, 118, 0.35);
          box-shadow: 0 4px 20px rgba(0, 230, 118, 0.03);
        }
        .m-match-card.skip-match {
          opacity: 0.4;
        }

        .card-header-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .league-name {
          font-size: 0.8rem;
          font-weight: 800;
          color: #888888;
        }
        .decision-pill-badge {
          font-size: 0.75rem;
          font-weight: 900;
          padding: 0.2rem 0.55rem;
          border-radius: 0.4rem;
          letter-spacing: -0.02em;
        }
        .decision-pill-badge.bet {
          background-color: #00e676;
          color: #000000;
        }
        .decision-pill-badge.skip {
          border: 1px solid rgba(239, 68, 68, 0.5);
          color: #ef4444;
          background: rgba(239, 68, 68, 0.04);
        }

        .card-teams-row {
          display: flex;
          align-items: center;
          gap: 0.8rem;
          font-size: 1.15rem;
          font-weight: 900;
          color: #ffffff;
        }
        .team-name {
          letter-spacing: -0.03em;
        }
        .vs-divider {
          font-size: 0.8rem;
          color: #555555;
          font-weight: normal;
        }

        .card-footer-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-top: 1px solid rgba(255, 255, 255, 0.03);
          padding-top: 0.7rem;
        }
        .match-time-label {
          font-size: 0.75rem;
          color: #888888;
          font-weight: 500;
        }
        .match-odds-group {
          display: flex;
          gap: 0.35rem;
        }
        .odds-box {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.04);
          padding: 0.25rem 0.5rem;
          border-radius: 0.35rem;
          font-size: 0.7rem;
          font-weight: 700;
          color: #777777;
        }
        .odds-box.highlight {
          background: rgba(0, 230, 118, 0.12);
          border-color: rgba(0, 230, 118, 0.25);
          color: #00e676;
        }
        .kelly-percent-badge {
          background: rgba(0, 230, 118, 0.12);
          border: 1px solid rgba(0, 230, 118, 0.2);
          color: #00e676;
          font-size: 0.75rem;
          font-weight: 900;
          padding: 0.25rem 0.55rem;
          border-radius: 0.35rem;
        }

        /* High Fidelity Empty Sport Page fallback */
        .no-matches-screen {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          gap: 1rem;
          padding: 6rem 2rem;
        }
        .no-match-glow-icon {
          color: rgba(0,230,118,0.2);
          filter: drop-shadow(0 0 15px rgba(0,230,118,0.15));
        }
        .no-match-primary {
          font-size: 1.1rem;
          font-weight: 900;
          color: #ffffff;
        }
        .no-match-sub {
          font-size: 0.8rem;
          color: #555555;
          line-height: 1.5;
          max-width: 250px;
        }

        /* Analysis View Styles */
        .analysis-view-wrapper {
          padding: 1.25rem;
        }
        .details-card-container {
          background: #141414;
          border: 1px solid rgba(255,255,255,0.04);
          border-radius: 1.2rem;
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
        .details-match-header {
          border-bottom: 1px solid rgba(255,255,255,0.03);
          padding-bottom: 1rem;
        }
        .analysis-brand-tag {
          font-size: 0.75rem;
          color: #00e676;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          display: block;
          margin-bottom: 0.4rem;
        }
        .analysis-teams-title {
          font-size: 1.4rem;
          font-weight: 900;
          color: #ffffff;
          line-height: 1.2;
        }
        .analysis-teams-title span {
          color: #555555;
          font-size: 1rem;
          font-weight: 500;
        }
        .recommendation-banner {
          border-radius: 0.8rem;
          padding: 1.1rem 1.25rem;
        }
        .recommendation-banner.bet {
          background: rgba(0, 230, 118, 0.08);
          border: 1px solid rgba(0, 230, 118, 0.25);
        }
        .recommendation-banner.skip {
          background: rgba(239, 68, 68, 0.05);
          border: 1px solid rgba(239, 68, 68, 0.25);
        }
        .banner-title {
          font-size: 1.05rem;
          font-weight: 900;
          margin-bottom: 0.4rem;
        }
        .recommendation-banner.bet .banner-title {
          color: #00e676;
        }
        .recommendation-banner.skip .banner-title {
          color: #ef4444;
        }
        .banner-desc {
          font-size: 0.8rem;
          line-height: 1.5;
          color: #aaaaaa;
          font-weight: 500;
        }

        /* Capital calculator */
        .capital-calculator-card {
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.04);
          border-radius: 0.8rem;
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 1.2rem;
        }
        .capital-input-field {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .capital-input-field .label {
          font-size: 0.85rem;
          font-weight: 700;
          color: #888888;
        }
        .input-group {
          display: flex;
          align-items: center;
          gap: 0.4rem;
        }
        .input-group input {
          background: #000000;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 0.6rem;
          padding: 0.4rem 0.8rem;
          color: #00e676;
          font-weight: 900;
          font-size: 1.1rem;
          width: 120px;
          text-align: right;
          outline: none;
        }
        .input-group input:focus {
          border-color: #00e676;
        }
        .input-group .unit {
          font-weight: bold;
          font-size: 0.85rem;
        }
        .recommended-stake-output {
          border-top: 1px solid rgba(255,255,255,0.03);
          padding-top: 1rem;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .output-label {
          font-size: 0.75rem;
          font-weight: 800;
          color: #666666;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .output-value {
          margin: 0.4rem 0;
          display: flex;
          align-items: baseline;
          gap: 0.2rem;
        }
        .output-value .amount {
          font-size: 2.2rem;
          font-weight: 900;
          color: #00e676;
          font-style: italic;
          text-shadow: 0 0 20px rgba(0, 230, 118, 0.2);
        }
        .output-value .amount-unit {
          font-size: 1.1rem;
          font-weight: bold;
          color: #00e676;
        }
        .fraction-label {
          font-size: 0.7rem;
          color: #555555;
          font-weight: 600;
        }
        
        .analysis-engine-btn {
          width: 100%;
          padding: 1rem;
          background: #00e676;
          color: #000000;
          border: none;
          border-radius: 0.8rem;
          font-weight: 900;
          font-size: 0.85rem;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          cursor: pointer;
          transition: all 0.2s ease-in-out;
        }
        .analysis-engine-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 15px rgba(0, 230, 118, 0.3);
        }
        .analysis-engine-btn.loading {
          background: rgba(255, 191, 0, 0.15);
          color: #ffbf00;
          border: 1px solid rgba(255, 191, 0, 0.3);
        }
        .spin-icon {
          animation: spin 1s linear infinite;
        }

        /* Accordion */
        .agents-report-accordion {
          border-top: 1px solid rgba(255,255,255,0.03);
          padding-top: 1rem;
        }
        .accordion-toggle-btn {
          width: 100%;
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.04);
          padding: 0.75rem;
          border-radius: 0.6rem;
          color: #888888;
          font-size: 0.8rem;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.2s;
        }
        .accordion-toggle-btn:hover {
          color: #ffffff;
          background: rgba(255,255,255,0.04);
        }
        .accordion-content-box {
          padding-top: 1.25rem;
        }
        .metrics-column-layout {
          display: flex;
          flex-direction: column;
          gap: 0.8rem;
        }
        .metric-box-card {
          background: rgba(255,255,255,0.01);
          border: 1px solid rgba(255,255,255,0.03);
          padding: 1rem;
          border-radius: 0.8rem;
        }
        .box-label {
          font-size: 0.75rem;
          color: #666666;
          font-weight: 700;
          display: block;
          margin-bottom: 0.25rem;
        }
        .box-value {
          font-size: 1.1rem;
          font-weight: 800;
          color: #ffffff;
        }
        .box-value.highlighted {
          color: #00e676;
          font-size: 1.4rem;
        }
        .box-value.font-neon {
          color: #00e676;
        }
        .metrics-header-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.4rem;
        }
        .progress-bar-track {
          width: 100%;
          height: 4px;
          background: rgba(255,255,255,0.04);
          border-radius: 2px;
        }
        .progress-bar-fill {
          height: 100%;
          background: #00e676;
          border-radius: 2px;
          box-shadow: 0 0 8px #00e676;
        }
        .insight-text-quote {
          font-size: 0.8rem;
          line-height: 1.5;
          color: #cccccc;
          font-style: italic;
        }
        .kelly-detail-metrics-row {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 0.6rem;
        }
        .small-metric-pill {
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.03);
          padding: 0.6rem;
          border-radius: 0.6rem;
          text-align: center;
        }
        .pill-label {
          font-size: 0.65rem;
          color: #555555;
          font-weight: 700;
          display: block;
          margin-bottom: 0.2rem;
        }
        .pill-value {
          font-size: 0.85rem;
          font-weight: 800;
          color: #ffffff;
        }
        .pill-value.text-blue {
          color: #00b0ff;
        }

        /* Strategy (Bet Slip) Styles */
        .strategy-view-wrapper {
          padding: 1.25rem;
        }
        .slip-main-card {
          background: #141414;
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 1.2rem;
          padding: 1.5rem;
        }
        .slip-card-header {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          margin-bottom: 1.5rem;
          border-bottom: 1px solid rgba(255,255,255,0.03);
          padding-bottom: 0.8rem;
        }
        .slip-title {
          font-size: 0.95rem;
          font-weight: 800;
          color: #ffffff;
        }
        .slip-data-body {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }
        .slip-match-info {
          display: flex;
          flex-direction: column;
          gap: 0.3rem;
        }
        .slip-match-info .label {
          font-size: 0.75rem;
          color: #666666;
          font-weight: 700;
        }
        .slip-match-info .value {
          font-size: 1.1rem;
          font-weight: 900;
          color: #ffffff;
        }
        .slip-pick-actions {
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
        }
        .pick-option-btn {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.9rem 1.1rem;
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.04);
          border-radius: 0.8rem;
          color: #ffffff;
          cursor: pointer;
          transition: all 0.2s;
        }
        .pick-option-btn:hover {
          background: rgba(255,255,255,0.04);
        }
        .pick-option-btn.selected {
          background: #00e676;
          border-color: #00e676;
          color: #000000;
        }
        .pick-option-btn.selected .pick-label,
        .pick-option-btn.selected .pick-odds {
          color: #000000;
          font-weight: 900;
        }
        .pick-label {
          font-size: 0.85rem;
          font-weight: 700;
          color: #dddddd;
        }
        .pick-odds {
          font-size: 0.85rem;
          font-weight: 800;
          color: #00e676;
        }
        .slip-earning-meta {
          display: flex;
          justify-content: space-between;
          border-top: 1px solid rgba(255,255,255,0.03);
          padding-top: 1rem;
          font-size: 0.85rem;
        }
        .meta-label {
          color: #888888;
          font-weight: 700;
        }
        .meta-value {
          color: #00e676;
          font-weight: 900;
        }
        .slip-submit-btn {
          width: 100%;
          padding: 1rem;
          background: rgba(255,255,255,0.05);
          color: #ffffff;
          border: none;
          border-radius: 0.8rem;
          font-weight: 900;
          font-size: 0.85rem;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          cursor: pointer;
          transition: all 0.2s;
        }
        .slip-submit-btn:not(:disabled) {
          background: #00e676;
          color: #000000;
        }
        .slip-submit-btn.success {
          background: rgba(0, 230, 118, 0.1);
          color: #00e676;
          border: 1px solid rgba(0, 230, 118, 0.2);
        }

        /* Notifications View Styles */
        .notifications-view-wrapper {
          padding: 1.25rem;
        }

        /* Chat View Styles */
        .chat-view-wrapper {
          display: flex;
          flex-direction: column;
          height: 100%;
          padding: 1rem;
        }
        .chat-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 1rem;
        }
        .chat-header h3 {
          margin: 0;
          font-size: 1.1rem;
        }
        .chat-history-container {
          flex: 1;
          overflow-y: auto;
          background: rgba(255, 255, 255, 0.02);
          border-radius: 0.5rem;
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .chat-empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: #888;
        }
        .bot-icon {
          color: #555;
          margin-bottom: 1rem;
        }
        .chat-suggestions {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          margin-top: 1.5rem;
          width: 100%;
        }
        .suggestion-btn {
          background: rgba(0, 230, 118, 0.1);
          border: 1px solid rgba(0, 230, 118, 0.3);
          color: #00e676;
          padding: 0.75rem;
          border-radius: 0.5rem;
          cursor: pointer;
          transition: all 0.2s;
        }
        .suggestion-btn:hover {
          background: rgba(0, 230, 118, 0.2);
        }
        .chat-message {
          display: flex;
          flex-direction: column;
        }
        .chat-message.user {
          align-items: flex-end;
        }
        .chat-message.assistant {
          align-items: flex-start;
        }
        .message-bubble {
          max-width: 85%;
          padding: 0.75rem 1rem;
          border-radius: 1rem;
          font-size: 0.95rem;
          line-height: 1.4;
          white-space: pre-wrap;
        }
        .chat-message.user .message-bubble {
          background: #00e676;
          color: #000;
          border-bottom-right-radius: 0.25rem;
        }
        .chat-message.assistant .message-bubble {
          background: rgba(255, 255, 255, 0.1);
          color: #fff;
          border-bottom-left-radius: 0.25rem;
        }
        .message-bubble.loading {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: #aaa;
        }
        .chat-input-area {
          display: flex;
          gap: 0.5rem;
          margin-top: 1rem;
        }
        .chat-input-area input {
          flex: 1;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          padding: 0.75rem 1rem;
          border-radius: 2rem;
          color: #fff;
          outline: none;
        }
        .chat-input-area input:focus {
          border-color: #00e676;
        }
        .chat-input-area button {
          background: #00e676;
          color: #000;
          border: none;
          width: 3rem;
          height: 3rem;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }
        .chat-input-area button:disabled {
          background: #333;
          color: #666;
          cursor: not-allowed;
        }
        .notif-box-container {
          background: #141414;
          border: 1px solid rgba(255,255,255,0.04);
          border-radius: 1.2rem;
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
        .notif-header {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          border-bottom: 1px solid rgba(255,255,255,0.03);
          padding-bottom: 0.8rem;
        }
        .notif-title {
          font-size: 1.05rem;
          font-weight: 900;
          color: #ffffff;
        }
        .notif-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .notif-item-card {
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.04);
          border-radius: 0.8rem;
          padding: 1.1rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          transition: all 0.2s;
        }
        .notif-item-card:hover {
          background: rgba(255,255,255,0.04);
        }
        .notif-badge-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .notif-tag-pill {
          font-size: 0.7rem;
          font-weight: 800;
          background: rgba(0, 230, 118, 0.12);
          color: #00e676;
          padding: 0.2rem 0.5rem;
          border-radius: 0.35rem;
        }
        .notif-time-label {
          font-size: 0.7rem;
          color: #555555;
          font-weight: 600;
        }
        .notif-card-title {
          font-size: 0.95rem;
          font-weight: 900;
          color: #ffffff;
        }
        .notif-card-desc {
          margin: 0;
          font-size: 0.85rem;
          color: #aaaaaa;
          line-height: 1.5;
        }

        /* Profile/History View Styles */
        .profile-view-wrapper {
          display: flex;
          flex-direction: column;
          height: 100%;
          padding: 1.25rem;
        }
        .profile-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 1rem;
        }
        .profile-header h3 {
          margin: 0;
          font-size: 1.1rem;
        }
        .history-list {
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        /* Profile Auth CSS */
        .profile-auth-section {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          margin-bottom: 1rem;
          background: rgba(255, 255, 255, 0.02);
          padding: 1rem;
          border-radius: 0.75rem;
          border: 1px solid rgba(255, 255, 255, 0.05);
        }
        
        /* New Full Auth Form CSS */
        .auth-full-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          padding: 24px;
          gap: 16px;
        }
        .auth-full-header {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 8px;
          margin-bottom: 8px;
        }
        .auth-full-header svg {
          width: 48px;
          height: 48px;
        }
        .auth-logo-text {
          font-size: 20px;
          font-weight: 700;
          color: #fff;
          margin: 0;
        }
        .auth-title {
          font-size: 24px;
          font-weight: 700;
          color: #fff;
          margin: 0;
        }
        .auth-subtitle {
          font-size: 14px;
          color: #aaa;
          margin: 0;
        }
        .auth-full-form {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .auth-full-form input {
          width: 100%;
          background: #1a1a1a;
          border: 1px solid #333;
          color: #fff;
          padding: 14px 16px;
          border-radius: 12px;
          outline: none;
          font-size: 16px;
          transition: border-color 0.2s;
        }
        .auth-full-form input:focus {
          border-color: #00e676;
        }
        .auth-full-btn {
          width: 100%;
          padding: 14px;
          border-radius: 12px;
          font-size: 16px;
          cursor: pointer;
          border: none;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .auth-full-btn.primary {
          background: #00e676;
          color: #000;
          font-weight: 700;
        }
        .auth-full-btn.google {
          background: transparent;
          border: 1px solid #333;
          color: #fff;
          font-weight: 400;
        }
        .auth-divider {
          display: flex;
          align-items: center;
          text-align: center;
          color: #555;
          margin: 4px 0;
        }
        .auth-divider::before,
        .auth-divider::after {
          content: '';
          flex: 1;
          border-bottom: 1px solid #333;
        }
        .auth-divider span {
          padding: 0 1rem;
          font-size: 14px;
        }
        .auth-footer-text {
          text-align: center;
          font-size: 14px;
          color: #aaa;
          margin-top: 8px;
          padding: 12px 8px;
          touch-action: manipulation;
        }
        .auth-footer-text span {
          color: #00e676;
          cursor: pointer;
          font-weight: bold;
          margin-left: 0.25rem;
        }
        .auth-error {
          color: #ff3d00;
          font-size: 0.8rem;
          margin: 0;
          text-align: center;
        }

        .auth-btn {
          padding: 0.6rem;
          border-radius: 0.5rem;
          font-size: 0.85rem;
          cursor: pointer;
          border: none;
          transition: all 0.2s;
        }
        .auth-btn.outline {
          background: transparent;
          border: 1px solid #00e676;
          color: #00e676;
        }
        .auth-btn.sm {
          padding: 0.4rem;
          font-size: 0.8rem;
        }
        .auth-user-box {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        .user-info {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }
        .user-nickname {
          font-size: 1.1rem;
          font-weight: bold;
          color: #fff;
        }
        .user-email {
          font-size: 0.85rem;
          color: #888;
        }
        .user-grade {
          font-size: 0.75rem;
          color: #ccc;
          margin-top: 0.25rem;
          display: inline-block;
          background: rgba(255,255,255,0.1);
          padding: 0.2rem 0.5rem;
          border-radius: 0.25rem;
          width: fit-content;
        }
        .user-grade.premium {
          background: rgba(0, 230, 118, 0.2);
          color: #00e676;
        }
        .profile-capital-setting {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: rgba(0,0,0,0.2);
          padding: 0.5rem 0.75rem;
          border-radius: 0.5rem;
        }
        .profile-capital-setting .label {
          font-size: 0.85rem;
          color: #aaa;
        }
        .profile-capital-setting .input-group {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .profile-capital-setting input {
          width: 80px;
          background: transparent;
          border: none;
          color: #00e676;
          font-weight: bold;
          font-size: 1rem;
          text-align: right;
          border-bottom: 1px solid #333;
        }
        .profile-capital-setting input:focus {
          outline: none;
          border-bottom-color: #00e676;
        }
          flex-direction: column;
          gap: 0.75rem;
        }
        .history-empty-state {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: #888;
        }
        .history-item-card {
          background: #141414;
          border: 1px solid rgba(255, 255, 255, 0.04);
          border-radius: 0.75rem;
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        .history-date {
          font-size: 0.8rem;
          color: #888;
        }
        .history-match {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          font-size: 0.95rem;
          font-weight: 600;
        }
        .history-league {
          font-size: 0.75rem;
          color: #00e676;
        }
        .history-actions {
          display: flex;
          gap: 0.5rem;
          margin-top: 0.25rem;
        }
        .result-btn {
          flex: 1;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #ccc;
          padding: 0.6rem;
          border-radius: 0.5rem;
          cursor: pointer;
          font-size: 0.85rem;
          transition: all 0.2s;
        }
        .result-btn.hit.active {
          background: rgba(0, 230, 118, 0.15);
          border-color: #00e676;
          color: #00e676;
        }
        .result-btn.miss.active {
          background: rgba(255, 61, 0, 0.15);
          border-color: #ff3d00;
          color: #ff3d00;
        }
        .history-stats {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.75rem;
          margin-top: 1rem;
          background: rgba(255,255,255,0.02);
          padding: 1rem;
          border-radius: 0.75rem;
        }
        .stat-box {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.25rem;
        }
        .stat-label {
          font-size: 0.75rem;
          color: #888;
        }
        .stat-value {
          font-size: 1.1rem;
          font-weight: 700;
          color: #00e676;
        }


        /* Dummy Tab View Styles */
        .dummy-tab-view-wrapper {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          gap: 0.75rem;
          padding: 6rem 2.5rem;
          color: #888888;
        }
        .dummy-tab-view-wrapper h3 {
          font-size: 1.1rem;
          font-weight: 800;
          color: #ffffff;
        }
        .dummy-tab-view-wrapper p {
          font-size: 0.8rem;
          line-height: 1.5;
          max-width: 260px;
        }

        /* Sticky Bottom Tabbar - Compact 60px */
        .app-bottom-tabbar {
          position: sticky;
          bottom: 0;
          left: 0;
          right: 0;
          height: 60px;
          background-color: rgba(10, 10, 10, 0.95);
          backdrop-filter: blur(10px);
          border-top: 1px solid rgba(255, 255, 255, 0.04);
          display: flex;
          justify-content: space-around;
          align-items: center;
          z-index: 100;
          flex-shrink: 0; /* Strictly protect tabbar from shrinking */
        }
        .tab-menu-item {
          background: none;
          border: none;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.2rem;
          cursor: pointer;
          color: #555555;
          transition: color 0.2s ease-in-out, transform 0.1s ease-in-out;
          flex: 1;
          height: 100%;
        }
        .tab-menu-item:active {
          transform: scale(0.95);
        }
        .tab-menu-item.active {
          color: #00e676;
        }
        .tab-icon {
          opacity: 0.8;
        }
        .tab-menu-item.active .tab-icon {
          opacity: 1;
          filter: drop-shadow(0 0 5px rgba(0, 230, 118, 0.4));
        }
        .tab-label {
          font-size: 0.65rem;
          font-weight: bold;
        }

        .custom-scrollbar::-webkit-scrollbar {
          width: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.1);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 1.5px;
        }
      `}</style>
    </div>
  );
};
