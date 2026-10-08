import { z } from "zod";
import { llmIntent } from "@/lib/voice/llm";
import { ruleIntent } from "@/lib/voice/rules";
import { resolveIntent } from "@/lib/voice/resolve";
import { todayIST } from "@/lib/dates";
import type { VoiceContext, VoiceResponse } from "@/lib/voice/types";

// Small in-memory limiter so one tab can't burn through the free AI quota.
const hits = new Map<string, number[]>();
function limited(key: string, perMinute = 20) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < 60000);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > perMinute;
}

const bodySchema = z.object({
  text: z.string().trim().min(1).max(300),
  context: z.record(z.string(), z.unknown()).default({}),
});

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (limited(ip)) return Response.json({ error: "Too many voice commands. Wait a few seconds." }, { status: 429 });

  const raw = await req.text();
  if (raw.length > 12000) return Response.json({ error: "Request too large" }, { status: 413 });
  let json: unknown;
  try {
    json = JSON.parse(raw || "{}");
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });

  const { text } = parsed.data;
  const ctx = parsed.data.context as unknown as VoiceContext;
  const today = todayIST();

  const llm = await llmIntent(text, ctx, today);
  const intent = llm?.intent ?? ruleIntent(text, ctx, today);
  const out = resolveIntent(intent, ctx, text, today);
  const res: VoiceResponse = { ...out, source: llm?.source ?? "rules", heard: text };
  return Response.json(res);
}
