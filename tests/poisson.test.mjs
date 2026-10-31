import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const files=['../lib/evaluation.ts','../lib/poisson.ts','../lib/poisson-capture.ts'];
const source=files.map(p=>readFileSync(new URL(p,import.meta.url),'utf8').replace(/^import .*;\n/gm,'')).join('\n');
const {outputText}=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}});
const {predictPoisson,trainingMatches,poissonProbabilities,pairedMetrics,capturePoisson,fetchLeagueHistory}=await import(`data:text/javascript;base64,${Buffer.from("import { randomUUID } from 'node:crypto';\n"+outputText).toString('base64')}`);
const now=Date.now(),observed=new Date(now).toISOString();
const target={id:9999,home:10,away:20,league:39,season:2026,kickoff:new Date(now+86400000).toISOString()};
const fixture=(i,patch={})=>({fixture:{id:i+1,date:new Date(now-(i+1)*86400000).toISOString(),status:{short:'FT'}},league:{id:39,season:2026},teams:{home:{id:i<6?10:30+i},away:{id:i<6?20:80+i}},goals:{home:2,away:1},...patch});
const history=Array.from({length:40},(_,i)=>fixture(i));
test('Poisson mass is conserved and symmetric rates give symmetric win probabilities',()=>{
 for(const [h,a] of [[.15,.15],[5,5],[5,.15],[2,1]]){const p=poissonProbabilities(h,a);assert.ok(Math.abs(p.reduce((x,y)=>x+y,0)-1)<1e-12);assert.ok(p.every(n=>n>=0&&n<=1));}
 const p=poissonProbabilities(1,1);assert.ok(Math.abs(p[0]-p[2])<1e-12);assert.ok(Math.abs(p[1]-.308508322553671)<1e-12);
 for(const n of [NaN,Infinity,-1,0,6])assert.throws(()=>poissonProbabilities(n,1));
});
test('future results, current fixture, other leagues/seasons and non-FT games cannot influence predictions',()=>{
 const base=predictPoisson(history,target,observed);
 const poison=[fixture(70,{fixture:{id:target.id,date:history[0].fixture.date,status:{short:'FT'}}}),fixture(71,{fixture:{id:900,date:new Date(now+1000).toISOString(),status:{short:'FT'}}}),fixture(72,{league:{id:140,season:2026}}),fixture(73,{league:{id:39,season:2025}}),fixture(74,{fixture:{id:901,date:history[0].fixture.date,status:{short:'PEN'}}})];
 assert.deepEqual(predictPoisson([...history,...poison],target,observed),base);
 assert.equal(base.lambdaHome,2);assert.equal(base.lambdaAway,1);
 assert.throws(()=>trainingMatches(history,target,target.kickoff));
});
test('history deduplicates exact fixtures but refuses contradictory scores and malformed inputs',()=>{
 assert.equal(trainingMatches([...history,history[0]],target,observed).length,40);
 assert.throws(()=>trainingMatches([...history,{...history[0],goals:{home:0,away:0}}],target,observed));
 assert.throws(()=>trainingMatches([{...history[0],goals:{home:null,away:0}}],target,observed));
});
test('insufficient history and unsupported competitions do not create a default forecast',()=>{
 assert.equal(predictPoisson(history.slice(0,29),target,observed).reason,'INSUFFICIENT_HISTORY');
 assert.equal(predictPoisson(history,{...target,home:999},observed).reason,'INSUFFICIENT_HISTORY');
 assert.equal(predictPoisson(history,{...target,league:2},observed).reason,'UNSUPPORTED_LEAGUE');
});
const paired={p_home:.5,p_draw:.25,p_away:.25,odds_home:2,odds_draw:4,odds_away:4,market_baseline_records:{settled_at:observed,result_home:2,result_away:1,excluded_reason:null}};
test('paired scores compare the same results, omit pending/excluded rows and match hand calculation',()=>{
 const m=pairedMetrics([paired,{...paired,market_baseline_records:{settled_at:null}},{...paired,market_baseline_records:{excluded_reason:'CANC'}}]);
 assert.equal(m.total,3);assert.equal(m.settled,1);assert.equal(m.pending,1);assert.equal(m.excluded,1);
 assert.equal(m.model.brier,.375);assert.equal(m.market.brier,.375);assert.equal(m.brierDifference,0);assert.equal(m.model.accuracy,1);
 assert.equal(pairedMetrics([]).model.brier,null);
 assert.throws(()=>pairedMetrics([{...paired,market_baseline_records:null}]));
 assert.throws(()=>pairedMetrics([{...paired,p_home:NaN}]));
});
test('ties are disclosed and excluded only from their own accuracy denominator',()=>{
 const m=pairedMetrics([{...paired,p_home:1/3,p_draw:1/3,p_away:1/3}]);
 assert.equal(m.model.tied,1);assert.equal(m.model.accuracy,null);assert.equal(m.market.accuracy,1);assert.equal(m.settled,1);
});
const match={id:String(target.id),rawIds:{fixtureId:target.id,homeTeamId:10,awayTeamId:20,leagueId:39,season:2026},fixtureStatus:'NS',oddsStatus:'AVAILABLE',bookmaker:'Example',teams:{home:'A',away:'B'},league:'Premier League',startTime:target.kickoff,fetchedAt:observed,odds:{win:2,draw:4,loss:4}};
const mockDB=(saveError=null,existing=[])=>{const writes=[],events=[];return {writes,events,from(table){if(table==='model_capture_events')return {insert:async rows=>{events.push(...rows);return {error:null}}};return {select(){return {eq(){return {in:async()=>({data:existing,error:null})}}}},insert:async row=>{writes.push(row);return {error:saveError}}}}}};
test('capture freezes model inputs and paired odds, duplicates never overwrite',async()=>{
 const db=mockDB();const result=await capturePoisson(db,[match],async()=>history);
 assert.equal(result.inserted,1);assert.equal(db.writes[0].evidence.history.length,40);assert.equal(db.writes[0].odds_home,2);
 const duplicate=mockDB(null,[{fixture_id:target.id}]);let requests=0;
 assert.equal((await capturePoisson(duplicate,[match],async()=>{requests++;return history})).duplicates,1);assert.equal(requests,0);assert.equal(duplicate.writes.length,0);
});
test('provider failures and failed writes cannot count as inserted records',async()=>{
 assert.equal((await capturePoisson(mockDB({code:'42501'}),[match],async()=>history)).failed,1);
 assert.equal((await capturePoisson(mockDB({code:'23505'}),[match],async()=>history)).duplicates,1);
 const db=mockDB();assert.equal((await capturePoisson(db,[match],async()=>{throw new Error('provider')})).failed,1);assert.equal(db.writes.length,0);
});
test('insufficient data, elapsed time budget and started fixtures produce no predictions',async()=>{
 const db=mockDB();assert.equal((await capturePoisson(db,[match],async()=>history.slice(0,2))).reasons.INSUFFICIENT_HISTORY,1);
 assert.equal((await capturePoisson(db,[match],async()=>history,now)).deferred,1);
 assert.equal((await capturePoisson(db,[{...match,startTime:new Date(now-1).toISOString()}],async()=>history)).inserted,0);assert.equal(db.writes.length,0);
});
test('history HTTP and provider errors, truncated pages and malformed bodies fail closed',async()=>{
 const original=globalThis.fetch;
 try{
  for(const body of [{errors:{quota:'limit'},response:[],results:0,paging:{current:1,total:1}},{response:history,results:99,paging:{current:1,total:1}},{response:history,results:40,paging:{current:1,total:2}}]){
    globalThis.fetch=async()=>({ok:true,json:async()=>body});await assert.rejects(()=>fetchLeagueHistory(39,2026,'test'));
  }
  globalThis.fetch=async()=>({ok:false});await assert.rejects(()=>fetchLeagueHistory(39,2026,'test'));
  globalThis.fetch=async()=>({ok:true,json:async()=>({response:history,results:40,paging:{current:1,total:1}})});assert.equal((await fetchLeagueHistory(39,2026,'test')).length,40);
 }finally{globalThis.fetch=original;}
});

