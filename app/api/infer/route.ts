import { NextRequest, NextResponse } from 'next/server';
import { getOrRunMatchAnalysis } from '@/lib/analysis';

export async function POST(req: NextRequest) {
  try {
    const { match } = await req.json();
    
    if (!match || !match.id) {
      return NextResponse.json({ success: false, error: 'Invalid match data' }, { status: 400 });
    }

    // Call getOrRunMatchAnalysis which checks Supabase match_analyses table first,
    // and if not cached, runs 10-agent W-5 debate and saves snapshot to Supabase.
    const results = await getOrRunMatchAnalysis(match);

    return NextResponse.json({ success: true, data: results });
  } catch (error: any) {
    console.error('Inference API Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
