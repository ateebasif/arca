import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dashboard } from '@/src/components/Dashboard';
import { setLinkStoreForTests, type LinkResult } from '@/src/features/deadlinks/check';
import { memoryStore } from '@/src/lib/idb';
import { getMetaStore, resetMetaForTests } from '@/src/store/useMeta';
import { useUi } from '@/src/store/ui';
import { renderWithBookmarks } from '../helpers/render';

beforeEach(() => resetMetaForTests());

describe('search filter chips', () => {
  it('narrows results by tag, note, duplicates and broken links', async () => {
    const links = new Map<string, LinkResult>([
      ['https://docs.dead.dev/', { status: 'broken', code: 404, checkedAt: Date.now() }],
    ]);
    const store = memoryStore<LinkResult>();
    for (const [u, r] of links) await store.put(u, r);
    setLinkStoreForTests(store);
    const { fake } = await renderWithBookmarks(<Dashboard surface="dashboard" />, {
      bar: [
        { title: 'React docs', url: 'https://react.dev/' },
        { title: 'Vue docs', url: 'https://vuejs.org/' },
        { title: 'Old docs', url: 'https://docs.dead.dev/' },
        {
          title: 'Work',
          children: [{ title: 'React docs again', url: 'https://react.dev' }],
        },
      ],
    });
    const meta = getMetaStore();
    await meta.setTags(fake.findByTitle('Vue docs')!.id, 'https://vuejs.org/', [
      'frontend',
    ]);
    await meta.setNote(
      fake.findByTitle('Old docs')!.id,
      'https://docs.dead.dev/',
      'archive',
    );

    act(() => useUi.getState().setQuery('docs'));
    const titles = async () =>
      within(await screen.findByRole('listbox', { name: 'Search results' }))
        .queryAllByRole('option')
        .map((o) => o.querySelector('[class*="truncate"]')?.textContent ?? o.textContent);
    const filters = screen.getByRole('group', { name: 'Search filters' });
    expect(await titles()).toHaveLength(3);

    await userEvent.selectOptions(
      within(filters).getByRole('combobox', { name: 'Filter by tag' }),
      'frontend',
    );
    expect((await titles()).join()).toMatch(/^Vue docs/);
    await userEvent.selectOptions(
      within(filters).getByRole('combobox', { name: 'Filter by tag' }),
      '',
    );

    await userEvent.click(within(filters).getByRole('button', { name: 'Has note' }));
    expect(await titles()).toHaveLength(1);
    expect((await titles())[0]).toContain('Old docs');
    await userEvent.click(within(filters).getByRole('button', { name: 'Has note' }));

    await userEvent.click(within(filters).getByRole('button', { name: 'Duplicates' }));
    expect((await titles()).every((t) => t?.includes('React docs'))).toBe(true);
    await userEvent.click(within(filters).getByRole('button', { name: 'Duplicates' }));

    await userEvent.click(within(filters).getByRole('button', { name: 'Broken' }));
    await vi.waitFor(async () => expect(await titles()).toHaveLength(1));
    expect((await titles())[0]).toContain('Old docs');

    // Clearing the search clears the filters.
    act(() => useUi.getState().setQuery(''));
    expect(useUi.getState().filters.broken).toBe(false);
    setLinkStoreForTests(null);
  });
});
