import { NextResponse } from 'next/server';
import { fetchTodayMatches, MatchDataUnavailable } from '@/lib/data/apiFootball';

export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const matches = await fetchTodayMatches();
    return NextResponse.json({ success: true, data: matches }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      code: 'DATA_UNAVAILABLE',
      error: error instanceof MatchDataUnavailable ? error.message : '경기 데이터를 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.',
    }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
