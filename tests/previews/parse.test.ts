import { cleanText, parsePreviewHtml, safeHttpUrl } from '@/src/features/previews/parse';

const page = (head: string, body = '') =>
  `<!doctype html><html><head>${head}</head><body>${body}</body></html>`;

describe('parsePreviewHtml', () => {
  it('reads Open Graph tags', () => {
    const meta = parsePreviewHtml(
      page(`
        <title>Fallback</title>
        <meta property="og:title" content="Real title">
        <meta property="og:description" content="About this page">
        <meta property="og:site_name" content="Example">
        <meta property="og:image" content="/img/cover.png">`),
      'https://example.com/post/1',
    );
    expect(meta).toEqual({
      title: 'Real title',
      description: 'About this page',
      siteName: 'Example',
      imageUrl: 'https://example.com/img/cover.png',
    });
  });

  it('falls back to <title>, meta description and twitter tags', () => {
    const meta = parsePreviewHtml(
      page(`<title> Plain   title </title>
        <meta name="description" content="Desc">
        <meta name="twitter:image" content="https://cdn.example.com/a.jpg">`),
      'https://example.com/',
    );
    expect(meta).toMatchObject({
      title: 'Plain title',
      description: 'Desc',
      imageUrl: 'https://cdn.example.com/a.jpg',
    });
  });

  it('never runs scripts or event handlers in the fetched HTML', () => {
    const w = window as unknown as { pwned?: boolean };
    parsePreviewHtml(
      page(
        `<script>window.pwned = true</script><meta property="og:title" content="x">`,
        `<img src="x" onerror="window.pwned = true"><svg onload="window.pwned = true"></svg>
         <iframe src="javascript:window.parent.pwned = true"></iframe>`,
      ),
      'https://evil.example/',
    );
    expect(w.pwned).toBeUndefined();
  });

  it('keeps markup in titles as plain text', () => {
    const meta = parsePreviewHtml(
      page(`<meta property="og:title" content="<img src=x onerror=alert(1)>">`),
      'https://evil.example/',
    );
    expect(meta.title).toBe('<img src=x onerror=alert(1)>');
  });

  it.each([
    'javascript:alert(1)',
    'data:image/svg+xml,<svg onload=alert(1)>',
    'file:///etc/passwd',
    'chrome://settings',
  ])('rejects image URL %s', (image) => {
    const meta = parsePreviewHtml(
      page(`<meta property="og:image" content="${image}">`),
      'https://evil.example/',
    );
    expect(meta.imageUrl).toBe('');
  });

  it('ignores <base href> when resolving image URLs', () => {
    const meta = parsePreviewHtml(
      page(
        `<base href="https://attacker.example/"><meta property="og:image" content="/i.png">`,
      ),
      'https://site.example/a',
    );
    expect(meta.imageUrl).toBe('https://site.example/i.png');
  });
});

describe('cleanText', () => {
  it('strips hidden and bidi-override characters and caps length', () => {
    expect(cleanText('Pay‮gnp.exe', 50)).toBe('Pay gnp.exe');
    expect(cleanText('a\u0000b​c\n\td', 50)).toBe('a b c d');
    expect(cleanText('x'.repeat(300), 10)).toHaveLength(10);
    expect(cleanText(null, 10)).toBe('');
  });

  it('only allows http(s) URLs', () => {
    expect(safeHttpUrl('//cdn.example.com/a.png', 'https://x.dev/')).toBe(
      'https://cdn.example.com/a.png',
    );
    expect(safeHttpUrl('ftp://x.dev/a.png', 'https://x.dev/')).toBe('');
  });
});
