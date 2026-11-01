import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const {outputText}=ts.transpileModule(readFileSync(new URL('../lib/match-filters.ts',import.meta.url),'utf8'),
 {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}});
const {filterMatches,leagueOptions,leagueLabel,compareMatchSchedule,fixtureStatusLabel,oddsAvailabilityMessage}=await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const fixture=(id,leagueId,league,startTime='2026-11-01T09:00:00Z')=>({id,league,rawIds:{leagueId},teams:{home:'Home',away:'Away'},startTime,odds:{win:2,draw:3,loss:4}});
const k1=fixture('k1',292,'K League 1'),k2=fixture('k2',293,'K League 2'),epl=fixture('epl',39,'Premier League');
test('league IDs keep K League 1 and 2 distinct and international fixtures accessible',()=>{
 const rows=[epl,k2,k1];
 assert.deepEqual(filterMatches(rows,'kleague').map(m=>m.id),['k2','k1']);
 assert.deepEqual(filterMatches(rows,'international').map(m=>m.id),['epl']);
 assert.equal(filterMatches(rows,'all').length,3);
 assert.equal(leagueLabel('K League 1',292),'K리그1');assert.equal(leagueLabel('K League 2',293),'K리그2');
 assert.equal(filterMatches([fixture('other',999,'K League 1')],'kleague').length,0);
});
test('league options, selection and Korean search compose without changing the source array',()=>{
 const rows=[epl,k2,k1,{...k1,id:'k1b'}];
 assert.deepEqual(leagueOptions(rows,'kleague'),[{value:'id:292',label:'K리그1',count:2},{value:'id:293',label:'K리그2',count:1}]);
 assert.equal(filterMatches(rows,'kleague','id:292','K리그1').length,2);
 assert.equal(filterMatches(rows,'kleague','id:292','K리그2').length,0);
 assert.equal(filterMatches(rows,'international','all','epl').length,1);
 assert.equal(filterMatches(rows,'all','all','  HOME  ').length,4);
 assert.deepEqual(rows.map(m=>m.id),['epl','k2','k1','k1b']);
 assert.deepEqual(leagueOptions([],'kleague'),[]);
});
test('schedule keeps Korean dates chronological and prioritizes K League within each date',()=>{
 const abroad=fixture('a',39,'Premier League','2026-10-31T15:00:00Z'); // Nov 1 KST
 const domestic=fixture('k',292,'K League 1','2026-11-01T07:00:00Z');
 const previous=fixture('p',39,'Premier League','2026-10-31T14:59:00Z'); // Oct 31 KST
 const next=fixture('n',292,'K League 1','2026-11-01T15:00:00Z'); // Nov 2 KST
 assert.deepEqual([next,abroad,domestic,previous].sort(compareMatchSchedule).map(m=>m.id),['p','k','a','n']);
});
test('missing odds, retrieval failures and fixture state never imply a prediction',()=>{
 assert.match(oddsAvailabilityMessage({...k1,oddsStatus:'UNAVAILABLE',oddsUnavailableReason:'FETCH_FAILED'}),/불러오지/);
 assert.match(oddsAvailabilityMessage({...k1,oddsStatus:'UNAVAILABLE',oddsUnavailableReason:'NOT_PROVIDED'}),/제공된 배당/);
 assert.equal(oddsAvailabilityMessage({...k1,oddsStatus:'AVAILABLE'}),null);
 assert.equal(fixtureStatusLabel('FT'),'경기 종료');assert.equal(fixtureStatusLabel('NS'),'경기 예정');assert.equal(fixtureStatusLabel('PST'),'경기 연기');
});
