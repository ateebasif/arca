import {
  onStorageChange,
  storageGet,
  storageRemove,
  storageSet,
} from '@/src/lib/storage';

describe('storage', () => {
  it('returns the fallback for missing keys', async () => {
    expect(await storageGet('settings', { view: 'grid' })).toEqual({ view: 'grid' });
  });

  it('round-trips values and removes them', async () => {
    await storageSet('settings', { view: 'list' });
    expect(await storageGet('settings', { view: 'grid' })).toEqual({ view: 'list' });
    await storageRemove('settings');
    expect(await storageGet('settings', null)).toBeNull();
  });

  it('keeps falsy stored values instead of using the fallback', async () => {
    await storageSet('count', 0);
    expect(await storageGet('count', 5)).toBe(0);
  });

  it('notifies listeners for their key only, until unsubscribed', async () => {
    const onChange = vi.fn();
    const unsubscribe = onStorageChange<number>('count', onChange);

    await storageSet('count', 1);
    await storageSet('other', 'x');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(1, undefined);

    unsubscribe();
    await storageSet('count', 2);
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
