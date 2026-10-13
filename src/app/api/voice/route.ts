import { z } from "zod";
import { clientKey, rateLimited } from "@/lib/ratelimit";
import { llmIntent } from "@/lib/voice/llm";
import { fastIntent, ruleIntent } from "@/lib/voice/rules";
import { resolveIntent } from "@/lib/voice/resolve";
import { todayIST } from "@/lib/dates";
import type { VoiceContext, VoiceIntent, VoiceResponse } from "@/lib/voice/types";

// AI and payment providers can be slow; give the function time to finish on Vercel.
export const maxDuration = 30;

const bodySchema = z.object({
  text: z.string().trim().min(1).max(300),
  alternatives: z.array(z.string().max(300)).max(5).default([]),
  context: z.record(z.string(), z.unknown()).default({}),
});

export async function POST(req: Request) {
  if (rateLimited(`voice:${clientKey(req)}`, 20)) return Response.json({ error: "Too many voice commands. Wait a few seconds." }, { status: 429 });

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

  const alts = parsed.data.alternatives;
  const fast = fastIntent(text, ctx, today);
  const llm = fast ? null : await llmIntent(text, ctx, today, alts);
  let intent: VoiceIntent;
  let source: VoiceResponse["source"] = "rules";
  if (fast) {
    intent = fast;
  } else if (llm && llm.intent.intent !== "unknown") {
    intent = llm.intent;
    source = llm.source;
  } else {
    // No model answered, or it couldn't classify: try the rule parser on every recognizer guess.
    intent = [text, ...alts].map((t) => ruleIntent(t, ctx, today)).find((i) => i.intent !== "unknown") ?? ruleIntent(text, ctx, today);
    // If the rules don't understand either, keep the model's own explanation (e.g. why it can't do something).
    if (intent.intent === "unknown" && llm?.intent.reply) {
      intent = llm.intent;
      source = llm.source;
    }
  }
  const out = resolveIntent(intent, ctx, text, today);
  // The spoken version only matches when the model's own reply is used (not a resolver message like "station not found").
  const speech = intent.speech && out.reply === intent.reply?.trim() ? intent.speech : undefined;
  const res: VoiceResponse & { intent?: unknown } = { ...out, speech, source, heard: text };
  if (process.env.NODE_ENV === "development") res.intent = intent; // visible in dev only, for debugging
  return Response.json(res);
}
