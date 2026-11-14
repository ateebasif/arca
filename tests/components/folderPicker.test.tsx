import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { FolderPicker } from '@/src/components/FolderPicker';
import { rememberFolder } from '@/src/features/editing/recentFolders';
import { BookmarkStore } from '@/src/store/bookmarkStore';
import { setBookmarkStoreForTests } from '@/src/store/useBookmarks';
import { installFakeBookmarks } from '../fakes/bookmarks';

function Harness() {
  const [value, setValue] = useState('1');
  return (
    <>
      <FolderPicker label="Save to folder" value={value} onChange={setValue} />
      <output data-testid="value">{value}</output>
    </>
  );
}

async function setup() {
  const fake = installFakeBookmarks({
    bar: [
      {
        title: 'Organized by Arca',
        children: [
          { title: 'TorrentSites', children: [] },
          { title: 'ReactUI', children: [] },
        ],
      },
      { title: 'Reading', children: [] },
    ],
    other: [{ title: 'Recipes', children: [] }],
  });
  const store = new BookmarkStore();
  setBookmarkStoreForTests(store);
  await store.start();
  render(<Harness />);
  return fake;
}

describe('folder picker', () => {
  it('shows the chosen folder and filters by typing; Enter picks', async () => {
    const fake = await setup();
    const button = screen.getByRole('button', { name: 'Save to folder' });
    expect(button).toHaveTextContent('Bookmarks bar');
    await userEvent.click(button);
    await userEvent.type(screen.getByRole('combobox', { name: 'Find a folder' }), 'torr');
    const options = within(screen.getByRole('listbox', { name: 'Folders' })).getAllByRole(
      'option',
    );
    expect(options).toHaveLength(1);
    // Search results show where the folder lives.
    expect(options[0]).toHaveTextContent(
      'TorrentSites · Bookmarks bar / Organized by Arca',
    );
    await userEvent.keyboard('{Enter}');
    expect(screen.getByTestId('value')).toHaveTextContent(
      fake.findByTitle('TorrentSites')!.id,
    );
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('lists recent folders first, then the whole tree; arrows move, Esc closes', async () => {
    const fake = await setup();
    await rememberFolder(fake.findByTitle('Recipes')!.id);
    await userEvent.click(screen.getByRole('button', { name: 'Save to folder' }));
    const list = await screen.findByRole('listbox', { name: 'Folders' });
    expect(await within(list).findByText('Recent')).toBeVisible();
    const names = within(list)
      .getAllByRole('option')
      .map((o) => o.textContent?.split(' · ')[0]?.replace('✓', '').trim());
    expect(names[0]).toBe('Recipes');
    expect(names.slice(1)).toEqual([
      'Bookmarks bar',
      'Organized by Arca',
      'TorrentSites',
      'ReactUI',
      'Reading',
      'Other bookmarks',
      'Recipes',
    ]);
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    expect(screen.getByTestId('value')).toHaveTextContent(
      fake.findByTitle('Organized by Arca')!.id,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save to folder' }));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});
