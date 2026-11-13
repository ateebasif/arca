import { normalizeInputUrl } from '@/src/features/editing/url';

describe('normalizeInputUrl', () => {
  it.each([
    ['example.com', 'https://example.com/'],
    ['  https://a.dev/x?y=1 ', 'https://a.dev/x?y=1'],
    ['http://localhost:3000', 'http://localhost:3000/'],
    ['javascript:alert(1)', 'javascript:alert(1)'],
    ['chrome://settings', 'chrome://settings'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeInputUrl(input)).toBe(expected);
  });

  it.each(['', '   ', 'not a url', 'hello'])('rejects %j', (input) => {
    expect(normalizeInputUrl(input)).toBeNull();
  });
});
