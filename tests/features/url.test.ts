import { normalizeInputUrl } from '@/src/features/editing/url';

describe('normalizeInputUrl', () => {
  it.each([
    ['example.com', 'https://example.com/'],
    ['  https://a.dev/x?y=1 ', 'https://a.dev/x?y=1'],
    ['http://localhost:3000', 'http://localhost:3000/'],
    ['chrome://settings', 'chrome://settings'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeInputUrl(input)).toBe(expected);
  });

  it.each([
    '',
    '   ',
    'not a url',
    'hello',
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    'blob:https://a.dev/x',
  ])('rejects %j', (input) => {
    expect(normalizeInputUrl(input)).toBeNull();
  });
});
