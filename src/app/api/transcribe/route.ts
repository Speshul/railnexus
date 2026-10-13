// "Enhanced" speech-to-text via Groq's hosted Whisper. More tolerant of accents and atypical speech
// than the browser's built-in recognizer, and it can be primed with words we expect to hear.
// Needs GROQ_API_KEY.
import { clientKey, rateLimited } from "@/lib/ratelimit";

// AI and payment providers can be slow; give the function time to finish on Vercel.
export const maxDuration = 30;

export function GET() {
  return Response.json({ available: !!process.env.GROQ_API_KEY });
}

export async function POST(req: Request) {
  const key = process.env.GROQ_API_KEY;
  if (!key) return Response.json({ error: "Enhanced recognition needs a GROQ_API_KEY in .env.local." }, { status: 501 });
  if (rateLimited(`stt:${clientKey(req)}`, 15)) return Response.json({ error: "Too many recordings. Wait a few seconds." }, { status: 429 });

  const form = await req.formData();
  const audio = form.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) return Response.json({ error: "No audio received" }, { status: 400 });
  if (audio.size > 6 * 1024 * 1024) return Response.json({ error: "Recording too long" }, { status: 413 });
  const lang = form.get("lang") === "hi" ? "hi" : "en";
  // Words visible on the page (stations, passenger names). Whisper's prompt biases spelling towards them.
  const hints = String(form.get("hints") ?? "").slice(0, 600);

  const out = new FormData();
  // Chrome/Firefox record webm/ogg, Safari mp4; name the file to match so the format is detected correctly.
  const ext = /mp4|m4a|aac/.test(audio.type) ? "mp4" : /ogg/.test(audio.type) ? "ogg" : /wav/.test(audio.type) ? "wav" : "webm";
  out.set("file", audio, `speech.${ext}`);
  out.set("model", process.env.GROQ_STT_MODEL || "whisper-large-v3");
  out.set("language", lang);
  out.set("temperature", "0");
  out.set(
    "prompt",
    `Indian train ticket booking, Hinglish. Kal Pune se Delhi sleeper mein do ticket book karo. Tatkal, 3AC, 2AC, chair car, Rajdhani, Shatabdi. ${hints}`
  );
  out.set("response_format", "json");
  const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { authorization: `Bearer ${key}` },
    body: out,
  });
  if (!res.ok) {
    console.warn(`[transcribe] groq ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return Response.json({ error: res.status === 429 ? "Speech service is busy, try again in a moment." : "Couldn't transcribe the audio. Try again." }, { status: 502 });
  }
  const data = await res.json();
  return Response.json({ text: String(data.text ?? "").trim() });
}
