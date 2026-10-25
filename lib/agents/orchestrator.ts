import type { KellyResult } from '../kelly';

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
  sport?: string;
  city?: string;
  teams: { home: string; away: string };
  league: string;
  odds: { win: number; draw: number; loss: number };
  startTime: string;
  isFeatured?: boolean;
  previewScore?: string;
  fixtureStatus?: string;
  dataSource?: string;
  fetchedAt?: string;
  oddsStatus?: 'AVAILABLE' | 'UNAVAILABLE';
  bookmaker?: string;
  stats?: {
    home: { form: string; xG: number; goalsScored: number; goalsConceded: number; winRate: number };
    away: { form: string; xG: number; goalsScored: number; goalsConceded: number; winRate: number };
    headToHead: string;
  };
}

export class AlphaOrchestrator {
  async infer(_match: MatchData): Promise<AgentResult[]> {
    throw new Error('검증된 예측 모델이 연결되지 않아 분석을 제공할 수 없습니다.');
  }
}
export const alphaOrchestrator = new AlphaOrchestrator();
