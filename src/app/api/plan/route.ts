import { z } from "zod";
import { clientKey, rateLimited } from "@/lib/ratelimit";
import { planTrip } from "@/lib/planner";
import { todayIST } from "@/lib/dates";
import { hasLlm } from "@/lib/voice/llm";

// AI and payment providers can be slow; give the function time to finish on Vercel.
export const maxDuration = 30;

const bodySchema = z.object({ text: z.string().trim().min(3).max(500) });

// POST { text } -> trip plans built from real trains. The AI only reads the request; trains, fares and
// availability all come from the timetable and booking engine.
export async function POST(req: Request) {
  if (rateLimited(`plan:${clientKey(req)}`, 8)) return Response.json({ ok: false, error: "plan.err.rate" }, { status: 429 });
  if (!hasLlm()) return Response.json({ ok: false, error: "plan.err.noAi" }, { status: 503 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: "plan.err.short" }, { status: 400 });
  return Response.json(await planTrip(parsed.data.text, todayIST()));
}