test('audit accounts for every input including filtered fixtures without retaining raw data',async()=>{
 const db=mockDB();
 const cases=[match,{...match,id:'cup',rawIds:{...match.rawIds,leagueId:2}},
  {...match,id:'far',startTime:new Date(now+72*3600000).toISOString()},
  {...match,id:'no-odds',oddsStatus:'UNAVAILABLE',oddsUnavailableReason:'NOT_PROVIDED'},
  {...match,id:'failed-odds',oddsStatus:'UNAVAILABLE',oddsUnavailableReason:'FETCH_FAILED'}];
 const result=await capturePoisson(db,cases,async()=>history);
 assert.equal(result.auditFailed,0);assert.equal(db.events.length,cases.length+2);
 assert.deepEqual(db.events.map(e=>e.reason),['RUN_STARTED','UNSUPPORTED_LEAGUE','OUTSIDE_HORIZON','ODDS_UNAVAILABLE','ODDS_FETCH_FAILED','PREDICTION_SAVED','RUN_COMPLETED']);
 assert.ok(db.events.every(e=>e.run_id===result.runId));
 assert.ok(db.events.every(e=>!('evidence' in e)&&!('error' in e)&&!('bookmaker' in e)));
});
test('audit distinguishes duplicates, both limits, history failure and prediction failure',async()=>{
 const db=mockDB();await capturePoisson(db,Array.from({length:31},(_,i)=>({...match,id:String(i),rawIds:{...match.rawIds,fixtureId:20000+i}})),async()=>history);
 assert.equal(db.events.filter(e=>e.reason==='PREDICTION_SAVED').length,30);
 assert.equal(db.events.filter(e=>e.reason==='ATTEMPT_LIMIT').length,1);
 const timed=mockDB();await capturePoisson(timed,[match],async()=>history,0);assert.equal(timed.events[1].reason,'TIME_BUDGET');
 const failed=mockDB();await capturePoisson(failed,[match],async()=>{throw new Error('secret-token=must-not-store')});
 assert.equal(failed.events[1].reason,'HISTORY_UNAVAILABLE');assert.ok(!JSON.stringify(failed.events).includes('secret-token'));
 const write=mockDB({code:'42501'});await capturePoisson(write,[match],async()=>history);assert.equal(write.events[1].reason,'PREDICTION_WRITE_FAILED');
 const race=mockDB({code:'23505'});await capturePoisson(race,[match],async()=>history);assert.equal(race.events[1].reason,'CONCURRENT_DUPLICATE');
 const dup=mockDB(null,[{fixture_id:target.id}]);await capturePoisson(dup,[match],async()=>history);assert.equal(dup.events[1].reason,'ALREADY_RECORDED');
});
test('audit failure before capture prevents predictions; failure after capture remains visible and incomplete',async()=>{
 for(const failAt of [1,2]){
  const db=mockDB();const original=db.from.bind(db);let calls=0;
  db.from=table=>table==='model_capture_events'?{insert:async rows=>{
    calls++;if(calls===failAt)return {error:{message:'credential must not leak'}};
    db.events.push(...rows);return {error:null};
  }}:original(table);
  const result=await capturePoisson(db,[match],async()=>history);
  assert.equal(result.auditFailed,1);assert.equal(result.inserted,failAt===1?0:1);
  assert.ok(!db.events.some(e=>e.reason==='RUN_COMPLETED'));
 }
});
test('empty input completes an auditable zero-match run and ledger read failure has per-fixture failures',async()=>{
 const empty=mockDB();await capturePoisson(empty,[],async()=>history);assert.deepEqual(empty.events.map(e=>e.reason),['RUN_STARTED','RUN_COMPLETED']);
 const db=mockDB();const original=db.from.bind(db);
 db.from=t=>t==='model_predictions'?{select(){return {eq(){return {in:async()=>({error:{code:'42501'}})}}}}}:original(t);
 const result=await capturePoisson(db,[match],async()=>history);assert.equal(result.failed,1);assert.equal(db.events[1].reason,'MODEL_LEDGER_UNAVAILABLE');assert.equal(db.writes.length,0);
});
