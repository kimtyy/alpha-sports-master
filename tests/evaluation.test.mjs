import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = readFileSync(new URL('../lib/evaluation.ts', import.meta.url),'utf8');
const {outputText} = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}});
const {marketProbabilities,baselineSnapshot,baselineResultPatch,evaluationMetrics,captureBaseline,settleBaseline} = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const now = Date.parse('2026-10-26T00:00:00Z');
const match = {rawIds:{fixtureId:123},fixtureStatus:'NS',oddsStatus:'AVAILABLE',bookmaker:'Example',teams:{home:'A',away:'B'},league:'Example',startTime:new Date(now+3600000).toISOString(),fetchedAt:new Date(now-1000).toISOString(),odds:{win:2,draw:4,loss:4}};
test('market probabilities remove overround and reject unusable prices',()=>{
 assert.deepEqual(marketProbabilities([2,4,4]),[.5,.25,.25]);
 assert.ok(Math.abs(marketProbabilities([1.8,3.4,4]).reduce((a,b)=>a+b,0)-1)<1e-12);
 for(const n of [NaN,Infinity,0,1,-1]) assert.throws(()=>marketProbabilities([n,3,4]));
});
test('only fresh pre-kickoff unstarted fixtures can be recorded',()=>{
 assert.equal(baselineSnapshot(match,now).fixture_id,123);
 for(const patch of [{startTime:new Date(now).toISOString()},{fixtureStatus:'FT'},{oddsStatus:'UNAVAILABLE'},{fetchedAt:new Date(now-16*60000).toISOString()},{fetchedAt:new Date(now+1).toISOString()},{rawIds:{fixtureId:-1}}]) assert.equal(baselineSnapshot({...match,...patch},now),null);
});
const row={fixture_id:123,kickoff_at:match.startTime,odds_home:2,odds_draw:4,odds_away:4};
const fixture={fixture:{id:123,date:match.startTime,status:{short:'FT'}},goals:{home:2,away:1}};
test('settlement uses matching regulation result and rejects invalid scores',()=>{
 const patch=baselineResultPatch(row,fixture,now+5*3600000);
 assert.equal(patch.result_home,2);
 assert.throws(()=>baselineResultPatch({...row,fixture_id:124},fixture,now+5*3600000));
 assert.throws(()=>baselineResultPatch(row,{...fixture,goals:{home:null,away:1}},now+5*3600000));
 assert.throws(()=>baselineResultPatch(row,fixture,now));
 assert.equal(baselineResultPatch(row,{...fixture,fixture:{...fixture.fixture,status:{short:'PEN'}}},now+5*3600000).excluded_reason,'PEN');
 assert.equal(baselineResultPatch(row,{...fixture,fixture:{...fixture.fixture,date:new Date(now+2*3600000).toISOString()}},now+5*3600000).excluded_reason,'KICKOFF_CHANGED');
});
test('metrics exclude pending/excluded rows, use Brier sum and disclose ties',()=>{
 const completed={...row,settled_at:'2026-10-26',result_home:2,result_away:1};
 let m=evaluationMetrics([completed,row,{...row,excluded_reason:'CANC'}]);
 assert.equal(m.settled,1);assert.equal(m.accuracy,1);assert.equal(m.brier,.375);assert.equal(m.pending,1);assert.equal(m.excluded,1);
 m=evaluationMetrics([{...completed,odds_home:3,odds_draw:3,odds_away:3}]);assert.equal(m.accuracy,null);assert.equal(m.tied,1);
 assert.equal(evaluationMetrics([]).brier,null);
});
test('capture inserts only, classifies duplicates and reports write failures',async()=>{
 const fresh={...match,startTime:new Date(Date.now()+3600000).toISOString(),fetchedAt:new Date().toISOString()};
 let calls=0;
 const db={from(name){assert.equal(name,'market_baseline_records');return {insert(){calls++;return {error:calls===1?null:calls===2?{code:'23505'}:{code:'error'}};}};}};
 assert.deepEqual(await captureBaseline(db,[fresh,fresh,fresh]),{inserted:1,duplicates:1,failed:1,skipped:0});
});
test('settlement errors cannot be reported as successful writes',async()=>{
 const pending={...row,kickoff_at:new Date(Date.now()-5*3600000).toISOString()};
 let updates=0;
 const db={from(){let write=false;const q={select(){return q},is(){return q},lte(){return q},order(){return q},limit(){return q},eq(){return q},update(){write=true;updates++;return q},then(resolve){return Promise.resolve(write?{data:null,error:{message:'write failed'}}:{data:[pending],error:null}).then(resolve)}};return q;}};
 const result=await settleBaseline(db,async()=>({...fixture,fixture:{...fixture.fixture,date:pending.kickoff_at}}));
 assert.equal(result.settled,0);assert.equal(result.failed,1);assert.equal(updates,2);
});
