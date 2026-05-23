export interface KellyResult {
  impliedProb: number;
  edge: number;
  kellyFraction: number;
  isValueBet: boolean;
  recommendation: 'BET' | 'SKIP';
  fractionalKelly: number;  // kellyFraction * 0.25 (보수적 운용)
}

export function calcKelly(modelProb: number, bookmakerOdds: number): KellyResult {
  const impliedProb = bookmakerOdds > 0 ? 1 / bookmakerOdds : 0;
  const edge = modelProb - impliedProb;

  let kellyFraction = 0;
  // f* = (p - p̃) / (1 - p̃)
  if (1 - impliedProb > 0) {
    kellyFraction = edge / (1 - impliedProb);
  }

  // f*가 0 이하면 Value Bet 없음 → 베팅 금지
  const isValueBet = kellyFraction > 0;
  const recommendation = isValueBet ? 'BET' : 'SKIP';
  const fractionalKelly = isValueBet ? kellyFraction * 0.25 : 0;

  return {
    impliedProb,
    edge,
    kellyFraction: isValueBet ? kellyFraction : 0,
    isValueBet,
    recommendation,
    fractionalKelly,
  };
}
