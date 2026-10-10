"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2, Mic, MicOff, Pencil, Send, Volume2, VolumeX, X } from "lucide-react";
import { useVoiceBridge } from "./VoiceBridge";
import { useT } from "@/i18n/client";
import type { VoiceAction, VoiceContext, VoiceResponse } from "@/lib/voice/types";

type Phase = "idle" | "listening" | "thinking" | "speaking";
type Lang = "en-IN" | "hi-IN";
/** enhanced = record and transcribe with Whisper (better with accents/atypical speech); standard = browser recognizer */
type Mode = "enhanced" | "standard";

// Minimal typing for the Web Speech API (not in TS's DOM lib everywhere).
type SpeechRec = {
  lang: string; interimResults: boolean; continuous: boolean; maxAlternatives: number;
  start(): void; stop(): void; abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};
const getRecognition = (): (new () => SpeechRec) | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

function readPref(key: string) {
  try {
    return typeof window === "undefined" ? null : localStorage.getItem(key);
  } catch {
    return null;
  }
}
const savePref = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* storage unavailable */
  }
};

/**
 * Record from the mic until the speaker pauses. Learns the room's noise floor from the first few
 * readings, then stops after ~1.5 s of quiet (or 15 s total, or 7 s with no speech at all).
 */
function recordUntilPause(
  stream: MediaStream,
  onLevel: (level: number) => void,
  exposeStop: (stop: () => void) => void
): Promise<{ blob: Blob; spoke: boolean }> {
  return new Promise((resolve) => {
    const rec = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    const ac = new AudioContext();
    const analyser = ac.createAnalyser();
    analyser.fftSize = 1024;
    ac.createMediaStreamSource(stream).connect(analyser);
    const buf = new Float32Array(analyser.fftSize);
    const startedAt = Date.now();
    let floor = 0;
    let samples = 0;
    let spoke = false;
    let lastLoud = startedAt;
    const stop = () => {
      if (rec.state === "recording") rec.stop();
    };
    const timer = setInterval(() => {
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (const x of buf) sum += x * x;
      const rms = Math.sqrt(sum / buf.length);
      onLevel(Math.min(1, rms * 10));
      const now = Date.now();
      if (samples < 3) {
        floor = (floor * samples + rms) / ++samples;
        return;
      }
      if (rms > Math.max(0.012, floor * 2.5)) {
        spoke = true;
        lastLoud = now;
      }
      if ((spoke && now - lastLoud > 1500) || now - startedAt > 15000 || (!spoke && now - startedAt > 7000)) stop();
    }, 100);
    rec.onstop = () => {
      clearInterval(timer);
      stream.getTracks().forEach((t) => t.stop());
      ac.close();
      resolve({ blob: new Blob(chunks, { type: rec.mimeType }), spoke });
    };
    exposeStop(stop);
    rec.start(250);
  });
}

const DEVANAGARI = /[ऀ-ॿ]/;

/**
 * Best installed voice for Hindi ("hi") or Indian English ("en"). Neural voices sound far less robotic:
 * Edge ships "Microsoft Swara/Madhur Online (Natural)", Chrome ships "Google हिन्दी".
 */
function pickVoice(voices: SpeechSynthesisVoice[], kind: "hi" | "en", preferred?: string | null) {
  const lang = (v: SpeechSynthesisVoice) => v.lang.toLowerCase().replace("_", "-");
  const pool = voices.filter((v) => (kind === "hi" ? lang(v).startsWith("hi") : lang(v) === "en-in"));
  const fallback = kind === "en" ? voices.filter((v) => lang(v).startsWith("en")) : [];
  const score = (v: SpeechSynthesisVoice) =>
    (v.name === preferred ? 100 : 0) + (/natural/i.test(v.name) ? 30 : 0) + (/online/i.test(v.name) ? 20 : 0) +
    (/google/i.test(v.name) ? 15 : 0) + (v.localService ? 0 : 5);
  return [...(pool.length ? pool : fallback)].sort((a, b) => score(b) - score(a))[0] ?? null;
}

