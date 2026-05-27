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
    case 135: return 'SERIEA';
    case 2: return 'UCL';
    case 3: return 'UEL';
    case 292: return 'K1';
    case 293: return 'K2';
    case 98: return 'J1';
    case 169: return 'CSL';
    case 253: return 'MLS';
    case 71: return 'BRA1';
    case 128: return 'ARG1';
    case 1: return 'WC';
    case 17: return 'ACL';
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

    // API-Football v3 accepts only ONE league per request
    // Filtered to Betman supported leagues only:
    // - K League 1/2, Premier League, La Liga, Bundesliga, Serie A, Ligue 1
    const leagueConfigs = [
      { id: 39, season: '2025' }, // EPL
      { id: 140, season: '2025' }, // 라리가
      { id: 78, season: '2025' }, // 분데스리가
      { id: 61, season: '2025' }, // 리그1
      { id: 135, season: '2025' }, // 세리에A
      { id: 292, season: '2025' }, // K리그1
      { id: 293, season: '2025' }  // K리그2
    ];

    console.log(`[API_FOOTBALL] Fetching fixtures for Date: ${todayDate}, ${leagueConfigs.length} leagues`);

    // 1. Fetch Today's Fixtures (per-league, parallel)
    const fixturePromises = leagueConfigs.map(config =>
      fetch(
        `${BASE_URL}/fixtures?date=${todayDate}&league=${config.id}&season=${config.season}`,
        {
          method: 'GET',
          headers: {
            'x-apisports-key': API_KEY,
          },
          next: { revalidate: 3600 } // Cache for 1 hour
        }
      ).then(async res => {
        if (!res.ok) {
          console.warn(`[API_FOOTBALL] League ${config.id} fetch failed: ${res.status} ${res.statusText}`);
          return [];
        }
        const json = await res.json();
        console.log(`[API_FOOTBALL] League ${config.id}: ${json.response?.length ?? 0} fixtures, errors: ${JSON.stringify(json.errors || {})}`);
        return json.response || [];
      }).catch(err => {
        console.warn(`[API_FOOTBALL] League ${config.id} error:`, err);
        return [];
      })
    );

    const allResults = await Promise.all(fixturePromises);
    const fixturesList = allResults.flat();

    console.log(`[API_FOOTBALL] Total fixtures found: ${fixturesList.length}`);

    if (fixturesList.length === 0) {
      console.warn('[API_FOOTBALL] No fixtures found for today across all leagues. Returning MOCK_MATCHES.');
      return MOCK_MATCHES;
    }

    // 2. Fetch Odds for Today
    console.log(`[API_FOOTBALL] Fetching odds for today...`);
    const oddsMap: Record<number, { win: number; draw: number; loss: number }> = {};

    const fetchSeasonOdds = async (seasonStr: string) => {
      try {
        const oddsRes = await fetch(
          `${BASE_URL}/odds?date=${todayDate}&season=${seasonStr}`,
          {
            method: 'GET',
            headers: {
              'x-apisports-key': API_KEY,
            },
            next: { revalidate: 3600 }
          }
        );

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
          console.warn(`[API_FOOTBALL] Odds query returned an error for season ${seasonStr}.`);
        }
      } catch (err) {
        console.error(`[API_FOOTBALL] Error fetching odds for season ${seasonStr}`, err);
      }
    };

    await Promise.all([fetchSeasonOdds('2025'), fetchSeasonOdds('2026')]);

    // 3. Map to MatchData interface
    const mappedMatches: MatchData[] = fixturesList.map((item: any, index: number) => {
      const fixtureId = item.fixture.id;
      const homeTeam = item.teams.home.name;
      const awayTeam = item.teams.away.name;
      const leagueName = item.league.name;
      const leagueId = item.league.id;
      const startTime = item.fixture.date;
      const city = item.fixture.venue?.city || '';

      const odds = oddsMap[fixtureId] || getFallbackOdds(fixtureId);
      const leagueAbbr = getLeagueAbbr(leagueId, leagueName);
      const homeAbbr = getTeamAbbr(homeTeam);
      const awayAbbr = getTeamAbbr(awayTeam);
      const code = `${leagueAbbr}-2526-${homeAbbr}-${awayAbbr}`;

      return {
        id: fixtureId.toString(),
        code,
        sport: 'soccer',
        city,
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
