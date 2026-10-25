import { MatchData } from '../agents/orchestrator';
import { MOCK_MATCHES } from './matches';
import { getTeamElo } from '../elo';

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
    case 88: return 'ERD';    // 에레디비지에
    case 94: return 'POR1';  // 포르투갈 프리메이라
    case 235: return 'RPL';  // 러시아 프리미어리그
    // A매치 국제대회
    case 10: return 'FIFAFR';  // FIFA 국제 친선경기
    case 5: return 'UEFANL';  // UEFA 네이션스리그
    case 30: return 'AFCWCQ'; // AFC 아시아 월드컵 예선
    case 4: return 'EURQ';    // UEFA 유로 예선
    case 9: return 'COPA';    // 코파 아메리카
    case 6: return 'AFCON';   // 아프리카 네이션스컵
    default: return name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 5).toUpperCase();
  }
};


const getTeamAbbr = (name: string): string => {
  const clean = name.replace(/[^a-zA-Z0-9]/g, '');
  return clean.length >= 3 ? clean.slice(0, 3).toUpperCase() : name.slice(0, 3).toUpperCase();
};

const getFallbackOdds = (fixtureId: number) => {
  return {
    win: 0,
    draw: 0,
    loss: 0
  };
};

// API-Football 응답의 paging.total을 확인해 나머지 페이지까지 모두 가져옴
const fetchAllFixturePages = async (url: string): Promise<any[]> => {
  const headers = { 'x-apisports-key': API_KEY };

  console.log('[API_FOOTBALL] Request URL:', url);
  const firstRes = await fetch(url, { method: 'GET', headers, cache: 'no-store' });
  if (!firstRes.ok) return [];

  const firstJson = await firstRes.json();
  const results: any[] = firstJson.response || [];
  const totalPages = firstJson.paging?.total || 1;

  if (totalPages <= 1) return results;

  const restPages = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, i) => i + 2).map(async (page) => {
      try {
        const res = await fetch(`${url}&page=${page}`, { method: 'GET', headers, cache: 'no-store' });
        if (!res.ok) return [];
        const json = await res.json();
        return json.response || [];
      } catch {
        return [];
      }
    })
  );

  return [...results, ...restPages.flat()];
};

export async function fetchTeamStats(teamId: number, leagueId: number, season: number = 2026) {
  if (!API_KEY) return null;
  try {
    const res = await fetch(
      `${BASE_URL}/teams/statistics?team=${teamId}&league=${leagueId}&season=${season}`,
      { headers: { 'x-apisports-key': API_KEY }, cache: 'no-store' }
    );
    if (!res.ok) return null;
    const json = await res.json();
    return json.response || null;
  } catch (err) {
    console.warn(`[API_FOOTBALL] Team stats error:`, err);
    return null;
  }
}

export async function fetchH2H(homeTeamId: number, awayTeamId: number) {
  if (!API_KEY) return [];
  try {
    const res = await fetch(
      `${BASE_URL}/fixtures/headtohead?h2h=${homeTeamId}-${awayTeamId}&last=10`,
      { headers: { 'x-apisports-key': API_KEY }, cache: 'no-store' }
    );
    if (!res.ok) return [];
    const json = await res.json();
    return json.response || [];
  } catch (err) {
    console.warn(`[API_FOOTBALL] H2H error:`, err);
    return [];
  }
}

export async function fetchInjuries(fixtureId: number) {
  if (!API_KEY) return [];
  try {
    const res = await fetch(
      `${BASE_URL}/injuries?fixture=${fixtureId}`,
      { headers: { 'x-apisports-key': API_KEY }, cache: 'no-store' }
    );
    if (!res.ok) return [];
    const json = await res.json();
    return json.response || [];
  } catch (err) {
    console.warn(`[API_FOOTBALL] Injuries error:`, err);
    return [];
  }
}

