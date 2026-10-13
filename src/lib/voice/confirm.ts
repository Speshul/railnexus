// Matching the spoken answer on the payment confirmation card. Done in the browser with fixed patterns, never by the
// language model, so nothing can be "interpreted" into a payment. Anything that sounds like no wins over yes.

const NO = /\b(cancel|no|nope|nahi|nahin|nai|mat|dont|don't|do not|stop|ruko|wait|rehne do|abhi nahi)\b|नहीं|नही|मत|रुको|कैंसल|रद्द/i;
const YES = /\b(confirm|confirmed|conform|kanfarm|confirm payment|payment confirm)\b|कन्फर्म|कंफर्म|पुष्टि/i;

/** "yes" only for a clear confirm (with no "no" words), "no" for any refusal, otherwise null (ask again). */
export function confirmVerdict(heard: string): "yes" | "no" | null {
  const t = heard.trim();
  if (NO.test(t)) return "no";
  if (YES.test(t)) return "yes";
  return null;
}
