import Anthropic from "@anthropic-ai/sdk";

let cached: Anthropic | null = null;

/**
 * Lazily construct the Anthropic client. Server-side only — the key never
 * reaches the browser. Throws a clear error when unset (feature-gate, never a
 * silent fake fallback — CLAUDE.md Rule 1 / ARCHITECTURE §8).
 */
export function getAnthropic(): Anthropic {
  if (cached) return cached;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set — the AI agent is unavailable until it is configured.",
    );
  }
  cached = new Anthropic({ apiKey: key });
  return cached;
}

export function isAgentConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/** Model is env-driven (docs/ARCHITECTURE.md §1); default matches .env.example. */
export function agentModel(): string {
  return process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
}
