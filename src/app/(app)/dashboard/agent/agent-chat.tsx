"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui";

type Msg = { role: "user" | "assistant"; content: string };

export function AgentChat() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = input.trim();
    if (!text || busy) return;

    setError(null);
    const outgoing: Msg[] = [...messages, { role: "user", content: text }];
    setMessages([...outgoing, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);

    try {
      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: outgoing }),
      });

      if (!res.ok || !res.body) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "The agent could not respond.");
        setMessages(outgoing); // drop the empty assistant placeholder
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages([...outgoing, { role: "assistant", content: acc }]);
        scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
      }
    } catch {
      setError("Connection error — please try again.");
      setMessages(outgoing);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        ref={scrollRef}
        className="min-h-[240px] max-h-[460px] space-y-3 overflow-y-auto rounded-card border border-line bg-black/20 p-4"
      >
        {messages.length === 0 && (
          <p className="text-sm text-faint">
            Ask about your account. The agent only knows what&apos;s in your Xenon
            data — it won&apos;t invent numbers.
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
            <span
              className={
                m.role === "user"
                  ? "inline-block rounded-card bg-ice-dim/20 px-3 py-2 text-sm text-text"
                  : "inline-block rounded-card border border-line px-3 py-2 text-sm text-text whitespace-pre-wrap"
              }
            >
              {m.content || (busy ? "…" : "")}
            </span>
          </div>
        ))}
      </div>

      {error && (
        <p role="alert" className="text-sm text-red">
          {error}
        </p>
      )}

      <form onSubmit={send} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask the agent…"
          className="flex-1 rounded-card border border-line bg-black/30 px-3 py-2.5 text-sm text-text placeholder:text-faint focus:border-ice-dim focus:outline-none focus:ring-1 focus:ring-ice-dim"
          disabled={busy}
        />
        <Button type="submit" disabled={busy || !input.trim()}>
          {busy ? "…" : "Send"}
        </Button>
      </form>
    </div>
  );
}
