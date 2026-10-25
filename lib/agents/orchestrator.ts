import { alphaInference } from './inference';
import { AGENT_REGISTRY } from './config';
import { calcKelly, KellyResult } from '../kelly';
import { enrichMatchDetails } from '../data/apiFootball';

export interface AgentResult {
  agentId: string;
  name: string;
  role: string;
  confidence: number;
  sentiment: 'favorable' | 'unfavorable' | 'stable';
  findings: string[];
  predictedScore?: string; // e.g., "2:1"
  winProb?: number;
  drawProb?: number;
  lossProb?: number;
  kellyResult?: KellyResult;
}

export interface MatchData {
  id: string;
  code: string;
  sport?: string;
  city?: string;
  teams: { home: string; away: string };
  league: string;
  odds: { win: number; draw: number; loss: number };
  startTime: string;
  isFeatured?: boolean;
  previewScore?: string;
  elo?: { home: number; away: number };
  injuries?: { home: string[]; away: string[] };
  h2hRecord?: string;
  rawIds?: { fixtureId?: number; homeTeamId?: number; awayTeamId?: number; leagueId?: number; season?: number };
  stats?: {
    home: { form: string; xG: number; goalsScored: number; goalsConceded: number; winRate: number; homeWinRate?: number };
    away: { form: string; xG: number; goalsScored: number; goalsConceded: number; winRate: number; awayWinRate?: number };
    headToHead: string;
  };
}

export class AlphaOrchestrator {
  /**
   * 10-AGENT ORCHESTRATION ENGINE (W-5 Framework Debate Chain)
   * Sequential Debate: match_strategist -> odds_watcher -> ml_validator -> value_finder
   * Parallel Context: lineup_sentinel, tactical_genius, venue_expert, weather_analyst, motivation_scout
   * Final Synthesis: alpha_consensus with Kelly criterion & 0.75 confidence filter.
   */
  async infer(inputMatch: MatchData): Promise<AgentResult[]> {
    console.log(`[ORCHESTRATOR] Starting W-5 debate inference for ${inputMatch.teams.home} vs ${inputMatch.teams.away}`);

    // Enrich match details with stats, H2H, injuries & ELO if available
    const match = await enrichMatchDetails(inputMatch);

    // 1. Step 1: Match Strategist (Poisson Baseline)
    const strategistResult = await alphaInference.runAgent('match_strategist', match);

    // 2. Step 2: Odds Watcher (Evaluates and challenges Strategist's baseline)
    const oddsWatcherContext = `[Poisson Baseline]: ${strategistResult.findings.join(' | ')} (Predicted Score: ${strategistResult.predictedScore})`;
    const oddsWatcherResult = await alphaInference.runAgent('odds_watcher', match, oddsWatcherContext);

    // 3. Step 3: ML Validator (Cross-validates Poisson & Odds Flow)
    const mlContext = `[Poisson Baseline]: ${strategistResult.findings[0]}\n[Odds Flow Analysis]: ${oddsWatcherResult.findings[0]}`;
    const mlResult = await alphaInference.runAgent('ml_validator', match, mlContext);

    // 4. Step 4: Value Finder (Assesses EV+ edge)
    const valueContext = `[ML Validation]: ${mlResult.findings[0]}\n[Market Odds]: Win ${match.odds.win} / Draw ${match.odds.draw} / Loss ${match.odds.loss}`;
    const valueResult = await alphaInference.runAgent('value_finder', match, valueContext);

    // 5. Parallel Execution of Remaining Specialized Context Agents
    const remainingAgentIds = ['lineup_sentinel', 'tactical_genius', 'venue_expert', 'weather_analyst', 'motivation_scout'];
    const parallelPromises = remainingAgentIds.map(id => alphaInference.runAgent(id, match));
    const parallelResults = await Promise.all(parallelPromises);

    // Combine all 9 sub-agents
    const subResults = [
      strategistResult,
      oddsWatcherResult,
      mlResult,
      valueResult,
      ...parallelResults
    ];

    // 6. Calculate Weighted Consensus Confidence (clamped 0 ~ 1)
    let weightSum = 0;
    let weightedConfidenceSum = 0;
    subResults.forEach(r => {
      const weight = AGENT_REGISTRY[r.agentId]?.weight || 1.0;
      weightSum += weight;
      weightedConfidenceSum += (r.confidence * weight);
    });
    const rawConsensusConfidence = weightSum > 0 ? weightedConfidenceSum / weightSum : 0.75;
    const consensusConfidence = Math.min(Math.max(rawConsensusConfidence, 0), 1);

    // Build consolidated debate summary for final Alpha Consensus agent
    const fullDebateSummary = subResults
      .map(r => `[${r.name} (${r.role})]: Confidence ${(r.confidence * 100).toFixed(1)}% | Sentiment: ${r.sentiment}\n- Findings: ${r.findings.join('; ')}`)
      .join('\n\n');

    // 7. Execute Alpha Consensus Agent
    const consensusResult = await alphaInference.runAgent('alpha_consensus', match, fullDebateSummary);

    // Determine bookmaker odds based on consensus sentiment
    let bookmakerOdds = match.odds.win;
    if (consensusResult.sentiment === 'unfavorable') {
      bookmakerOdds = match.odds.loss;
    } else if (consensusResult.sentiment === 'stable') {
      bookmakerOdds = match.odds.draw;
    }

    // Fix C1: Select appropriate modelProb based on sentiment (favorable: winProb, unfavorable: lossProb, stable: drawProb)
    const impliedProb = bookmakerOdds > 0 ? (1 / bookmakerOdds) : 0.5;
    let edgeAdjustment = 0;
    if (consensusResult.sentiment === 'favorable') {
      edgeAdjustment = 0.08 + (consensusConfidence * 0.05);
    } else if (consensusResult.sentiment === 'unfavorable') {
      edgeAdjustment = -0.10;
    }
    const fallbackProb = Math.min(Math.max(impliedProb * (1 + edgeAdjustment), 0.05), 0.95);

    let modelProb = fallbackProb;
    if (consensusResult.sentiment === 'favorable') {
      modelProb = consensusResult.winProb ?? fallbackProb;
    } else if (consensusResult.sentiment === 'unfavorable') {
      modelProb = consensusResult.lossProb ?? fallbackProb;
    } else {
      modelProb = consensusResult.drawProb ?? fallbackProb;
    }

    // 8. Calculate Kelly Criterion using modelProb, bookmakerOdds, and consensusConfidence threshold
    const kelly = calcKelly(modelProb, bookmakerOdds, consensusConfidence);
    consensusResult.kellyResult = kelly;
    consensusResult.confidence = consensusConfidence;

    console.log(`[ORCHESTRATOR] Debate complete. Consensus Confidence: ${(consensusConfidence * 100).toFixed(1)}%, Rec: ${kelly.recommendation}`);

    // Return total 10 agent results
    return [...subResults, consensusResult];
  }
}

export const alphaOrchestrator = new AlphaOrchestrator();
