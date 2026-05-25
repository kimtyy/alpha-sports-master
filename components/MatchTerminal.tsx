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
import { MOCK_MATCHES } from '@/lib/data/matches';
import { calcKelly, KellyResult } from '@/lib/kelly';

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

const getInitialProbability = (matchId: string): number => {
  switch (matchId) {
    case 'm1': return 0.72; // MAN CITY vs ARSENAL -> Value Bet (Theo 30.0%)
    case 'm2': return 0.45; // REAL MADRID vs BARCELONA
    case 'm3': return 0.35; // FC SEOUL vs ULSAN HD
    case 'm4': return 0.85; // BAYERN MUNICH vs LEVERKUSEN -> Value Bet (Theo 76.5%)
    case 'm5': return 0.28; // JEJU UTD vs DAEGU FC
    case 'm6': return 0.62; // DOOSAN vs LG
    case 'm7': return 0.78; // DODGERS vs GIANTS -> Value Bet (Theo 42.6%)
    case 'm8': return 0.58; // LAKERS vs WARRIORS
    default: return 0.50;
  }
};

const enrichMatches = (data: BaseMatchData[]): MatchData[] => {
  return data.map(m => {
    const prob = getInitialProbability(m.id);
    const kelly = calcKelly(prob, m.odds.win);
    const sport = (m as any).sport || getMatchSport(m.id);
    return { ...m, kellyResult: kelly, sport };
  }).sort((a, b) => {
    const aVal = a.kellyResult?.isValueBet ? 1 : 0;
    const bVal = b.kellyResult?.isValueBet ? 1 : 0;
    return bVal - aVal;
  });
};

