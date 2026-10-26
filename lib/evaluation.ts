import type { MatchData } from './agents/orchestrator';

export function marketProbabilities(odds: number[]) {
  if (odds.length !== 3 || !odds.every(n => Number.isFinite(n) && n > 1)) throw new Error('INVALID_ODDS');
  const weights = odds.map(n => 1 / n);
  const total = weights.reduce((a, b) => a + b, 0);
  return weights.map(n => n / total);
}

export function baselineSnapshot(match: MatchData, now = Date.now()) {
  const kickoff = Date.parse(match.startTime);
  const observed = Date.parse(match.fetchedAt || '');
  const id = match.rawIds?.fixtureId;
  if (!Number.isSafeInteger(id) || !id || id < 1 || match.fixtureStatus !== 'NS' ||
      match.oddsStatus !== 'AVAILABLE' || !match.bookmaker ||
      !Number.isFinite(kickoff) || kickoff <= now + 5 * 60_000 ||
      !Number.isFinite(observed) || observed > now || now - observed > 15 * 60_000) return null;
  try { marketProbabilities([match.odds.win, match.odds.draw, match.odds.loss]); } catch { return null; }
  return { fixture_id: id, home_team: match.teams.home, away_team: match.teams.away,
    league: match.league, kickoff_at: match.startTime, observed_at: match.fetchedAt,
    bookmaker: match.bookmaker, odds_home: match.odds.win, odds_draw: match.odds.draw, odds_away: match.odds.loss };
}

export function evaluationMetrics(rows: any[]) {
  let settled = 0, correct = 0, brierSum = 0, tied = 0;
  for (const row of rows) {
    if (!row.settled_at || row.excluded_reason || ![row.result_home, row.result_away].every(n => Number.isInteger(n) && n >= 0)) continue;
    const p = marketProbabilities([row.odds_home, row.odds_draw, row.odds_away]);
    const outcome = row.result_home > row.result_away ? 0 : row.result_home < row.result_away ? 2 : 1;
    const max = Math.max(...p);
    const winners = p.map((n, i) => Math.abs(n - max) < 1e-12 ? i : -1).filter(i => i >= 0);
    settled++;
    if (winners.length > 1) tied++;
    else if (winners[0] === outcome) correct++;
    brierSum += p.reduce((sum, n, i) => sum + (n - (i === outcome ? 1 : 0)) ** 2, 0);
  }
  return { total: rows.length, settled, pending: rows.filter(r => !r.settled_at && !r.excluded_reason).length,
    excluded: rows.filter(r => r.excluded_reason).length, tied,
    accuracy: settled - tied > 0 ? correct / (settled - tied) : null,
    brier: settled > 0 ? brierSum / settled : null };
}

export async function captureBaseline(db: any, matches: MatchData[]) {
  let inserted = 0, duplicates = 0, failed = 0, skipped = 0;
  for (const match of matches) {
    const row = baselineSnapshot(match);
    if (!row) { skipped++; continue; }
    const { error } = await db.from('market_baseline_records').insert(row);
    if (error?.code === '23505') duplicates++;
    else if (error) failed++;
    else inserted++;
  }
  return { inserted, duplicates, failed, skipped };
}

export function baselineResultPatch(row: any, fixture: any, now = Date.now()) {
  if (String(fixture?.fixture?.id) !== String(row.fixture_id)) throw new Error('FIXTURE_MISMATCH');
  const status = fixture.fixture.status?.short;
  const checked = { last_checked_at: new Date(now).toISOString() };
  // Changed kickoff invalidates a snapshot rather than silently changing its horizon.
  const kickoff = Date.parse(fixture.fixture.date);
  if (!Number.isFinite(kickoff)) throw new Error('INVALID_KICKOFF');
  if (kickoff !== Date.parse(row.kickoff_at)) return { ...checked, excluded_reason: 'KICKOFF_CHANGED' };
  if (['CANC','ABD','AWD','WO','AET','PEN'].includes(status)) return { ...checked, excluded_reason: status };
  if (status !== 'FT') return checked;
  const home = fixture.goals?.home, away = fixture.goals?.away;
  if (![home, away].every(n => Number.isInteger(n) && n >= 0) || now <= kickoff) throw new Error('INVALID_FINAL_SCORE');
  return { ...checked, result_home: home, result_away: away, settled_at: new Date(now).toISOString() };
}

export async function settleBaseline(db: any, getFixture: (id: string) => Promise<any>) {
  const { data, error } = await db.from('market_baseline_records').select('*')
    .is('settled_at', null).is('excluded_reason', null)
    .lte('kickoff_at', new Date(Date.now() - 3 * 60 * 60_000).toISOString())
    .order('last_checked_at', { ascending: true, nullsFirst: true }).order('fixture_id').limit(60);
  if (error) throw new Error('BASELINE_READ_FAILED');
  let settled = 0, excluded = 0, failed = 0, checked = 0;
  const deadline = Date.now() + 100_000;
  for (const row of data || []) {
    if (Date.now() > deadline) break;
    try {
      const patch = baselineResultPatch(row, await getFixture(String(row.fixture_id)));
      const { data: saved, error: writeError } = await db.from('market_baseline_records').update(patch)
        .eq('fixture_id', row.fixture_id).is('settled_at', null).is('excluded_reason', null).select('fixture_id');
      if (writeError) throw new Error('BASELINE_WRITE_FAILED');
      if (saved?.length) { checked++; if ('settled_at' in patch) settled++; if ('excluded_reason' in patch) excluded++; }
    } catch {
      failed++;
      // Rotate failed lookups so one permanently broken fixture cannot starve others.
      await db.from('market_baseline_records').update({last_checked_at:new Date().toISOString()})
        .eq('fixture_id',row.fixture_id).is('settled_at',null).is('excluded_reason',null);
    }
  }
  return { checked, settled, excluded, failed, deferred: (data?.length || 0) - checked - failed };
}