export async function enrichMatchDetails(match: MatchData): Promise<MatchData> {
  // M1: Parallelize ELO fetching
  const [homeElo, awayElo] = await Promise.all([
    getTeamElo(match.teams.home),
    getTeamElo(match.teams.away)
  ]);

  const enriched: MatchData = {
    ...match,
    elo: { home: homeElo, away: awayElo }
  };

  // M2: Null safety try/catch block
  try {
    const fixtureId = match.rawIds?.fixtureId ? Number(match.rawIds.fixtureId) : (parseInt(match.id) || null);
    const homeId = match.rawIds?.homeTeamId;
    const awayId = match.rawIds?.awayTeamId;
    const leagueId = match.rawIds?.leagueId;
    const season = match.rawIds?.season || 2026;

    if (fixtureId && homeId && awayId && leagueId) {
      const [homeStats, awayStats, h2h, injuries] = await Promise.all([
        fetchTeamStats(homeId, leagueId, season),
        fetchTeamStats(awayId, leagueId, season),
        fetchH2H(homeId, awayId),
        fetchInjuries(fixtureId)
      ]);

      const homeWins = homeStats?.fixtures?.wins?.home || 0;
      const homePlayed = homeStats?.fixtures?.played?.home || 1;
      const homeWinRate = Math.round((homeWins / Math.max(1, homePlayed)) * 100);

      const awayWins = awayStats?.fixtures?.wins?.away || 0;
      const awayPlayed = awayStats?.fixtures?.played?.away || 1;
      const awayWinRate = Math.round((awayWins / Math.max(1, awayPlayed)) * 100);

      const homeInjuries = Array.isArray(injuries)
        ? injuries.filter((i: any) => i?.team?.id === homeId).map((i: any) => `${i.player?.name || 'Player'} (${i.player?.type || 'Injury'})`)
        : [];
      const awayInjuries = Array.isArray(injuries)
        ? injuries.filter((i: any) => i?.team?.id === awayId).map((i: any) => `${i.player?.name || 'Player'} (${i.player?.type || 'Injury'})`)
        : [];

      const safeH2h = Array.isArray(h2h) ? h2h : [];
      const h2hWinsHome = safeH2h.filter((h: any) => h?.teams?.home?.id === homeId && h?.teams?.home?.winner).length;
      const h2hWinsAway = safeH2h.filter((h: any) => h?.teams?.away?.id === awayId && h?.teams?.away?.winner).length;
      const h2hDraws = safeH2h.filter((h: any) => h?.teams?.home?.winner === null).length;
      const h2hSummary = safeH2h.length > 0
        ? `Last ${safeH2h.length} H2H: ${match.teams.home} ${h2hWinsHome}W, ${h2hDraws}D, ${match.teams.away} ${h2hWinsAway}W`
        : `No recent H2H records available`;

      enriched.injuries = {
        home: homeInjuries.length > 0 ? homeInjuries : ['None reported'],
        away: awayInjuries.length > 0 ? awayInjuries : ['None reported']
      };
      enriched.h2hRecord = h2hSummary;

      enriched.stats = {
        home: {
          form: homeStats?.form || 'WWDLW',
          xG: parseFloat(homeStats?.goals?.for?.average?.home || '1.5'),
          goalsScored: homeStats?.goals?.for?.total?.home || 12,
          goalsConceded: homeStats?.goals?.against?.total?.home || 5,
          winRate: Math.round((homeStats?.fixtures?.wins?.total || 0) / Math.max(1, homeStats?.fixtures?.played?.total || 1) * 100),
          homeWinRate
        },
        away: {
          form: awayStats?.form || 'WWDLD',
          xG: parseFloat(awayStats?.goals?.for?.average?.away || '1.3'),
          goalsScored: awayStats?.goals?.for?.total?.away || 10,
          goalsConceded: awayStats?.goals?.against?.total?.away || 8,
          winRate: Math.round((awayStats?.fixtures?.wins?.total || 0) / Math.max(1, awayStats?.fixtures?.played?.total || 1) * 100),
          awayWinRate
        },
        headToHead: h2hSummary
      };
    }
  } catch (err) {
    console.warn(`[API_FOOTBALL] Post-enrichment notice for match ${match.id}:`, err);
  }

  return enriched;
}