export const MatchTerminal: React.FC = () => {
  const [mounted, setMounted] = useState(false);
  const [isInferring, setIsInferring] = useState(false);
  const [results, setResults] = useState<AgentResult[]>([]);
  const [matches, setMatches] = useState<MatchData[]>(enrichMatches(MOCK_MATCHES));
  const [selectedMatch, setSelectedMatch] = useState<MatchData>(enrichMatches(MOCK_MATCHES)[0]);
  const [betPick, setBetPick] = useState<'WIN' | 'DRAW' | 'LOSS' | null>(null);
  const [isBetPlaced, setIsBetPlaced] = useState(false);
  
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
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'none'>('none');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      if (data) {
        setProfile(data);
        setCapital(Number(data.capital));
      } else {
        const newProfile = { id: user.id, email: user.email, nickname: 'User_' + Math.random().toString(36).substring(2,6), capital: 1000000, grade: 'free' };
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
    if (authMode === 'signup') {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setAuthError(error.message);
      else {
        alert('회원가입이 완료되었습니다. 로그인해주세요.');
        setAuthMode('login');
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setAuthError(error.message);
      else setAuthMode('none');
    }
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
      
      const newBookmark = {
        device_id: deviceId,
        match_id: match.id,
        home_team: match.teams.home,
        away_team: match.teams.away,
        league: match.league,
        predicted_score: match.previewScore || '',
        kelly_percent: match.kellyResult?.fractionalKelly || 0,
        is_value_bet: !!match.kellyResult?.isValueBet,
        bet_date: new Date().toISOString().split('T')[0]
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
    const timeString = now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

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
        const res = await fetch('/api/matches');
        const json = await res.json();
        if (json.success && json.data && json.data.length > 0) {
          const enriched = enrichMatches(json.data);
          setMatches(enriched);
          setSelectedMatch(enriched[0]);
        }
      } catch (error) {
        console.error('라이브 경기 데이터를 불러오는데 실패하여 폴백 데이터를 유지합니다:', error);
      }
    };
    loadMatches();
  }, []);

  const consensus = useMemo(() => {
    if (results.length === 0) return null;
    const finalBoss = results.find(r => r.agentId === 'alpha_consensus');
    return finalBoss || (results.length > 0 ? results[0] : null);
  }, [results]);

  const activeKelly = useMemo(() => {
    if (consensus && consensus.kellyResult) {
      return consensus.kellyResult;
    }
    return selectedMatch.kellyResult;
  }, [consensus, selectedMatch]);

  const handleExecute = async () => {
    setIsInferring(true);
    setResults([]);
    try {
      const res = await fetch('/api/infer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ match: selectedMatch })
      });
      const json = await res.json();
      if (json.success) {
        setResults(json.data);
      } else {
        throw new Error(json.error);
      }
    } catch (error) {
       await new Promise(r => setTimeout(r, 1500));
       const demoOdds = selectedMatch.odds.win;
       const demoKelly = calcKelly(0.89, demoOdds);
       const demoResults: AgentResult[] = [
         {
           agentId: 'alpha_consensus',
           name: '알파 컨센서스',
           role: '최종 전략 결정론자',
           confidence: 0.89,
           sentiment: 'favorable',
           findings: [
             "최근 5경기 xG 데이터 분석 결과 1.82 득점 기대치 확보.",
             "해외 주요 오즈메이커들의 배당이 홈팀 우세 방향으로 12% 하락 조정됨.",
             "상대팀 수비 핵심 부재에 따른 오버 스코어 공략 추천."
           ],
           predictedScore: selectedMatch.previewScore || "2:1",
           kellyResult: demoKelly
         }
       ];
       setResults(demoResults);
    } finally {
      setIsInferring(false);
    }
  };

  const handlePlaceBet = () => {
    if (!betPick) return;
    setIsBetPlaced(true);
  };

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
          <span className="recommend-title">오늘의 추천</span>
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
                {showOnlyValueBets ? 'AI 추천 분석 매치' : searchQuery ? `'${searchQuery}' 검색 결과` : '오늘 경기'}
              </span>
              {(showOnlyValueBets || searchQuery) && (
                <span className="section-link reset" onClick={resetToHome}>필터 해제</span>
              )}
            </div>

            <div className="match-cards-list">
              {filteredMatches.length > 0 ? (
                filteredMatches.map(match => {
                  const isValue = match.kellyResult?.isValueBet;
                  const sportEmoji = match.sport === 'baseball' ? '⚾' : match.sport === 'basketball' ? '🏀' : '⚽';
                  const formattedTime = new Date(match.startTime).toLocaleTimeString('ko-KR', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
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
                            {isValue ? 'BET ✓' : 'SKIP'}
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
                          <span className={`odds-box ${isValue ? 'highlight' : ''}`}>승 {match.odds.win}</span>
                          <span className="odds-box">무 {match.odds.draw}</span>
                          <span className="odds-box">패 {match.odds.loss}</span>
                        </div>
                        {match.kellyResult && (
                          <div className="kelly-percent-badge">
                            {(match.kellyResult.fractionalKelly * 100).toFixed(1)}%
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="no-matches-screen">
                  <Flame size={40} className="no-match-glow-icon" />
                  <p className="no-match-primary">오늘 해당 종목 경기가 없습니다</p>
                  <span className="no-match-sub">AI 핵심 인텔리전스 시스템이 다음 전술 매치업을 수집 중입니다.</span>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'analysis' && (
          <div className="analysis-view-wrapper">
            <div className="details-card-container">
              <div className="details-match-header">
                <span className="analysis-brand-tag">전략 전술 분석</span>
                <h2 className="analysis-teams-title">
                  {selectedMatch.teams.home} <span>VS</span> {selectedMatch.teams.away}
                </h2>
              </div>

              {activeKelly && (
                <div className={`recommendation-banner ${activeKelly.isValueBet ? 'bet' : 'skip'}`}>
                  <div className="banner-title">
                    {activeKelly.isValueBet ? '베팅 추천' : '패스 추천'}
                  </div>
                  <div className="banner-desc">
                    {consensus ? (
                      consensus.findings[0]
                    ) : (
                      activeKelly.isValueBet 
                        ? "최근 통계 기대 우위가 해외 기준배당을 초과하여 켈리 공식상 높은 에지가 형성되었습니다."
                        : "기대 배당 확률 대비 기대 가치가 낮게 관측되어 리스크 관리를 위해 스킵을 권고합니다."
                    )}
                  </div>
                </div>
              )}

              {/* Capital Stake Calculator */}
              {activeKelly && (
                <div className="capital-calculator-card">
                  <div className="capital-input-field">
                    <span className="label">보유 자본금</span>
                    <div className="input-group">
                      <input 
                        type="number"
                        value={capital}
                        onChange={(e) => updateCapital(Math.max(0, parseInt(e.target.value) || 0))}
                      />
                      <span className="unit">원</span>
                    </div>
                  </div>

                  <div className="recommended-stake-output">
                    <span className="output-label">추천 베팅액</span>
                    <div className="output-value">
                      <span className="amount">
                        {activeKelly.isValueBet ? (capital * activeKelly.fractionalKelly).toLocaleString([], { maximumFractionDigits: 0 }) : '0'}
                      </span>
                      <span className="amount-unit">원</span>
                    </div>
                    <span className="fraction-label">
                      (보수적 쿼터 켈리 비율 {(activeKelly.fractionalKelly * 100).toFixed(2)}% 적용액)
                    </span>
                  </div>
                </div>
              )}

              {/* Inference Engine Action Button */}
              <button 
                className={`analysis-engine-btn ${isInferring ? 'loading' : ''}`}
                onClick={handleExecute}
                disabled={isInferring}
              >
                {isInferring ? <Loader2 size={18} className="spin-icon" /> : <Zap size={18} fill="currentColor" />}
                <span>{isInferring ? "실시간 분석 분석 도출 중..." : "AI 실시간 전술 분석 기동"}</span>
              </button>

              {/* Details Agent Accordion */}
              {(results.length > 0 || activeKelly) && (
                <div className="agents-report-accordion">
                  <button 
                    onClick={() => setIsDetailsOpen(!isDetailsOpen)}
                    className="accordion-toggle-btn"
                  >
                    <span>{isDetailsOpen ? '상세 리포트 및 지표 숨기기 ▲' : '상세 리포트 및 지표 더보기 ▼'}</span>
                  </button>

                  <AnimatePresence>
                    {isDetailsOpen && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="accordion-content-box"
                      >
                        <div className="metrics-column-layout">
                          <div className="metric-box-card">
                            <span className="box-label">예측 스코어</span>
                            <span className="box-value highlighted">
                              {consensus ? (consensus.predictedScore || selectedMatch.previewScore) : selectedMatch.previewScore}
                            </span>
                          </div>

                          <div className="metric-box-card">
                            <div className="metrics-header-row">
                              <span className="box-label">종합 신뢰도</span>
                              <span className="box-value font-neon">
                                {((consensus ? consensus.confidence : 0.85) * 100).toFixed(1)}%
                              </span>
                            </div>
                            <div className="progress-bar-track">
                              <div 
                                className="progress-bar-fill" 
                                style={{ width: `${(consensus ? consensus.confidence : 0.85) * 100}%` }} 
                              />
                            </div>
                          </div>

                          <div className="metric-box-card">
                            <span className="box-label">핵심 인사이트</span>
                            <p className="insight-text-quote">
                              "{consensus ? consensus.findings[1] : '공수 밸런스 및 xG 시뮬레이션 지수가 우세하여 포트폴리오 편입에 적합합니다.'}"
                            </p>
                          </div>

                          {activeKelly && (
                            <div className="kelly-detail-metrics-row">
                              <div className="small-metric-pill">
                                <span className="pill-label">이론 켈리</span>
                                <span className="pill-value">{(activeKelly.kellyFraction * 100).toFixed(1)}%</span>
                              </div>
                              <div className="small-metric-pill">
                                <span className="pill-label">에지 비율</span>
                                <span className="pill-value text-blue">{(activeKelly.edge * 100).toFixed(1)}%</span>
                              </div>
                              <div className="small-metric-pill">
                                <span className="pill-label">북메이커 확률</span>
                                <span className="pill-value">{(activeKelly.impliedProb * 100).toFixed(1)}%</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'strategy' && (
          <div className="strategy-view-wrapper">
            <div className="slip-main-card">
              <div className="slip-card-header">
                <Wallet size={20} color="#ffbf00" />
                <span className="slip-title">베팅 전략 전표</span>
              </div>

              <div className="slip-data-body">
                <div className="slip-match-info">
                  <span className="label">타겟 경기</span>
                  <span className="value">{selectedMatch.teams.home} vs {selectedMatch.teams.away}</span>
                </div>

                <div className="slip-pick-actions">
                  {['WIN', 'DRAW', 'LOSS'].map(type => (
                    <button 
                      key={type}
                      className={`pick-option-btn ${betPick === type ? 'selected' : ''}`}
                      onClick={() => { setBetPick(type as any); setIsBetPlaced(false); }}
                    >
                      <span className="pick-label">{type === 'WIN' ? '승' : type === 'DRAW' ? '무' : '패'}</span>
                      <span className="pick-odds">x{type === 'WIN' ? selectedMatch.odds.win : type === 'DRAW' ? selectedMatch.odds.draw : selectedMatch.odds.loss}</span>
                    </button>
                  ))}
                </div>

                <div className="slip-earning-meta">
                  <span className="meta-label">예상 배당률</span>
                  <span className="meta-value">
                    {betPick ? `${(betPick === 'WIN' ? selectedMatch.odds.win : betPick === 'DRAW' ? selectedMatch.odds.draw : selectedMatch.odds.loss).toFixed(2)}배` : '-'}
                  </span>
                </div>

                <button 
                  className={`slip-submit-btn ${isBetPlaced ? 'success' : ''}`}
                  onClick={handlePlaceBet}
                  disabled={!betPick || isBetPlaced}
                >
                  {isBetPlaced ? <CheckCircle2 size={20} /> : <Fingerprint size={20} />}
                  <span>{isBetPlaced ? "전략 전표 접수 완료" : "베팅 전표 서명 및 승인"}</span>
                </button>
              </div>
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
            <div className="chat-header">
              <MessageSquare size={20} color="#00e676" />
              <h3>AI 스포츠 분석 어시스턴트</h3>
            </div>
            
            <div className="chat-history-container custom-scrollbar">
              {chatHistory.length === 0 ? (
                <div className="chat-empty-state">
                  <Bot size={40} className="bot-icon" />
                  <p>궁금한 점을 물어보세요!</p>
                  <div className="chat-suggestions">
                    {["오늘 추천 경기는?", "켈리 비율이 뭔가요?", "월드컵 일정 알려줘"].map(q => (
                      <button key={q} onClick={() => handleSendChat(q)} className="suggestion-btn">
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                chatHistory.map((msg, i) => (
                  <div key={i} className={`chat-message ${msg.role}`}>
                    <div className="message-bubble">{msg.content}</div>
                  </div>
                ))
              )}
              {isChatLoading && (
                <div className="chat-message assistant">
                  <div className="message-bubble loading"><Loader2 size={16} className="spin-icon" /> 답변 작성 중...</div>
                </div>
              )}
            </div>

            <div className="chat-input-area">
              <input 
                type="text" 
                value={chatInput} 
                onChange={e => setChatInput(e.target.value)} 
                onKeyDown={e => {
                  if (e.key === 'Enter') handleSendChat(chatInput);
                }}
                placeholder="질문을 입력하세요..." 
                disabled={isChatLoading}
              />
              <button onClick={() => handleSendChat(chatInput)} disabled={isChatLoading || !chatInput.trim()}>
                <Send size={18} />
              </button>
            </div>
          </div>
        )}

        {activeTab === 'profile' && (() => {
          const thisMonthStr = new Date().toISOString().substring(0, 7);
          const thisMonthMatches = bookmarkedMatches.filter(b => b.bet_date && b.bet_date.startsWith(thisMonthStr) && b.is_correct !== null);
          const thisMonthHits = thisMonthMatches.filter(b => b.is_correct).length;
          const thisMonthRate = thisMonthMatches.length > 0 ? Math.round((thisMonthHits / thisMonthMatches.length) * 100) : 0;
          
          const totalResolved = bookmarkedMatches.filter(b => b.is_correct !== null).length;
          const totalHits = bookmarkedMatches.filter(b => b.is_correct).length;
          const totalRate = totalResolved > 0 ? Math.round((totalHits / totalResolved) * 100) : 0;

          return (
            <div className="profile-view-wrapper">
              <div className="profile-header">
                <User size={20} color="#00e676" />
                <h3>내 베팅 히스토리</h3>
              </div>

              <div className="profile-auth-section">
                {!session ? (
                  <div className="auth-guest-box">
                    <p className="auth-desc">로그인하고 기기 간 찜 내역을 동기화하세요!</p>
                    {authMode === 'none' ? (
                      <div className="auth-buttons">
                        <button className="auth-btn outline" onClick={() => setAuthMode('login')}>이메일 로그인</button>
                        <button className="auth-btn google" onClick={handleGoogleLogin}>Google 로그인</button>
                      </div>
                    ) : (
                      <div className="auth-form">
                        <input type="email" placeholder="이메일" value={email} onChange={e => setEmail(e.target.value)} />
                        <input type="password" placeholder="비밀번호" value={password} onChange={e => setPassword(e.target.value)} />
                        {authError && <p className="auth-error">{authError}</p>}
                        <div className="auth-buttons">
                          <button className="auth-btn primary" onClick={handleEmailAuth}>
                            {authMode === 'login' ? '로그인' : '회원가입'}
                          </button>
                          <button className="auth-btn text" onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}>
                            {authMode === 'login' ? '회원가입 하기' : '로그인으로 돌아가기'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="auth-user-box">
                    <div className="user-info">
                      <span className="user-nickname">{profile?.nickname || '사용자'}</span>
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
              
              <div className="history-list custom-scrollbar">
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

              <div className="history-stats">
                <div className="stat-box">
                  <span className="stat-label">총 찜</span>
                  <span className="stat-value">{bookmarkedMatches.length}</span>
                </div>
                <div className="stat-box">
                  <span className="stat-label">적중</span>
                  <span className="stat-value">{totalHits}</span>
                </div>
                <div className="stat-box">
                  <span className="stat-label">전체 적중률</span>
                  <span className="stat-value">{totalRate}%</span>
                </div>
                <div className="stat-box">
                  <span className="stat-label">이번달 적중률</span>
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
        .auth-guest-box {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          align-items: center;
        }
        .auth-desc {
          font-size: 0.85rem;
          color: #888;
        }
        .auth-buttons {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          width: 100%;
        }
        .auth-btn {
          flex: 1;
          padding: 0.6rem;
          border-radius: 0.5rem;
          font-size: 0.85rem;
          cursor: pointer;
          border: none;
          transition: all 0.2s;
        }
        .auth-btn.primary {
          background: #00e676;
          color: #000;
          font-weight: bold;
        }
        .auth-btn.outline {
          background: transparent;
          border: 1px solid #00e676;
          color: #00e676;
        }
        .auth-btn.google {
          background: transparent;
          border: 1px solid #fff;
          color: #fff;
          font-weight: bold;
        }
        .auth-btn.text {
          background: transparent;
          color: #888;
        }
        .auth-btn.sm {
          padding: 0.4rem;
          font-size: 0.8rem;
        }
        .auth-form {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          width: 100%;
        }
        .auth-form input {
          background: rgba(0,0,0,0.3);
          border: 1px solid #333;
          color: #fff;
          padding: 0.6rem;
          border-radius: 0.5rem;
        }
        .auth-error {
          color: #ff3d00;
          font-size: 0.75rem;
          margin: 0;
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
