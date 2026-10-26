import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export async function GET() {
  return NextResponse.json({
    commit: process.env.VERCEL_GIT_COMMIT_SHA || null,
    source: process.env.VERCEL_GIT_COMMIT_SHA ? 'vercel-git' : 'unverified',
    predictionMode: 'disabled-unvalidated',
  }, { headers: { 'Cache-Control': 'no-store' } });
}
