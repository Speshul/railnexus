// Speech-to-text fallback for browsers without built-in speech recognition (Firefox, Safari).
// Uses Groq's hosted Whisper; needs GROQ_API_KEY.
export async function POST(req: Request) {
  const key = process.env.GROQ_API_KEY;
  if (!key) return Response.json({ error: "Voice input needs Chrome or Edge on this setup (no speech-to-text key configured)." }, { status: 501 });

  const form = await req.formData();
  const audio = form.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) return Response.json({ error: "No audio received" }, { status: 400 });
  if (audio.size > 4 * 1024 * 1024) return Response.json({ error: "Recording too long" }, { status: 413 });

  const out = new FormData();
  out.set("file", audio, "speech.webm");
  out.set("model", process.env.GROQ_STT_MODEL || "whisper-large-v3-turbo");
  // Bias towards the vocabulary we expect (Hinglish train booking).
  out.set("prompt", "Train ticket booking in Hinglish. Kal Pune se Delhi sleeper mein do ticket. Tatkal, 3AC, Rajdhani.");
  out.set("response_format", "json");
  const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { authorization: `Bearer ${key}` },
    body: out,
  });
  if (!res.ok) return Response.json({ error: "Couldn't transcribe the audio. Try again." }, { status: 502 });
  const data = await res.json();
  return Response.json({ text: String(data.text ?? "").trim() });
}
