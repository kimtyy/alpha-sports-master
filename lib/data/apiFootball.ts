import { MatchData } from '../agents/orchestrator';
import { MOCK_MATCHES } from './matches';

const API_KEY = process.env.APIFOOTBALL_KEY || '';
const BASE_URL = 'https://v3.football.api-sports.io';

const getLeagueAbbr = (id: number, name: string): string => {
  switch (id) {
    case 39: return 'EPL';
    case 140: return 'LALIGA';
    case 78: return 'BUND';
    case 61: return 'LIGUE1';
    case 292: return 'KLEAGUE';
    default: return name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 5).toUpperCase();
  }
};

const getTeamAbbr = (name: string): string => {
  const clean = name.replace(/[^a-zA-Z0-9]/g, '');
  return clean.length >= 3 ? clean.slice(0, 3).toUpperCase() : name.slice(0, 3).toUpperCase();
};

const getFallbackOdds = (fixtureId: number) => {
  const seed = fixtureId % 100;
  const win = 1.5 + (seed % 15) * 0.1; // 1.5 to 2.9
  const draw = 3.0 + (seed % 6) * 0.1; // 3.0 to 3.5
  const loss = 2.0 + (seed % 25) * 0.2; // 2.0 to 6.8
  return {
    win: Math.round(win * 100) / 100,
    draw: Math.round(draw * 100) / 100,
    loss: Math.round(loss * 100) / 100
  };
};

export async function fetchTodayMatches(): Promise<MatchData[]> {
  console.log('[API_FOOTBALL] Starting fetchTodayMatches...');

  if (!API_KEY || API_KEY === 'your_api_football_key_here') {
    console.warn('[API_FOOTBALL] APIFOOTBALL_KEY is missing or using default placeholder. Graceful fallback to MOCK_MATCHES.');
    return MOCK_MATCHES;
  }

  try {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(now.getTime() - offset)).toISOString();
    const todayDate = localISOTime.split('T')[0];

    const leagues = '39,140,78,61,292';
    const season = '2024';

    console.log(`[API_FOOTBALL] Fetching fixtures for Date: ${todayDate}, Leagues: ${leagues}, Season: ${season}`);

    // 1. Fetch Today's Fixtures
    const fixturesRes = await fetch(
      `${BASE_URL}/fixtures?date=${todayDate}&league=${leagues}&season=${season}`,
      {
        method: 'GET',
        headers: {
          'x-apisports-key': API_KEY,
        },
        next: { revalidate: 3600 } // Cache for 1 hour
      }
    );

    if (!fixturesRes.ok) {
      throw new Error(`Failed to fetch fixtures: ${fixturesRes.statusText}`);
    }

    const fixturesJson = await fixturesRes.json();
    const fixturesList = fixturesJson.response || [];

    if (fixturesList.length === 0) {
      console.warn('[API_FOOTBALL] No fixtures found for today. Returning MOCK_MATCHES.');
      return MOCK_MATCHES;
    }

    // 2. Fetch Odds for Today
    console.log(`[API_FOOTBALL] Fetching odds for today...`);
    const oddsRes = await fetch(
      `${BASE_URL}/odds?date=${todayDate}&season=${season}`,
      {
        method: 'GET',
        headers: {
          'x-apisports-key': API_KEY,
        },
        next: { revalidate: 3600 }
      }
    );

    const oddsMap: Record<number, { win: number; draw: number; loss: number }> = {};
    if (oddsRes.ok) {
      const oddsJson = await oddsRes.json();
      const oddsList = oddsJson.response || [];
      
      for (const item of oddsList) {
        const fixtureId = item.fixture.id;
        const bookmaker = item.bookmakers.find((b: any) => b.name === 'Bet365') || item.bookmakers[0];
        if (bookmaker) {
          const bet = bookmaker.bets.find((b: any) => b.name === 'Match Winner');
          if (bet) {
            const homeOdd = bet.values.find((v: any) => v.value === 'Home')?.odd;
            const drawOdd = bet.values.find((v: any) => v.value === 'Draw')?.odd;
            const awayOdd = bet.values.find((v: any) => v.value === 'Away')?.odd;
            if (homeOdd && drawOdd && awayOdd) {
              oddsMap[fixtureId] = {
                win: parseFloat(homeOdd),
                draw: parseFloat(drawOdd),
                loss: parseFloat(awayOdd)
              };
            }
          }
        }
      }
    } else {
      console.warn('[API_FOOTBALL] Odds query returned an error. Using fallbacks for odds.');
    }

    // 3. Map to MatchData interface
    const mappedMatches: MatchData[] = fixturesList.map((item: any, index: number) => {
      const fixtureId = item.fixture.id;
      const homeTeam = item.teams.home.name;
      const awayTeam = item.teams.away.name;
      const leagueName = item.league.name;
      const leagueId = item.league.id;
      const startTime = item.fixture.date;

      const odds = oddsMap[fixtureId] || getFallbackOdds(fixtureId);
      const leagueAbbr = getLeagueAbbr(leagueId, leagueName);
      const homeAbbr = getTeamAbbr(homeTeam);
      const awayAbbr = getTeamAbbr(awayTeam);
      const code = `${leagueAbbr}-2425-${homeAbbr}-${awayAbbr}`;

      return {
        id: fixtureId.toString(),
        code,
        teams: {
          home: homeTeam.toUpperCase(),
          away: awayTeam.toUpperCase()
        },
        league: leagueName,
        odds,
        startTime,
        isFeatured: index === 0, // Mark first match as featured
        previewScore: `${Math.floor(Math.random() * 3)}:${Math.floor(Math.random() * 3)}`
      };
    });

    console.log(`[API_FOOTBALL] Successfully mapped ${mappedMatches.length} live matches.`);
    return mappedMatches;

  } catch (error) {
    console.error('[API_FOOTBALL] Error in fetchTodayMatches. Performing graceful fallback to MOCK_MATCHES.', error);
    return MOCK_MATCHES;
  }
}
