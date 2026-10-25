import type { MatchData, AgentResult } from './agents/orchestrator';
// Legacy cache may contain simulated predictions; never serve it as validated analysis.
export async function getOrRunMatchAnalysis(_match: MatchData): Promise<AgentResult[]> {
  throw new Error('검증된 예측 모델이 연결되지 않아 분석을 제공할 수 없습니다.');
}
