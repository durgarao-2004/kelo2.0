import type {
  AiTask,
  GenerateRequest,
  ProviderClient,
  ProviderName,
  RouteResult,
} from "./types";

/**
 * Task → ordered provider preference. Cheap tasks lead with the fast primary
 * (Gemini); reasoning-heavy tasks lead with a stronger model; second_opinion
 * deliberately prefers an alternate provider. Every task falls back through all
 * providers so a single outage never breaks the feature.
 */
export const TASK_PROVIDER_ORDER: Record<AiTask, ProviderName[]> = {
  title: ["gemini", "openai", "grok", "openrouter"],
  summary: ["gemini", "openai", "grok", "openrouter"],
  concepts: ["gemini", "openai", "grok", "openrouter"],
  revision: ["gemini", "openai", "grok", "openrouter"],
  qa: ["openai", "gemini", "grok", "openrouter"],
  analysis: ["openai", "gemini", "grok", "openrouter"],
  second_opinion: ["grok", "openai", "openrouter", "gemini"],
};

export class AllProvidersFailedError extends Error {
  constructor(public readonly details: string[]) {
    super(`All AI providers failed: ${details.join("; ")}`);
    this.name = "AllProvidersFailedError";
  }
}

export class NoProviderConfiguredError extends Error {
  constructor() {
    super("No AI provider is configured.");
    this.name = "NoProviderConfiguredError";
  }
}

/**
 * Try each preferred provider in order, skipping unconfigured ones, falling
 * through on error or empty output. Pure w.r.t. the provided clients, so it's
 * fully unit-testable with fakes.
 */
export async function routeTask(
  task: AiTask,
  req: GenerateRequest,
  clients: Partial<Record<ProviderName, ProviderClient>>,
  order: ProviderName[] = TASK_PROVIDER_ORDER[task],
): Promise<RouteResult> {
  const errors: string[] = [];
  let anyConfigured = false;

  for (const name of order) {
    const client = clients[name];
    if (!client || !client.isConfigured()) continue;
    anyConfigured = true;
    try {
      const text = await client.generate(req);
      if (text && text.trim().length > 0) {
        return { text, provider: name, model: client.model };
      }
      errors.push(`${name}: empty response`);
    } catch (e) {
      errors.push(`${name}: ${e instanceof Error ? e.message : "error"}`);
    }
  }

  if (!anyConfigured) throw new NoProviderConfiguredError();
  throw new AllProvidersFailedError(errors);
}

export function configuredProviders(
  clients: Partial<Record<ProviderName, ProviderClient>>,
): ProviderName[] {
  return (Object.keys(clients) as ProviderName[]).filter((n) =>
    clients[n]?.isConfigured(),
  );
}
