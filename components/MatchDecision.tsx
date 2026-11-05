'use client';

import { useEffect, useState } from 'react';
import type { MatchData } from '@/lib/agents/orchestrator';
import { MODEL_VERSION } from '@/lib/poisson';
import { supabase } from '@/lib/supabase';

const outcomes = [
  { value: 'p_home', label: '홈팀 승' },
  { value: 'p_draw', label: '무승부' },
  { value: 'p_away', label: '원정팀 승' },
] as const;

type Outcome = typeof outcomes[number]['value'];
type Prediction = Record<Outcome, number> & { recorded_at: string };
type Lookup = { prediction?: Prediction; error?: boolean };
const percent = (value: number) => `${(value * 100).toFixed(1)}%`;

export default function MatchDecision({ match }: { match: MatchData }) {
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [outcome, setOutcome] = useState<Outcome>('p_home');
  const [price, setPrice] = useState('');
  const [now, setNow] = useState(Date.now);
  const fixtureId = match.rawIds?.fixtureId;
  const kickoff = Date.parse(match.startTime);
  const isUpcoming = match.fixtureStatus === 'NS' && kickoff > now;

  useEffect(() => {
    if (!isUpcoming) return;
    const timer = window.setTimeout(() => setNow(Date.now()), Math.min(kickoff - Date.now() + 10, 60_000));
    return () => window.clearTimeout(timer);
  }, [isUpcoming, kickoff, now]);

  useEffect(() => {
    if (!fixtureId || !isUpcoming) return;
    const controller = new AbortController();
    async function readPrediction() {
      try {
        const { data, error } = await supabase.from('model_predictions')
          .select('p_home,p_draw,p_away,recorded_at')
          .eq('fixture_id', fixtureId)
          .eq('model_version', MODEL_VERSION)
          .eq('kickoff_at', new Date(kickoff).toISOString())
          .lt('recorded_at', new Date(kickoff).toISOString())
          .abortSignal(controller.signal)
          .maybeSingle();
        if (controller.signal.aborted) return;
        if (error) setLookup({ error: true });
        else setLookup(data ? { prediction: data } : {});
      } catch {
        if (!controller.signal.aborted) setLookup({ error: true });
      }
    }
    void readPrediction();
    return () => controller.abort();
  }, [fixtureId, kickoff, isUpcoming]);

  const prediction = lookup?.prediction;
  const decimalOdds = Number(price);
  const threshold = /^\d+(?:\.\d+)?$/.test(price.trim()) && decimalOdds > 1 && Number.isFinite(decimalOdds)
    ? 1 / decimalOdds
    : null;
  const difference = prediction && threshold !== null ? prediction[outcome] - threshold : null;
  let status = '보류 · 모델 성능 검증 중';
  if (!isUpcoming) status = '보류 · 경기 시작 전 일정만 비교합니다';
  else if (!fixtureId) status = '보류 · 경기 식별 정보 없음';
  else if (!lookup) status = '경기 전 모델 기록 확인 중';
  else if (lookup.error) status = '보류 · 모델 기록 조회 실패';
  else if (!prediction) status = '보류 · 저장된 경기 전 모델 기록 없음';
  else if (threshold === null) status = '보류 · 국내 구매 배당 입력 필요';

  return (
    <section className="mt-4 space-y-3 rounded-xl border border-neutral-700 p-4 text-sm">
      <h3 className="text-base font-semibold">베팅 판단</h3>
      <p role="status" className="font-medium">{status}</p>
      {prediction && isUpcoming && <p>경기 전 모델 확률 · 홈 승 {percent(prediction.p_home)} / 무승부 {percent(prediction.p_draw)} / 원정 승 {percent(prediction.p_away)}</p>}
      {isUpcoming && <>
        <a className="inline-block rounded border border-neutral-600 px-3 py-2 underline" href="https://www.betman.co.kr/" target="_blank" rel="noopener noreferrer">베트맨에서 경기·구매 배당 확인 ↗</a>
        <p className="text-neutral-400">베트맨에서 같은 경기의 일반 승무패 배당을 확인한 뒤 입력하세요.</p>
        <label className="block">비교할 결과
          <select className="mt-1 block w-full rounded border border-neutral-600 bg-neutral-900 p-2" value={outcome} onChange={event => setOutcome(event.target.value as Outcome)}>
            {outcomes.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        <label className="block">국내 배당 (직접 입력)
          <input className="mt-1 block w-full rounded border border-neutral-600 bg-neutral-900 p-2" inputMode="decimal" value={price} onChange={event => setPrice(event.target.value)} placeholder="1.67" />
        </label>
        {price.trim() && threshold === null && <p>1보다 큰 소수 배당을 입력하세요.</p>}
        {threshold !== null && <p>입력 배당의 손익분기 확률 {percent(threshold)}</p>}
        {difference !== null && <p>모델 확률 − 손익분기 확률 {(difference * 100).toFixed(1)}%p · 연구용 비교</p>}
      </>}
    </section>
  );
}
