import { act, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as bm from '@/src/lib/bookmarks';
import { Dashboard } from '@/src/components/Dashboard';
import { useUi } from '@/src/store/ui';
import { renderWithBookmarks, SAMPLE_SEED } from '../helpers/render';

const bookmarks = () => screen.getByRole('region', { name: 'Bookmarks' });
const folders = () => screen.getByRole('region', { name: 'Folders' });

describe('folder view', () => {
  it('shows folder cards first, then bookmark tiles as real links', async () => {
    await renderWithBookmarks(<Dashboard surface="dashboard" />, SAMPLE_SEED);
    const card = within(folders()).getByRole('button', { name: /^Dev/ });
    expect(card).toHaveTextContent('2 bookmarks');
    const links = within(bookmarks()).getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual([
      'GitHubgithub.com',
      'Newsnews.ycombinator.com',
    ]);
    expect(links[0]).toHaveAttribute('href', 'https://github.com/');
  });

  it('opens a folder from its card and updates breadcrumbs', async () => {
    await renderWithBookmarks(<Dashboard surface="dashboard" />, SAMPLE_SEED);
    await userEvent.click(within(folders()).getByRole('button', { name: /^Dev/ }));
    await userEvent.click(within(folders()).getByRole('button', { name: /^Nested/ }));
    const crumbs = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(
      within(crumbs)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['Bookmarks bar', 'Dev', 'Nested']);
    expect(within(crumbs).getByText('Nested')).toHaveAttribute('aria-current', 'page');
    await userEvent.click(within(crumbs).getByRole('button', { name: 'Bookmarks bar' }));
    expect(useUi.getState().currentFolderId).toBe('1');
  });

  it('shows an empty state for empty folders', async () => {
    await renderWithBookmarks(<Dashboard surface="dashboard" />, {
      bar: [{ title: 'Empty', children: [] }],
    });
    await userEvent.click(screen.getByRole('button', { name: /^Empty/ }));
    expect(screen.getByText('This folder is empty')).toBeInTheDocument();
  });

  it('falls back to a letter tile when a favicon fails', async () => {
    await renderWithBookmarks(<Dashboard surface="dashboard" />, SAMPLE_SEED);
    const link = within(bookmarks()).getByRole('link', { name: /GitHub/ });
    const img = link.querySelector('img')!;
    expect(img.getAttribute('src')).toContain(
      '/_favicon/?pageUrl=https%3A%2F%2Fgithub.com%2F',
    );
    fireEvent.error(img);
    expect(within(link).getByTestId('letter-tile')).toHaveTextContent('G');
  });

  it('switches density', async () => {
    await renderWithBookmarks(<Dashboard surface="dashboard" />, SAMPLE_SEED);
    await userEvent.click(screen.getByRole('button', { name: 'Compact density' }));
    expect(useUi.getState().density).toBe('compact');
    expect(screen.getByRole('button', { name: 'Comfortable density' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('reflects bookmark edits made in the browser', async () => {
    const { fake } = await renderWithBookmarks(
      <Dashboard surface="dashboard" />,
      SAMPLE_SEED,
    );
    await act(() => bm.update(fake.findByTitle('GitHub')!.id, { title: 'GH' }));
    expect(within(bookmarks()).getByRole('link', { name: /GH/ })).toBeInTheDocument();
  });
});

describe('list view and sorting', () => {
  it('switches to a list with sortable columns', async () => {
    await renderWithBookmarks(<Dashboard surface="dashboard" />, SAMPLE_SEED);
    await userEvent.click(screen.getByRole('button', { name: 'List view' }));
    expect(useUi.getState().view).toBe('list');
    const table = screen.getByRole('table', { name: 'Folder contents' });
    const rows = () =>
      within(table)
        .getAllByRole('row')
        .slice(1)
        .map((r) => r.textContent);
    // Manual order: folders first, then bookmarks in browser order.
    expect(rows()[0]).toContain('Dev');
    expect(rows()[1]).toContain('GitHub');

    await userEvent.click(within(table).getByRole('button', { name: 'Title' }));
    expect(within(table).getByRole('columnheader', { name: /Title/ })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
    await userEvent.click(within(table).getByRole('button', { name: /Title/ }));
    expect(useUi.getState()).toMatchObject({ sort: 'title', sortDirection: 'desc' });
    const titles = within(table)
      .getAllByRole('row')
      .filter((r) => r.hasAttribute('data-bookmark-id'))
      .map((r) => r.querySelector('[role=cell] span:last-child')?.textContent);
    expect(titles).toEqual(['News', 'GitHub']);
  });

  it('sorts the grid from the toolbar', async () => {
    await renderWithBookmarks(<Dashboard surface="dashboard" />, SAMPLE_SEED);
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Sort by' }),
      'title',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Ascending' }));
    const links = within(bookmarks()).getAllByRole('link');
    expect(links.map((l) => l.getAttribute('href'))).toEqual([
      'https://news.ycombinator.com/',
      'https://github.com/',
    ]);
  });
});

describe('virtualization', () => {
  it('virtualizes folders with more than 200 bookmarks in grid and list', async () => {
    await renderWithBookmarks(<Dashboard surface="dashboard" />, {
      bar: Array.from({ length: 300 }, (_, i) => ({
        title: `B${i}`,
        url: `https://b${i}.dev/`,
      })),
    });
    expect(document.querySelector('[data-virtualized]')).not.toBeNull();
    expect(screen.queryAllByRole('link').length).toBeLessThan(300);
    await userEvent.click(screen.getByRole('button', { name: 'List view' }));
    expect(document.querySelector('[data-virtualized]')).not.toBeNull();
  });

  it('renders small folders without virtualization', async () => {
    await renderWithBookmarks(<Dashboard surface="dashboard" />, SAMPLE_SEED);
    expect(document.querySelector('[data-virtualized]')).toBeNull();
  });
});
