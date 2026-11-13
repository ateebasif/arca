import { compactPath, normalizeUrl } from '@/src/features/tidy/normalize';

describe('normalizeUrl', () => {
  it.each([
    ['https://www.Example.com/', 'http://example.com'],
    ['https://example.com/a/', 'https://example.com/a'],
    ['https://example.com/a?utm_source=x&b=2&a=1#top', 'https://example.com/a?a=1&b=2'],
    ['https://example.com:443/a?fbclid=1', 'http://example.com/a'],
    ['https://anirena.com/?s=torrent&gclid=9', 'https://www.anirena.com?s=torrent'],
  ])('%s ≡ %s', (a, b) => expect(normalizeUrl(a)).toBe(normalizeUrl(b)));

  it('keeps meaningful differences', () => {
    expect(normalizeUrl('https://a.dev/x')).not.toBe(normalizeUrl('https://a.dev/y'));
    expect(normalizeUrl('https://a.dev/?q=1')).not.toBe(
      normalizeUrl('https://a.dev/?q=2'),
    );
    expect(normalizeUrl('https://a.dev:8080/')).not.toBe(normalizeUrl('https://a.dev/'));
    expect(normalizeUrl('chrome://settings')).toBe('chrome://settings');
  });
});

describe('compactPath', () => {
  it('keeps short paths and elides the middle of long ones', () => {
    expect(compactPath('Bookmarks bar / Work')).toBe('Bookmarks bar / Work');
    expect(
      compactPath(
        'Bookmarks bar / Imported From Opera GX / Other Bookmarks / Trash / Bookmarks Bar (Chrome) (2)',
      ),
    ).toBe('Bookmarks bar / … / Trash / Bookmarks Bar (Chrome) (2)');
  });
});
