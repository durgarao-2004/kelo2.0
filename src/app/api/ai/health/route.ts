import { getCurrentUser } from "@/server/auth/current-user";
import { buildAiClients } from "@/server/ai/clients";
import { configuredProviders } from "@/features/ai/router";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Secret-free view of which AI providers are configured. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const clients = buildAiClients();
  const configured = configuredProviders(clients);
  return Response.json({
    providers: {
      gemini: clients.gemini?.isConfigured() ?? false,
      grok: clients.grok?.isConfigured() ?? false,
      openai: clients.openai?.isConfigured() ?? false,
      openrouter: clients.openrouter?.isConfigured() ?? false,
    },
    configured,
    anyConfigured: configured.length > 0,
  });
}
