import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { calculateElo, getTeamElo, saveTeamElo } from '@/lib/elo';

const API_KEY = process.env.APIFOOTBALL_KEY || '';
const BASE_URL = 'https://v3.football.api-sports.io';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // C3: Bearer Token Authorization check if CRON_SECRET is set
  if (process.env.CRON_SECRET) {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  console.log('[CRON_UPDATE_RESULTS] Starting automated match results check...');

  try {
    const { data: pendingBookmarks, error: fetchErr } = await supabase
      .from('bookmarks')
      .select('*')
      .is('is_correct', null);

    if (fetchErr) {
      console.error('[CRON_UPDATE_RESULTS] Supabase fetch error:', fetchErr.message);
      return NextResponse.json({ success: false, error: fetchErr.message }, { status: 500 });
    }

    if (!pendingBookmarks || pendingBookmarks.length === 0) {
      return NextResponse.json({ success: true, message: 'No pending matches to update.' });
    }

    const nowTime = Date.now();
    const THREE_HOURS_MS = 3 * 60 * 60 * 1000;
    const updatedRecords: any[] = [];

    for (const bookmark of pendingBookmarks) {
      // C4: Skip determination if bookmark has no pick (null or empty)
      if (!bookmark.pick) {
        console.log(`[CRON] Bookmark ${bookmark.id} has no pick, skipping outcome determination.`);
        continue;
      }

      // H3: Calculate 3 hours post match using kickoff_time (fallback bet_date / created_at)
      const matchDateStr = bookmark.kickoff_time || bookmark.bet_date || bookmark.created_at;
      const matchTime = new Date(matchDateStr).getTime();

      if (nowTime - matchTime < THREE_HOURS_MS) {
        continue;
      }

      const matchId = bookmark.match_id;

      if (API_KEY && matchId && !isNaN(Number(matchId))) {
        try {
          const res = await fetch(`${BASE_URL}/fixtures?id=${matchId}`, {
            headers: { 'x-apisports-key': API_KEY },
            cache: 'no-store'
          });

          if (res.ok) {
            const json = await res.json();
            const fixtureData = json.response?.[0];

            if (fixtureData && fixtureData.fixture.status.short === 'FT') {
              const homeGoals = fixtureData.goals.home;
              const awayGoals = fixtureData.goals.away;
              const actualResultScore = `${homeGoals}:${awayGoals}`;

              let actualOutcome: 'home' | 'draw' | 'away' = 'draw';
              if (homeGoals > awayGoals) actualOutcome = 'home';
              else if (homeGoals < awayGoals) actualOutcome = 'away';

              // C4: Calculate is_correct based on saved pick
              const rawPick = (bookmark.pick || 'home').toLowerCase();
              let userPick: 'home' | 'draw' | 'away' = 'home';
              if (rawPick === 'win' || rawPick === 'home' || rawPick === 'h') userPick = 'home';
              else if (rawPick === 'loss' || rawPick === 'away' || rawPick === 'a') userPick = 'away';
              else if (rawPick === 'draw' || rawPick === 'd') userPick = 'draw';

              const isCorrect = userPick === actualOutcome;

              await supabase
                .from('bookmarks')
                .update({
                  actual_result: actualResultScore,
                  is_correct: isCorrect,
                  updated_at: new Date().toISOString()
                })
                .eq('id', bookmark.id);

              const homeTeam = bookmark.home_team || fixtureData.teams.home.name;
              const awayTeam = bookmark.away_team || fixtureData.teams.away.name;

              if (homeTeam && awayTeam) {
                const [homeElo, awayElo] = await Promise.all([
                  getTeamElo(homeTeam),
                  getTeamElo(awayTeam)
                ]);
                const { newRatingA, newRatingB } = calculateElo(homeElo, awayElo, homeGoals, awayGoals);

                await Promise.all([
                  saveTeamElo(homeTeam, newRatingA),
                  saveTeamElo(awayTeam, newRatingB)
                ]);
              }

              updatedRecords.push({ matchId, actualResultScore, userPick, actualOutcome, isCorrect });
            }
          }
        } catch (err) {
          console.warn(`[CRON_UPDATE_RESULTS] Error updating match ${matchId}:`, err);
        }
      }
    }

    return NextResponse.json({
      success: true,
      processed: pendingBookmarks.length,
      updatedCount: updatedRecords.length,
      updatedRecords
    });
  } catch (error: any) {
    console.error('[CRON_UPDATE_RESULTS] Global error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Server error' }, { status: 500 });
  }
}
