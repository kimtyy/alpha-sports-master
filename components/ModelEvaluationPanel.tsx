'use client';
import {useEffect,useState} from 'react';
const pct=(n:number|null)=>n===null?'평가 대기':`${(n*100).toFixed(1)}%`;
const score=(n:number|null)=>n===null?'평가 대기':n.toFixed(3);
export default function ModelEvaluationPanel(){
  const [report,setReport]=useState<any>(null),[error,setError]=useState(false);
  useEffect(()=>{const c=new AbortController();fetch('/api/model-evaluation',{signal:c.signal,cache:'no-store'})
    .then(async r=>{if(!r.ok)throw new Error();return r.json();}).then(setReport)
    .catch(e=>{if(e.name!=='AbortError')setError(true);});return()=>c.abort();},[]);
  const m=report?.metrics;
  return <section style={{padding:20,border:'1px solid #34404a',borderRadius:12,marginTop:20}}>
    <h3>첫 예측 모델 · 검증 중</h3>
    <p style={{fontSize:13,color:'#b9c7d5'}}>실제 득점·실점으로 계산한 포아송 모델입니다. 검증용 기록이며 구매 추천이 아닙니다.</p>
    {error?<p role="alert">모델 평가 기록을 불러오지 못했습니다.</p>:!m?<p>모델 기록 확인 중…</p>:<>
      <p>최근 90일 · 예측 {m.total}건 · 평가 완료 {m.settled}건 · 대기 {m.pending}건 · 제외 {m.excluded}건</p>
      {m.total===0&&<p>첫 경기 전 예측 수집 대기입니다. 매일 오전 9시대 자동 작업에서 자료가 충분한 경기만 기록합니다.</p>}
      <div style={{overflowX:'auto'}}><table style={{width:'100%',fontSize:13,textAlign:'left'}}>
        <caption style={{textAlign:'left',padding:'8px 0'}}>같은 경기 · 예측 수집 때 함께 저장한 배당과 비교</caption>
        <thead><tr><th scope="col">항목</th><th scope="col">포아송 모델</th><th scope="col">배당 기준선</th></tr></thead>
        <tbody><tr><th scope="row">적중률</th><td>{pct(m.model.accuracy)}</td><td>{pct(m.market.accuracy)}</td></tr>
          <tr><th scope="row">확률 오차</th><td>{score(m.model.brier)}</td><td>{score(m.market.brier)}</td></tr>
          <tr><th scope="row">최대 확률 동률</th><td>{m.model.tied}건</td><td>{m.market.tied}건</td></tr></tbody>
      </table></div>
      <p style={{fontSize:12,color:'#b9c7d5'}}>확률 오차(Brier, 0~2)는 낮을수록 좋습니다. 동률은 각 적중률에서 제외하므로 동률 건수가 다르면 분모도 다릅니다. 적중률은 수익률이 아닙니다.</p>
      <p>모델 − 배당 확률 오차: {score(m.brierDifference)}{m.brierDifference!==null?' (음수면 모델의 오차가 더 작음)':''}</p>
      {m.settled<200&&<p style={{fontSize:13,color:'#f0c674'}}>초기 표본입니다. 현재 수치만으로 성능 우위를 판단하지 않습니다.</p>}
      {report.recent.map((r:any)=><div key={r.fixture_id} style={{borderTop:'1px solid #34404a',padding:'10px 0',fontSize:13}}>
        <strong>{r.market_baseline_records.home_team} vs {r.market_baseline_records.away_team}</strong>
        <p>모델: 승 {pct(r.p_home)} / 무 {pct(r.p_draw)} / 패 {pct(r.p_away)}</p>
        <p>기록 {new Date(r.recorded_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})} · {r.market_baseline_records.excluded_reason?'평가 제외':r.market_baseline_records.settled_at?`결과 ${r.market_baseline_records.result_home}:${r.market_baseline_records.result_away}`:'결과 대기'}</p>
      </div>)}
    </>}
    <p style={{fontSize:12,color:'#b9c7d5'}}>동일 리그·시즌, 최근 365일의 종료 경기만 사용합니다. 리그 30경기, 해당 팀 홈·원정 각각 5경기 이상이 필요합니다. 향후 48시간 내 경기 중 회당 최대 30건을 시도하며, 수집 제한으로 전체 경기를 포함하지 않습니다. 부상·선발·상대 전력 차이는 아직 반영하지 않습니다.</p>
  </section>;
}
