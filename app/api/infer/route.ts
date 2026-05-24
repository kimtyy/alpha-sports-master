import { NextRequest, NextResponse } from 'next/server';
import { AlphaOrchestrator } from '@/lib/agents/orchestrator';

// In-memory cache for serverless environments (persists while instance is warm)
const analysisCache = new Map<string, { data: any; analyzedAt: number }>();

export async function POST(req: NextRequest) {
  try {
    const { match } = await req.json();
    
    if (!match || !match.id || !match.startTime) {
      return NextResponse.json({ success: false, error: 'Invalid match data' }, { status: 400 });
    }

    const matchStartTime = new Date(match.startTime).getTime();
    const oneHourBeforeMatch = matchStartTime - 60 * 60 * 1000;
    const now = Date.now();

    const cached = analysisCache.get(match.id);
    let needsAnalysis = true;

    if (cached) {
      needsAnalysis = false;
      // Re-analyze only if we are now within 1 hour of match start, 
      // AND the previous analysis was done before this 1-hour window.
      if (now >= oneHourBeforeMatch && cached.analyzedAt < oneHourBeforeMatch) {
        needsAnalysis = true;
        console.log(`[Cache] Re-analyzing match ${match.id} (within 1 hour of kickoff)`);
      } else {
        console.log(`[Cache] Returning cached analysis for match ${match.id}`);
      }
    }

    if (!needsAnalysis && cached) {
      return NextResponse.json({ success: true, data: cached.data });
    }

    // Initialize orchestrator and run inference
    const orchestrator = new AlphaOrchestrator();
    const results = await orchestrator.infer(match);
    
    // Save to cache
    analysisCache.set(match.id, { data: results, analyzedAt: Date.now() });

    return NextResponse.json({ success: true, data: results });
  } catch (error: any) {
    console.error('Inference API Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
