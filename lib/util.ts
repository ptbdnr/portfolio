// Small shared helpers used across blog, search, stats, and chat.

// Make a user-entered URL safe to use as a link target. Stored values are
// untrusted (admin-authored, but defense in depth), so allow only http(s) and
// reject everything else — notably javascript:/data: URIs. Embedded control
// chars that smuggle a scheme past the check fall through to the https:// branch
// (which neutralises them).
export function safeExternalUrl(
  raw: string | null | undefined
): string | null {
  if (!raw) return null;
  const cleaned = raw.trim();
  if (!cleaned) return null;
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(cleaned);
  if (!hasScheme) return `https://${cleaned}`;
  try {
    const { protocol } = new URL(cleaned);
    return protocol === "http:" || protocol === "https:" ? cleaned : null;
  } catch {
    return null;
  }
}

// Format an ISO/SQLite datetime as a readable date. Falls back to the raw value.
export function fmtDate(s: string | null | undefined): string {
  if (!s) return "—";
  const d = new Date(s.includes("T") || s.length > 10 ? s : s + "T00:00:00");
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function wordCount(text: string): number {
  const m = text.trim().match(/\S+/g);
  return m ? m.length : 0;
}

// Average adult reading speed ~200 wpm; floor at 1 minute.
export function readingMinutes(text: string): number {
  return Math.max(1, Math.round(wordCount(text) / 200));
}

// Turn a title into a URL-safe slug.
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "") // strip combining accents
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
