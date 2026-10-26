import type { MatchData } from '../agents/orchestrator';

const BASE_URL = 'https://v3.football.api-sports.io';
const LEAGUES = [292, 293, 98, 39, 140, 78, 135, 61, 88, 253, 2, 17, 3, 10, 5, 30, 4, 9, 6, 94, 71, 128, 235, 1];
export class MatchDataUnavailable extends Error {}

export function koreanDate(now = new Date()): string {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function parseOdds(values: { value: string; odd: string }[]) {
  const odds = {
    win: Number(values.find(v => v.value === 'Home')?.odd),
    draw: Number(values.find(v => v.value === 'Draw')?.odd),
    loss: Number(values.find(v => v.value === 'Away')?.odd),
  };
  return Object.values(odds).every(n => Number.isFinite(n) && n > 1) ? odds : null;
}

// No caching of failures; HTTP 200 provider errors are failures as well.
async function request(path: string, apiKey: string) {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { 'x-apisports-key': apiKey },
    cache: 'no-store',
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new MatchDataUnavailable('경기 데이터 제공업체에 연결할 수 없습니다.');
  const json = await response.json();
  if ((json.errors && Object.keys(json.errors).length > 0) || !Array.isArray(json.response)) {
    throw new MatchDataUnavailable('경기 데이터 제공업체의 응답을 확인할 수 없습니다.');
  }
  return json;
}

export async function fetchTodayMatches(): Promise<MatchData[]> {
  const apiKey = process.env.APIFOOTBALL_KEY;
  if (!apiKey || apiKey === 'your_api_football_key_here') {
    throw new MatchDataUnavailable('경기 데이터 연결이 설정되지 않았습니다.');
  }
  const dates = Array.from({ length: 8 }, (_, i) => koreanDate(new Date(Date.now() + i * 86400000)));
  const fetchedAt = new Date().toISOString();
  const responses = await Promise.all(dates.map(date =>
    request(`/fixtures?date=${date}&timezone=Asia%2FSeoul`, apiKey)
  ));
  const unique = new Map<number, any>();
  for (const item of responses.flatMap(r => r.response)) {
    if (LEAGUES.includes(item.league?.id)) unique.set(item.fixture?.id, item);
  }
  const fixtures = [...unique.values()];
  if (!fixtures.length) return [];

  const oddsMap = new Map<number, { odds: MatchData['odds']; bookmaker: string }>();
  const failedOddsDates = new Set<string>();
  for (const date of new Set(fixtures.map(item => koreanDate(new Date(item.fixture.date))))) {
    try {
      // Publish a date only after every page succeeds. A failed date must not
      // erase verified prices from other dates or expose partial page coverage.
      const collected = [];
      let total = 1;
      for (let page = 1; page <= total; page++) {
        const json = await request(`/odds?date=${date}&timezone=Asia%2FSeoul&page=${page}`, apiKey);
        total = Number(json.paging?.total ?? 1);
        if (!Number.isInteger(total) || total < 0 || total > 50 ||
            (total === 0 && (page !== 1 || json.response.length > 0)) ||
            (total > 0 && total < page)) throw new Error('Invalid pagination');
        collected.push(...json.response);
      }
      const dateOdds = new Map<number, { odds: MatchData['odds']; bookmaker: string }>();
      for (const item of collected) {
        const bookmakers = Array.isArray(item.bookmakers) ? item.bookmakers : [];
        const ordered = [...bookmakers.filter((b: any) => b.name === 'Bet365'),
          ...bookmakers.filter((b: any) => b.name !== 'Bet365')];
        for (const bookmaker of ordered) {
          const bet = bookmaker.bets?.find((b: any) => b.name === 'Match Winner');
          const odds = bet && Array.isArray(bet.values) ? parseOdds(bet.values) : null;
          if (odds && item.fixture?.id && bookmaker.name) {
            dateOdds.set(item.fixture.id, { odds, bookmaker: bookmaker.name });
            break;
          }
        }
      }
      for (const [id, value] of dateOdds) oddsMap.set(id, value);
    } catch {
      failedOddsDates.add(date);
      console.warn('Odds retrieval failed for date', date);
    }
  }

  return fixtures.map((item: any) => {
    if (!item.fixture?.id || !item.fixture?.status?.short ||
        !Number.isFinite(Date.parse(item.fixture?.date)) ||
        !item.teams?.home?.name || !item.teams?.away?.name || !item.league?.name) {
      throw new MatchDataUnavailable('경기 데이터 형식이 올바르지 않습니다.');
    }
    const found = oddsMap.get(item.fixture.id);
    return {
      id: String(item.fixture.id),
      code: `${item.league.id}-${item.fixture.id}`,
      sport: 'soccer',
      city: item.fixture.venue?.city || '',
      teams: { home: item.teams.home.name, away: item.teams.away.name },
      league: item.league.name,
      startTime: item.fixture.date,
      fixtureStatus: item.fixture.status.short,
      rawIds: { fixtureId: item.fixture.id, homeTeamId: item.teams.home.id, awayTeamId: item.teams.away.id, leagueId: item.league.id, season: item.league.season },
      dataSource: 'API-Football',
      fetchedAt,
      // Zero is a compatibility sentinel, never a usable decimal price or model input.
      odds: found?.odds || { win: 0, draw: 0, loss: 0 },
      oddsStatus: found ? 'AVAILABLE' : 'UNAVAILABLE',
      oddsUnavailableReason: found ? undefined : failedOddsDates.has(koreanDate(new Date(item.fixture.date))) ? 'FETCH_FAILED' : 'NOT_PROVIDED',
      bookmaker: found?.bookmaker,
    };
  });
}