export async function fetchTodayMatches(): Promise<MatchData[]> {
  console.log('[API_FOOTBALL] Starting fetchTodayMatches...');

  if (!API_KEY || API_KEY === 'your_api_football_key_here') {
    console.warn('[API_FOOTBALL] APIFOOTBALL_KEY is missing or using default placeholder. Graceful fallback to MOCK_MATCHES.');
    return MOCK_MATCHES;
  }

  try {
    const getKSTDateString = (offsetDays: number = 0): string => {
      const target = new Date(Date.now() + (offsetDays * 24 * 60 * 60 * 1000));
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(target);
    };

    const todayDate = getKSTDateString(0);
    const future7DaysDate = getKSTDateString(7);

    console.log(`[API_FOOTBALL] KST Date Range: ${todayDate} ~ ${future7DaysDate}`);

    // Betman 지원 리그 (클럽 리그 + A매치)
    const supportedLeagueIds = [
      292, // K리그1
      293, // K리그2
      98,  // J리그
      39,  // EPL
      140, // 라리가
      78,  // 분데스리가
      135, // 세리에A
      61,  // 리그앙
      88,  // 에레디비지에
      253, // MLS
      2,   // 챔피언스리그
      17,  // AFC 챔피언스리그
      3,   // 유로파리그
      10,  // A매치(국제친선)
      5,   // UEFA 네이션스리그
      30,  // AFC 아시아 월드컵 예선
      4,   // UEFA 유로 예선
      9,   // 코파 아메리카
      6,   // 아프리카 네이션스컵
      94,  // 포르투갈
      71,  // 브라질
      128, // 아르헨티나
      235, // 러시아
      1,   // FIFA 월드컵
    ];

    console.log('[API_FOOTBALL] supportedLeagueIds:', supportedLeagueIds);

    // 오늘부터 7일간 날짜 배열 생성
    const dateRange: string[] = Array.from({ length: 8 }, (_, i) => getKSTDateString(i));
    console.log(`[API_FOOTBALL] Fetching fixtures for dates:`, dateRange);

    let fixturesList: any[] = [];
    try {
      // 날짜별 개별 호출 (Promise.all 병렬)
      const allResults = await Promise.all(
        dateRange.map(async (date) => {
          const url = `${BASE_URL}/fixtures?date=${date}&timezone=Asia/Seoul`;
          console.log('[API_FOOTBALL] Request URL:', url);
          try {
            const res = await fetch(url, {
              method: 'GET',
              headers: { 'x-apisports-key': API_KEY },
              cache: 'no-store'
            });
            if (!res.ok) {
              console.warn(`[API_FOOTBALL] Non-OK response for date ${date}:`, res.status);
              return [];
            }
            const json = await res.json();
            const fixtures = json.response || [];
            console.log(`[API_FOOTBALL] Date ${date}: ${fixtures.length} fixtures`);
            return fixtures;
          } catch (err) {
            console.warn(`[API_FOOTBALL] Fetch error for date ${date}:`, err);
            return [];
          }
        })
      );

      const rawFixtures: any[] = allResults.flat();
      console.log('[API_FOOTBALL] Total from API:', rawFixtures.length);
      console.log('[API_FOOTBALL] League IDs found:', rawFixtures.map((f: any) => f.league.id));
      console.log('[API_FOOTBALL] First fixture league id:', rawFixtures[0]?.league?.id, 'type:', typeof rawFixtures[0]?.league?.id);
      console.log('[API_FOOTBALL] supportedLeagueIds[0]:', supportedLeagueIds[0], 'type:', typeof supportedLeagueIds[0]);

      const filtered = rawFixtures.filter((f: any) => {
        const leagueId = f.league.id;
        const isSupported = supportedLeagueIds.includes(leagueId);
        if (!isSupported) {
          console.log('[API_FOOTBALL] FILTERED OUT:', leagueId, 'supported:', isSupported);
        }
        return isSupported;
      });
      console.log('[API_FOOTBALL] After filter:', filtered.length);

      const uniqueFixturesMap = new Map();
      filtered.forEach((item: any) => {
        uniqueFixturesMap.set(item.fixture.id, item);
      });

      fixturesList = Array.from(uniqueFixturesMap.values());
      console.log(`[API_FOOTBALL] Final fixtures count: ${fixturesList.length}`);
    } catch (err) {
      console.warn(`[API_FOOTBALL] Fetch error:`, err);
    }

    if (fixturesList.length === 0) {
      console.log('[API_FOOTBALL] No fixtures found. Returning empty list.');
      return [];
    }

    // 2. Fetch Odds for Unique Dates
    console.log(`[API_FOOTBALL] Fetching odds for unique dates...`);
    const oddsMap: Record<number, { win: number; draw: number; loss: number }> = {};

    const datesSet = new Set<string>();
    fixturesList.forEach(item => {
      const datePart = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date(item.fixture.date));
      datesSet.add(datePart);
    });
    const datesToFetch = Array.from(datesSet);

    const oddsResultsByDate = await Promise.all(
      datesToFetch.map(async (d) => {
        try {
          const oddsUrl = `${BASE_URL}/odds?date=${d}&timezone=Asia/Seoul`;
          console.log(`[API_FOOTBALL] Odds request URL: ${oddsUrl}`);
          const oddsRes = await fetch(
            oddsUrl,
            {
              method: 'GET',
              headers: {
                'x-apisports-key': API_KEY,
              },
              cache: 'no-store'
            }
          );

          if (oddsRes.ok) {
            const oddsJson = await oddsRes.json();
            const items = oddsJson.response || [];
            console.log(`[API_FOOTBALL] Odds for date ${d}: ${items.length} items, errors:`, oddsJson.errors);
            return items;
          }

          console.warn(`[API_FOOTBALL] Odds query returned an error for date ${d}.`);
          return [];
        } catch (err) {
          console.error(`[API_FOOTBALL] Error fetching odds for date ${d}`, err);
          return [];
        }
      })
    );

    for (const oddsList of oddsResultsByDate) {
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
    }
    console.log(`[API_FOOTBALL] Odds mapped for ${Object.keys(oddsMap).length} fixtures out of ${fixturesList.length} total.`);

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

      const homeTeamId = item.teams.home.id;
      const awayTeamId = item.teams.away.id;
      const season = item.league.season || 2026;

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
        previewScore: undefined,
        elo: { home: 1500, away: 1500 },
        rawIds: { fixtureId, homeTeamId, awayTeamId, leagueId, season }
      };
    });

    console.log(`[API_FOOTBALL] Successfully mapped ${mappedMatches.length} live matches.`);
    return mappedMatches;

  } catch (error) {
    console.error('[API_FOOTBALL] Error in fetchTodayMatches. Returning empty list [].', error);
    return [];
  }
}
