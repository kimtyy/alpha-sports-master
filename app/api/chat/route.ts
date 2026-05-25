import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

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

    // Build the prompt context
    const systemPrompt = "당신은 Alpha Sports Master의 AI 스포츠 분석 도우미입니다. 스포츠 경기, 베팅 전략, 켈리 비율 등 사용자의 질문에 전문적이고 친절하게 답해주세요.";
    
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
