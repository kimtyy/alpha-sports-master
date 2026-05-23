import { NextResponse } from 'next/server';
import { fetchTodayMatches } from '@/lib/data';

export async function GET() {
  try {
    const matches = await fetchTodayMatches();
    return NextResponse.json({ success: true, data: matches });
  } catch (error: any) {
    console.error('Matches API Route Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch matches' },
      { status: 500 }
    );
  }
}
