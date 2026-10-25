import type { AgentResult, MatchData } from './orchestrator';

// Predictions remain unavailable until an evidence-backed, calibrated model is integrated.
// Never manufacture analysis when a provider fails or credentials are missing.
export class AlphaInference {
  async runAgent(_agentId: string, _match: MatchData, _context?: string): Promise<AgentResult> {
    throw new Error('검증된 예측 모델이 연결되지 않아 분석을 제공할 수 없습니다.');
  }
}
export const alphaInference = new AlphaInference();
