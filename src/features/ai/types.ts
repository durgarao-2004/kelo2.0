/**
 * AI abstraction shared by the router and providers. Kept free of server-only
 * imports so the routing logic can be unit-tested with fake providers.
 */
export type ProviderName = "gemini" | "grok" | "openai" | "openrouter";

export type AiTask =
  | "title" // quick, cheap
  | "summary" // fast/quality
  | "concepts" // fast/quality
  | "revision" // quality
  | "qa" // best reasoning (Ask my lectures)
  | "analysis" // difficult lecture — strongest reasoning
  | "second_opinion"; // alternate provider on purpose

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface GenerateRequest {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  /** Ask the provider for strict JSON output. */
  json?: boolean;
}

export interface ProviderClient {
  readonly name: ProviderName;
  readonly model: string;
  isConfigured(): boolean;
  generate(req: GenerateRequest): Promise<string>;
}

export interface RouteResult {
  text: string;
  provider: ProviderName;
  model: string;
}
