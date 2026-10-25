import { supabase } from './supabase';

const DEFAULT_ELO = 1500;
const K_FACTOR = 32;

export interface EloRating {
  team_name: string;
  rating: number;
  updated_at: string;
}

/**
 * Calculates updated ELO ratings after a match.
 */
export function calculateElo(
  ratingA: number,
  ratingB: number,
  scoreA: number,
  scoreB: number,
  kFactor: number = K_FACTOR
): { newRatingA: number; newRatingB: number } {
  // Expected probability of team A winning
  const expectedA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  const expectedB = 1 - expectedA;

  // Actual outcome
  let actualA = 0.5;
  if (scoreA > scoreB) actualA = 1.0;
  else if (scoreA < scoreB) actualA = 0.0;

  const actualB = 1.0 - actualA;

  // Goal difference multiplier
  const goalDiff = Math.abs(scoreA - scoreB);
  const marginMult = goalDiff <= 1 ? 1.0 : goalDiff === 2 ? 1.5 : (11 + goalDiff) / 8;

  const newRatingA = Math.round(ratingA + kFactor * marginMult * (actualA - expectedA));
  const newRatingB = Math.round(ratingB + kFactor * marginMult * (actualB - expectedB));

  return { newRatingA, newRatingB };
}

/**
 * Calculates win probability based on ELO ratings.
 */
export function getEloWinProbability(ratingA: number, ratingB: number, homeAdvantage: number = 50): number {
  const adjustedRatingA = ratingA + homeAdvantage;
  return 1 / (1 + Math.pow(10, (ratingB - adjustedRatingA) / 400));
}

/**
 * Fetches team ELO rating from Supabase `elo_ratings` table, falling back to 1500.
 */
export async function getTeamElo(teamName: string): Promise<number> {
  if (!teamName) return DEFAULT_ELO;
  
  try {
    const cleanName = teamName.trim().toUpperCase();
    const { data, error } = await supabase
      .from('elo_ratings')
      .select('rating')
      .eq('team_name', cleanName)
      .single();

    if (error || !data) {
      return DEFAULT_ELO;
    }
    return data.rating || DEFAULT_ELO;
  } catch (err) {
    console.warn(`[ELO] Error fetching ELO for ${teamName}:`, err);
    return DEFAULT_ELO;
  }
}

/**
 * Updates team ELO rating in Supabase `elo_ratings` table.
 */
export async function saveTeamElo(teamName: string, newRating: number): Promise<void> {
  if (!teamName) return;

  try {
    const cleanName = teamName.trim().toUpperCase();
    const { error } = await supabase
      .from('elo_ratings')
      .upsert({
        team_name: cleanName,
        rating: newRating,
        updated_at: new Date().toISOString()
      }, { onConflict: 'team_name' });

    if (error) {
      console.warn(`[ELO] Error upserting ELO for ${cleanName}:`, error.message);
    }
  } catch (err) {
    console.error(`[ELO] Save error:`, err);
  }
}
