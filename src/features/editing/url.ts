/**
 * Turns what the user typed into a bookmarkable URL, or null if it isn't one.
 * "example.com/x" becomes "https://example.com/x"; known schemes are kept.
 */
export function normalizeInputUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed);
  const candidate = hasScheme ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(candidate);
    if (
      /^https?:$/.test(url.protocol) &&
      !url.hostname.includes('.') &&
      url.hostname !== 'localhost'
    ) {
      return null;
    }
    return url.href;
  } catch {
    return null;
  }
}
