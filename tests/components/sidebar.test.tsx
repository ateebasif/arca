import { act, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as bm from '@/src/lib/bookmarks';
import { Dashboard } from '@/src/components/Dashboard';
import { useUi } from '@/src/store/ui';
import { renderWithBookmarks, SAMPLE_SEED } from '../helpers/render';

const tree = () => screen.getByRole('tree', { name: 'Folders' });
const item = (name: RegExp) => within(tree()).getByRole('treeitem', { name });

describe('sidebar folder tree', () => {
  it('shows root folders with recursive bookmark counts', async () => {
    await renderWithBookmarks(<Dashboard surface="dashboard" />, SAMPLE_SEED);
    expect(item(/Bookmarks bar/)).toHaveTextContent('4');
    expect(item(/Other bookmarks/)).toHaveTextContent('1');
    // Bookmarks bar is expanded by default, so its child folder is visible.
    expect(item(/^Dev/)).toHaveAttribute('aria-level', '2');
    expect(within(tree()).queryByRole('treeitem', { name: /Nested/ })).toBeNull();
  });

  it('opens a folder on click and marks it selected', async () => {
    await renderWithBookmarks(<Dashboard surface="dashboard" />, SAMPLE_SEED);
    await userEvent.click(item(/^Dev/));
    expect(useUi.getState().currentFolderId).toBe(item(/^Dev/).dataset.folderId);
    expect(item(/^Dev/)).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Dev');
  });

  it('supports arrow-key navigation and expand/collapse', async () => {
    await renderWithBookmarks(<Dashboard surface="dashboard" />, SAMPLE_SEED);
    item(/Bookmarks bar/).focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(item(/^Dev/)).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    expect(item(/^Dev/)).toHaveAttribute('aria-expanded', 'true');
    await userEvent.keyboard('{ArrowRight}');
    expect(item(/Nested/)).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Nested');
    await userEvent.keyboard('{ArrowLeft}');
    expect(item(/^Dev/)).toHaveFocus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(item(/^Dev/)).toHaveAttribute('aria-expanded', 'false');
  });

  it('expands ancestors when the open folder changes elsewhere', async () => {
    const { fake } = await renderWithBookmarks(
      <Dashboard surface="dashboard" />,
      SAMPLE_SEED,
    );
    act(() => useUi.getState().openFolder(fake.findByTitle('Nested')!.id));
    expect(item(/Nested/)).toHaveAttribute('aria-selected', 'true');
  });

  it('updates live when bookmarks change in the browser', async () => {
    const { fake } = await renderWithBookmarks(
      <Dashboard surface="dashboard" />,
      SAMPLE_SEED,
    );
    await act(() => bm.create({ parentId: '1', title: 'Fresh' }));
    expect(item(/Fresh/)).toBeInTheDocument();
    await act(() => bm.remove(fake.findByTitle('Dev')!.id));
    expect(within(tree()).queryByRole('treeitem', { name: /^Dev/ })).toBeNull();
    expect(item(/Bookmarks bar/)).toHaveTextContent('2');
  });

  it('falls back to the first root when the open folder is deleted', async () => {
    const { fake } = await renderWithBookmarks(
      <Dashboard surface="dashboard" />,
      SAMPLE_SEED,
    );
    const dev = fake.findByTitle('Dev')!.id;
    act(() => useUi.getState().openFolder(dev));
    await act(() => bm.remove(dev));
    expect(useUi.getState().currentFolderId).toBe('1');
  });

  it('toggles with mod+\\ and resizes with the keyboard', async () => {
    await renderWithBookmarks(<Dashboard surface="dashboard" />, SAMPLE_SEED);
    const separator = screen.getByRole('separator', { name: 'Resize sidebar' });
    separator.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(useUi.getState().sidebarWidth).toBe(264);

    fireEvent.keyDown(window, { key: '\\', ctrlKey: true });
    expect(screen.queryByRole('tree')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /Show sidebar/ }));
    expect(tree()).toBeInTheDocument();
  });
});

describe('folder history', () => {
  it('goes back and forward with buttons, [ ], and mouse side buttons', async () => {
    const { fake } = await renderWithBookmarks(
      <Dashboard surface="dashboard" />,
      SAMPLE_SEED,
    );
    const dev = fake.findByTitle('Dev')!.id;
    const nested = fake.findByTitle('Nested')!.id;
    const back = () => screen.getByRole('button', { name: /^Back/ });
    const forward = () => screen.getByRole('button', { name: /^Forward/ });
    expect(back()).toBeDisabled();

    act(() => useUi.getState().openFolder(dev));
    act(() => useUi.getState().openFolder(nested));
    expect(back()).toHaveAccessibleName('Back to Dev ([)');
    await userEvent.click(back());
    expect(useUi.getState().currentFolderId).toBe(dev);
    expect(forward()).toBeEnabled();

    fireEvent.keyDown(window, { key: '[' });
    expect(useUi.getState().currentFolderId).toBe('1');
    fireEvent.keyDown(window, { key: ']' });
    expect(useUi.getState().currentFolderId).toBe(dev);
    fireEvent.mouseUp(window, { button: 4 });
    expect(useUi.getState().currentFolderId).toBe(nested);
    fireEvent.mouseUp(window, { button: 3 });
    expect(useUi.getState().currentFolderId).toBe(dev);

    // Opening a new folder clears forward history.
    act(() => useUi.getState().openFolder('2'));
    expect(forward()).toBeDisabled();
  });

  it('goes up with alt+arrow-up but not past the root folders', async () => {
    const { fake } = await renderWithBookmarks(
      <Dashboard surface="dashboard" />,
      SAMPLE_SEED,
    );
    act(() => useUi.getState().openFolder(fake.findByTitle('Nested')!.id));
    fireEvent.keyDown(window, { key: 'ArrowUp', altKey: true });
    expect(useUi.getState().currentFolderId).toBe(fake.findByTitle('Dev')!.id);
    fireEvent.keyDown(window, { key: 'ArrowUp', altKey: true });
    fireEvent.keyDown(window, { key: 'ArrowUp', altKey: true });
    expect(useUi.getState().currentFolderId).toBe('1');
  });

  it('ignores [ ] while typing and opens the shortcuts sheet with ?', async () => {
    await renderWithBookmarks(<Dashboard surface="dashboard" />, SAMPLE_SEED);
    act(() => useUi.getState().openFolder('2'));
    const input = screen.getByRole('combobox', { name: 'Search bookmarks' });
    await userEvent.type(input, '[[');
    expect(useUi.getState().currentFolderId).toBe('2');
    input.blur();
    fireEvent.keyDown(window, { key: '?', shiftKey: true });
    expect(
      await screen.findByRole('dialog', { name: 'Keyboard shortcuts' }),
    ).toBeInTheDocument();
  });

  it('does not keep a deleted folder in history', async () => {
    const { fake } = await renderWithBookmarks(
      <Dashboard surface="dashboard" />,
      SAMPLE_SEED,
    );
    const dev = fake.findByTitle('Dev')!.id;
    act(() => useUi.getState().openFolder(dev));
    await act(() => bm.remove(dev));
    expect(useUi.getState().currentFolderId).toBe('1');
    expect(useUi.getState().backStack).toEqual(['1']);
  });
});
