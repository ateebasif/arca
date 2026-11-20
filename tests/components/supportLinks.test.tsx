import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { Dashboard } from '@/src/components/Dashboard';
import { SUPPORT_LINKS } from '@/src/features/support/links';
import { useOverlays } from '@/src/store/overlays';
import { renderWithBookmarks } from '../helpers/render';

describe('Support Arca', () => {
  it('opens the Patreon links in a new tab from Settings', async () => {
    await renderWithBookmarks(<Dashboard surface="dashboard" />, { bar: [] });
    act(() => useOverlays.getState().openSettings());
    const section = await screen.findByRole('region', { name: 'Support Arca' });
    const create = vi.spyOn(fakeBrowser.tabs, 'create');
    await userEvent.click(
      within(section).getByRole('button', { name: /Buy me a coffee/ }),
    );
    await userEvent.click(
      within(section).getByRole('button', { name: 'Become a supporter' }),
    );
    await vi.waitFor(() => expect(create).toHaveBeenCalledTimes(2));
    expect(create.mock.calls.map(([p]) => (p as { url: string }).url)).toEqual([
      SUPPORT_LINKS.coffee,
      SUPPORT_LINKS.patreon,
    ]);
  });
});
