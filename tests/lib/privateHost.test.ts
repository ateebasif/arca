import { isPrivateHost } from '@/src/lib/url';

describe('isPrivateHost', () => {
  it.each([
    'http://localhost/',
    'http://app.localhost:3000/',
    'http://printer.local/',
    'http://nas/',
    'http://127.0.0.1/',
    'http://2130706433/',
    'http://10.1.2.3/',
    'http://172.20.0.1/',
    'http://192.168.0.1/',
    'http://169.254.169.254/latest',
    'http://100.100.1.1/',
    'http://0.0.0.0/',
    'http://[::1]/',
    'http://[fd12::1]/',
    'http://[fe80::1]/',
    'http://[::ffff:127.0.0.1]/',
  ])('%s is local', (url) => expect(isPrivateHost(url)).toBe(true));

  it.each([
    'https://example.com/',
    'https://172.32.0.1/',
    'https://8.8.8.8/',
    'https://[2606:4700::1111]/',
    'not a url',
  ])('%s is public', (url) => expect(isPrivateHost(url)).toBe(false));
});
