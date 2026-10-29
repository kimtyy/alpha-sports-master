// A frozen, interpretable research model. No odds are used as model inputs.
export const MODEL_VERSION = 'poisson-venue-v1';
export const MODEL_LEAGUES = [39, 140, 78, 135, 61, 292, 293, 98, 88, 94, 71, 128, 253, 235];
export type TrainingMatch = { id:number; kickoff:string; home:number; away:number; hg:number; ag:number };
export type Target = { id:number; home:number; away:number; league:number; season:number; kickoff:string };
const DAY = 86400000;

export function trainingMatches(raw:any[], target:Target, observedAt:string):TrainingMatch[] {
  const cutoff = Date.parse(observedAt);
  if (!Number.isFinite(cutoff) || cutoff >= Date.parse(target.kickoff)) throw new Error('INVALID_CUTOFF');
  const found = new Map<number,TrainingMatch>();
  for (const r of raw) {
    if (r.league?.id !== target.league || r.league?.season !== target.season || r.fixture?.status?.short !== 'FT') continue;
    const t = Date.parse(r.fixture.date);
    // Conservative three-hour buffer. Only final scores already observed before prediction.
    if (!Number.isFinite(t) || t > cutoff-3*3600000 || t < cutoff-365*DAY || r.fixture.id === target.id) continue;
    const vals = [r.fixture.id,r.teams?.home?.id,r.teams?.away?.id];
    if (!vals.every(n=>Number.isSafeInteger(n)&&n>0) || vals[1]===vals[2] ||
        ![r.goals?.home,r.goals?.away].every(n=>Number.isInteger(n)&&n>=0&&n<=30)) throw new Error('INVALID_HISTORY');
    const row={id:vals[0],kickoff:new Date(t).toISOString(),home:vals[1],away:vals[2],hg:r.goals.home,ag:r.goals.away};
    if(found.has(row.id) && JSON.stringify(found.get(row.id))!==JSON.stringify(row)) throw new Error('CONFLICTING_HISTORY');
    found.set(row.id,row);
  }
  return [...found.values()].sort((a,b)=>a.kickoff.localeCompare(b.kickoff)||a.id-b.id);
}

export function poissonProbabilities(home:number,away:number):number[] {
  if (![home,away].every(n=>Number.isFinite(n)&&n>=.15&&n<=5)) throw new Error('INVALID_LAMBDA');
  const pmf=(lambda:number)=>{const p=[Math.exp(-lambda)];for(let i=1;i<=40;i++)p.push(p[i-1]*lambda/i);return p;};
  const h=pmf(home),a=pmf(away),out=[0,0,0];
  for(let i=0;i<h.length;i++)for(let j=0;j<a.length;j++)out[i>j?0:i===j?1:2]+=h[i]*a[j];
  const total=out.reduce((x,y)=>x+y,0);
  if (1-total>1e-9) throw new Error('POISSON_TAIL_TOO_LARGE');
  return out.map(n=>n/total);
}

export function predictPoisson(raw:any[],target:Target,observedAt:string) {
  if(!MODEL_LEAGUES.includes(target.league)) return {reason:'UNSUPPORTED_LEAGUE'} as const;
  if(![target.id,target.home,target.away,target.season].every(n=>Number.isSafeInteger(n)&&n>0)||target.home===target.away||!Number.isFinite(Date.parse(target.kickoff))) throw new Error('INVALID_TARGET');
  const history=trainingMatches(raw,target,observedAt);
  const h=history.filter(r=>r.home===target.home),a=history.filter(r=>r.away===target.away);
  if(history.length<30||h.length<5||a.length<5) return {reason:'INSUFFICIENT_HISTORY'} as const;
  const avgH=history.reduce((s,r)=>s+r.hg,0)/history.length,avgA=history.reduce((s,r)=>s+r.ag,0)/history.length;
  if(avgH<=0||avgA<=0) return {reason:'INVALID_LEAGUE_AVERAGE'} as const;
  const shrink=(rows:TrainingMatch[],key:'hg'|'ag',prior:number)=>(rows.reduce((s,r)=>s+r[key],0)+5*prior)/(rows.length+5);
  const rawH=shrink(h,'hg',avgH)*shrink(a,'hg',avgH)/avgH;
  const rawA=shrink(a,'ag',avgA)*shrink(h,'ag',avgA)/avgA;
  const lambdaHome=Math.max(.15,Math.min(5,rawH)),lambdaAway=Math.max(.15,Math.min(5,rawA));
  return {reason:null, probabilities:poissonProbabilities(lambdaHome,lambdaAway),lambdaHome,lambdaAway,
    evidence:{source:'API-Football',league:target.league,season:target.season,homeTeamId:target.home,awayTeamId:target.away,
      observedAt,leagueMatches:history.length,homeMatches:h.length,awayMatches:a.length,priorMatches:5,
      avgHome:avgH,avgAway:avgA,rawLambdaHome:rawH,rawLambdaAway:rawA,history}};
}

export function pairedMetrics(rows:any[]) {
  const total=rows.length; let pending=0,excluded=0,settled=0;
  const m={correct:0,tied:0,brier:0},b={correct:0,tied:0,brier:0};
  const score=(p:number[],outcome:number,s:typeof m)=>{
    if(!p.every(n=>Number.isFinite(n)&&n>=0&&n<=1)||Math.abs(p.reduce((x,y)=>x+y,0)-1)>1e-8) throw new Error('INVALID_PROBABILITIES');
    const top=Math.max(...p),w=p.map((n,i)=>Math.abs(n-top)<1e-12?i:-1).filter(i=>i>=0);
    if(w.length>1)s.tied++;else if(w[0]===outcome)s.correct++;
    s.brier+=p.reduce((sum,n,i)=>sum+(n-(i===outcome?1:0))**2,0);
  };
  for(const row of rows){
    const result=row.market_baseline_records;
    if(!result)throw new Error('MISSING_PAIRED_RESULT');
    if(result.excluded_reason){excluded++;continue;}
    if(!result.settled_at){pending++;continue;}
    if(![result.result_home,result.result_away].every(n=>Number.isInteger(n)&&n>=0))throw new Error('INVALID_RESULT');
    settled++;const out=result.result_home>result.result_away?0:result.result_home<result.result_away?2:1;
    score([row.p_home,row.p_draw,row.p_away],out,m);
    const prices=[row.odds_home,row.odds_draw,row.odds_away];
    if(!prices.every(n=>Number.isFinite(n)&&n>1))throw new Error('INVALID_ODDS');
    const weights=prices.map(n=>1/n),sum=weights.reduce((x,y)=>x+y,0);
    score(weights.map(n=>n/sum),out,b);
  }
  const finish=(s:typeof m)=>({correct:s.correct,tied:s.tied,accuracy:settled>s.tied?s.correct/(settled-s.tied):null,brier:settled?s.brier/settled:null});
  return {total,pending,excluded,settled,model:finish(m),market:finish(b),brierDifference:settled?(m.brier-b.brier)/settled:null};
}
