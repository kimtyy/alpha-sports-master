export interface KellyResult {
  impliedProb: number;
  edge: number;
  kellyFraction: number;
  isValueBet: boolean;
  recommendation: 'BET' | 'SKIP';
  fractionalKelly: number;  // kellyFraction * 0.25 (보수적 운용)
  confidenceScore: number;  // 에이전트 컨센서스 신뢰도 점수
}

export function calcKelly(modelProb: number, bookmakerOdds: number, confidenceScore: number = 0.80): KellyResult {
  if (bookmakerOdds <= 0) {
    return {
      impliedProb: 0,
      edge: 0,
      kellyFraction: 0,
      isValueBet: false,
      recommendation: 'SKIP',
      fractionalKelly: 0,
      confidenceScore,
    };
  }

  const impliedProb = 1 / bookmakerOdds;
  const edge = modelProb - impliedProb;

  let kellyFraction = 0;
  // f* = (p - p̃) / (1 - p̃)
  if (1 - impliedProb > 0) {
    kellyFraction = edge / (1 - impliedProb);
  }

  const meetsConfidence = confidenceScore >= 0.75;
  const isValueBet = kellyFraction > 0 && meetsConfidence;
  const recommendation = isValueBet ? 'BET' : 'SKIP';

  const fractionalKelly = isValueBet 
    ? Math.min(kellyFraction * 0.25, 0.25) 
    : 0;

  return {
    impliedProb,
    edge,
    kellyFraction: isValueBet ? kellyFraction : 0,
    isValueBet,
    recommendation,
    fractionalKelly,
    confidenceScore,
  };
}
