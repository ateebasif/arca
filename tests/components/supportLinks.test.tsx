import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { Dashboard } from '@/src/components/Dashboard';
import { SUPPORT_LINKS } from '@/src/features/support/links';
import { useOverlays } from '@/src/store/overlays';
import { SUPPORT_CARD_AFTER_MS } from '@/src/components/main/HomeView';
import { hydrateSettings, useSettings } from '@/src/store/settings';
import { useUi } from '@/src/store/ui';
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

  it('the sidebar heart opens the coffee link', async () => {
    await renderWithBookmarks(<Dashboard surface="dashboard" />, { bar: [] });
    const create = vi.spyOn(fakeBrowser.tabs, 'create');
    await userEvent.click(screen.getByRole('button', { name: 'Support Arca' }));
    await vi.waitFor(() => expect(create).toHaveBeenCalled());
    expect((create.mock.calls[0]![0] as { url: string }).url).toBe(SUPPORT_LINKS.coffee);
  });

  it('records the first day Arca is used', async () => {
    await hydrateSettings();
    await vi.waitFor(() => expect(useSettings.getState().firstUsedAt).toBeGreaterThan(0));
  });

  it('shows the Home card once, after two weeks, and never after dismissal', async () => {
    await renderWithBookmarks(<Dashboard surface="dashboard" />, { bar: [] });
    // Used for a day: no card.
    await act(() =>
      useSettings.getState().update({ firstUsedAt: Date.now() - 86_400_000 }),
    );
    act(() => useUi.getState().showHome());
    await screen.findByRole('region', { name: 'Recently added' });
    expect(screen.queryByRole('region', { name: 'Enjoying Arca?' })).toBeNull();

    // Two weeks later: the card appears (on the next visit to Home).
    await act(() =>
      useSettings
        .getState()
        .update({ firstUsedAt: Date.now() - SUPPORT_CARD_AFTER_MS - 1 }),
    );
    act(() => useUi.getState().openFolder('1'));
    act(() => useUi.getState().showHome());
    const card = await screen.findByRole('region', { name: 'Enjoying Arca?' });
    await userEvent.click(within(card).getByRole('button', { name: 'No thanks' }));
    expect(useSettings.getState().supportCardDone).toBe(true);
    expect(screen.queryByRole('region', { name: 'Enjoying Arca?' })).toBeNull();
  });
});
