import { randomUUID } from 'node:crypto';
import type { MatchData } from './agents/orchestrator';
import { baselineSnapshot } from './evaluation';
import { MODEL_VERSION, MODEL_LEAGUES, predictPoisson } from './poisson';

export async function fetchLeagueHistory(league:number,season:number,key:string,signal?:AbortSignal) {
  const response=await fetch(`https://v3.football.api-sports.io/fixtures?league=${league}&season=${season}&status=FT`,{
    headers:{'x-apisports-key':key},cache:'no-store',signal:signal||AbortSignal.timeout(12000)});
  if(!response.ok)throw new Error('HISTORY_UNAVAILABLE');
  const body=await response.json();
  if((body.errors&&Object.keys(body.errors).length)||!Array.isArray(body.response)||
    !Number.isInteger(body.results)||body.results!==body.response.length||
    !body.paging||body.paging.current!==1||body.paging.total!==1)throw new Error('HISTORY_INCOMPLETE');
  return body.response;
}

export async function capturePoisson(db:any,matches:MatchData[],getHistory:(league:number,season:number)=>Promise<any[]>,deadline=Date.now()+60000) {
  const runId=randomUUID();
  const stats={runId,inserted:0,duplicates:0,skipped:0,failed:0,deferred:0,auditFailed:0,reasons:{} as Record<string,number>};
  const events:any[]=[];
  const event=(match:MatchData,status:string,reason:string)=>events.push({run_id:runId,model_version:MODEL_VERSION,
    fixture_id:Number.isSafeInteger(match.rawIds?.fixtureId)&&match.rawIds!.fixtureId!>0?match.rawIds!.fixtureId:null,
    league_id:Number.isSafeInteger(match.rawIds?.leagueId)?match.rawIds!.leagueId:null,
    status,reason});
  const persist=async(rows:any[])=>{
    try{const {error}=await db.from('model_capture_events').insert(rows);if(error)throw new Error();return true;}
    catch{stats.auditFailed++;return false;}
  };
  if(!await persist([{run_id:runId,model_version:MODEL_VERSION,status:'run',reason:'RUN_STARTED'}]))return stats;
  const finish=async()=>{
    // One atomic bulk insert: a completion marker means every received fixture has an outcome.
    await persist([...events,{run_id:runId,model_version:MODEL_VERSION,status:'run',reason:'RUN_COMPLETED'}]);
    return stats;
  };
  const skip=(reason:string)=>{stats.skipped++;stats.reasons[reason]=(stats.reasons[reason]||0)+1;};
  const candidates:MatchData[]=[];
  for(const m of matches){
    let reason:string|null=null;
    if(!MODEL_LEAGUES.includes(m.rawIds?.leagueId||0))reason='UNSUPPORTED_LEAGUE';
    else if(!Number.isFinite(Date.parse(m.startTime)))reason='INVALID_KICKOFF';
    else if(Date.parse(m.startTime)>Date.now()+48*3600000)reason='OUTSIDE_HORIZON';
    else if(!baselineSnapshot(m))reason=m.oddsStatus!=='AVAILABLE'
      ? (m.oddsUnavailableReason==='FETCH_FAILED'?'ODDS_FETCH_FAILED':'ODDS_UNAVAILABLE'):'STALE_OR_STARTED';
    if(reason){skip(reason);event(m,'skipped',reason);}else candidates.push(m);
  }
  candidates.sort((a,b)=>Date.parse(a.startTime)-Date.parse(b.startTime)||a.id.localeCompare(b.id));
  if(!candidates.length)return finish();
  let existing:any[]=[];
  try{
    const result=await db.from('model_predictions').select('fixture_id').eq('model_version',MODEL_VERSION).in('fixture_id',candidates.map(m=>m.rawIds!.fixtureId));
    if(result.error)throw new Error();existing=result.data||[];
  }catch{
    for(const m of candidates){stats.failed++;event(m,'failed','MODEL_LEDGER_UNAVAILABLE');}
    return finish();
  }
  const ids=new Set((existing||[]).map((r:any)=>String(r.fixture_id)));
  const cache=new Map<string,{raw:any[],observedAt:string}|null>();let attempted=0;
  for(const match of candidates){
    if(ids.has(String(match.rawIds!.fixtureId))){stats.duplicates++;event(match,'duplicate','ALREADY_RECORDED');continue;}
    if(Date.now()>deadline-13000||attempted>=30){stats.deferred++;event(match,'deferred',attempted>=30?'ATTEMPT_LIMIT':'TIME_BUDGET');continue;}
    attempted++;
    try{
      const {fixtureId,homeTeamId,awayTeamId,leagueId,season}=match.rawIds!;
      if(![fixtureId,homeTeamId,awayTeamId,leagueId,season].every(n=>Number.isSafeInteger(n)&&n!>0)){skip('INVALID_IDS');event(match,'skipped','INVALID_IDS');continue;}
      const cacheKey=`${leagueId}:${season}`;
      if(!cache.has(cacheKey)){
        try{const raw=await getHistory(leagueId!,season!);cache.set(cacheKey,{raw,observedAt:new Date().toISOString()});}
        catch{cache.set(cacheKey,null);}
      }
      const source=cache.get(cacheKey);
      if(!source){stats.failed++;event(match,'failed','HISTORY_UNAVAILABLE');continue;}
      if(!baselineSnapshot(match)){skip('STALE_OR_STARTED');event(match,'skipped','STALE_OR_STARTED');continue;}
      const prediction=predictPoisson(source.raw,{id:fixtureId!,home:homeTeamId!,away:awayTeamId!,league:leagueId!,season:season!,kickoff:match.startTime},source.observedAt);
      if(prediction.reason){skip(prediction.reason);event(match,'skipped',prediction.reason);continue;}
      const p=prediction.probabilities!;
      const {error:saveError}=await db.from('model_predictions').insert({fixture_id:fixtureId,model_version:MODEL_VERSION,
        kickoff_at:match.startTime,observed_at:source.observedAt,odds_observed_at:match.fetchedAt,bookmaker:match.bookmaker,
        odds_home:match.odds.win,odds_draw:match.odds.draw,odds_away:match.odds.loss,
        p_home:p[0],p_draw:p[1],p_away:p[2],lambda_home:prediction.lambdaHome,lambda_away:prediction.lambdaAway,evidence:prediction.evidence});
      if(saveError?.code==='23505'){stats.duplicates++;event(match,'duplicate','CONCURRENT_DUPLICATE');}
      else if(saveError){stats.failed++;event(match,'failed','PREDICTION_WRITE_FAILED');}
      else{stats.inserted++;ids.add(String(fixtureId));event(match,'inserted','PREDICTION_SAVED');}
    }catch{stats.failed++;event(match,'failed','CAPTURE_FAILED');}
  }
  return finish();
}
