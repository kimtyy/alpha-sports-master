import { NextRequest, NextResponse } from 'next/server';
import { AlphaOrchestrator } from '@/lib/agents/orchestrator';

export async function POST(req: NextRequest) {
  try {
    const { match } = await req.json();
    
    // Initialize orchestrator and run inference
    const orchestrator = new AlphaOrchestrator();
    const results = await orchestrator.infer(match);
    
    return NextResponse.json({ success: true, data: results });
  } catch (error: any) {
    console.error('Inference API Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
