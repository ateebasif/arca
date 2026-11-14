import { fetchPreview, MAX_HTML_BYTES } from '@/src/features/previews/fetchPreview';

const html = (head: string) => `<html><head>${head}</head></html>`;

function respond(body: BodyInit, type: string, init: ResponseInit = {}) {
  return new Response(body, { status: 200, headers: { 'content-type': type }, ...init });
}

describe('fetchPreview', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  const encode = vi.fn(async () => 'data:image/webp;base64,AAAA');

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    encode.mockClear();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('fetches without cookies or referrer and returns metadata + thumbnail', async () => {
    fetchMock
      .mockResolvedValueOnce(
        respond(
          html(
            `<meta property="og:title" content="T"><meta property="og:image" content="/i.png">`,
          ),
          'text/html; charset=utf-8',
        ),
      )
      .mockResolvedValueOnce(respond(new Uint8Array([1, 2, 3]), 'image/png'));
    const preview = await fetchPreview('https://site.dev/a', { encode });
    expect(preview).toMatchObject({ title: 'T', image: 'data:image/webp;base64,AAAA' });
    for (const [, init] of fetchMock.mock.calls) {
      expect(init).toMatchObject({
        method: 'GET',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
      });
    }
    expect(fetchMock.mock.calls[1]![0]).toBe('https://site.dev/i.png');
    expect(encode).toHaveBeenCalledTimes(1);
  });

  it('a public page cannot point its image at the local network', async () => {
    for (const img of [
      'http://192.168.1.1/x.png',
      'http://localhost:8080/x.png',
      'http://[::1]/x.png',
      'http://0x7f.1/x.png',
      'http://router.local/x.png',
    ]) {
      fetchMock.mockReset();
      fetchMock.mockResolvedValueOnce(
        respond(html(`<meta property="og:image" content="${img}">`), 'text/html'),
      );
      const preview = await fetchPreview('https://evil.dev/', { encode });
      expect(preview.image).toBe('');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    }
  });

  it('drops a public page that redirected to a local address', async () => {
    const res = respond(html('<title>Admin</title>'), 'text/html');
    Object.defineProperty(res, 'url', { value: 'http://10.0.0.1/admin' });
    fetchMock.mockResolvedValueOnce(res);
    await expect(fetchPreview('https://evil.dev/', { encode })).rejects.toThrow(
      'local address',
    );
  });

  it('a bookmark on your own network still previews, with its own images', async () => {
    fetchMock
      .mockResolvedValueOnce(
        respond(
          html(`<title>NAS</title><meta property="og:image" content="/i.png">`),
          'text/html',
        ),
      )
      .mockResolvedValueOnce(respond(new Uint8Array([1]), 'image/png'));
    const preview = await fetchPreview('http://192.168.1.20/', { encode });
    expect(preview.image).not.toBe('');
  });

  it('only fetches http(s) pages', async () => {
    for (const url of ['javascript:alert(1)', 'file:///etc/hosts', 'chrome://settings']) {
      await expect(fetchPreview(url, { encode })).rejects.toThrow();
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects non-HTML responses and HTTP errors', async () => {
    fetchMock.mockResolvedValueOnce(respond('{}', 'application/json'));
    await expect(fetchPreview('https://a.dev/', { encode })).rejects.toThrow(
      'Not an HTML page',
    );
    fetchMock.mockResolvedValueOnce(respond('nope', 'text/html', { status: 500 }));
    await expect(fetchPreview('https://a.dev/', { encode })).rejects.toThrow('HTTP 500');
  });

  it('reads at most the HTML byte cap', async () => {
    const huge = `<html><head><meta property="og:title" content="Top"></head><body>${'x'.repeat(
      MAX_HTML_BYTES * 2,
    )}<meta property="og:description" content="too far"></body></html>`;
    fetchMock.mockResolvedValueOnce(respond(huge, 'text/html'));
    const preview = await fetchPreview('https://a.dev/', { encode });
    expect(preview.title).toBe('Top');
    expect(preview.description).toBe('');
  });

  it('refuses SVG and other non-raster images, but keeps the preview', async () => {
    fetchMock
      .mockResolvedValueOnce(
        respond(
          html(
            `<meta property="og:title" content="T"><meta property="og:image" content="/i.svg">`,
          ),
          'text/html',
        ),
      )
      .mockResolvedValueOnce(respond('<svg onload="alert(1)"/>', 'image/svg+xml'));
    const preview = await fetchPreview('https://a.dev/', { encode });
    expect(preview).toMatchObject({ title: 'T', image: '' });
    expect(encode).not.toHaveBeenCalled();
  });

  it('keeps the preview when the image request fails', async () => {
    fetchMock
      .mockResolvedValueOnce(
        respond(
          html(
            `<meta property="og:title" content="T"><meta property="og:image" content="/i.png">`,
          ),
          'text/html',
        ),
      )
      .mockRejectedValueOnce(new TypeError('network down'));
    expect(await fetchPreview('https://a.dev/', { encode })).toMatchObject({
      title: 'T',
      image: '',
    });
  });
});
