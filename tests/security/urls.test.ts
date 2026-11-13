import * as bm from '@/src/lib/bookmarks';
import { openUrl } from '@/src/lib/tabs';
import { classifyUrl, safeHref } from '@/src/lib/url';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { installFakeBookmarks } from '../fakes/bookmarks';

describe('classifyUrl', () => {
  it.each([
    ['https://a.dev/', 'web'],
    ['http://a.dev/', 'web'],
    ['ftp://a.dev/', 'web'],
    ['chrome://settings', 'browser'],
    ['file:///Users/me/a.pdf', 'browser'],
    ['about:blank', 'browser'],
  ])('%s → %s', (url, kind) => expect(classifyUrl(url)).toBe(kind));

  it.each([
    'javascript:alert(1)',
    'JAVASCRIPT:alert(1)',
    '  javascript:alert(1)',
    'java\tscript:alert(1)',
    'java\nscript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'data:image/svg+xml,<svg onload=alert(1)>',
    'vbscript:msgbox(1)',
    'blob:https://a.dev/uuid',
    'filesystem:https://a.dev/temporary/x',
    'mailto:a@b.dev',
    'not a url',
    '',
    undefined,
  ])('blocks %j', (url) => {
    expect(classifyUrl(url)).toBe('blocked');
    expect(safeHref(url)).toBeUndefined();
  });

  it('only renders web URLs as hrefs', () => {
    expect(safeHref('https://a.dev/')).toBe('https://a.dev/');
    expect(safeHref('chrome://settings')).toBeUndefined();
  });
});

describe('wrappers refuse blocked URLs', () => {
  beforeEach(() =>
    installFakeBookmarks({ bar: [{ title: 'A', url: 'https://a.dev/' }] }),
  );

  it('never creates or updates a bookmark to a code-carrying URL', async () => {
    await expect(
      bm.create({ parentId: '1', title: 'x', url: 'javascript:alert(1)' }),
    ).rejects.toMatchObject({ code: 'BLOCKED_URL' });
    const [a] = await bm.getChildren('1');
    await expect(bm.update(a!.id, { url: 'data:text/html,hi' })).rejects.toMatchObject({
      code: 'BLOCKED_URL',
    });
  });

  it('never opens a code-carrying URL', async () => {
    const update = vi.spyOn(fakeBrowser.tabs, 'update');
    const create = vi.spyOn(fakeBrowser.tabs, 'create');
    await expect(openUrl('javascript:alert(1)')).rejects.toMatchObject({
      code: 'BLOCKED_URL',
    });
    await expect(openUrl('data:text/html,x', 'new-tab')).rejects.toMatchObject({
      code: 'BLOCKED_URL',
    });
    expect(update).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });
});
