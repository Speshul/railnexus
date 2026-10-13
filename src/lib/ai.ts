import "server-only";

// Generic "text in, JSON out" call for features beyond the voice assistant (which keeps its own tuned client in
// voice/llm.ts). Gemini first (falling back through the configured models), hedged with Groq.

const TIMEOUT_MS = 15000;

async function post(url: string, init: RequestInit) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

const parse = (raw: string) => JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, ""));

async function gemini(system: string, user: string, schema: object): Promise<unknown> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("no GEMINI_API_KEY");
  const models = (process.env.GEMINI_MODELS || "gemini-3.5-flash,gemini-3.1-flash-lite").split(",").map((m) => m.trim());
  let res: Response | null = null;
  for (const model of models) {
    res = await post(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: { temperature: 0.2, responseMimeType: "application/json", responseSchema: schema, thinkingConfig: { thinkingBudget: 0 } },
      }),
    });
    if (res.ok || ![404, 429, 503].includes(res.status)) break;
  }
  if (!res || !res.ok) throw new Error(`gemini ${res?.status}`);
  const data = await res.json();
  const out = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("");
  if (!out) throw new Error("gemini: empty response");
  return parse(out);
}

async function groq(system: string, user: string, keys: string[]): Promise<unknown> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("no GROQ_API_KEY");
  const res = await post("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || "openai/gpt-oss-20b",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: `${system}\nRespond with a single JSON object with exactly these keys: ${keys.join(", ")}. Use null when unknown.` },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`groq ${res.status}`);
  const data = await res.json();
  return parse(data?.choices?.[0]?.message?.content ?? "");
}

const HEDGE_MS = 3000;

/**
 * Ask the configured model(s) for JSON matching `schema` (Gemini OpenAPI-subset schema of an OBJECT). Gemini goes
 * first; if it hasn't answered within HEDGE_MS (the free tier sometimes stalls) or fails, Groq is asked too and the
 * first valid answer wins. Null if no provider is configured or all fail.
 */
export async function llmJson(system: string, user: string, schema: { properties: Record<string, unknown> }, tag: string): Promise<unknown | null> {
  const keys = Object.keys(schema.properties);
  const attempt = (name: string, fn: () => Promise<unknown>) =>
    fn().catch((e: Error) => {
      if (!e.message.startsWith("no ")) console.warn(`[${tag}] ${name} failed: ${e.message}`);
      throw e;
    });
  const hasGemini = !!process.env.GEMINI_API_KEY;
  const hasGroq = !!process.env.GROQ_API_KEY;
  if (!hasGemini && !hasGroq) return null;
  if (!hasGemini) return attempt("groq", () => groq(system, user, keys)).catch(() => null);
  const first = attempt("gemini", () => gemini(system, user, schema));
  if (!hasGroq) return first.catch(() => null);
  const backup = new Promise<unknown>((resolve, reject) => {
    const start = () => attempt("groq", () => groq(system, user, keys)).then(resolve, reject);
    const t = setTimeout(start, HEDGE_MS);
    first.catch(() => {
      clearTimeout(t);
      start();
    });
  });
  return Promise.any([first, backup]).catch(() => null);
}
