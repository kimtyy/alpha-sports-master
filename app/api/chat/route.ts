import { NextResponse } from 'next/server';

// No external model calls or invented probabilities while model validation is pending.
export async function POST() {
  return NextResponse.json({
    success: false,
    code: 'MODEL_UNAVAILABLE',
    error: '검증된 예측 모델이 아직 연결되지 않았습니다. 경기 정보만 조회할 수 있으며 승률·추천액은 제공하지 않습니다.',
  }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
}
