import { systemPrompt } from "@/content/assistant";

/**
 * The site assistant. Same Groq setup as the LLM projects (gpt-oss-120b over
 * the OpenAI-compatible API); streams the answer back as plain text.
 */
export const runtime = "nodejs";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
// Separate per-model quota on Groq's free tier, so it absorbs bursts.
const FALLBACK = process.env.GROQ_FALLBACK_MODEL || "openai/gpt-oss-20b";
const MAX_TURNS = 12;
const MAX_CHARS = 1200;

type Msg = { role: "user" | "assistant"; content: string };

// Best effort: per-instance memory, so it caps a single abuser, not a botnet.
const hits = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > 10;
}

function clean(body: unknown): Msg[] | null {
  const raw = (body as { messages?: unknown })?.messages;
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const msgs = raw.slice(-MAX_TURNS).filter(
    (m): m is Msg => (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string" && m.content.trim() !== "",
  );
  if (msgs.at(-1)?.role !== "user") return null;
  return msgs.map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));
}

const text = (s: string, status: number) => new Response(s, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });

export async function POST(req: Request) {
  const key = process.env.GROQ_API_KEY;
  if (!key) return text("The assistant isn't configured yet.", 503);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  if (limited(ip)) return text("You're asking faster than I can think. Give me a minute.", 429);

  const messages = clean(await req.json().catch(() => null));
  if (!messages) return text("Bad request.", 400);

  const ask = (model: string) =>
    fetch(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: systemPrompt() }, ...messages],
        temperature: 0.4,
        max_completion_tokens: 700,
        reasoning_effort: "low",
        stream: true,
      }),
      signal: req.signal,
    }).catch(() => null);

  let upstream = await ask(MODEL);
  if (upstream && (upstream.status === 429 || upstream.status >= 500)) upstream = await ask(FALLBACK);

  if (!upstream?.ok || !upstream.body) {
    console.error("groq", upstream?.status, await upstream?.text().catch(() => ""));
    const busy = upstream?.status === 429;
    return text(busy ? "Lots of people are asking right now. Try again in a few seconds." : "I couldn't reach my brain just now. Try again in a moment.", busy ? 429 : 502);
  }

  // Groq streams SSE; forward only the answer text (not the reasoning).
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buf = "";
  const stream = upstream.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, ctrl) {
        buf += decoder.decode(chunk, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ") || line === "data: [DONE]") continue;
          try {
            const delta = JSON.parse(line.slice(6)).choices?.[0]?.delta?.content;
            if (delta) ctrl.enqueue(encoder.encode(delta));
          } catch {
            /* partial or keep-alive line */
          }
        }
      },
    }),
  );
  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}
