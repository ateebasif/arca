import { act, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dashboard } from '@/src/components/Dashboard';
import { useOverlays } from '@/src/store/overlays';
import { useUi } from '@/src/store/ui';
import { renderWithBookmarks, SAMPLE_SEED } from '../helpers/render';

const tile = (title: string) =>
  screen.getAllByRole('link').find((l) => l.textContent?.startsWith(title))!;

describe('editing', () => {
  it('adds a bookmark to the open folder, normalizing the URL', async () => {
    const { fake } = await renderWithBookmarks(
      <Dashboard surface="dashboard" />,
      SAMPLE_SEED,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'New bookmark' }));
    const dialog = screen.getByRole('dialog', { name: 'New bookmark' });
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Arca');
    await userEvent.type(within(dialog).getByLabelText('URL'), 'nope');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add' }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Enter a valid URL');

    await userEvent.clear(within(dialog).getByLabelText('URL'));
    await userEvent.type(within(dialog).getByLabelText('URL'), 'arca.dev');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(fake.findByTitle('Arca')).toMatchObject({
      parentId: '1',
      url: 'https://arca.dev/',
    });
    expect(tile('Arca')).toHaveAttribute('href', 'https://arca.dev/');
  });

  it('adds a folder with a default name', async () => {
    const { fake } = await renderWithBookmarks(
      <Dashboard surface="dashboard" />,
      SAMPLE_SEED,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'New folder' }));
    expect(within(screen.getByRole('dialog')).queryByLabelText('URL')).toBeNull();
    await userEvent.keyboard('{Enter}');
    expect(fake.findByTitle('New folder')?.parentId).toBe('1');
  });

  it('edits title, URL and folder from the item menu', async () => {
    const { fake } = await renderWithBookmarks(
      <Dashboard surface="dashboard" />,
      SAMPLE_SEED,
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'More actions for GitHub' }),
    );
    await userEvent.click(screen.getByRole('menuitem', { name: 'Edit…' }));
    const dialog = screen.getByRole('dialog', { name: 'Edit bookmark' });
    const name = within(dialog).getByLabelText('Name');
    await userEvent.clear(name);
    await userEvent.type(name, 'GH');
    await userEvent.selectOptions(
      within(dialog).getByLabelText('Folder'),
      fake.findByTitle('Recipes')!.id,
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(fake.findByTitle('GH')?.parentId).toBe(fake.findByTitle('Recipes')!.id);
    expect(screen.queryByRole('link', { name: /GH/ })).toBeNull();
  });

  it("doesn't offer a folder's own subtree as its destination", async () => {
    const { fake } = await renderWithBookmarks(
      <Dashboard surface="dashboard" />,
      SAMPLE_SEED,
    );
    act(() =>
      useOverlays
        .getState()
        .openEditor({ mode: 'edit', id: fake.findByTitle('Dev')!.id }),
    );
    const options = within(screen.getByLabelText('Folder'))
      .getAllByRole('option')
      .map((o) => o.textContent?.trim());
    expect(options).not.toContain('Dev');
    expect(options).not.toContain('Nested');
    expect(options).toContain('Recipes');
  });

  it('renames inline with F2; Escape cancels', async () => {
    const { fake } = await renderWithBookmarks(
      <Dashboard surface="dashboard" />,
      SAMPLE_SEED,
    );
    tile('GitHub').focus();
    await userEvent.keyboard('{F2}');
    const input = screen.getByRole('textbox', { name: 'Name' });
    expect(input).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(fake.findByTitle('GitHub')).toBeDefined();

    tile('GitHub').focus();
    await userEvent.keyboard('{F2}');
    await userEvent.keyboard('{Control>}a{/Control}Code host{Enter}');
    expect(fake.findByTitle('Code host')).toBeDefined();
    expect(tile('Code host')).toBeInTheDocument();
  });

  it('renames a folder by double-clicking it in the sidebar', async () => {
    const { fake } = await renderWithBookmarks(
      <Dashboard surface="dashboard" />,
      SAMPLE_SEED,
    );
    const tree = screen.getByRole('tree');
    await userEvent.dblClick(within(tree).getByRole('treeitem', { name: /^Dev/ }));
    await userEvent.keyboard('{Control>}a{/Control}Engineering{Enter}');
    expect(fake.findByTitle('Engineering')).toBeDefined();
  });

  it('deletes bookmarks directly and asks before deleting non-empty folders', async () => {
    const { fake } = await renderWithBookmarks(
      <Dashboard surface="dashboard" />,
      SAMPLE_SEED,
    );
    tile('GitHub').focus();
    await userEvent.keyboard('{Delete}');
    expect(fake.findByTitle('GitHub')).toBeUndefined();
    expect(screen.getByRole('status')).toHaveTextContent('Deleted “GitHub”');

    fireEvent.contextMenu(screen.getByRole('button', { name: /^Dev/ }));
    await userEvent.click(screen.getByRole('menuitem', { name: /Delete/ }));
    const confirm = screen.getByRole('alertdialog', { name: 'Delete “Dev”?' });
    expect(confirm).toHaveTextContent('2 bookmarks and 1 folder');
    await userEvent.click(within(confirm).getByRole('button', { name: 'Cancel' }));
    expect(fake.findByTitle('Dev')).toBeDefined();

    fireEvent.contextMenu(screen.getByRole('button', { name: /^Dev/ }));
    await userEvent.click(screen.getByRole('menuitem', { name: /Delete/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete folder' }));
    expect(fake.findByTitle('Dev')).toBeUndefined();
    expect(fake.findByTitle('Deep')).toBeUndefined();
  });

  it('keeps root folders read-only', async () => {
    const { fake } = await renderWithBookmarks(
      <Dashboard surface="dashboard" />,
      SAMPLE_SEED,
    );
    const bar = within(screen.getByRole('tree')).getByRole('treeitem', {
      name: /Bookmarks bar/,
    });
    fireEvent.contextMenu(bar);
    const menu = screen.getByRole('menu');
    for (const name of ['Edit…', 'Rename', 'Delete']) {
      expect(
        within(menu).getByRole('menuitem', { name: new RegExp(name) }),
      ).toHaveAttribute('aria-disabled', 'true');
    }
    expect(menu).toHaveTextContent("Browser folder — can't be changed");
    await userEvent.keyboard('{Escape}');

    bar.focus();
    await userEvent.keyboard('{F2}{Delete}');
    await userEvent.dblClick(bar);
    expect(screen.queryByRole('textbox', { name: 'Name' })).toBeNull();
    expect(fake.findByTitle('Bookmarks bar')).toBeDefined();
    expect(useUi.getState().currentFolderId).toBe('1');
  });
});
