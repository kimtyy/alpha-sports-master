// Reserved for evidence-backed explanations after model validation.
// Role prompts must not be used as substitutes for statistical model implementations.
export interface AgentPersona {
  id: string;
  name: string;
  role: string;
  expertise: string;
  prompt: string;
  weight: number;
}
export const AGENT_REGISTRY: Record<string, AgentPersona> = {};
