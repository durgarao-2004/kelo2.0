import { describe, it, expect, vi } from "vitest";
import {
  routeTask,
  configuredProviders,
  AllProvidersFailedError,
  NoProviderConfiguredError,
} from "./router";
import type { ProviderClient, ProviderName } from "./types";

function fake(
  name: ProviderName,
  behavior: { configured?: boolean; result?: string; throws?: string },
): ProviderClient {
  return {
    name,
    model: `${name}-model`,
    isConfigured: () => behavior.configured ?? true,
    generate: vi.fn(async () => {
      if (behavior.throws) throw new Error(behavior.throws);
      return behavior.result ?? "";
    }),
  };
}

const req = { messages: [{ role: "user" as const, content: "hi" }] };

describe("routeTask", () => {
  it("uses the first configured provider that succeeds", async () => {
    const res = await routeTask("summary", req, {
      gemini: fake("gemini", { result: "from gemini" }),
      openai: fake("openai", { result: "from openai" }),
    });
    expect(res.provider).toBe("gemini");
    expect(res.text).toBe("from gemini");
    expect(res.model).toBe("gemini-model");
  });

  it("falls back when the primary throws", async () => {
    const openai = fake("openai", { result: "recovered" });
    const res = await routeTask("summary", req, {
      gemini: fake("gemini", { throws: "500 error" }),
      openai,
    });
    expect(res.provider).toBe("openai");
    expect(openai.generate).toHaveBeenCalledOnce();
  });

  it("falls back when the primary returns empty", async () => {
    const res = await routeTask("summary", req, {
      gemini: fake("gemini", { result: "   " }),
      openai: fake("openai", { result: "real" }),
    });
    expect(res.provider).toBe("openai");
  });

  it("skips unconfigured providers", async () => {
    const gemini = fake("gemini", { configured: false, result: "nope" });
    const res = await routeTask("summary", req, {
      gemini,
      openai: fake("openai", { result: "ok" }),
    });
    expect(res.provider).toBe("openai");
    expect(gemini.generate).not.toHaveBeenCalled();
  });

  it("respects a custom order (second_opinion prefers grok)", async () => {
    const res = await routeTask("second_opinion", req, {
      gemini: fake("gemini", { result: "g" }),
      grok: fake("grok", { result: "x" }),
    });
    expect(res.provider).toBe("grok");
  });

  it("throws AllProvidersFailed when every configured provider fails", async () => {
    await expect(
      routeTask("summary", req, {
        gemini: fake("gemini", { throws: "down" }),
        openai: fake("openai", { throws: "down" }),
      }),
    ).rejects.toBeInstanceOf(AllProvidersFailedError);
  });

  it("throws NoProviderConfigured when nothing is configured", async () => {
    await expect(
      routeTask("summary", req, {
        gemini: fake("gemini", { configured: false }),
      }),
    ).rejects.toBeInstanceOf(NoProviderConfiguredError);
  });
});

describe("configuredProviders", () => {
  it("lists only configured providers", () => {
    expect(
      configuredProviders({
        gemini: fake("gemini", { configured: true }),
        openai: fake("openai", { configured: false }),
      }),
    ).toEqual(["gemini"]);
  });
});
