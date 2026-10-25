import { supabase } from './supabase';
import { MatchData, AgentResult, alphaOrchestrator } from './agents/orchestrator';

/**
 * Retrieves cached analysis from Supabase `match_analyses` table if available,
 * otherwise executes fresh 10-agent orchestration debate and persists the result.
 */
export async function getOrRunMatchAnalysis(match: MatchData): Promise<AgentResult[]> {
  const matchId = match.id;

  try {
    // 1. Check if cached analysis exists in match_analyses table
    const { data: cached, error } = await supabase
      .from('match_analyses')
      .select('*')
      .eq('match_id', matchId)
      .single();

    if (!error && cached && cached.agent_scores && Array.isArray(cached.agent_scores) && cached.agent_scores.length > 0) {
      console.log(`[ANALYSIS_CACHE] Cache hit! Returning existing AI analysis for match_id: ${matchId}`);
      return cached.agent_scores as AgentResult[];
    }
  } catch (err) {
    console.warn(`[ANALYSIS_CACHE] Cache check notice for ${matchId}:`, err);
  }

  // 2. If no cache, run AI Orchestrator 10-agent debate analysis
  console.log(`[ANALYSIS] Executing fresh AI 10-agent debate for match_id: ${matchId}`);
  const results = await alphaOrchestrator.infer(match);

  // Extract key metrics from consensus agent (last item)
  const consensusResult = results[results.length - 1];
  const kellyResult = consensusResult?.kellyResult;

  const confidenceScore = kellyResult?.confidenceScore ?? consensusResult?.confidence ?? 0.75;
  const isValueBet = kellyResult?.isValueBet ?? false;
  const kellyPercent = kellyResult?.fractionalKelly ? Math.round(kellyResult.fractionalKelly * 100) : 0;
  const predictedScore = consensusResult?.predictedScore || match.previewScore || '2:1';

  // 3. Save complete snapshot to Supabase match_analyses table
  try {
    const record = {
      match_id: matchId,
      home_team: match.teams.home,
      away_team: match.teams.away,
      league: match.league,
      match_date: match.startTime,
      home_elo: match.elo?.home || 1500,
      away_elo: match.elo?.away || 1500,
      confidence_score: confidenceScore,
      is_value_bet: isValueBet,
      kelly_percent: kellyPercent,
      predicted_score: predictedScore,
      agent_scores: results,
      team_stats: match.stats || {},
      h2h_record: match.h2hRecord || match.stats?.headToHead || '',
      injuries: match.injuries || { home: [], away: [] },
      created_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('match_analyses')
      .upsert(record, { onConflict: 'match_id' });

    if (error) {
      console.warn(`[ANALYSIS] Supabase match_analyses insert warning:`, error.message);
    } else {
      console.log(`[ANALYSIS] Successfully saved analysis record for ${matchId} to Supabase.`);
    }
  } catch (err) {
    console.error(`[ANALYSIS] Error persisting analysis to Supabase:`, err);
  }

  return results;
}
