import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dashboard } from '@/src/components/Dashboard';
import { storageGet, storageSet } from '@/src/lib/storage';
import { applyCachedTheme } from '@/src/lib/theme';
import { hydrateSettings, useSettings } from '@/src/store/settings';
import { renderWithBookmarks, SAMPLE_SEED } from '../helpers/render';

const root = () => document.documentElement;

describe('theme', () => {
  afterEach(() => {
    delete root().dataset.theme;
    localStorage.clear();
  });

  it('switches between system, light and dark, and saves the choice', async () => {
    await renderWithBookmarks(<Dashboard surface="dashboard" />, SAMPLE_SEED);
    const group = screen.getAllByRole('radiogroup', { name: 'Theme' })[0]!;
    await userEvent.click(within(group).getByRole('radio', { name: 'Dark' }));
    expect(root().dataset.theme).toBe('dark');
    expect(within(group).getByRole('radio', { name: 'Dark' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(await storageGet('settings', {})).toMatchObject({ theme: 'dark' });
    expect(localStorage.getItem('arca-theme')).toBe('dark');

    await userEvent.click(within(group).getByRole('radio', { name: 'Light' }));
    expect(root().dataset.theme).toBe('light');
    await userEvent.click(within(group).getByRole('radio', { name: 'Match system' }));
    expect(root().dataset.theme).toBeUndefined();
  });

  it('applies the cached theme synchronously before settings load', () => {
    localStorage.setItem('arca-theme', 'dark');
    applyCachedTheme();
    expect(root().dataset.theme).toBe('dark');
    localStorage.setItem('arca-theme', '"><script>');
    delete root().dataset.theme;
    applyCachedTheme();
    expect(root().dataset.theme).toBeUndefined();
  });

  it('follows theme changes made in another Arca tab', async () => {
    await hydrateSettings();
    await act(() => storageSet('settings', { theme: 'dark' }));
    expect(useSettings.getState().theme).toBe('dark');
    expect(root().dataset.theme).toBe('dark');
  });
});
