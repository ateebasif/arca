/** Hostname without a leading `www.`, or '' when the URL can't be parsed. */
export function displayHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}
