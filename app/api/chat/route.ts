import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { fetchTodayMatches } from '@/lib/data';

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

    const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });

    // Fetch today's actual matches
    const matches = await fetchTodayMatches();
    const matchesContext = matches && matches.length > 0 
      ? matches.map(m => `- ${m.league}: ${m.teams.home} vs ${m.teams.away} (시작시간: ${m.startTime})`).join('\n')
      : '오늘 예정된 경기가 없습니다.';

    // Build the prompt context
    const systemPrompt = `당신은 Alpha Sports Master의 AI 스포츠 분석 도우미입니다. 스포츠 경기, 베팅 전략, 켈리 비율 등 사용자의 질문에 전문적이고 친절하게 답해주세요.

[오늘 실제 경기 데이터]
${matchesContext}

위 데이터를 기반으로만 오늘 경기나 일정에 대해 답변하고 실제 데이터에 없는 경기나 리그는 절대 언급하지 마십시오.`;
    
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
