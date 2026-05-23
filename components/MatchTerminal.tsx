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
  CalendarDays, Flame
} from 'lucide-react';
import { AgentResult, MatchData as BaseMatchData } from '@/lib/agents/orchestrator';
import { MOCK_MATCHES } from '@/lib/data/matches';
import { calcKelly, KellyResult } from '@/lib/kelly';

export interface MatchData extends BaseMatchData {
  kellyResult?: KellyResult;
}

const getInitialProbability = (matchId: string): number => {
  switch (matchId) {
    case 'm1': return 0.72; // MAN CITY vs ARSENAL -> Value Bet (Theo 30.0%)
    case 'm2': return 0.45; // REAL MADRID vs BARCELONA
    case 'm3': return 0.35; // FC SEOUL vs ULSAN HD
    case 'm4': return 0.85; // BAYERN MUNICH vs LEVERKUSEN -> Value Bet (Theo 76.5%)
    case 'm5': return 0.28; // JEJU UTD vs DAEGU FC
    default: return 0.50;
  }
};

const enrichMatches = (data: BaseMatchData[]): MatchData[] => {
  return data.map(m => {
    const prob = getInitialProbability(m.id);
    const kelly = calcKelly(prob, m.odds.win);
    return { ...m, kellyResult: kelly };
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
  const [activeTab, setActiveTab] = useState<'matches' | 'analysis' | 'strategy'>('matches');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingMatches, setIsLoadingMatches] = useState(false);
  
  // Decision-Centric States
  const [capital, setCapital] = useState<number>(1000000); // Default capital: 1,000,000 KRW
  const [isDetailsOpen, setIsDetailsOpen] = useState<boolean>(false); // Folding agents details

  useEffect(() => {
    setMounted(true);
    const loadMatches = async () => {
      try {
        setIsLoadingMatches(true);
        const res = await fetch('/api/matches');
        const json = await res.json();
        if (json.success && json.data && json.data.length > 0) {
          const enriched = enrichMatches(json.data);
          setMatches(enriched);
          setSelectedMatch(enriched[0]);
        }
      } catch (error) {
        console.error('Failed to load live matches, using fallbacks:', error);
      } finally {
        setIsLoadingMatches(false);
      }
    };
    loadMatches();
  }, []);

  const sysStatus = {
    version: "v2.0.0-PRO",
    network: "Alpha Int. Network",
    sync: "LIVE",
    uptime: "100%"
  };

  const filteredMatches = useMemo(() => {
    return matches.filter(m => 
      m.teams.home.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.teams.away.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.league.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [matches, searchQuery]);

  // Grouping logic for the dashboard
  const groupedMatches = useMemo(() => {
    const groups: { [key: string]: MatchData[] } = {};
    filteredMatches.forEach(match => {
      const dateKey = new Date(match.startTime).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(match);
    });
    return groups;
  }, [filteredMatches]);

  const featuredMatch = useMemo(() => {
    return matches.find(m => m.isFeatured) || matches[0];
  }, [matches]);

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
       await new Promise(r => setTimeout(r, 2000));
       const demoOdds = selectedMatch.odds.win; // Default win odds for demo
       const demoKelly = calcKelly(0.89, demoOdds);
       const demoResults: AgentResult[] = [
         {
           agentId: 'alpha_consensus',
           name: '알파 컨센서스',
           role: '최종 전략 결정론자',
           confidence: 0.89,
           sentiment: 'favorable',
           findings: [
             "통계적 우위: 최근 5경기 xG 데이터 분석 결과 1.82 득점 기대치 확보.",
             "배당 흐름: 해외 주요 오즈메이커들의 배당이 홈팀 우세 방향으로 12% 하락.",
             "전술적 포인트: 상대팀 수비 핵심 부재에 따른 오버 스코어 공략 추천."
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

  if (!mounted) return null;

  return (
    <div id="terminal-root" className="terminal-container">
      {/* 0. External Gateway */}
      <div className="gateway-banner">
         <div className="gateway-glow" />
         <a 
           href="https://www.sportstoto.co.kr/" 
           target="_blank" 
           rel="noopener noreferrer"
           className="gateway-content"
         >
           <div className="gateway-status">
              <div className="pulse-dot" />
              <div className="gateway-info">
                 <span className="gateway-label">게이트웨이 활성화 // Gateway Active</span>
                 <span className="gateway-desc">공식 스포츠토토 포트 // Official Sports Toto Port</span>
              </div>
           </div>
           <div className="gateway-button">
              연결 // Connect <MousePointer2 size={12} />
           </div>
         </a>
      </div>

      {/* 1. Header - Updated Branding */}
      <header className="terminal-header">
         <div className="header-brand">
            <div className="brand-logo">
               <Trophy size={40} color="#00e676" />
            </div>
            <div>
               <h1 className="brand-name">Alpha <span>Sports Master</span></h1>
               <p className="brand-tagline">지능형 전술 운영 체제 // Intelligence OS</p>
            </div>
         </div>
         <div className="sys-stats lg-only">
            <div className="stat-pill">
               <div className="status-dot" />
               <span>정상 작동 중 // Operational</span>
            </div>
            <div className="stat-data">
               <span>Ver: {sysStatus.version}</span>
            </div>
         </div>
      </header>

      <main className="terminal-main">
         {/* PANEL A: DASHBOARD VIEW (Formerly Target Selection) */}
         <aside className={`panel-a ${activeTab === 'matches' ? 'active' : ''}`}>
            {/* Spotlight Section */}
            <section className="spotlight-section">
               <div className="section-title">
                  <Flame size={16} color="#ff3d00" />
                  <span>이주의 추천 경기 // Weekly Spotlight</span>
               </div>
               <div 
                 className="spotlight-card"
                 onClick={() => {
                   setSelectedMatch(featuredMatch);
                   setActiveTab('analysis');
                 }}
               >
                  <div className="spotlight-bg" />
                  <div className="spotlight-info">
                     <span className="league-pill">{featuredMatch.league}</span>
                     <div className="spotlight-teams">
                        <span>{featuredMatch.teams.home}</span>
                        <span className="vs-min">VS</span>
                        <span>{featuredMatch.teams.away}</span>
                     </div>
                     <div className="spotlight-footer">
                        <span className="time"><Clock size={12} /> {new Date(featuredMatch.startTime).toLocaleString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 시작</span>
                        <span className="prediction-pill">AI 예측: {featuredMatch.previewScore}</span>
                     </div>
                  </div>
               </div>
            </section>

            <div className="section-title" style={{ marginTop: '2.5rem' }}>
               <CalendarDays size={16} opacity={0.5} />
               <span>오늘의 경기 리스트 // Daily Fixtures</span>
            </div>

            <div className="search-box">
               <Search size={16} className="search-icon" />
               <input 
                 type="text" 
                 placeholder="리그, 팀 전술 검색..." 
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
               />
            </div>

            <div className="grouped-match-list custom-scrollbar">
               {Object.entries(groupedMatches).map(([date, matches]) => (
                 <div key={date} className="date-group">
                    <div className="date-header">{date === new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' }) ? "오늘 // Today" : date}</div>
                    <div className="match-grid">
                       {matches.map(match => {
                          const isValue = match.kellyResult?.isValueBet;
                          return (
                            <div 
                              key={match.id} 
                              className={`h-match-card ${selectedMatch.id === match.id ? 'selected' : ''} ${isValue ? 'value-match' : 'no-value-match'}`}
                              style={{
                                opacity: isValue ? 1 : 0.35,
                                border: isValue ? '2px solid #00e676' : '1px solid rgba(255,255,255,0.05)',
                                boxShadow: isValue ? '0 0 15px rgba(0, 230, 118, 0.15)' : 'none',
                                transition: 'all 0.3s ease'
                              }}
                              onClick={() => {
                                setSelectedMatch(match);
                                setResults([]);
                                setIsBetPlaced(false);
                                setBetPick(null);
                                if (window.innerWidth < 1280) setActiveTab('analysis');
                              }}
                            >
                               <div className="team home">
                                  <div className="team-avatar">{match.teams.home[0]}</div>
                                  <span>{match.teams.home}</span>
                               </div>
                               
                               <div className="match-mid" style={{ position: 'relative' }}>
                                  <div className="mid-time">{new Date(match.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                  <div className="predicted-score">{match.previewScore}</div>
                                  
                                  {/* Large BET / SKIP Decision Badge */}
                                  <div className={`decision-badge ${isValue ? 'bet' : 'skip'}`} style={{
                                    fontSize: '0.65rem',
                                    fontWeight: 900,
                                    padding: '0.3rem 0.6rem',
                                    borderRadius: '0.5rem',
                                    marginTop: '0.3rem',
                                    display: 'inline-block',
                                    backgroundColor: isValue ? 'rgba(0, 230, 118, 0.2)' : 'rgba(239, 68, 68, 0.15)',
                                    color: isValue ? '#00e676' : '#ef4444',
                                    border: isValue ? '1px solid rgba(0, 230, 118, 0.4)' : '1px solid rgba(239, 68, 68, 0.3)',
                                    letterSpacing: '0.1em'
                                  }}>
                                    {isValue ? 'BET ✅' : 'SKIP ❌'}
                                  </div>
                               </div>

                               <div className="team away">
                                  <span>{match.teams.away}</span>
                                  <div className="team-avatar secondary">{match.teams.away[0]}</div>
                               </div>
                            </div>
                          );
                       })}
                    </div>
                 </div>
               ))}
            </div>
         </aside>

         {/* PANEL B: ANALYSIS STAGE */}
          <section className={`panel-b ${activeTab === 'analysis' ? 'active' : ''}`}>
             <div className="analysis-card" style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem', padding: '3.5rem 3rem' }}>
                {isInferring && <div className="scanbar" />}
                
                <div className="analysis-header" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '2rem', marginBottom: '0px' }}>
                   <div className="intel-pill">전략 인텔리전스 코어 // Strategic Intel Core</div>
                   <h2 className="match-title" style={{ fontSize: '3.2rem', fontWeight: 900, fontStyle: 'italic', letterSpacing: '-0.05em', textTransform: 'uppercase', lineHeight: 0.9 }}>
                      {selectedMatch.teams.home} <br />
                      <span className="vs-label" style={{ fontSize: '1.5rem', opacity: 0.2 }}>VS</span> {selectedMatch.teams.away}
                   </h2>
                </div>

                {/* 1. Decision Header (상단 결론 블록) */}
                {activeKelly && (
                  <div className="decision-header-block" style={{
                    backgroundColor: activeKelly.isValueBet ? 'rgba(0, 230, 118, 0.08)' : 'rgba(239, 68, 68, 0.05)',
                    border: activeKelly.isValueBet ? '2px solid #00e676' : '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '2rem',
                    padding: '2.5rem',
                    textAlign: 'center',
                    boxShadow: activeKelly.isValueBet ? '0 10px 40px rgba(0, 230, 118, 0.1)' : 'none',
                    transition: 'all 0.3s ease'
                  }}>
                    <div style={{ fontSize: '3rem', fontWeight: 900, color: activeKelly.isValueBet ? '#00e676' : '#ef4444', letterSpacing: '0.05em' }}>
                      {activeKelly.isValueBet ? '✅ 베팅 추천' : '❌ 스킵 추천'}
                    </div>
                    <div style={{ fontSize: '0.95rem', color: 'rgba(255, 255, 255, 0.8)', marginTop: '1rem', fontWeight: 500, lineHeight: 1.6, padding: '0 1rem' }}>
                      {consensus ? (
                        consensus.findings[0]
                      ) : (
                        activeKelly.isValueBet 
                          ? "데이터 분석 결과, 기대 가치(xG 및 최근 전적)가 북메이커 배당률을 상회하여 장기적으로 유리한 에지(Edge)를 점유했습니다."
                          : "기대 승률이 배당률 대비 가치가 낮거나 동등한 수준으로 판명되어 자금 보존을 위해 투자를 건너뛰는 것을 권장합니다."
                      )}
                    </div>
                  </div>
                )}

                {/* 2. Capital-based Stake Input & Output (중간 자본 입력창 & 계산 결과) */}
                {activeKelly && (
                  <div className="capital-calc-block" style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    borderRadius: '2rem',
                    padding: '2.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '2rem'
                  }}>
                    <div className="input-row" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                      <span style={{ fontSize: '1.2rem', fontWeight: 900, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>내 보유 자본금 // CAPITAL:</span>
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <input 
                          type="number"
                          value={capital}
                          onChange={(e) => setCapital(Math.max(0, parseInt(e.target.value) || 0))}
                          style={{
                            background: 'rgba(0,0,0,0.5)',
                            border: '2px solid rgba(255,255,255,0.1)',
                            borderRadius: '1.2rem',
                            padding: '0.8rem 1.5rem',
                            fontSize: '1.5rem',
                            fontWeight: 900,
                            color: '#00e676',
                            width: '200px',
                            textAlign: 'right',
                            outline: 'none',
                            transition: 'all 0.3s'
                          }}
                          className="capital-input"
                        />
                        <span style={{ marginLeft: '0.5rem', fontSize: '1.2rem', fontWeight: 900 }}>원</span>
                      </div>
                    </div>

                    <div className="stake-result-row" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', width: '100%', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '2rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 900, color: 'rgba(255, 255, 255, 0.4)', textTransform: 'uppercase', letterSpacing: '0.2em' }}>
                        오늘 추천 베팅액 // RECOMMENDED STAKE
                      </span>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', margin: '0.5rem 0' }}>
                        <span className="big-recommended-stake" style={{
                          fontSize: '3.8rem',
                          fontWeight: 900,
                          color: activeKelly.isValueBet ? '#00e676' : 'rgba(255,255,255,0.15)',
                          textShadow: activeKelly.isValueBet ? '0 0 40px rgba(0, 230, 118, 0.3)' : 'none',
                          fontStyle: 'italic',
                          lineHeight: 1
                        }}>
                          {activeKelly.isValueBet ? (capital * activeKelly.fractionalKelly).toLocaleString([], { maximumFractionDigits: 0 }) : '0'}
                        </span>
                        <span style={{ fontSize: '1.8rem', fontWeight: 900, color: activeKelly.isValueBet ? '#00e676' : 'rgba(255,255,255,0.15)' }}>원</span>
                      </div>
                      <span style={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.5)', fontWeight: 800, textAlign: 'center' }}>
                        (보수적 Quarter Kelly 비율인 <strong style={{ color: '#00e676' }}>{(activeKelly.fractionalKelly * 100).toFixed(2)}%</strong>를 적용한 배분액)
                      </span>
                    </div>
                  </div>
                )}

                {/* AI 분석 엔진 기동 버튼 (추론을 실행하여 실시간 데이터를 얻고 싶을 때) */}
                <button 
                  className={`execute-btn ${isInferring ? 'inferring' : ''}`}
                  onClick={handleExecute}
                  disabled={isInferring}
                  style={{ marginTop: '0.5rem' }}
                >
                   {isInferring ? <Loader2 size={24} className="spin" /> : <Zap size={24} fill="currentColor" />}
                   <span>{isInferring ? "제미나이 1.5 엔진 실시간 전술 도출 중..." : "AI 실시간 분석 기동 // Boot Analysis Engine"}</span>
                </button>

                {/* 3. Details Accordion Toggle (하단 근거 접기/펼치기) */}
                {(results.length > 0 || activeKelly) && (
                  <div className="details-accordion-section" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1.5rem' }}>
                    <button 
                      onClick={() => setIsDetailsOpen(!isDetailsOpen)}
                      style={{
                        width: '100%',
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.05)',
                        borderRadius: '1.2rem',
                        padding: '1.2rem',
                        color: 'rgba(255,255,255,0.7)',
                        fontSize: '0.75rem',
                        fontWeight: 900,
                        textTransform: 'uppercase',
                        letterSpacing: '0.2em',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.75rem',
                        cursor: 'pointer',
                        transition: 'all 0.3s'
                      }}
                      className="details-toggle-btn"
                    >
                      <span>{isDetailsOpen ? '분석 근거 및 에이전트 리포트 숨기기 ▲' : '분석 근거 및 에이전트 리포트 자세히 보기 ▼'}</span>
                    </button>

                    <AnimatePresence>
                      {isDetailsOpen && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          style={{ overflow: 'hidden', marginTop: '2rem' }}
                        >
                          <div className="result-main" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2rem' }}>
                             <div className="conclusion-box" style={{ padding: '2rem', borderRadius: '2rem' }}>
                                <Shield size={45} className="bg-icon" />
                                <span className="conclusion-label" style={{ fontSize: '0.65rem', letterSpacing: '0.2em', marginBottom: '1rem' }}>최종 전술 기대 스코어</span>
                                <span className="score" style={{ fontSize: '4.5rem', marginBottom: '0.5rem' }}>{consensus ? (consensus.predictedScore || selectedMatch.previewScore) : selectedMatch.previewScore}</span>
                                <div className="rank" style={{ fontSize: '0.6rem' }}>
                                   <Star size={12} fill="currentColor" /> 최적 전술 종합 완료 // Synthesized
                                </div>
                             </div>
                             
                             <div className="result-side" style={{ gap: '1.5rem' }}>
                                <div className="conclusion-box-mobile-card">
                                  <div className="mobile-card-left">
                                     <span className="mobile-card-label">최종 기대 스코어 // EXPECTED SCORE</span>
                                     <div className="mobile-card-rank">
                                        <Star size={12} fill="#00e676" color="#00e676" />
                                        <span>최적 전술 종합 완료 // SYNTHESIZED</span>
                                     </div>
                                  </div>
                                  <div className="mobile-card-score">
                                     {consensus ? (consensus.predictedScore || selectedMatch.previewScore) : selectedMatch.previewScore}
                                  </div>
                                </div>
                                <div className="side-card" style={{ padding: '1.5rem', borderRadius: '1.5rem' }}>
                                   <div className="side-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '1.2rem' }}>
                                      <span style={{ color: '#AAAAAA', fontSize: '13px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.15em' }}>종합 신뢰도 // CONFIDENCE</span>
                                      <span className="power" style={{ color: '#00E676', fontSize: '2rem', fontWeight: 'bold', lineHeight: 1 }}>{((consensus ? consensus.confidence : 0.85) * 100).toFixed(1)}%</span>
                                   </div>
                                   <div className="prog-bar"><div className="prog-fill" style={{ width: `${(consensus ? consensus.confidence : 0.85) * 100}%` }} /></div>
                                </div>
                                
                                <div className="side-card-b" style={{ padding: '1.5rem', borderRadius: '1.5rem' }}>
                                   <div className="side-header"><Activity size={14} color="#00b0ff" /> <span>핵심 인사이트 // Core Insight</span></div>
                                   <p className="insight-text" style={{ fontSize: '0.7rem', lineHeight: 1.5 }}>
                                     "{consensus ? consensus.findings[1] : 'Poisson 분포 모델링 상 홈팀의 전술적 기대 우위가 입증되어 자산 비중 배분이 가능한 상태입니다.'}"
                                   </p>
                                </div>
                             </div>
                          </div>

                          {activeKelly && (
                            <div className="side-card kelly-card" style={{ marginTop: '1.5rem', padding: '2rem', borderRadius: '1.5rem' }}>
                              <div className="side-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                 <div className="kelly-title-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <TrendingUp size={14} color="#00e676" />
                                    <span style={{ fontSize: '0.6rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.2em' }}>켈리 비율 상세 지표</span>
                                 </div>
                                 <span className={`value-badge ${activeKelly.isValueBet ? 'bet' : 'skip'}`}>
                                   {activeKelly.isValueBet ? 'VALUE BET' : 'NO VALUE'}
                                 </span>
                              </div>
                              <div className="kelly-content" style={{ marginTop: '1.2rem', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1.2rem' }}>
                                 <div className="k-metric" style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                    <span style={{ fontSize: '0.5rem', color: 'rgba(255,255,255,0.3)', fontWeight: 800, textTransform: 'uppercase' }}>이론 켈리 비율</span>
                                    <strong style={{ fontSize: '0.9rem', color: 'white', fontWeight: 900 }}>{(activeKelly.kellyFraction * 100).toFixed(2)}%</strong>
                                 </div>
                                 <div className="k-metric" style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                    <span style={{ fontSize: '0.5rem', color: 'rgba(255,255,255,0.3)', fontWeight: 800, textTransform: 'uppercase' }}>기대 에지 (Edge)</span>
                                    <strong style={{ fontSize: '0.9rem', color: '#00b0ff', fontWeight: 900 }}>{(activeKelly.edge * 100).toFixed(2)}%</strong>
                                 </div>
                                 <div className="k-metric" style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                    <span style={{ fontSize: '0.5rem', color: 'rgba(255,255,255,0.3)', fontWeight: 800, textTransform: 'uppercase' }}>북메이커 암시확률</span>
                                    <strong style={{ fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.6)', fontWeight: 900 }}>{(activeKelly.impliedProb * 100).toFixed(2)}%</strong>
                                 </div>
                              </div>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
             </div>
          </section>

         {/* PANEL C: STRATEGY */}
         <aside className={`panel-c ${activeTab === 'strategy' ? 'active' : ''}`}>
            <div className="strategy-card">
               <div className="strat-header">
                  <Wallet size={20} color="#ffbf00" />
                  <div>
                     <h3>전략 전표 // Strategic Slip</h3>
                     <span>리스크 엔진 가동 중 // Active Risk Engine</span>
                  </div>
               </div>

               <div className="slip-container">
                  <div className="slip-match">
                     <p>타겟 매치 // Target Selected</p>
                     <h4>{selectedMatch.teams.home} vs {selectedMatch.teams.away}</h4>
                  </div>
                  <div className="slip-actions">
                     {['WIN', 'DRAW', 'LOSS'].map(type => (
                       <button 
                         key={type}
                         className={`pick-btn ${betPick === type ? 'picked' : ''}`}
                         onClick={() => { setBetPick(type as any); setIsBetPlaced(false); }}
                       >
                          <span>{type === 'WIN' ? '승' : type === 'DRAW' ? '무' : '패'}</span>
                          <span>x{type === 'WIN' ? selectedMatch.odds.win : type === 'DRAW' ? selectedMatch.odds.draw : selectedMatch.odds.loss}</span>
                       </button>
                     ))}
                  </div>
                  <div className="slip-meta">
                     <div className="meta-row"><span>기대 수익 / Return pts</span> <span className="highlight-text">{betPick ? (10000 * (betPick === 'WIN' ? selectedMatch.odds.win : betPick === 'DRAW' ? selectedMatch.odds.draw : selectedMatch.odds.loss)).toLocaleString() : '0'}</span></div>
                  </div>
                  <button 
                    className={`secure-btn ${isBetPlaced ? 'placed' : ''}`}
                    onClick={handlePlaceBet}
                    disabled={!betPick || isBetPlaced}
                  >
                     {isBetPlaced ? <CheckCircle2 size={24} /> : <Fingerprint size={24} />}
                     <span>{isBetPlaced ? "전략 실행 완료 // Success" : "전략 보안 집행 // Secure Strategy"}</span>
                  </button>
               </div>
            </div>
         </aside>
      </main>

      <nav className="mobile-nav">
         <div className="nav-bar">
            <button className={activeTab === 'matches' ? 'active' : ''} onClick={() => setActiveTab('matches')}><LayoutGrid size={20} /><span>목록 // List</span></button>
            <button className={activeTab === 'analysis' ? 'active' : ''} onClick={() => setActiveTab('analysis')}><Cpu size={20} /><span>분석 // Intel</span></button>
            <button className={activeTab === 'strategy' ? 'active' : ''} onClick={() => setActiveTab('strategy')}><Wallet size={20} /><span>베팅 // Bet</span></button>
         </div>
      </nav>

      <style jsx>{`
        .terminal-container {
          background-color: #020617;
          color: #FFFFFF;
          min-height: 100vh;
          padding: 2rem;
          font-family: 'Inter', sans-serif;
          max-width: 1800px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 2rem;
          padding-bottom: 8rem;
          font-size: 14px;
        }

        /* Gateway Banner */
        .gateway-banner {
          position: relative;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 2rem;
          overflow: hidden;
          transition: all 0.3s;
        }
        .gateway-banner:hover { background: rgba(255, 255, 255, 0.08); }
        .gateway-glow {
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, rgba(0, 230, 118, 0.1), transparent);
          pointer-events: none;
        }
        .gateway-content {
          position: relative;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 1.5rem;
          text-decoration: none;
          color: inherit;
        }
        .gateway-status { display: flex; align-items: center; gap: 1rem; }
        .pulse-dot {
          width: 10px; height: 10px; background: #00e676; border-radius: 50%;
          box-shadow: 0 0 10px #00e676; animation: pulse 2s infinite;
        }
        @keyframes pulse {
          0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(0, 230, 118, 0.7); }
          70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(0, 230, 118, 0); }
          100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(0, 230, 118, 0); }
        }
        .gateway-label { display: block; font-size: 13px; font-weight: 900; color: #00e676; text-transform: uppercase; letter-spacing: 0.2em; }
        .gateway-desc { font-size: 14px; color: #FFFFFF; font-weight: 700; }
        .gateway-button {
          font-size: 14px; font-weight: 900; background: rgba(0, 230, 118, 0.15);
          color: #FFFFFF; padding: 0.5rem 1rem; border-radius: 2rem; text-transform: uppercase;
          display: flex; align-items: center; gap: 0.5rem; border: 1px solid rgba(0, 230, 118, 0.3);
        }

        /* Header */
        .terminal-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          padding-bottom: 2rem;
        }
        .header-brand { display: flex; align-items: center; gap: 1.5rem; }
        .brand-name { font-size: 3rem; font-weight: 900; font-style: italic; text-transform: uppercase; letter-spacing: -0.05em; line-height: 0.8; }
        .brand-name span { color: #00e676; text-shadow: 0 0 30px rgba(0, 230, 118, 0.5); }
        .brand-tagline { font-size: 13px; font-weight: 900; letter-spacing: 0.3em; color: #AAAAAA; text-transform: uppercase; margin-top: 0.5rem; opacity: 1; }
        .sys-stats { display: flex; align-items: center; gap: 1rem; background: rgba(255, 255, 255, 0.02); padding: 0.5rem; border-radius: 1.5rem; }
        .stat-pill { display: flex; align-items: center; gap: 0.5rem; }
        .status-dot { width: 8px; height: 8px; background: #00e676; border-radius: 50%; box-shadow: 0 0 10px #00e676; }
        .stat-pill span { font-size: 13px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.1em; color: #FFFFFF; }
        .stat-data { display: flex; gap: 1rem; font-family: monospace; font-size: 13px; color: #00E676; text-transform: uppercase; font-weight: bold; }

        /* Main Grid */
        .terminal-main {
          display: grid;
          grid-template-columns: 1fr 1.5fr 1fr;
          gap: 3rem;
          min-height: 800px;
        }

        .section-title { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem; }
        .section-title span { font-size: 13px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.2em; color: #AAAAAA; }

        /* Spotlight Header */
        .spotlight-card {
           position: relative; border-radius: 2rem; overflow: hidden; padding: 2.5rem;
           background: linear-gradient(135deg, rgba(0, 230, 118, 0.2), rgba(0, 0, 0, 0.6));
           border: 1px solid rgba(0, 230, 118, 0.3); cursor: pointer; transition: all 0.3s;
           min-height: 180px; display: flex; align-items: center;
        }
        .spotlight-card:hover { transform: scale(1.02); box-shadow: 0 20px 50px rgba(0, 230, 118, 0.2); }
        .spotlight-bg { position: absolute; inset: 0; background: url('https://images.unsplash.com/photo-1574629810360-7efbbe195018?q=80&w=1000&auto=format&fit=crop') center/cover; opacity: 0.15; mix-blend-mode: overlay; pointer-events: none; }
        .spotlight-info { position: relative; width: 100%; z-index: 2; }
        .league-pill { font-size: 13px; font-weight: 900; background: #00e676; color: black; padding: 0.3rem 0.8rem; border-radius: 1rem; text-transform: uppercase; }
        .spotlight-teams { font-size: 2.5rem; font-weight: 900; font-style: italic; text-transform: uppercase; letter-spacing: -0.05em; display: flex; align-items: center; gap: 1rem; margin: 1rem 0; color: #FFFFFF; }
        .vs-min { font-size: 14px; opacity: 0.5; font-style: normal; color: #CCCCCC; }
        .spotlight-footer { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 1rem; }
        .prediction-pill { font-size: 14px; font-weight: 800; background: rgba(255,255,255,0.1); color: #FFFFFF; padding: 0.4rem 1rem; border-radius: 1.5rem; }

        /* Panel A: Matches */
        .search-box { position: relative; margin-bottom: 2rem; }
        .search-icon { position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); opacity: 0.5; color: #FFFFFF; }
        .search-box input {
          width: 100%; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 1.5rem; padding: 1.2rem 1.2rem 1.2rem 3rem; color: #FFFFFF; outline: none; transition: all 0.3s;
          font-size: 14px;
        }
        .search-box input:focus { background: rgba(255, 255, 255, 0.08); border-color: rgba(0, 230, 118, 0.5); }

        .grouped-match-list { max-height: 800px; overflow-y: auto; padding-right: 0.5rem; }
        .date-group { margin-bottom: 2rem; }
        .date-header { font-size: 13px; font-weight: 900; color: #00e676; margin-bottom: 1rem; text-transform: uppercase; letter-spacing: 0.1em; border-left: 3px solid #00e676; padding-left: 0.75rem; }
        .match-grid { display: flex; flex-direction: column; gap: 1rem; }

        /* Horizontal Match Card */
        .h-match-card {
           display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 1rem;
           padding: 1.2rem 1.5rem; border-radius: 1.5rem; background: rgba(255,255,255,0.02);
           border: 1px solid rgba(255,255,255,0.08); cursor: pointer; transition: all 0.3s;
        }
        .h-match-card:hover { background: rgba(255,255,255,0.05); }
        .h-match-card.selected { background: rgba(0, 230, 118, 0.08); border-color: #00e676; }
        
        .team { display: flex; align-items: center; gap: 1rem; font-weight: 900; text-transform: uppercase; letter-spacing: -0.02em; }
        .team span { color: #FFFFFF; font-size: 16px; font-weight: bold; }
        .home { justify-content: flex-end; text-align: right; }
        .away { justify-content: flex-start; text-align: left; }
        .team-avatar { 
           width: 32px; height: 32px; border-radius: 50%; background: #00e676; color: black;
           display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: bold;
        }
        .team-avatar.secondary { background: #334155; color: white; }
        
        .match-mid { text-align: center; display: flex; flex-direction: column; align-items: center; padding: 0 1rem; border-left: 1px solid rgba(255,255,255,0.05); border-right: 1px solid rgba(255,255,255,0.05); }
        .mid-time { font-size: 13px; color: #CCCCCC; margin-bottom: 0.2rem; font-weight: normal; opacity: 1; }
        .predicted-score { font-size: 1.8rem; font-weight: 900; font-style: italic; color: #00e676; line-height: 1; margin: 0.2rem 0; }
        .mid-label { font-size: 13px; font-weight: 900; letter-spacing: 0.2em; color: #AAAAAA; opacity: 1; }

        /* Panel B: Analysis */
        .analysis-card {
          background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 3rem; padding: 4rem; position: relative; min-height: 600px;
          display: flex; flex-direction: column; overflow: hidden;
        }
        .scanbar {
          position: absolute; left: 0; right: 0; height: 1px; background: #00e676;
          box-shadow: 0 0 10px #00e676; animation: scan 2s linear infinite; z-index: 10;
        }
        @keyframes scan { 0% { top: 0; } 100% { top: 100%; } }
        .analysis-header { margin-bottom: 4rem; text-align: center; }
        .intel-pill { display: inline-block; padding: 0.5rem 1.5rem; border-radius: 2rem; background: rgba(0, 230, 118, 0.15); border: 1px solid rgba(0, 230, 118, 0.3); color: #00e676; font-size: 13px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.4em; margin-bottom: 2rem; }
        .match-title { font-size: 5rem; font-weight: 900; font-style: italic; line-height: 0.8; letter-spacing: -0.05em; text-transform: uppercase; color: #FFFFFF; }
        .vs-label { font-size: 2rem; font-style: normal; opacity: 0.3; margin: 0 1rem; color: #CCCCCC; }
        
        .execute-btn {
          width: 100%; padding: 2rem; border-radius: 2rem; background: #00e676; color: black;
          border: none; font-size: 14px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.4em;
          display: flex; align-items: center; justify-content: center; gap: 1rem; cursor: pointer;
          transition: all 0.3s; box-shadow: 0 0 40px rgba(0, 230, 118, 0.2); margin-top: auto;
        }
        .execute-btn span { color: black; font-size: 14px; font-weight: bold; }
        .execute-btn:hover { transform: scale(1.02); box-shadow: 0 0 60px rgba(0, 230, 118, 0.3); }
        .execute-btn.inferring { background: rgba(255, 191, 0, 0.2); color: #ffbf00; border: 1px solid rgba(255, 191, 0, 0.4); }
        .execute-btn.inferring span { color: #ffbf00; }
        .spin { animation: rotate 1s linear infinite; }
        @keyframes rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        .analysis-results { margin-top: 4rem; }
        .result-main { display: grid; grid-template-columns: 1.2fr 1fr; gap: 3rem; }
         .conclusion-box {
           background: #00e676; color: black; padding: 3rem; border-radius: 4rem;
           display: flex; flex-direction: column; align-items: center; justify-content: center;
           position: relative; overflow: hidden; text-align: center;
           box-shadow: 0 20px 80px rgba(0, 230, 118, 0.3);
         }
         .conclusion-box-mobile-card {
           display: none;
         }
        .bg-icon { position: absolute; top: -10%; right: -10%; opacity: 0.1; transform: rotate(15deg); }
        .conclusion-label { font-size: 13px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.4em; color: #AAAAAA; margin-bottom: 2rem; opacity: 1; }
        .score { font-size: 8rem; font-weight: 900; font-style: italic; letter-spacing: -0.05em; line-height: 1; border-bottom: 8px solid rgba(0,0,0,0.1); padding-bottom: 1rem; margin-bottom: 1rem; color: black; }
        .rank { font-size: 13px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.2em; display: flex; align-items: center; gap: 0.5rem; color: black; }

        .result-side { display: flex; flex-direction: column; gap: 2rem; }
        .side-card, .side-card-b { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); padding: 2rem; border-radius: 2rem; flex: 1; }
        .side-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
        .side-header span { font-size: 13px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.3em; color: #AAAAAA; opacity: 1; }
        .power { color: #00e676; opacity: 1 !important; font-family: monospace; font-size: 18px !important; font-weight: bold !important; }
        .prog-bar { width: 100%; height: 4px; background: rgba(255,255,255,0.05); border-radius: 2px; }
        .prog-fill { height: 100%; background: #00e676; box-shadow: 0 0 10px #00e676; }
        .insight-text { font-size: 14px; color: #FFFFFF; font-weight: 500; font-style: italic; line-height: 1.6; }

        .empty-stage { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2rem; opacity: 0.5; }
        .empty-stage p { font-size: 2rem; font-weight: 900; font-style: italic; text-transform: uppercase; letter-spacing: -0.05em; color: #FFFFFF; }

        /* Panel C: Strategy */
        .strategy-card { background: rgba(15, 23, 42, 0.98); border: 1px solid rgba(255,255,255,0.12); border-radius: 3rem; padding: 3rem; min-height: 600px; display: flex; flex-direction: column; }
        .strat-header { display: flex; align-items: center; gap: 1rem; margin-bottom: 3rem; }
        .strat-header h3 { font-size: 14px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.3em; margin-bottom: 0.2rem; color: #FFFFFF; }
        .strat-header span { font-size: 13px; font-weight: 900; color: #AAAAAA; text-transform: uppercase; letter-spacing: 0.2em; opacity: 1; }
        
        .slip-container { flex: 1; display: flex; flex-direction: column; gap: 2rem; }
        .slip-match h4 { font-size: 1.2rem; font-weight: 900; text-transform: uppercase; letter-spacing: -0.02em; color: #FFFFFF; }
        .slip-actions { display: flex; flex-direction: column; gap: 1rem; }
        .pick-btn {
          display: flex; justify-content: space-between; padding: 1.2rem 1.5rem; border-radius: 1.2rem;
          background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #FFFFFF;
          font-weight: 900; font-size: 14px; text-transform: uppercase; cursor: pointer; transition: all 0.3s;
        }
        .pick-btn span { color: #FFFFFF; font-size: 14px; }
        .pick-btn.picked { background: #00e676; color: black; border-color: #00e676; box-shadow: 0 10px 30px rgba(0, 230, 118, 0.3); }
        .pick-btn.picked span { color: black; font-weight: bold; }
        
        .slip-meta { border-top: 1px solid rgba(255,255,255,0.08); padding-top: 2rem; }
        .meta-row { display: flex; justify-content: space-between; align-items: flex-end; }
        .meta-row span:first-child { font-size: 13px; font-weight: 900; text-transform: uppercase; color: #AAAAAA; letter-spacing: 0.2em; opacity: 1; }
        .highlight-text { font-size: 3rem; font-weight: 900; font-style: italic; color: #00e676; line-height: 1; }
        
        .secure-btn {
          width: 100%; padding: 1.5rem; border-radius: 2rem; border: none; font-size: 14px; font-weight: 900;
          text-transform: uppercase; letter-spacing: 0.3em; display: flex; align-items: center; justify-content: center; gap: 1rem;
          background: rgba(255,255,255,0.08); color: #FFFFFF; cursor: pointer; transition: all 0.3s;
          margin-top: auto;
        }
        .secure-btn span { color: #FFFFFF; font-size: 14px; }
        .secure-btn:not(:disabled) { background: #00e676; color: black; box-shadow: 0 15px 40px rgba(0, 230, 118, 0.2); }
        .secure-btn:not(:disabled) span { color: black; font-weight: bold; }
        .secure-btn.placed { background: rgba(0,230,118,0.15); color: #00e676; border: 1px solid rgba(0,230,118,0.3); }
        .secure-btn.placed span { color: #00e676; }

        /* Mobile Nav */
        .mobile-nav { display: none; }

        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.1); }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 2px; }

        .value-badge {
          font-size: 13px;
          font-weight: 900;
          padding: 0.25rem 0.6rem;
          border-radius: 0.5rem;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }
        .value-badge.bet {
          background: rgba(0, 230, 118, 0.15);
          color: #00e676;
          border: 1px solid rgba(0, 230, 118, 0.3);
        }
        .value-badge.skip {
          background: rgba(239, 68, 68, 0.15);
          color: #ef4444;
          border: 1px solid rgba(239, 68, 68, 0.3);
        }
        .kelly-card {
          border: 1px dashed rgba(0, 230, 118, 0.4) !important;
          background: linear-gradient(135deg, rgba(0, 230, 118, 0.04), rgba(0, 0, 0, 0.4)) !important;
        }
        
        /* Kelly Metric Highlight Values */
        .k-metric strong {
          color: #00E676 !important;
          font-size: 18px !important;
          font-weight: bold !important;
        }

        @media (max-width: 1280px) {
          .terminal-container { padding: 0.75rem; padding-bottom: 15rem; }
          .terminal-header { padding-bottom: 1rem; }
          .brand-name { font-size: 2rem; }
          .lg-only { display: none; }
          .terminal-main { grid-template-columns: 1fr; gap: 2rem; }
          .panel-a, .panel-b, .panel-c { display: none; }
          .panel-a.active, .panel-b.active, .panel-c.active { display: block; }
          .spotlight-card { padding: 1.5rem; border-radius: 1.5rem; }
          .spotlight-teams { font-size: 1.8rem; }
          .h-match-card { padding: 1rem; border-radius: 1.2rem; gap: 0.5rem; }
          .team { font-size: 14px; gap: 0.5rem; }
          .team span { font-size: 16px; }
          .team-avatar { width: 24px; height: 24px; font-size: 13px; }
          .predicted-score { font-size: 1.2rem; }
          .analysis-card { padding: 2rem; border-radius: 2rem; min-height: 500px; }
          .match-title { font-size: 2.5rem; }
          .result-main {
             display: flex !important;
             flex-direction: row !important;
             gap: 1.2rem !important;
             align-items: stretch !important;
          }
          .conclusion-box {
             width: 12px !important;
             padding: 0 !important;
             border-radius: 6px !important;
             background: #00e676 !important;
             box-shadow: 0 0 15px rgba(0, 230, 118, 0.4) !important;
             flex-shrink: 0 !important;
             min-height: auto !important;
          }
          .conclusion-box * {
             display: none !important;
          }
          .conclusion-box-mobile-card {
             display: flex !important;
             justify-content: space-between;
             align-items: center;
             background: rgba(255, 255, 255, 0.03);
             border: 1px solid rgba(0, 230, 118, 0.2);
             padding: 1.2rem 1.5rem;
             border-radius: 1.5rem;
             gap: 1rem;
             width: 100%;
          }
          .mobile-card-left {
             display: flex;
             flex-direction: column;
             gap: 0.4rem;
             text-align: left;
          }
          .mobile-card-label {
             font-size: 13px;
             color: #AAAAAA;
             font-weight: 800;
             letter-spacing: 0.05em;
          }
          .mobile-card-rank {
             display: flex;
             align-items: center;
             gap: 0.4rem;
             font-size: 13px;
             color: #00e676;
             font-weight: bold;
          }
          .mobile-card-score {
             font-size: 2.2rem;
             font-weight: 900;
             font-style: italic;
             color: #00e676;
             text-shadow: 0 0 15px rgba(0, 230, 118, 0.3);
          }
          .score { font-size: 5rem; }
          .mobile-nav {
            display: block; position: fixed; bottom: 0; left: 0; right: 0;
            background: linear-gradient(0deg, #020617 80%, transparent); padding: 5rem 1.5rem 1.5rem; z-index: 1000;
          }
          .nav-bar {
            background: rgba(15, 23, 42, 0.98); backdrop-filter: blur(20px);
            border: 1px solid rgba(255,255,255,0.1); border-radius: 3.5rem; display: flex;
            padding: 0.5rem; justify-content: space-around; box-shadow: 0 20px 80px rgba(0,0,0,0.9);
          }
          .nav-bar button {
            background: none; border: none; color: rgba(255,255,255,0.2);
            padding: 1.2rem; display: flex; flex-direction: column; align-items: center; gap: 0.3rem;
            transition: all 0.3s; flex: 1; border-radius: 3rem;
          }
          .nav-bar button span { font-size: 13px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em; color: #FFFFFF; }
          .nav-bar button.active { background: #00e676; color: black; box-shadow: 0 10px 30px rgba(0,230,118,0.4); }
          .nav-bar button.active span { color: black; }
        }
      `}</style>
    </div>
  );
};

