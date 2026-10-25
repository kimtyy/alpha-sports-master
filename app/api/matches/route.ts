import { NextResponse } from 'next/server';
import { fetchTodayMatches } from '@/lib/data';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const matches = await fetchTodayMatches();
    return NextResponse.json({ success: true, data: matches });
  } catch (error: any) {
    console.error('Matches API Route Error:', error);
    return NextResponse.json(
      { success: false, code: 'DATA_UNAVAILABLE', error: '경기 데이터를 가져올 수 없습니다.' },
      { status: 503 }
    );
  }
}
