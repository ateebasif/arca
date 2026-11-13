import { act, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { Dashboard } from '@/src/components/Dashboard';
import {
  HOVER_DELAY_MS,
  LEAVE_GRACE_MS,
} from '@/src/components/preview/PreviewController';
import { PreviewCache, setPreviewCacheForTests } from '@/src/features/previews/cache';
import { memoryStore } from '@/src/lib/idb';
import { useSettings } from '@/src/store/settings';
import { renderWithBookmarks, SAMPLE_SEED } from '../helpers/render';

let granted = false;
const fetcher = vi.fn(async () => ({
  title: 'GitHub: where the world builds software',
  description: 'Millions of developers…',
  siteName: 'GitHub',
  image: '',
  excerpt: 'GitHub is where over 100 million developers shape the future of software.',
  headings: ['Build and ship software', 'Collaborate'],
  finalUrl: 'https://github.com/',
}));

beforeEach(() => {
  granted = false;
  fetcher.mockClear();
  setPreviewCacheForTests(new PreviewCache({ store: memoryStore(), fetcher }));
  const p = fakeBrowser.permissions;
  vi.spyOn(p, 'contains').mockImplementation(async () => granted);
  vi.spyOn(p, 'request').mockImplementation(async () => granted);
  vi.spyOn(p, 'remove').mockImplementation(async () => {
    granted = false;
    return true;
  });
  for (const event of [p.onAdded, p.onRemoved]) {
    vi.spyOn(event, 'addListener').mockImplementation(() => {});
    vi.spyOn(event, 'removeListener').mockImplementation(() => {});
  }
});
afterEach(() => setPreviewCacheForTests(null));

const tile = (title: string) =>
  [...document.querySelectorAll<HTMLElement>('[data-bookmark-id]')].find((el) =>
    el.textContent?.includes(title),
  )!;

async function hover(el: HTMLElement) {
  await userEvent.hover(el);
  await act(() => new Promise((r) => setTimeout(r, HOVER_DELAY_MS + 50)));
}

describe('link previews', () => {
  it('stays off and fetches nothing by default', async () => {
    await renderWithBookmarks(<Dashboard surface="dashboard" />, SAMPLE_SEED);
    await hover(tile('GitHub'));
    expect(screen.queryByTestId('link-preview')).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('turning on asks for site access; declining changes nothing', async () => {
    await renderWithBookmarks(<Dashboard surface="dashboard" />, SAMPLE_SEED);
    await userEvent.click(screen.getByRole('button', { name: 'Settings' }));
    const toggle = screen.getByRole('switch', { name: 'Link previews' });
    await userEvent.click(toggle);
    expect(fakeBrowser.permissions.request).toHaveBeenCalledWith({
      origins: ['<all_urls>'],
    });
    expect(useSettings.getState().linkPreviews).toBe(false);
    expect(screen.getByText(/Nothing was changed/)).toBeInTheDocument();

    granted = true;
    await userEvent.click(toggle);
    expect(useSettings.getState().linkPreviews).toBe(true);
    expect(toggle).toHaveAttribute('aria-checked', 'true');

    await userEvent.click(toggle);
    expect(useSettings.getState().linkPreviews).toBe(false);
    expect(fakeBrowser.permissions.remove).toHaveBeenCalled();
  });

  it('shows a cached preview on hover, fetching each page only once', async () => {
    granted = true;
    await useSettings.getState().update({ linkPreviews: true });
    await renderWithBookmarks(<Dashboard surface="dashboard" />, SAMPLE_SEED);
    await useSettings.getState().update({ linkPreviews: true });

    await hover(tile('GitHub'));
    const card = await screen.findByTestId('link-preview');
    expect(
      within(card).getByText('GitHub: where the world builds software'),
    ).toBeInTheDocument();
    expect(card).toHaveTextContent('Build and ship software');
    expect(card).toHaveTextContent('Millions of developers');
    expect(card).toHaveTextContent('100 million developers');
    expect(card).toHaveTextContent('Bookmarks bar');

    await userEvent.unhover(tile('GitHub'));
    await act(() => new Promise((r) => setTimeout(r, LEAVE_GRACE_MS + 50)));
    expect(screen.queryByTestId('link-preview')).toBeNull();
    await hover(tile('GitHub'));
    await screen.findByTestId('link-preview');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('never previews non-web bookmarks', async () => {
    granted = true;
    await renderWithBookmarks(<Dashboard surface="dashboard" />, {
      bar: [{ title: 'Evil', url: 'javascript:alert(1)' }],
    });
    await useSettings.getState().update({ linkPreviews: true });
    await hover(tile('Evil'));
    expect(screen.queryByTestId('link-preview')).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('preview card stability', () => {
  it('stays open when focus changes elsewhere on the page', async () => {
    granted = true;
    await renderWithBookmarks(<Dashboard surface="dashboard" />, SAMPLE_SEED);
    await useSettings.getState().update({ linkPreviews: true });
    await hover(tile('GitHub'));
    await screen.findByTestId('link-preview');
    const search = screen.getByRole('combobox', { name: 'Search bookmarks' });
    act(() => {
      search.focus();
      search.blur();
    });
    expect(screen.getByTestId('link-preview')).toBeInTheDocument();
  });
});

describe('interactive preview card', () => {
  it('stays open when the pointer moves into it, survives scrolling inside, and its buttons open the link', async () => {
    granted = true;
    const create = vi.spyOn(fakeBrowser.windows, 'create').mockResolvedValue({} as never);
    await renderWithBookmarks(<Dashboard surface="dashboard" />, SAMPLE_SEED);
    await useSettings.getState().update({ linkPreviews: true });
    await hover(tile('GitHub'));
    const card = await screen.findByTestId('link-preview');

    // Leave the tile towards the card, arrive within the grace period.
    fireEvent.pointerOut(tile('GitHub'), { relatedTarget: document.body });
    fireEvent.pointerOver(card);
    await act(() => new Promise((r) => setTimeout(r, LEAVE_GRACE_MS + 50)));
    expect(screen.getByTestId('link-preview')).toBeInTheDocument();

    fireEvent.scroll(card.querySelector('[data-preview-scroll]')!);
    expect(screen.getByTestId('link-preview')).toBeInTheDocument();

    await userEvent.click(within(card).getByRole('button', { name: 'Mini window' }));
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://github.com/' }),
    );
    expect(screen.queryByTestId('link-preview')).toBeNull();
  });

  it('closes when scrolling the page or pressing Escape', async () => {
    granted = true;
    await renderWithBookmarks(<Dashboard surface="dashboard" />, SAMPLE_SEED);
    await useSettings.getState().update({ linkPreviews: true });
    await hover(tile('GitHub'));
    await screen.findByTestId('link-preview');
    fireEvent.scroll(document.querySelector('[aria-label="Folder contents"]')!);
    expect(screen.queryByTestId('link-preview')).toBeNull();
    await hover(tile('News'));
    await screen.findByTestId('link-preview');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('link-preview')).toBeNull();
  });
});
