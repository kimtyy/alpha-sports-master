import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { fetchTodayMatches } from '@/lib/data';
import { calcKelly } from '@/lib/kelly';

// Initialize the Google Generative AI with the API key from the environment
const apiKey = process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(apiKey);

export async function POST(req: Request) {
  if (!apiKey) {
    return NextResponse.json(
      { error: 'GEMINI_API_KEY is not set in environment variables' },
      { status: 500 }
    );
  }

  try {
    const { message, history } = await req.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });

    // Fetch today's actual matches
    const matches = await fetchTodayMatches();
    
    // Calculate Value Bets
    const valueBets = matches.filter(m => {
      // In real scenario, modelProb would be derived from the AI model (orchestrator).
      // Here we use a generic probability or calculate an edge based on simple logic if it's actual API data.
      // Since getInitialProbability returns 0.5 default, any match with odds > 2.0 is a value bet.
      const modelProb = 0.55; // simple assumed baseline probability to find some value bets
      const kelly = calcKelly(modelProb, m.odds.win);
      return kelly.isValueBet;
    }).map(m => {
      const kelly = calcKelly(0.55, m.odds.win);
      return {
        league: m.league,
        home: m.teams.home,
        away: m.teams.away,
        odds_win: m.odds.win,
        kelly_fraction: (kelly.kellyFraction * 100).toFixed(1) + '%'
      };
    });

    const matchesData = matches && matches.length > 0 
      ? matches.map(m => ({ league: m.league, home: m.teams.home, away: m.teams.away, startTime: m.startTime, odds_win: m.odds.win }))
      : [];

    // Build the prompt context
    const systemPrompt = `[시스템 지침]
너는 Alpha Sports Master의 AI 스포츠 분석 어시스턴트다.
반드시 아래 실제 오늘 경기 데이터만 참조하여 답변하라.
데이터에 없는 경기는 절대 언급하지 마라.

[오늘 실제 경기 데이터]
${JSON.stringify(matchesData)}

[Value Bet 경기]
${valueBets.length > 0 ? JSON.stringify(valueBets) : "오늘은 Value Bet 조건을 충족하는 경기가 없습니다."}

[답변 규칙]
- Value Bet 없으면 → "오늘은 베팅을 자제하세요"
- Value Bet 있으면 → 해당 경기만 추천
- 켈리 비율 항상 포함
- 실제 배당률 기반으로만 계산`;
    
    // We could use startChat for conversational history, but for simplicity we will just include history in the prompt.
    let fullPrompt = `${systemPrompt}\n\n`;
    if (history && history.length > 0) {
      history.forEach((msg: { role: string, content: string }) => {
        fullPrompt += `${msg.role === 'user' ? '사용자' : 'AI'}: ${msg.content}\n`;
      });
    }
    fullPrompt += `사용자: ${message}\nAI:`;

    const result = await model.generateContent(fullPrompt);
    const responseText = result.response.text();

    return NextResponse.json({ success: true, text: responseText });
  } catch (error: any) {
    console.error('Chat API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
