'use client';
import { useEffect, useState } from 'react';
import ModelEvaluationPanel from './ModelEvaluationPanel';
import { marketProbabilities } from '@/lib/evaluation';

export default function EvaluationPanel() {
  const [report, setReport] = useState<any>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/evaluation', {signal:controller.signal, cache:'no-store'})
      .then(async r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setReport).catch(e => { if (e.name !== 'AbortError') setError(true); });
    return () => controller.abort();
  }, []);
  return <><ModelEvaluationPanel/><section style={{padding:20, border:'1px solid #34404a', borderRadius:12, marginTop:20}}>
    <h3>배당 기준선 검증 기록</h3>
    <p style={{fontSize:13,color:'#b9c7d5'}}>AI 예측이나 구매 추천이 아닙니다. 해외 배당의 역수를 합계 100%로 환산한 비교 기준입니다.</p>
    {error ? <p role="alert">평가 기록을 불러오지 못했습니다. 잠시 후 다시 확인해주세요.</p> : !report ? <p>평가 기록 확인 중…</p> : <>
      <p>최근 90일 · 대기 {report.metrics.pending}건 · 평가 완료 {report.metrics.settled}건 · 제외 {report.metrics.excluded}건</p>
      <p>최대 확률 결과 적중률: {report.metrics.accuracy === null ? '평가 대기' : `${(report.metrics.accuracy * 100).toFixed(1)}%`}</p>
      <p>확률 오차(Brier): {report.metrics.brier === null ? '평가 대기' : report.metrics.brier.toFixed(3)}</p>
      <p style={{fontSize:12,color:'#b9c7d5'}}>Brier 점수는 0~2 범위로, 낮을수록 실제 결과에 가까웠습니다. 최대 확률이 같은 경기는 적중률에서 제외합니다({report.metrics.tied}건). 적중률은 수익률이 아닙니다.</p>
      {report.metrics.total === 0 && <p>아직 경기 전 기록이 없습니다. 매일 오전 9시대(한국시간) 자동 작업에서 수집합니다.</p>}
      {report.recent.map((row:any) => {
        const p = marketProbabilities([row.odds_home,row.odds_draw,row.odds_away]);
        return <div key={row.fixture_id} style={{borderTop:'1px solid #34404a',padding:'12px 0',fontSize:13}}>
          <strong>{row.home_team} vs {row.away_team}</strong>
          <p>승 {(p[0]*100).toFixed(1)}% / 무 {(p[1]*100).toFixed(1)}% / 패 {(p[2]*100).toFixed(1)}%</p>
          <p>{row.bookmaker} · 기록 {new Date(row.recorded_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})}</p>
          <p>{row.excluded_reason ? `평가 제외 (${row.excluded_reason})` : row.settled_at ? `종료 결과 ${row.result_home}:${row.result_away}` : '결과 평가 대기'}</p>
        </div>;
      })}
      <p style={{fontSize:12,color:'#b9c7d5'}}>최초 수집 배당을 고정합니다. 수집 시점은 경기마다 다르며 취소·연장전·경기 시간 변경은 평가에서 제외합니다. 최근 기록 최대 20건을 표시합니다.</p>
    </>}
  </section></>;
}
