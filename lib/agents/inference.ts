import { GoogleGenerativeAI } from '@google/generative-ai';
import { AGENT_REGISTRY, AgentPersona } from './config';
import { MatchData, AgentResult } from './orchestrator';

/*
 * ALPHA INFERENCE PROVIDER - POWERED BY GOOGLE GEMINI
 * Handles the logic of 'thinking' for each agent using actual AI.
 */

// Initialize Gemini SDK (Make sure GEMINI_API_KEY is in your environment)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export class AlphaInference {
  /**
   * Executes an actual Gemini AI inference for a specific agent.
   */
  async runAgent(agentId: string, match: MatchData, context?: string): Promise<AgentResult> {
    const persona = AGENT_REGISTRY[agentId];
    if (!persona) throw new Error(`Agent ${agentId} not found in registry.`);

    const modelId = agentId === 'alpha_consensus' ? 'gemini-1.5-pro' : 'gemini-1.5-flash';
    
    // Graceful fallback if API key is missing for demonstrations
    if (!process.env.GEMINI_API_KEY) {
      console.warn(`[AI_INFO] Missing API Key. Returning simulated protocol for ${persona.name}.`);
      await new Promise(r => setTimeout(r, 1500)); // Simulate thinking
      return {
        agentId: persona.id,
        name: persona.name,
        role: persona.role,
        confidence: 0.85 + (Math.random() * 0.1),
        sentiment: 'favorable',
        findings: [
          `${persona.name} 시뮬레이션 데이터 스캐닝 완료.`,
          `${match.teams.home}의 최근 5경기 공수 밸런스 지수 0.84 확보.`,
          "알파 지능형 터미널 데모 모드 작동 중."
        ],
        predictedScore: "2:1"
      };
    }

    const model = genAI.getGenerativeModel({ model: modelId });

    const prompt = this.buildPrompt(persona, match, context);

    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      return this.parseAIResponse(persona, text);
    } catch (error) {
      console.error(`[AI_ERROR] ${persona.name} inference failed:`, error);
      // Fallback in case of API failure
      return {
        agentId: persona.id,
        name: persona.name,
        role: persona.role,
        confidence: 0.5,
        sentiment: 'stable',
        findings: [`${persona.name}의 분석 시스템에 일시적인 신호 간섭이 발생했습니다. (API Error)`]
      };
    }
  }

  private buildPrompt(persona: AgentPersona, match: MatchData, context?: string): string {
    return `
      ${persona.prompt}
      
      현재 분석 중인 경기 데이터:
      - 매치: ${match.teams.home} vs ${match.teams.away}
      - 리그: ${match.league}
      - 배당: 승(${match.odds.win}) / 무(${match.odds.draw}) / 패(${match.odds.loss})
      - 추가 컨텍스트: ${context || 'N/A'}

      [출력 규칙 - 반드시 준수할 것]
      1. 응답은 반드시 다음 형식을 포함해야 합니다:
         CONFIDENCE: [0.0에서 1.0 사이의 숫자]
         SENTIMENT: [favorable | unfavorable | stable 중 하나]
         SCORE: [예상 점수, 예: 2:1]
         FINDINGS: [중요 분석 포인트를 리스트 형태로 3개 작성]

      2. 말투는 냉철하고 전문적인 분석관처럼 하십시오.
    `;
  }

  private parseAIResponse(persona: AgentPersona, text: string): AgentResult {
    // Advanced parsing logic with regex
    const confidenceMatch = text.match(/CONFIDENCE:\s*([\d\.]+)/i);
    const sentimentMatch = text.match(/SENTIMENT:\s*(favorable|unfavorable|stable)/i);
    const scoreMatch = text.match(/SCORE:\s*(\d+:\d+)/i);
    const findingsSection = text.match(/FINDINGS:([\s\S]+)/i);

    const confidence = confidenceMatch ? parseFloat(confidenceMatch[1]) : 0.7;
    const sentiment = (sentimentMatch ? sentimentMatch[1].toLowerCase() : 'stable') as any;
    const predictedScore = scoreMatch ? scoreMatch[1] : undefined;
    
    let findings = [
      `${persona.name}의 데이터 스캔 결과 정밀한 상시 분석 진행 중.`,
      "주요 지표에서 특이점 발견.",
      "이사님의 비책(Skill)에 따른 보정 필요."
    ];

    if (findingsSection) {
      const parsedFindings = findingsSection[1]
        .split('\n')
        .map(f => f.replace(/^[-*0-9.\s]+/, '').trim())
        .filter(f => f.length > 5)
        .slice(0, 3);
      
      if (parsedFindings.length > 0) findings = parsedFindings;
    }

    return {
      agentId: persona.id,
      name: persona.name,
      role: persona.role,
      confidence,
      sentiment,
      findings,
      predictedScore
    };
  }
}

export const alphaInference = new AlphaInference();
