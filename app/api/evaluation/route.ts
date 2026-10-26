import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { evaluationMetrics } from '@/lib/evaluation';
export const dynamic = 'force-dynamic';

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.json({ error: 'EVALUATION_UNAVAILABLE' }, { status: 503 });
  const db = createClient(url, key, { auth: { persistSession: false } });
  try {
    const rows: any[] = [];
    const since = new Date(Date.now() - 90 * 86400_000).toISOString();
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await db.from('market_baseline_records').select('*')
        .gte('recorded_at', since).order('recorded_at', {ascending:false}).order('fixture_id').range(offset,offset+499);
      if (error) throw error;
      rows.push(...(data || []));
      if (!data || data.length < 500) break;
      if (rows.length >= 10000) throw new Error('EVALUATION_WINDOW_TOO_LARGE');
    }
    return NextResponse.json({ success: true, model: 'market-implied-v1', windowDays:90,
      metrics: evaluationMetrics(rows), recent: rows.slice(0,20) }, {headers:{'Cache-Control':'no-store'}});
  } catch {
    return NextResponse.json({ success:false, error:'EVALUATION_UNAVAILABLE' }, {status:503});
  }
}
