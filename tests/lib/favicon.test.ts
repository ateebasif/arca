import { faviconUrl, letterTile } from '@/src/lib/favicon';
import { displayHost } from '@/src/lib/url';

describe('faviconUrl', () => {
  it('builds an encoded _favicon URL', () => {
    const url = new URL(faviconUrl('https://example.com/a?b=c&d=e', 16));
    expect(url.pathname).toBe('/_favicon/');
    expect(url.searchParams.get('pageUrl')).toBe('https://example.com/a?b=c&d=e');
    expect(url.searchParams.get('size')).toBe('16');
  });

  it('defaults to 32 px', () => {
    expect(new URL(faviconUrl('https://a.dev/')).searchParams.get('size')).toBe('32');
  });
});

describe('letterTile', () => {
  it('uses the first letter or digit of the title', () => {
    expect(letterTile('  github', 'https://github.com').letter).toBe('G');
    expect(letterTile('"9to5mac"').letter).toBe('9');
    expect(letterTile('école').letter).toBe('É');
  });

  it('falls back to the host, then to "?"', () => {
    expect(letterTile('', 'https://www.figma.com/file').letter).toBe('F');
    expect(letterTile('—', undefined).letter).toBe('?');
  });

  it('gives the same host the same hue', () => {
    const a = letterTile('One', 'https://github.com/a');
    const b = letterTile('Two', 'https://www.github.com/b');
    expect(a.hue).toBe(b.hue);
    expect(a.hue).toBeGreaterThanOrEqual(0);
    expect(a.hue).toBeLessThan(360);
  });
});

describe('displayHost', () => {
  it('strips www and handles bad URLs', () => {
    expect(displayHost('https://www.example.com/path')).toBe('example.com');
    expect(displayHost('not a url')).toBe('');
  });
});

import { mainDomain } from '@/src/lib/url';

describe('mainDomain', () => {
  it.each([
    ['https://docs.github.com/en', 'github.com'],
    ['https://www.example.com/', 'example.com'],
    ['https://shop.example.co.uk/x', 'example.co.uk'],
    ['https://a.b.daraz.com.pk/', 'daraz.com.pk'],
    ['http://127.0.0.1:4747/', '127.0.0.1'],
    ['http://localhost:3000/', 'localhost'],
    ['not a url', ''],
  ])('%s → %s', (url, domain) => expect(mainDomain(url)).toBe(domain));
});
