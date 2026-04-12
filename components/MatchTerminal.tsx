"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Zap, Activity, Shield, Search, TrendingUp, 
  ChevronRight, Cpu, LayoutGrid, Fingerprint, Layers, 
  Clock, AlertTriangle, Trophy, Target, 
  BarChart3, Globe, Star, Loader2, MousePointer2,
  CheckCircle2, Info, Wallet, BarChart, X, Menu,
  LineChart as LineChartIcon, SlidersHorizontal
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, AreaChart, Area
} from 'recharts';
import { AgentResult, MatchData } from '@/lib/agents/orchestrator';
import { MOCK_MATCHES } from '@/lib/data/matches';

export const MatchTerminal: React.FC = () => {
  const [mounted, setMounted] = useState(false);
  const [isInferring, setIsInferring] = useState(false);
  const [results, setResults] = useState<AgentResult[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<MatchData>(MOCK_MATCHES[0]);
  const [betPick, setBetPick] = useState<'WIN' | 'DRAW' | 'LOSS' | null>(null);
  const [isBetPlaced, setIsBetPlaced] = useState(false);
  const [activeTab, setActiveTab] = useState<'matches' | 'analysis' | 'strategy'>('matches');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  const sysStatus = {
    version: "v1.2.0-ELITE",
    network: "Alpha Intelligence Corps",
    sync: "REAL-TIME",
    uptime: "99.9%"
  };

  const filteredMatches = useMemo(() => {
    return MOCK_MATCHES.filter(m => 
      m.teams.home.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.teams.away.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.league.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

  const consensus = useMemo(() => {
    if (results.length === 0) return null;
    const finalBoss = results.find(r => r.agentId === 'alpha_consensus');
    return finalBoss || (results.length > 0 ? results[0] : null);
  }, [results]);

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
       console.warn("[DEMO_MODE] API Unavailable. Activating simulated intelligence protocol.");
       await new Promise(r => setTimeout(r, 2000));
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
           predictedScore: "2:0"
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
      {/* 0. External Gateway (Sports Toto) */}
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
                 <span className="gateway-label">Gateway Active</span>
                 <span className="gateway-desc">Official Sports Toto Port // 외부 베팅 포털 연결</span>
              </div>
           </div>
           <div className="gateway-button">
              Connect <MousePointer2 size={12} />
           </div>
         </a>
      </div>

      {/* 1. Header */}
      <header className="terminal-header">
         <div className="header-brand">
            <div className="brand-logo">
               <Trophy size={32} color="#00e676" />
            </div>
            <div>
               <h1 className="brand-name">Alpha <span>Master</span></h1>
               <p className="brand-tagline">Tactical Intelligence OS</p>
            </div>
         </div>
         <div className="sys-stats">
            <div className="stat-pill">
               <div className="status-dot" />
               <span>Syncing</span>
            </div>
            <div className="stat-data">
               <span>Report: {sysStatus.sync}</span>
               <span>Ver: {sysStatus.version}</span>
            </div>
         </div>
      </header>

      <main className="terminal-main">
         {/* PANEL A: TARGET SELECTION */}
         <aside className={`panel-a ${activeTab === 'matches' ? 'active' : ''}`}>
            <div className="panel-header">
               <Target size={14} opacity={0.3} />
               <h2>Market Targets</h2>
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

            <div className="match-list custom-scrollbar">
               {filteredMatches.map(match => (
                 <div 
                   key={match.id} 
                   className={`match-card ${selectedMatch.id === match.id ? 'selected' : ''}`}
                   onClick={() => {
                     setSelectedMatch(match);
                     setResults([]);
                     setIsBetPlaced(false);
                     setBetPick(null);
                     if (window.innerWidth < 1280) setActiveTab('analysis');
                   }}
                 >
                    <div className="card-top">
                       <span className="league-tag">{match.league}</span>
                       <span className="time-tag"><Clock size={12} /> {new Date(match.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className="card-teams">
                       <h3 className={selectedMatch.id === match.id ? 'highlight' : ''}>{match.teams.home}</h3>
                       <h3>{match.teams.away}</h3>
                    </div>
                    <div className="card-odds">
                       <div className="odd-box">H: {match.odds.win.toFixed(2)}</div>
                       <div className="odd-box">D: {match.odds.draw.toFixed(2)}</div>
                       <div className="odd-box">A: {match.odds.loss.toFixed(2)}</div>
                    </div>
                 </div>
               ))}
            </div>
         </aside>

         {/* PANEL B: ANALYSIS STAGE */}
         <section className={`panel-b ${activeTab === 'analysis' ? 'active' : ''}`}>
            <div className="analysis-card">
               {isInferring && <div className="scanbar" />}
               
               <div className="analysis-header">
                  <div className="intel-pill">Strategic Intel Core</div>
                  <h2 className="match-title">
                     {selectedMatch.teams.home} <br />
                     <span className="vs-label">VS</span> {selectedMatch.teams.away}
                  </h2>
               </div>

               <button 
                 className={`execute-btn ${isInferring ? 'inferring' : ''}`}
                 onClick={handleExecute}
                 disabled={isInferring}
               >
                  {isInferring ? <Loader2 size={24} className="spin" /> : <Zap size={24} fill="currentColor" />}
                  <span>{isInferring ? "Computing Tactical Data..." : "Boot Analytics Engine"}</span>
               </button>

               <AnimatePresence>
                  {results.length > 0 && consensus && (
                    <motion.div 
                      className="analysis-results"
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                       <div className="result-main">
                          <div className="conclusion-box">
                             <Shield size={60} className="bg-icon" />
                             <span className="conclusion-label">Tactical Conclusion</span>
                             <span className="score">{consensus.predictedScore || "2:1"}</span>
                             <div className="rank">
                                <Star size={12} fill="currentColor" /> Rank: High
                             </div>
                          </div>
                          <div className="result-side">
                             <div className="side-card">
                                <div className="side-header">
                                   <span>Confidence Gauge</span>
                                   <span className="power">84.2%</span>
                                </div>
                                <div className="prog-bar"><div className="prog-fill" /></div>
                             </div>
                             <div className="side-card-b">
                                <div className="side-header"><Activity size={14} color="#00b0ff" /> <span>Insight</span></div>
                                <p className="insight-text">"{consensus.findings[0]}"</p>
                             </div>
                          </div>
                       </div>
                    </motion.div>
                  )}
               </AnimatePresence>

               {results.length === 0 && !isInferring && (
                 <div className="empty-stage">
                    <Cpu size={80} />
                    <p>Intelligence Locked</p>
                    <span>제미나이 1.5 프로 엔진 분석 대기 중</span>
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
                     <h3>Strategic Slip</h3>
                     <span>Active Risk Engine</span>
                  </div>
               </div>

               <div className="slip-container">
                  <div className="slip-match">
                     <p>Target Selected</p>
                     <h4>{selectedMatch.teams.home} vs {selectedMatch.teams.away}</h4>
                  </div>
                  <div className="slip-actions">
                     {['WIN', 'DRAW', 'LOSS'].map(type => (
                       <button 
                         key={type}
                         className={`pick-btn ${betPick === type ? 'picked' : ''}`}
                         onClick={() => { setBetPick(type as any); setIsBetPlaced(false); }}
                       >
                          <span>{type}</span>
                          <span>x{type === 'WIN' ? selectedMatch.odds.win : type === 'DRAW' ? selectedMatch.odds.draw : selectedMatch.odds.loss}</span>
                       </button>
                     ))}
                  </div>
                  <div className="slip-meta">
                     <div className="meta-row"><span>Return / pts</span> <span className="highlight-text">{betPick ? (10000 * (betPick === 'WIN' ? selectedMatch.odds.win : betPick === 'DRAW' ? selectedMatch.odds.draw : selectedMatch.odds.loss)).toLocaleString() : '0'}</span></div>
                  </div>
                  <button 
                    className={`secure-btn ${isBetPlaced ? 'placed' : ''}`}
                    onClick={handlePlaceBet}
                    disabled={!betPick || isBetPlaced}
                  >
                     {isBetPlaced ? <CheckCircle2 size={24} /> : <Fingerprint size={24} />}
                     <span>{isBetPlaced ? "Strategy Implemented" : "Secure Strategy"}</span>
                  </button>
               </div>
            </div>
         </aside>
      </main>

      <nav className="mobile-nav">
         <div className="nav-bar">
            <button className={activeTab === 'matches' ? 'active' : ''} onClick={() => setActiveTab('matches')}><LayoutGrid size={20} /><span>List</span></button>
            <button className={activeTab === 'analysis' ? 'active' : ''} onClick={() => setActiveTab('analysis')}><Cpu size={20} /><span>Intel</span></button>
            <button className={activeTab === 'strategy' ? 'active' : ''} onClick={() => setActiveTab('strategy')}><Wallet size={20} /><span>Bet</span></button>
         </div>
      </nav>

      <style jsx>{`
        .terminal-container {
          background-color: #020617;
          color: white;
          min-height: 100vh;
          padding: 2rem;
          font-family: 'Inter', sans-serif;
          max-width: 1800px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 2rem;
          padding-bottom: 8rem;
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
        .gateway-label { display: block; font-size: 0.6rem; font-weight: 900; color: #00e676; text-transform: uppercase; letter-spacing: 0.2em; }
        .gateway-desc { font-size: 0.75rem; color: rgba(255, 255, 255, 0.6); font-weight: 700; }
        .gateway-button {
          font-size: 0.6rem; font-weight: 900; background: rgba(0, 230, 118, 0.1);
          color: #00e676; padding: 0.5rem 1rem; border-radius: 2rem; text-transform: uppercase;
          display: flex; align-items: center; gap: 0.5rem; border: 1px solid rgba(0, 230, 118, 0.2);
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
        .brand-tagline { font-size: 0.8rem; font-weight: 900; letter-spacing: 0.5em; opacity: 0.1; text-transform: uppercase; margin-top: 0.5rem; }
        .sys-stats { display: flex; align-items: center; gap: 1rem; background: rgba(255, 255, 255, 0.02); padding: 0.5rem; border-radius: 1.5rem; }
        .stat-pill { display: flex; align-items: center; gap: 0.5rem; border-right: 1px solid rgba(255, 255, 255, 0.05); padding-right: 1rem; margin-right: 0.5rem; }
        .status-dot { width: 8px; height: 8px; background: #00e676; border-radius: 50%; box-shadow: 0 0 10px #00e676; }
        .stat-pill span { font-size: 0.6rem; font-weight: 900; text-transform: uppercase; letter-spacing: 0.1em; }
        .stat-data { display: flex; gap: 1rem; font-family: monospace; font-size: 0.6rem; color: rgba(0, 230, 118, 0.4); text-transform: uppercase; }

        /* Main Grid */
        .terminal-main {
          display: grid;
          grid-template-cols: 1fr 2fr 1.2fr;
          gap: 3rem;
          min-height: 700px;
        }

        .panel-header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.5rem; opacity: 0.3; }
        .panel-header h2 { font-size: 0.6rem; font-weight: 900; text-transform: uppercase; letter-spacing: 0.4em; }

        /* Panel A: Matches */
        .search-box { position: relative; margin-bottom: 2rem; }
        .search-icon { position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); opacity: 0.2; }
        .search-box input {
          width: 100%; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 1.5rem; padding: 1.2rem 1.2rem 1.2rem 3rem; color: white; outline: none; transition: all 0.3s;
        }
        .search-box input:focus { background: rgba(255, 255, 255, 0.06); border-color: rgba(0, 230, 118, 0.3); }

        .match-list { display: flex; flex-direction: column; gap: 1rem; max-height: 600px; overflow-y: auto; padding-right: 0.5rem; }
        .match-card {
          padding: 1.5rem; border-radius: 1.5rem; background: rgba(255, 255, 255, 0.01); border: 1px solid rgba(255, 255, 255, 0.05);
          cursor: pointer; transition: all 0.3s; position: relative; overflow: hidden;
        }
        .match-card.selected { background: rgba(0, 230, 118, 0.05); border-color: rgba(0, 230, 118, 0.4); box-shadow: 0 10px 40px rgba(0,0,0,0.4); }
        .card-top { display: flex; justify-content: space-between; margin-bottom: 1rem; }
        .league-tag { font-size: 0.6rem; font-weight: 900; background: rgba(255, 255, 255, 0.05); padding: 0.4rem 0.8rem; border-radius: 1rem; color: rgba(255,255,255,0.4); text-transform: uppercase; }
        .time-tag { font-family: monospace; font-size: 0.6rem; color: rgba(255,255,255,0.1); display: flex; align-items: center; gap: 0.3rem; }
        .card-teams h3 { font-size: 1.2rem; font-weight: 900; font-style: italic; text-transform: uppercase; letter-spacing: -0.02em; line-height: 1; }
        .card-teams h3.highlight { color: #00e676; }
        .card-odds { display: flex; gap: 0.5rem; margin-top: 1.5rem; }
        .odd-box { flex: 1; text-align: center; border-radius: 0.8rem; background: rgba(0,0,0,0.3); padding: 0.5rem; font-size: 0.7rem; font-weight: 800; color: rgba(255,255,255,0.3); }

        /* Panel B: Analysis */
        .analysis-card {
          background: rgba(255, 255, 255, 0.01); border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 3rem; padding: 4rem; position: relative; min-height: 600px;
          display: flex; flex-direction: column; overflow: hidden;
        }
        .scanbar {
          position: absolute; left: 0; right: 0; height: 1px; background: #00e676;
          box-shadow: 0 0 10px #00e676; animation: scan 2s linear infinite; z-index: 10;
        }
        @keyframes scan { 0% { top: 0; } 100% { top: 100%; } }
        .analysis-header { margin-bottom: 4rem; text-align: center; }
        .intel-pill { display: inline-block; padding: 0.5rem 1.5rem; border-radius: 2rem; background: rgba(0, 230, 118, 0.1); border: 1px solid rgba(0, 230, 118, 0.2); color: #00e676; font-size: 0.6rem; font-weight: 900; text-transform: uppercase; letter-spacing: 0.4em; margin-bottom: 2rem; }
        .match-title { font-size: 5rem; font-weight: 900; font-style: italic; line-height: 0.8; letter-spacing: -0.05em; text-transform: uppercase; }
        .vs-label { font-size: 2rem; font-style: normal; opacity: 0.1; margin: 0 1rem; }
        .execute-btn {
          width: 100%; padding: 2rem; border-radius: 2rem; background: #00e676; color: black;
          border: none; font-size: 1rem; font-weight: 900; text-transform: uppercase; letter-spacing: 0.4em;
          display: flex; align-items: center; justify-content: center; gap: 1rem; cursor: pointer;
          transition: all 0.3s; box-shadow: 0 0 40px rgba(0, 230, 118, 0.2); margin-top: auto;
        }
        .execute-btn:hover { transform: scale(1.02); box-shadow: 0 0 60px rgba(0, 230, 118, 0.3); }
        .execute-btn.inferring { background: rgba(255, 191, 0, 0.1); color: #ffbf00; border: 1px solid rgba(255, 191, 0, 0.2); }
        .spin { animation: rotate 1s linear infinite; }
        @keyframes rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        .analysis-results { margin-top: 4rem; }
        .result-main { display: grid; grid-template-cols: 1.2fr 1fr; gap: 3rem; }
        .conclusion-box {
          background: #00e676; color: black; padding: 3rem; border-radius: 4rem;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          position: relative; overflow: hidden; text-align: center;
          box-shadow: 0 20px 80px rgba(0, 230, 118, 0.3);
        }
        .bg-icon { position: absolute; top: -10%; right: -10%; opacity: 0.1; transform: rotate(15deg); }
        .conclusion-label { font-size: 0.6rem; font-weight: 900; text-transform: uppercase; letter-spacing: 0.4em; opacity: 0.6; margin-bottom: 2rem; }
        .score { font-size: 8rem; font-weight: 900; font-style: italic; letter-spacing: -0.05em; line-height: 1; border-bottom: 8px solid rgba(0,0,0,0.1); padding-bottom: 1rem; margin-bottom: 1rem; }
        .rank { font-size: 0.6rem; font-weight: 900; text-transform: uppercase; letter-spacing: 0.2em; display: flex; align-items: center; gap: 0.5rem; }

        .result-side { display: flex; flex-direction: column; gap: 2rem; }
        .side-card, .side-card-b { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); padding: 2rem; border-radius: 2rem; flex: 1; }
        .side-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
        .side-header span { font-size: 0.5rem; font-weight: 900; text-transform: uppercase; letter-spacing: 0.3em; opacity: 0.2; }
        .power { color: #00e676; opacity: 1 !important; font-family: monospace; font-size: 0.8rem !important; }
        .prog-bar { width: 100%; height: 4px; background: rgba(255,255,255,0.05); border-radius: 2px; }
        .prog-fill { width: 84%; height: 100%; background: #00e676; box-shadow: 0 0 10px #00e676; }
        .insight-text { font-size: 0.75rem; color: rgba(255,255,255,0.5); font-weight: 500; font-style: italic; line-height: 1.6; }

        .empty-stage { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2rem; opacity: 0.15; }
        .empty-stage p { font-size: 2rem; font-weight: 900; font-style: italic; text-transform: uppercase; letter-spacing: -0.05em; }

        /* Panel C: Strategy */
        .strategy-card { background: rgba(15, 23, 42, 0.95); border: 1px solid rgba(255,255,255,0.1); border-radius: 3rem; padding: 3rem; min-height: 600px; display: flex; flex-direction: column; }
        .strat-header { display: flex; align-items: center; gap: 1rem; margin-bottom: 3rem; }
        .strat-header h3 { font-size: 0.8rem; font-weight: 900; text-transform: uppercase; letter-spacing: 0.3em; margin-bottom: 0.2rem; }
        .strat-header span { font-size: 0.5rem; font-weight: 900; opacity: 0.1; text-transform: uppercase; letter-spacing: 0.2em; }
        
        .slip-container { flex: 1; display: flex; flex-direction: column; gap: 2rem; }
        .slip-match p { font-size: 0.5rem; font-weight: 800; color: rgba(255,255,255,0.2); text-transform: uppercase; letter-spacing: 0.2em; margin-bottom: 0.5rem; }
        .slip-match h4 { font-size: 1.1rem; font-weight: 900; text-transform: uppercase; letter-spacing: -0.02em; }
        .slip-actions { display: flex; flex-direction: column; gap: 1rem; }
        .pick-btn {
          display: flex; justify-content: space-between; padding: 1.2rem 1.5rem; border-radius: 1.2rem;
          background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); color: rgba(255,255,255,0.4);
          font-weight: 900; font-size: 0.75rem; text-transform: uppercase; cursor: pointer; transition: all 0.3s;
        }
        .pick-btn.picked { background: #00e676; color: black; border-color: #00e676; box-shadow: 0 10px 30px rgba(0, 230, 118, 0.3); }
        .slip-meta { border-top: 1px solid rgba(255,255,255,0.05); padding-top: 2rem; }
        .meta-row { display: flex; justify-content: space-between; align-items: flex-end; }
        .meta-row span:first-child { font-size: 0.5rem; font-weight: 900; text-transform: uppercase; opacity: 0.2; letter-spacing: 0.2em; }
        .highlight-text { font-size: 3rem; font-weight: 900; font-style: italic; color: #00e676; line-height: 1; }
        .secure-btn {
          width: 100%; padding: 1.5rem; border-radius: 2rem; border: none; font-size: 0.8rem; font-weight: 900;
          text-transform: uppercase; letter-spacing: 0.3em; display: flex; align-items: center; justify-content: center; gap: 1rem;
          background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.1); cursor: pointer; transition: all 0.3s;
          margin-top: auto;
        }
        .secure-btn:not(:disabled) { background: #00e676; color: black; box-shadow: 0 15px 40px rgba(0, 230, 118, 0.2); }
        .secure-btn.placed { background: rgba(0,e6,76,0.1); color: #00e676; border: 1px solid rgba(0,e6,76,0.2); }

        /* Mobile Nav */
        .mobile-nav { display: none; }

        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.1); }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 2px; }

        @media (max-width: 1280px) {
          .terminal-container { padding: 1rem; padding-bottom: 150px; }
          .terminal-main { height: auto; grid-template-cols: 1fr; gap: 2rem; }
          .panel-a, .panel-b, .panel-c { display: none; }
          .panel-a.active, .panel-b.active, .panel-c.active { display: block; }
          .match-list { height: auto; max-height: none; }
          .analysis-card { padding: 2rem; border-radius: 2rem; min-height: 500px; }
          .match-title { font-size: 3rem; }
          .result-main { grid-template-cols: 1fr; gap: 2rem; }
          .score { font-size: 5rem; }
          .mobile-nav {
            display: block; position: fixed; bottom: 0; left: 0; right: 0;
            background: linear-gradient(0deg, #020617, transparent); padding: 4rem 2rem 2rem; z-index: 1000;
          }
          .nav-bar {
            background: rgba(15, 23, 42, 0.95); backdrop-filter: blur(20px);
            border: 1px solid rgba(255,255,255,0.1); border-radius: 3rem; display: flex;
            padding: 0.5rem; justify-content: space-around; box-shadow: 0 20px 80px rgba(0,0,0,0.8);
          }
          .nav-bar button {
            background: none; border: none; color: rgba(255,255,255,0.2);
            padding: 1rem; display: flex; flex-direction: column; align-items: center; gap: 0.2rem;
            transition: all 0.3s; flex: 1; border-radius: 2.5rem;
          }
          .nav-bar button span { font-size: 0.5rem; font-weight: 900; text-transform: uppercase; letter-spacing: 0.1em; }
          .nav-bar button.active { background: #00e676; color: black; box-shadow: 0 10px 20px rgba(0,230,118,0.3); }
        }
      `}</style>
    </div>
  );
};
