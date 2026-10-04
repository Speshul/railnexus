/** Only allow redirects back into this site ("/path"), never protocol-relative "//host" or absolute URLs. */
export function safeNext(v: unknown, fallback = "/"): string {
  const s = typeof v === "string" ? v : "";
  return s.startsWith("/") && !s.startsWith("//") && !s.startsWith("/\\") ? s : fallback;
}
