import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { settlePending } from '@/lib/settlement';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
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
    const result = await settlePending(db, async id => {
      const response = await fetch(`https://v3.football.api-sports.io/fixtures?id=${encodeURIComponent(id)}`, {
        headers: { 'x-apisports-key': key }, cache: 'no-store', signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) throw new Error('PROVIDER_UNAVAILABLE');
      const body = await response.json();
      if ((body.errors && Object.keys(body.errors).length) || !Array.isArray(body.response)) throw new Error('PROVIDER_ERROR');
      return body.response[0];
    });
    return NextResponse.json({ success: result.failed === 0, ...result }, { status: result.failed ? 502 : 200 });
  } catch {
    return NextResponse.json({ success: false, error: 'SETTLEMENT_FAILED' }, { status: 503 });
  }
}
