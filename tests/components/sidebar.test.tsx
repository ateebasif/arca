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
