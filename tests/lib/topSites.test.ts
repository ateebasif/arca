import { fakeBrowser } from 'wxt/testing/fake-browser';
import { ArcaError } from '@/src/lib/errors';
import { getTopSites } from '@/src/lib/topSites';

describe('getTopSites', () => {
  it('returns at most `limit` sites', async () => {
    const sites = Array.from({ length: 20 }, (_, i) => ({
      url: `https://${i}.dev/`,
      title: `Site ${i}`,
    }));
    vi.spyOn(fakeBrowser.topSites, 'get').mockResolvedValue(sites as never);
    expect(await getTopSites(8)).toHaveLength(8);
    expect((await getTopSites())[0]?.title).toBe('Site 0');
  });

  it('wraps API failures in ArcaError', async () => {
    vi.spyOn(fakeBrowser.topSites, 'get').mockRejectedValue(new Error('nope'));
    const error = await getTopSites().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ArcaError);
    expect(error).toMatchObject({ code: 'API', message: 'topSites.get failed: nope' });
  });
});
