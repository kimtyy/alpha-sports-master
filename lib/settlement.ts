export function normalizePick(pick: unknown): 'home' | 'draw' | 'away' | null {
  if (typeof pick !== 'string') return null;
  const value = pick.trim().toLowerCase();
  if (['win', 'home', 'h'].includes(value)) return 'home';
  if (['draw', 'd'].includes(value)) return 'draw';
  if (['loss', 'away', 'a'].includes(value)) return 'away';
  return null;
}

// Match Winner is a regulation-time market. AET/PEN require an explicit
// regulation score contract; do not silently settle those using final goals.
export function settledOutcome(fixture: any, expectedId: string) {
  if (String(fixture?.fixture?.id) !== expectedId || fixture?.fixture?.status?.short !== 'FT') return null;
  const home = fixture.goals?.home;
  const away = fixture.goals?.away;
  if (![home, away].every(n => Number.isInteger(n) && n >= 0)) return null;
  return { score: `${home}:${away}`, outcome: home > away ? 'home' : home < away ? 'away' : 'draw' };
}

export async function settlePending(db: any, getFixture: (id: string) => Promise<any>) {
  // Page through pending records so a group of postponed games cannot starve
  // later fixtures. Refuse an oversized backlog instead of silently truncating.
  const data: any[] = [];
  const cutoff = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
  for (let offset = 0; ; offset += 200) {
    const { data: page, error } = await db.from('bookmarks').select('id,match_id,pick')
      .is('is_correct', null).not('pick', 'is', null).lte('kickoff_time', cutoff)
      .order('id').range(offset, offset + 199);
    if (error) throw new Error('BOOKMARK_READ_FAILED');
    data.push(...(page || []));
    if (!page || page.length < 200) break;
    if (data.length >= 10000) throw new Error('SETTLEMENT_BACKLOG_TOO_LARGE');
  }
  const groups = new Map<string, any[]>();
  let skipped = 0;
  for (const row of data || []) {
    if (!/^\d+$/.test(String(row.match_id)) || !normalizePick(row.pick)) { skipped++; continue; }
    const id = String(row.match_id);
    groups.set(id, [...(groups.get(id) || []), row]);
  }
  let updated = 0;
  let failed = 0;
  for (const [id, rows] of groups) {
    try {
      const result = settledOutcome(await getFixture(id), id);
      if (!result) { skipped += rows.length; continue; }
      for (const row of rows) {
        const { data: saved, error: saveError } = await db.from('bookmarks').update({
          actual_result: result.score,
          is_correct: normalizePick(row.pick) === result.outcome,
        }).eq('id', row.id).eq('pick', row.pick).is('is_correct', null).select('id');
        if (saveError) failed++;
        else updated += saved?.length || 0;
      }
    } catch { failed += rows.length; }
  }
  // Elo writes are deliberately paused. The legacy bookmark-driven updates
  // counted a fixture once per user; rebuilding requires a fixture ledger.
  return { processed: data?.length || 0, updated, skipped, failed, eloUpdates: 'paused' };
}
