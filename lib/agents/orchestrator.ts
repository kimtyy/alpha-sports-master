import { alphaInference } from './inference';
import { AGENT_REGISTRY } from './config';
import { calcKelly, KellyResult } from '../kelly';

export interface AgentResult {
  agentId: string;
  name: string;
  role: string;
  confidence: number;
  sentiment: 'favorable' | 'unfavorable' | 'stable';
  findings: string[];
  predictedScore?: string; // e.g., "2:1"
  kellyResult?: KellyResult;
}

export interface MatchData {
  id: string;
  code: string;
  teams: { home: string; away: string };
  league: string;
  odds: { win: number; draw: number; loss: number };
  startTime: string;
  isFeatured?: boolean;
  previewScore?: string;
  stats?: {
    home: { form: string; xG: number; goalsScored: number; goalsConceded: number; winRate: number };
    away: { form: string; xG: number; goalsScored: number; goalsConceded: number; winRate: number };
    headToHead: string;
  };
}

export class AlphaOrchestrator {
  /**
   * 10-AGENT ORCHESTRATION ENGINE
   * Executes 9 specialized agents in parallel, then 1 consensus agent.
   */
  async infer(match: MatchData): Promise<AgentResult[]> {
    console.log(`[ORCHESTRATOR] Starting inference for ${match.teams.home} vs ${match.teams.away}`);

    // 1. Filter out the consensus agent for phase 1
    const subAgentIds = Object.keys(AGENT_REGISTRY).filter(id => id !== 'alpha_consensus');

    // 2. Phase 1: Parallel Execution of 9 Agents
    const subAgentPromises = subAgentIds.map(id => alphaInference.runAgent(id, match));
    const subResults = await Promise.all(subAgentPromises);

    console.log(`[ORCHESTRATOR] Sub-agent inference complete. Synthesizing consensus...`);

    // 3. Phase 2: Consensus Aggregation
    // Consolidate findings to provide as 'context' to the consensus agent
    const context = subResults
      .map(r => `${r.name}: ${r.findings[1]}`)
      .join('\n');

    const consensusResult = await alphaInference.runAgent('alpha_consensus', match, context);

    // Calculate modelProb (weighted average of sub-agent confidences)
    let weightSum = 0;
    let weightedConfidenceSum = 0;
    subResults.forEach(r => {
      const weight = AGENT_REGISTRY[r.agentId]?.weight || 1.0;
      weightSum += weight;
      weightedConfidenceSum += (r.confidence * weight);
    });
    const modelProb = weightSum > 0 ? weightedConfidenceSum / weightSum : 0.5;

    // Determine bookmaker odds based on consensus sentiment
    let bookmakerOdds = match.odds.win;
    if (consensusResult.sentiment === 'unfavorable') {
      bookmakerOdds = match.odds.loss;
    } else if (consensusResult.sentiment === 'stable') {
      bookmakerOdds = match.odds.draw;
    }

    // Calculate Kelly Criterion
    const kelly = calcKelly(modelProb, bookmakerOdds);
    consensusResult.kellyResult = kelly;

    // 4. Return total 10-agent results
    return [...subResults, consensusResult];
  }
}

export const alphaOrchestrator = new AlphaOrchestrator();
