import { alphaInference } from './inference';
import { AGENT_REGISTRY } from './config';

export interface AgentResult {
  agentId: string;
  name: string;
  role: string;
  confidence: number;
  sentiment: 'favorable' | 'unfavorable' | 'stable';
  findings: string[];
  predictedScore?: string; // e.g., "2:1"
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

    // 4. Return total 10-agent results
    return [...subResults, consensusResult];
  }
}

export const alphaOrchestrator = new AlphaOrchestrator();
