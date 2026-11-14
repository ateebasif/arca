import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { Popup } from '@/src/components/Popup';
import { readPendingSave, setPendingSave } from '@/src/lib/pendingSave';
import { getMetaStore } from '@/src/store/useMeta';
import { pickFolder } from '../helpers/folderPicker';
import { renderWithBookmarks, SAMPLE_SEED } from '../helpers/render';

beforeEach(() => {
  window.close = vi.fn();
  vi.spyOn(fakeBrowser.tabs, 'query').mockResolvedValue([
    { id: 1, url: 'https://current.dev/', title: 'Current', active: true },
  ] as never);
});

describe('"Add to Arca…" from the right-click menu', () => {
  it('only accepts web pages and expires after two minutes', async () => {
    expect(await setPendingSave({ url: 'javascript:alert(1)', title: 'x' })).toBe(false);
    expect(await readPendingSave()).toBeNull();
    await setPendingSave({ url: 'https://a.dev/', title: 'A' }, 1000);
    expect(await readPendingSave(1000 + 60_000)).toEqual({
      url: 'https://a.dev/',
      title: 'A',
    });
    expect(await readPendingSave(1000 + 3 * 60_000)).toBeNull();
  });

  it('opens the popup as a save box: title, folder, tags, then closes', async () => {
    await setPendingSave({ url: 'https://link.dev/article', title: 'Great article' });
    const { fake } = await renderWithBookmarks(<Popup />, SAMPLE_SEED);
    const box = await screen.findByRole('region', { name: 'Add to Arca' });
    // The usual popup (search, current tab) stays out of the way.
    expect(screen.queryByRole('region', { name: 'Current tab' })).toBeNull();
    const title = within(box).getByRole('textbox', { name: 'Title' });
    expect(title).toHaveValue('Great article');
    await userEvent.clear(title);
    await userEvent.type(title, 'Must read');
    await pickFolder(box, 'Save to folder', 'Recipes');
    await userEvent.type(
      within(box).getByRole('combobox', { name: 'Add tag' }),
      'later{Enter}',
    );
    await userEvent.click(within(box).getByRole('button', { name: 'Save' }));

    await vi.waitFor(() => expect(fake.findByTitle('Must read')).toBeDefined());
    const saved = fake.findByTitle('Must read')!;
    expect(saved).toMatchObject({
      url: 'https://link.dev/article',
      parentId: fake.findByTitle('Recipes')!.id,
    });
    expect(getMetaStore().tagsOf(saved.id)).toEqual(['later']);
    expect(await readPendingSave()).toBeNull();
    await vi.waitFor(() => expect(window.close).toHaveBeenCalled());
  });

  it('Cancel drops it without saving', async () => {
    await setPendingSave({ url: 'https://nope.dev/', title: 'Nope' });
    const { fake } = await renderWithBookmarks(<Popup />, SAMPLE_SEED);
    const box = await screen.findByRole('region', { name: 'Add to Arca' });
    await userEvent.click(within(box).getByRole('button', { name: 'Cancel' }));
    await vi.waitFor(() => expect(window.close).toHaveBeenCalled());
    expect(fake.findByTitle('Nope')).toBeUndefined();
    expect(await readPendingSave()).toBeNull();
  });
});
