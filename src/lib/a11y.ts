// Client-safe accessibility preferences. Stored per browser and applied as data-* attributes on <html>,
// which globals.css turns into larger text, high contrast, a readable font or reduced motion.

export const A11Y_PREFS = {
  text: { label: "Text size", options: { normal: "Normal", lg: "Large", xl: "Extra large" }, default: "normal" },
  contrast: { label: "Contrast", options: { normal: "Standard", high: "High" }, default: "normal" },
  font: { label: "Font", options: { normal: "Standard", readable: "Easy to read" }, default: "normal" },
  motion: { label: "Animations", options: { normal: "On", reduce: "Reduced" }, default: "normal" },
} as const;

export type A11yKey = keyof typeof A11Y_PREFS;
export type A11yPrefs = { [K in A11yKey]: keyof (typeof A11Y_PREFS)[K]["options"] };

export const A11Y_STORAGE_KEY = "a11y-prefs";

export const defaultPrefs = (): A11yPrefs =>
  Object.fromEntries(Object.entries(A11Y_PREFS).map(([k, v]) => [k, v.default])) as A11yPrefs;

export function readPrefs(): A11yPrefs {
  try {
    return { ...defaultPrefs(), ...JSON.parse(localStorage.getItem(A11Y_STORAGE_KEY) ?? "{}") };
  } catch {
    return defaultPrefs();
  }
}

export function applyPrefs(p: A11yPrefs) {
  const el = document.documentElement;
  for (const k of Object.keys(A11Y_PREFS) as A11yKey[]) el.setAttribute(`data-a11y-${k}`, String(p[k]));
}

export function savePrefs(p: A11yPrefs) {
  applyPrefs(p);
  try {
    localStorage.setItem(A11Y_STORAGE_KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable: settings still apply for this page view */
  }
}

/** Runs in <head> before first paint so saved settings never flash in after load. */
export const A11Y_INLINE_SCRIPT = `(function(){try{var p=JSON.parse(localStorage.getItem(${JSON.stringify(A11Y_STORAGE_KEY)})||"{}");var e=document.documentElement;for(var k in p){e.setAttribute("data-a11y-"+k,p[k])}}catch(x){}})()`;