/**
 * Run follow-up actions (e.g. "sort") once the URL has changed to `href` and the new page has mounted its
 * handlers. Watching the full URL (not just the path) also covers search -> search with new query params.
 */
function runAfterNavigation(href: string, then: () => void) {
  const target = new URL(href, window.location.origin);
  const startedAt = Date.now();
  const timer = setInterval(() => {
    const here = window.location.pathname + window.location.search;
    if (here === target.pathname + target.search || Date.now() - startedAt > 6000) {
      clearInterval(timer);
      setTimeout(then, 300);
    }
  }, 100);
}

const EXAMPLES = ["Kal Pune se Delhi sleeper", "Sabse sasti wali book karo 3A mein", "Agle din ke trains", "Meri bookings dikhao"];

export function VoiceAssistant({ loggedIn }: { loggedIn: boolean }) {
  const router = useRouter();
  const tr = useT();
  const pathname = usePathname();
  const bridge = useVoiceBridge();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  // Per-browser preferences; the panel that shows them only renders after a click, so no hydration mismatch.
  const [lang, setLang] = useState<Lang>(() => {
    const saved = readPref("voice-lang");
    return saved === "hi-IN" || (!saved && tr.locale === "hi") ? "hi-IN" : "en-IN";
  });
  const [muted, setMuted] = useState(() => readPref("voice-muted") === "1");
  const [mode, setMode] = useState<Mode>(() => (readPref("voice-mode") === "standard" ? "standard" : "enhanced"));
  const [enhancedOk, setEnhancedOk] = useState<boolean | null>(null);
  const [level, setLevel] = useState(0);
  const [interim, setInterim] = useState("");
  const [heard, setHeard] = useState("");
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");
  const [typed, setTyped] = useState("");
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [hindiVoiceName, setHindiVoiceName] = useState<string | null>(() => readPref("voice-hindi"));
  const hindiVoices = voices.filter((v) => v.lang.toLowerCase().startsWith("hi"));

  // Browsers load voices asynchronously and announce it with "voiceschanged".
  useEffect(() => {
    const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
    if (!synth) return;
    const load = () => setVoices(synth.getVoices());
    synth.addEventListener("voiceschanged", load);
    const t = setTimeout(load, 0);
    return () => {
      clearTimeout(t);
      synth.removeEventListener("voiceschanged", load);
    };
  }, []);
  const recRef = useRef<SpeechRec | null>(null);
  const stopRecordingRef = useRef<(() => void) | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const micRef = useRef<HTMLButtonElement>(null);

  // Escape closes the panel (and stops listening/speaking); focus goes back to the mic button.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      recRef.current?.abort();
      stopRecordingRef.current?.();
      window.speechSynthesis?.cancel();
      setOpen(false);
      setPhase("idle");
      micRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Is enhanced (Whisper) recognition configured on the server?
  useEffect(() => {
    if (!open || enhancedOk !== null) return;
    fetch("/api/transcribe")
      .then((r) => r.json())
      .then((d) => setEnhancedOk(!!d.available))
      .catch(() => setEnhancedOk(false));
  }, [open, enhancedOk]);
  const hasBrowserRec = typeof window !== "undefined" && !!getRecognition();
  const useEnhanced = (mode === "enhanced" && enhancedOk !== false) || !hasBrowserRec;

  useEffect(
    () => () => {
      recRef.current?.abort();
      stopRecordingRef.current?.();
      window.speechSynthesis?.cancel();
    },
    []
  );

  /** Speak `text` (shown on screen); `spoken` is the Devanagari version for a Hindi voice when the reply is Hindi. */
  function speak(text: string, spoken?: string) {
    if (muted || !text || typeof window === "undefined" || !window.speechSynthesis) return setPhase("idle");
    window.speechSynthesis.cancel();
    const hindiVoice = pickVoice(voices, "hi", hindiVoiceName);
    // Devanagari needs a Hindi voice; without one, read the Roman-script reply with an Indian-English voice.
    const useHindi = !!spoken && DEVANAGARI.test(spoken) && !!hindiVoice;
    const v = useHindi ? hindiVoice : pickVoice(voices, "en");
    const u = new SpeechSynthesisUtterance(useHindi ? spoken! : text);
    if (v) u.voice = v;
    u.lang = v?.lang ?? (useHindi ? "hi-IN" : "en-IN");
    u.rate = useHindi ? 1 : 1.05;
    u.onend = () => setPhase("idle");
    u.onerror = () => setPhase("idle");
    setPhase("speaking");
    window.speechSynthesis.speak(u);
  }

  function run(actions: VoiceAction[]): string | void {
    let override: string | void = undefined;
    for (let i = 0; i < actions.length; i++) {
      const a = actions[i];
      if (a.type === "navigate") {
        if (a.href === "back") {
          router.back();
          return override;
        }
        // Only ever navigate within this site.
        if (!a.href.startsWith("/") || a.href.startsWith("//")) return "Sorry, I can't open that.";
        router.push(a.href);
        const rest = actions.slice(i + 1);
        if (rest.length) runAfterNavigation(a.href, () => rest.forEach((x) => bridge.dispatch(x)));
        return override;
      }
      const [handled, msg] = bridge.dispatch(a);
      if (msg) override = msg;
      if (!handled && !override) override = "That isn't available on this page.";
    }
    return override;
  }

  async function send(text: string, alternatives: string[] = []) {
    const t = text.trim();
    if (!t) return;
    setHeard(t);
    setInterim("");
    setReply("");
    setError("");
    setPhase("thinking");
    const context: VoiceContext = { path: pathname, loggedIn, ...bridge.context() };
    try {
      const res = await fetch("/api/voice", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: t, alternatives, context }),
      });
      const data = (await res.json()) as VoiceResponse & { error?: string };
      if (!res.ok) throw new Error(data.error || tr("voice.wrong"));
      const override = run(data.actions);
      const say = override || data.reply;
      setReply(say);
      speak(say, override ? undefined : data.speech);
    } catch (e) {
      setError((e as Error).message || tr("voice.unreachable"));
      setPhase("idle");
    }
  }

  /** Names likely to be spoken on this page; Whisper uses them to spell what it hears. */
  function hintWords() {
    const c = bridge.context();
    const words = [c.search?.fromName, c.search?.toName, ...(c.trains ?? []).slice(0, 5).map((t) => t.name), ...(c.booking?.saved ?? [])];
    return [...new Set(words.filter(Boolean))].join(", ");
  }

  /** Record until the speaker pauses, then transcribe with Whisper. */
  async function startEnhanced() {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch {
      setError(tr("voice.micDenied"));
      setPhase("idle");
      return;
    }
    setPhase("listening");
    const { blob, spoke } = await recordUntilPause(stream, setLevel, (stop) => (stopRecordingRef.current = stop));
    stopRecordingRef.current = null;
    setLevel(0);
    if (!spoke) {
      setError("I didn't hear anything. Tap the mic and try again, a little closer to the microphone.");
      setPhase("idle");
      return;
    }
    setPhase("thinking");
    const fd = new FormData();
    fd.set("audio", blob);
    fd.set("lang", lang === "hi-IN" ? "hi" : "en");
    fd.set("hints", hintWords());
    const r = await fetch("/api/transcribe", { method: "POST", body: fd }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : { error: tr("voice.network") };
    if (!r?.ok || !d.text) {
      setError(d.error ?? tr("voice.noWords"));
      setPhase("idle");
      return;
    }
    send(d.text);
  }

  /** Browser recognizer, asking for its top 5 guesses so the assistant can pick the one that makes sense. */
  function startStandard(Rec: new () => SpeechRec) {
    const rec = new Rec();
    rec.lang = lang;
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 5;
    let finalText = "";
    let finalAlts: string[] = [];
    rec.onresult = (e) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        text += r[0].transcript;
        if (r.isFinal) {
          finalText = text;
          finalAlts = Array.from({ length: r.length }, (_, j) => r[j].transcript).slice(1);
        }
      }
      setInterim(text);
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") setError(tr("voice.micDenied"));
      else if (e.error === "no-speech") setError("I didn't hear anything. Tap the mic and try again.");
      else if (e.error !== "aborted") setError(tr("voice.recError", { e: e.error }));
    };
    rec.onend = () => {
      recRef.current = null;
      if (finalText) send(finalText, finalAlts);
      else setPhase((p) => (p === "listening" ? "idle" : p));
    };
    recRef.current = rec;
    setPhase("listening");
    rec.start();
  }

  function startListening() {
    window.speechSynthesis?.cancel();
    setError("");
    setInterim("");
    const Rec = getRecognition();
    if (useEnhanced || !Rec) startEnhanced();
    else startStandard(Rec);
  }

  function stopListening() {
    recRef.current?.stop();
    stopRecordingRef.current?.();
  }

  const onMic = () => {
    if (!open) setOpen(true);
    if (phase === "listening") stopListening();
    else if (phase !== "thinking") startListening();
  };

  const editHeard = () => {
    setTyped(heard);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const busy = phase === "thinking";
  return (
    <>
      {open && (
        <div role="dialog" aria-label={tr("voice.title")} className="print:hidden fixed bottom-24 right-4 z-50 w-[min(24rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2.5">
            <span className="font-semibold">{tr("voice.title")}</span>
            <div className="ml-auto flex items-center gap-1">
              <div className="flex rounded-md border border-slate-200 p-0.5 text-xs" role="group" aria-label={tr("voice.speakLang")}>
                {(["en-IN", "hi-IN"] as Lang[]).map((l) => (
                  <button key={l} onClick={() => { setLang(l); savePref("voice-lang", l); }} aria-pressed={lang === l}
                    className={`rounded px-2 py-0.5 ${lang === l ? "bg-brand text-white" : "text-slate-600"}`}>
                    {l === "en-IN" ? "English" : "हिंदी"}
                  </button>
                ))}
              </div>
              <button onClick={() => { setMuted(!muted); savePref("voice-muted", muted ? "0" : "1"); if (!muted) window.speechSynthesis?.cancel(); }}
                aria-label={muted ? tr("voice.unmute") : tr("voice.mute")} className="rounded p-1.5 text-slate-500 hover:bg-slate-100">
                {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
              </button>
              <button onClick={() => { stopListening(); window.speechSynthesis?.cancel(); setOpen(false); setPhase("idle"); }}
                aria-label={tr("voice.close")} className="rounded p-1.5 text-slate-500 hover:bg-slate-100">
                <X className="size-4" />
              </button>
            </div>
          </div>

          {hindiVoices.length > 1 && (
            <label className="flex items-center gap-2 border-b border-slate-100 px-4 py-1.5 text-xs text-slate-600">
              {tr("voice.hindiVoice")}
              <select className="input w-auto flex-1 py-0.5 text-xs" value={pickVoice(voices, "hi", hindiVoiceName)?.name ?? ""}
                onChange={(e) => {
                  setHindiVoiceName(e.target.value);
                  savePref("voice-hindi", e.target.value);
                  const v = hindiVoices.find((x) => x.name === e.target.value);
                  if (v && !muted) {
                    window.speechSynthesis.cancel();
                    const u = new SpeechSynthesisUtterance("नमस्ते, मैं आपकी टिकट बुक करने में मदद करूँगा।");
                    u.voice = v;
                    u.lang = v.lang;
                    window.speechSynthesis.speak(u);
                  }
                }}>
                {hindiVoices.map((v) => <option key={v.name} value={v.name}>{v.name}</option>)}
              </select>
            </label>
          )}
          {enhancedOk && hasBrowserRec && (
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-1.5 text-xs text-slate-600">
              {tr("voice.recognition")}
              <div className="flex rounded-md border border-slate-200 p-0.5" role="group" aria-label={tr("voice.recMode")}>
                {(["enhanced", "standard"] as Mode[]).map((m) => (
                  <button key={m} onClick={() => { setMode(m); savePref("voice-mode", m); }} aria-pressed={mode === m}
                    title={m === "enhanced" ? tr("voice.enhancedTitle") : tr("voice.standardTitle")}
                    className={`rounded px-2 py-0.5 ${mode === m ? "bg-brand text-white" : ""}`}>
                    {m === "enhanced" ? tr("voice.enhanced") : tr("voice.standard")}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2 px-4 py-3 text-sm" aria-live="polite">
            {phase === "listening" && (
              <div>
                <p className="text-slate-500">
                  {interim ? <span className="text-slate-900">{interim}</span> : useEnhanced ? tr("voice.listeningPause") : tr("voice.listening")}
                </p>
                {useEnhanced && (
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden>
                    <div className="h-full rounded-full bg-ok transition-[width] duration-100" style={{ width: `${Math.round(level * 100)}%` }} />
                  </div>
                )}
              </div>
            )}
            {heard && phase !== "listening" && (
              <div className="flex items-start gap-2 rounded-lg bg-slate-100 px-3 py-2 text-slate-800">
                <span className="flex-1">“{heard}”</span>
                <button onClick={editHeard} className="flex shrink-0 items-center gap-1 text-xs font-medium text-brand hover:underline" aria-label={tr("voice.editLabel")}>
                  <Pencil className="size-3" aria-hidden /> {tr("voice.edit")}
                </button>
              </div>
            )}
            {busy && <p className="flex items-center gap-2 text-slate-500"><Loader2 className="size-4 animate-spin" aria-hidden /> {tr("voice.working")}</p>}
            {reply && !busy && <p className="rounded-lg bg-brand-light px-3 py-2 text-slate-900">{reply}</p>}
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-bad">{error}</p>}
            {!heard && phase === "idle" && (
              <div>
                <p className="mb-1.5 text-slate-600">{tr("voice.tryIt")}</p>
                <div className="flex flex-wrap gap-1.5">
                  {EXAMPLES.map((e) => (
                    <button key={e} onClick={() => send(e)} className="rounded-full border border-slate-200 px-2.5 py-1 text-xs hover:border-brand">{e}</button>
                  ))}
                </div>
              </div>
            )}
            <p className="text-xs text-slate-500">{tr("voice.scope")}</p>
          </div>

          <form className="flex gap-2 border-t border-slate-100 p-2" onSubmit={(e) => { e.preventDefault(); send(typed); setTyped(""); }}>
            <input ref={inputRef} className="input py-1.5" placeholder={tr("voice.placeholder")} value={typed} onChange={(e) => setTyped(e.target.value)} disabled={busy} />
            <button className="btn-brand px-3 py-1.5" disabled={busy || !typed.trim()} aria-label={tr("voice.send")}><Send className="size-4" aria-hidden /></button>
          </form>
        </div>
      )}

      <button
        ref={micRef}
        onClick={onMic}
        aria-expanded={open}
        aria-label={phase === "listening" ? tr("voice.stop") : tr("voice.speak")}
        className={`print:hidden fixed bottom-6 right-4 z-50 flex size-14 items-center justify-center rounded-full text-white shadow-lg transition ${
          phase === "listening" ? "bg-bad ring-4 ring-red-200" : "bg-accent hover:bg-accent-dark"
        }`}
      >
        {phase === "listening" && <span className="absolute inset-0 animate-ping rounded-full bg-bad/40" />}
        {busy ? <Loader2 className="size-6 animate-spin" /> : phase === "listening" ? <MicOff className="size-6" /> : <Mic className="size-6" />}
      </button>
    </>
  );
}
