import type { MatchData } from '../agents/orchestrator';

const BASE_URL = 'https://v3.football.api-sports.io';
const LEAGUES = [292, 293, 98, 39, 140, 78, 135, 61, 88, 253, 2, 17, 3, 10, 5, 30, 4, 9, 6, 94, 71, 128, 235, 1];
export class MatchDataUnavailable extends Error {}
class ProviderFailure extends MatchDataUnavailable {
  constructor(readonly code: NonNullable<MatchData['oddsFailure']>['code'], readonly httpStatus?: number) {
    super('경기 데이터 조회 실패');
  }
}

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
  let response:Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      headers: { 'x-apisports-key': apiKey }, cache: 'no-store', signal: AbortSignal.timeout(12000),
    });
  } catch(error) {
    throw new ProviderFailure(error instanceof Error && ['TimeoutError','AbortError'].includes(error.name) ? 'TIMEOUT' : 'NETWORK_ERROR');
  }
  if (!response.ok) throw new ProviderFailure(response.status===429?'RATE_LIMIT':'HTTP_ERROR',response.status);
  let json;
  try { json=await response.json(); } catch { throw new ProviderFailure('INVALID_RESPONSE'); }
  if (json?.errors && Object.keys(json.errors).length > 0) {
    // Inspect only known keys; never preserve provider error text or request credentials.
    throw new ProviderFailure(Object.keys(json.errors).some(k=>['requests','rateLimit'].includes(k))?'RATE_LIMIT':'PROVIDER_ERROR');
  }
  if (!Array.isArray(json?.response)) throw new ProviderFailure('INVALID_RESPONSE');
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
  const failedOddsDates = new Map<string,NonNullable<MatchData['oddsFailure']>>();
  for (const date of new Set(fixtures.map(item => koreanDate(new Date(item.fixture.date))))) {
    let requestedPage=1;
    try {
      // Publish a date only after every page succeeds. A failed date must not
      // erase verified prices from other dates or expose partial page coverage.
      const loadPages=async(scope='')=>{
        const rows:any[]=[];let total=1;
        for(let page=1;page<=total;page++){
          requestedPage=page;
          const json=await request(`/odds?date=${date}&timezone=Asia%2FSeoul&page=${page}${scope}`,apiKey);
          total=Number(json.paging?.total??1);
          if(Number.isInteger(total)&&total>50)throw new ProviderFailure('PAGE_LIMIT');
          if(!Number.isInteger(total)||total<0||(total===0&&(page!==1||json.response.length>0))||
            (total>0&&total<page))throw new ProviderFailure('INVALID_PAGINATION');
          rows.push(...json.response);
        }
        return rows;
      };
      let collected:any[];
      try{collected=await loadPages();}
      catch(error){
        if(!(error instanceof ProviderFailure)||error.code!=='PAGE_LIMIT')throw error;
        const scopedFixtures=fixtures.filter(item=>koreanDate(new Date(item.fixture.date))===date);
        if(!scopedFixtures.every(item=>Number.isSafeInteger(item.league?.id)&&item.league.id>0&&
          Number.isSafeInteger(item.league?.season)&&item.league.season>0))throw error;
        const scopes=new Map<string,{id:number,season:number}>();
        for(const item of scopedFixtures)scopes.set(`${item.league.id}:${item.league.season}`,item.league);
        collected=[];
        // Bound each league query too. Publish the date only when all selected scopes complete.
        for(const scope of scopes.values())collected.push(...await loadPages(`&league=${scope.id}&season=${scope.season}`));
        console.info('ODDS_DATE_SCOPED',JSON.stringify({date,leagues:scopes.size}));
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
    } catch(error) {
      const failure:NonNullable<MatchData['oddsFailure']>={date,page:requestedPage,
        code:error instanceof ProviderFailure?error.code:'INVALID_RESPONSE',
        ...(error instanceof ProviderFailure && error.httpStatus?{httpStatus:error.httpStatus}:{})};
      failedOddsDates.set(date,failure);
      console.warn('ODDS_FETCH_FAILED',JSON.stringify(failure));
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
      oddsFailure: found ? undefined : failedOddsDates.get(koreanDate(new Date(item.fixture.date))),
      bookmaker: found?.bookmaker,
    };
  });
}
