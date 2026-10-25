import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

async function load(path) {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}
const data = await load('lib/data/apiFootball.ts');
const { calcKelly } = await load('lib/kelly.ts');
const { AlphaInference } = await load('lib/agents/inference.ts');
const { AlphaOrchestrator } = await load('lib/agents/orchestrator.ts');
const originalFetch = globalThis.fetch;
const originalKey = process.env.APIFOOTBALL_KEY;
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.APIFOOTBALL_KEY;
  else process.env.APIFOOTBALL_KEY = originalKey;
});
const fixture = { fixture: { id: 123, date: '2026-10-25T20:00:00+09:00', status: { short: 'NS' }, venue: { city: 'Seoul' } }, teams: { home: { name: 'Home' }, away: { name: 'Away' } }, league: { id: 292, name: 'K League 1' } };
const json = (response, extra = {}) => new Response(JSON.stringify({ errors: {}, response, ...extra }));

test('Korean date rolls over at 15:00 UTC', () => {
  assert.equal(data.koreanDate(new Date('2026-10-24T15:00:00Z')), '2026-10-25');

});
test('missing credentials fail instead of returning example fixtures', async () => {
  delete process.env.APIFOOTBALL_KEY;
  globalThis.fetch = () => { throw Error('must not call provider'); };
  await assert.rejects(data.fetchTodayMatches(), data.MatchDataUnavailable);
});
test('HTTP 200 quota/plan errors are not interpreted as no fixtures', async () => {
  process.env.APIFOOTBALL_KEY = 'test-only';
  globalThis.fetch = async () => json([], { errors: { requests: 'quota exceeded' } });
  await assert.rejects(data.fetchTodayMatches(), data.MatchDataUnavailable);
});
test('one failed fixture date makes collection unavailable, not silently partial', async () => {
  process.env.APIFOOTBALL_KEY = 'test-only';
  globalThis.fetch = async url => String(url).includes('date=' + data.koreanDate()) ? new Response('', { status: 503 }) : json([]);
  await assert.rejects(data.fetchTodayMatches(), data.MatchDataUnavailable);
});
test('successful empty fixtures are genuinely empty and never trigger odds calls', async () => {
  process.env.APIFOOTBALL_KEY = 'test-only';
  let calls = 0;
  globalThis.fetch = async url => { calls++; assert.match(String(url), /fixtures/); return json([]); };
  assert.deepEqual(await data.fetchTodayMatches(), []);
  assert.equal(calls, 8);
});
test('odds failure preserves fixtures with explicit unavailability and no invented scores', async () => {
  process.env.APIFOOTBALL_KEY = 'test-only';
  globalThis.fetch = async url => String(url).includes('/odds?') ? new Response('', { status: 503 }) : json([fixture]);
  const [match] = await data.fetchTodayMatches();
  assert.equal(match.oddsStatus, 'UNAVAILABLE');
  assert.equal(match.previewScore, undefined);
  assert.equal(match.stats, undefined);
  assert.equal(match.fixtureStatus, 'NS');
  assert.equal(match.dataSource, 'API-Football');
  assert.ok(match.fetchedAt);
});
test('odds pagination loads page two and keeps the provider price and source', async () => {
  process.env.APIFOOTBALL_KEY = 'test-only';
  const pages = [];
  globalThis.fetch = async url => {
    url = String(url);
    if (url.includes('/fixtures?')) return json([fixture]);
    const page = Number(new URL(url).searchParams.get('page')); pages.push(page);
    const odds = { fixture: { id: 123 }, bookmakers: [{ name: 'Bet365', bets: [{ name: 'Match Winner', values: [{value:'Home',odd:'2.5'}, {value:'Draw',odd:'3.2'}, {value:'Away',odd:'2.8'}] }] }] };
    return json(page === 2 ? [odds] : [], { paging: { total: 2 } });
  };
  const [match] = await data.fetchTodayMatches();
  assert.deepEqual(pages, [1, 2]);
  assert.equal(match.oddsStatus, 'AVAILABLE');
  assert.equal(match.odds.win, 2.5);
  assert.equal(match.bookmaker, 'Bet365');
});
test('invalid prices cannot enter Kelly calculations', () => {
  for (const odds of [0, 1, -2, NaN, Infinity]) assert.throws(() => calcKelly(.5, odds), RangeError);
  for (const p of [-.1, 1.1, NaN, Infinity]) assert.throws(() => calcKelly(p, 2), RangeError);
  assert.equal(data.parseOdds([{ value: 'Home', odd: 'NaN' }]), null);
  assert.equal(calcKelly(.5, 2).recommendation, 'SKIP');
});
test('legacy inference cannot return simulated results even if called directly', async () => {
  await assert.rejects(new AlphaInference().runAgent('anything', {}));
  await assert.rejects(new AlphaOrchestrator().infer({}));
});
test('UI starts empty and does not present fixed model confidence or fake success', () => {
  const ui = readFileSync(new URL('../components/MatchTerminal.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(ui, /MOCK_MATCHES|calcKelly\(|getInitialProbability|demoResults|전략 전표 접수 완료/);
  assert.match(ui, /사용자 기록 적중률/);
  assert.match(ui, /예측 모델 검증 대기/);
});

const { normalizePick, settledOutcome, settlePending } = await load('lib/settlement.ts');
const finished = { fixture: { id: 12, status: { short: 'FT' } }, goals: { home: 2, away: 1 } };
test('settlement refuses unknown picks, missing scores and extra-time outcomes', () => {
  assert.equal(normalizePick('WIN'), 'home');
  assert.equal(normalizePick('wrong'), null);
  assert.equal(settledOutcome(finished, '13'), null);
  assert.equal(settledOutcome({ ...finished, goals: { home: null, away: 1 } }, '12'), null);
  assert.equal(settledOutcome({ ...finished, fixture: { id: 12, status: { short: 'AET' } } }, '12'), null);
  assert.deepEqual(settledOutcome(finished, '12'), { score: '2:1', outcome: 'home' });
});
function mockDb(rows, failWrite = false) {
  return { from(table) {
    assert.equal(table, 'bookmarks'); // No ratings table writes.
    let patch; let start = 0; let end = Infinity;
    const filters = [];
    const query = {
      select() { return query; }, order() { return query; }, limit() { return query; },
      not() { return query; }, lte() { return query; },
      range(a, b) { start = a; end = b; return query; },
      is(key, value) { filters.push(r => r[key] === value); return query; },
      eq(key, value) { filters.push(r => r[key] === value); return query; },
      update(value) { patch = value; return query; },
      then(resolve) {
        const found = rows.filter(r => filters.every(f => f(r))).slice(start, end + 1);
        if (patch && failWrite) return Promise.resolve({ data: null, error: new Error('write failed') }).then(resolve);
        if (patch) found.forEach(r => Object.assign(r, patch));
        return Promise.resolve({ data: found.map(r => ({...r})), error: null }).then(resolve);
      }
    };
    return query;
  } };
}
test('duplicate bookmarks use one fixture lookup and reruns do not resettle records', async () => {
  const rows = [{id:1,match_id:'12',pick:'home',is_correct:null},{id:2,match_id:'12',pick:'away',is_correct:null}];
  const db = mockDb(rows); let calls = 0;
  const getFixture = async () => { calls++; return finished; };
  assert.equal((await settlePending(db, getFixture)).updated, 2);
  assert.equal(calls, 1);
  assert.deepEqual(rows.map(r=>r.is_correct), [true,false]);
  assert.equal((await settlePending(db, getFixture)).updated, 0);
  assert.equal(calls, 1);
});
test('write failures are counted as failures and can be retried', async () => {
  const rows = [{id:1,match_id:'12',pick:'home',is_correct:null}];
  const result = await settlePending(mockDb(rows, true), async()=>finished);
  assert.equal(result.failed,1); assert.equal(result.updated,0);
  assert.equal(rows[0].is_correct,null);
});

test('pending result pagination does not hide records after page one', async () => {
  const rows = Array.from({length:201}, (_,id)=>({id,match_id:'12',pick:'home',is_correct:null}));
  const result = await settlePending(mockDb(rows), async()=>finished);
  assert.equal(result.processed,201); assert.equal(result.updated,201);
});
