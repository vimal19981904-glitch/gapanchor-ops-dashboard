// ─── TEAMS URL CLEANING & SANITIZATION (CLIENT & SERVER SAFE) ──────────────

export function cleanTeamsMeetingUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  let cleaned = url.trim();

  // 1. Unescape HTML entities & URL-encoded entities (e.g. &amp; -> &, %26amp%3B -> &)
  cleaned = cleaned
    .replace(/%26amp%3B/gi, '&')
    .replace(/%26amp;/gi, '&')
    .replace(/%26amp/gi, '&')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');

  // 2. Isolate the Teams meeting URL (exclude trailing backslashes \, quotes, brackets, or HTML tags)
  const match = cleaned.match(/https:\/\/(?:teams\.microsoft\.com|teams\.live\.com)\/[^\s"<>'`\\]+/i);
  if (match) {
    cleaned = match[0];
  }

  // 3. Strip trailing backslashes \, closing brackets, punctuation, or encoded characters at the end
  cleaned = cleaned
    .replace(/[\)\],.>\s;'"\\/]+$/, '')
    .replace(/(?:%29|%5D|%3E|%5C)+$/gi, '');

  // 4. Remove any trailing backslash \ inside parameter values (e.g. &p=passcode\ -> &p=passcode)
  cleaned = cleaned.replace(/\\+$/, '');

  // 5. Final pass: Ensure no residual &amp; remains in query string parameters
  cleaned = cleaned.replace(/&amp;/gi, '&');

  return cleaned || null;
}
