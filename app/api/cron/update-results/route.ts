import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { settlePending } from '@/lib/settlement';
import { captureBaseline, settleBaseline } from '@/lib/evaluation';
import { fetchTodayMatches } from '@/lib/data';
import { capturePoisson, fetchLeagueHistory } from '@/lib/poisson-capture';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const startedAt = Date.now();
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'SETTLEMENT_NOT_CONFIGURED' }, { status: 503 });
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const key = process.env.APIFOOTBALL_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key || !url || !serviceKey) {
    return NextResponse.json({ error: 'SETTLEMENT_NOT_CONFIGURED' }, { status: 503 });
  }
  // Server-only key; never reuse the public browser client to settle all users.
  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const getFixture = async (id: string) => {
      const response = await fetch(`https://v3.football.api-sports.io/fixtures?id=${encodeURIComponent(id)}`, {
        headers: { 'x-apisports-key': key }, cache: 'no-store', signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) throw new Error('PROVIDER_UNAVAILABLE');
      const body = await response.json();
      if ((body.errors && Object.keys(body.errors).length) || !Array.isArray(body.response)) throw new Error('PROVIDER_ERROR');
      return body.response[0];
    };
    const result = await settlePending(db, getFixture);
    const evaluation = await settleBaseline(db, getFixture);
    let capture;
    let modelCapture:any = { status:'not_run',failed:0 };
    try {
      const matches = await fetchTodayMatches();
      capture = await captureBaseline(db, matches);
      if (Date.now() < startedAt + 230000) {
        try {
          modelCapture = await capturePoisson(db, matches,
            (league,season)=>fetchLeagueHistory(league,season,key), Math.min(startedAt+270000,Date.now()+60000));
        } catch { modelCapture={status:'unavailable',failed:1}; }
      } else { modelCapture={status:'deferred_time_budget',failed:0}; }
    }
    catch { capture = { failed: 1, error: "BASELINE_CAPTURE_UNAVAILABLE" }; }
    const success = result.failed === 0 && evaluation.failed === 0 && capture.failed === 0 && modelCapture.failed === 0;
    console.info("RESULT_EVALUATION_RUN", JSON.stringify({ success, bookmarks: result, evaluation, capture, modelCapture }));
    return NextResponse.json({ success, ...result, evaluation, capture, modelCapture }, { status: success ? 200 : 502 });
  } catch {
    console.error("RESULT_EVALUATION_RUN_FAILED");
    return NextResponse.json({ success: false, error: 'SETTLEMENT_FAILED' }, { status: 503 });
  }
}
