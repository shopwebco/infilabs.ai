import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { chatRequestSchema } from "@/lib/validation/agent";
import { getAnthropic, isAgentConfigured, agentModel } from "@/lib/agent/client";
import { buildScopedContext } from "@/lib/agent/context";
import { consumeAgentQuery, QuotaExceededError } from "@/lib/agent/usage";
import { logAgentQuery } from "@/lib/agent/actions";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await requireUser(); // 401 → /login handled inside

  if (!isAgentConfigured()) {
    return NextResponse.json(
      { error: "The AI agent is not configured on this deployment yet." },
      { status: 503 },
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = chatRequestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  // Server-side metering: Starter is capped at 25 queries/month, blocked at the 26th.
  try {
    await consumeAgentQuery(user.id, user.plan);
  } catch (err) {
    if (err instanceof QuotaExceededError) {
      return NextResponse.json({ error: err.message }, { status: 402 });
    }
    throw err;
  }

  const { systemPrompt } = await buildScopedContext(user);
  const messages = parsed.data.messages;
  const lastUserText =
    [...messages].reverse().find((m) => m.role === "user")?.content ?? "";

  const anthropic = getAnthropic();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let full = "";
      try {
        const modelStream = anthropic.messages.stream({
          model: agentModel(),
          max_tokens: 4096,
          system: systemPrompt,
          messages,
        });

        for await (const event of modelStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            full += event.delta.text;
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }

        // Append the interaction to the immutable audit log.
        await logAgentQuery(user.id, lastUserText, full);
        controller.close();
      } catch (err) {
        console.error("agent stream error", err);
        controller.error(err);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
