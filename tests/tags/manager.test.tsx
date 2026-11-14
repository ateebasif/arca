import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dashboard } from '@/src/components/Dashboard';
import { parseColors, tagStem } from '@/src/features/tags/meta';
import { deleteTag, lookAlikes, mergeTags } from '@/src/features/tags/manage';
import * as undo from '@/src/features/undo/undo';
import { useOverlays } from '@/src/store/overlays';
import { getMetaStore } from '@/src/store/useMeta';
import { useUi } from '@/src/store/ui';
import { renderWithBookmarks } from '../helpers/render';

const seed = {
  bar: [
    { title: 'A', url: 'https://a.dev/' },
    { title: 'B', url: 'https://b.dev/' },
    { title: 'C', url: 'https://c.dev/' },
  ],
};

async function setup() {
  const r = await renderWithBookmarks(<Dashboard surface="dashboard" />, seed);
  const id = (t: string) => r.fake.findByTitle(t)!.id;
  const meta = getMetaStore();
  await act(async () => {
    await meta.setTags(id('A'), 'https://a.dev/', ['react', 'docs']);
    await meta.setTags(id('B'), 'https://b.dev/', ['reactjs']);
    await meta.setTags(id('C'), 'https://c.dev/', ['React.js', 'food']);
  });
  undo.clearUndoForTests();
  return { ...r, id, meta };
}

describe('tag data for the manager', () => {
  it('spots look-alike tags', () => {
    expect(tagStem('React.js')).toBe('react');
    expect(tagStem('recipes')).toBe('recipe');
    expect(
      lookAlikes([
        { tag: 'react', count: 5 },
        { tag: 'reactjs', count: 2 },
        { tag: 'react.js', count: 1 },
        { tag: 'food', count: 3 },
      ]),
    ).toEqual([['react', 'reactjs', 'react.js']]);
  });

  it('validates stored colours', () => {
    expect([...parseColors({ React: 2, bad: 9, x: 'red', y: 1.5 })]).toEqual([
      ['react', 2],
    ]);
  });
});

describe('tag manager', () => {
  it('merges, renames and deletes across all items, each in one undo', async () => {
    const { id, meta } = await setup();
    await act(() => mergeTags(['reactjs', 'react.js'], 'react'));
    expect(meta.tagsOf(id('B'))).toEqual(['react']);
    expect(meta.tagsOf(id('C'))).toEqual(['food', 'react']);
    expect(meta.idsWithTag('react')).toHaveLength(3);
    await act(async () => void (await undo.undoLast()));
    expect(meta.tagsOf(id('B'))).toEqual(['reactjs']);
    expect(meta.tagsOf(id('C'))).toEqual(['react.js', 'food']);

    await act(() => deleteTag('docs'));
    expect(meta.tagsOf(id('A'))).toEqual(['react']);
    await act(async () => void (await undo.undoLast()));
    expect(meta.tagsOf(id('A'))).toEqual(['react', 'docs']);
  });

  it('opens from the sidebar; renames inline, merges look-alikes, recolours, views', async () => {
    const { id, meta } = await setup();
    const tags = screen.getByRole('region', { name: 'Tags' });
    await userEvent.click(within(tags).getByRole('button', { name: 'Manage' }));
    const dialog = await screen.findByRole('dialog', { name: 'Manage tags' });

    // Look-alikes: one click merges them into the most used.
    const similar = within(dialog).getByRole('region', { name: 'Look-alike tags' });
    await userEvent.click(within(similar).getByRole('button', { name: /Merge into #/ }));
    await vi.waitFor(() =>
      expect(meta.allTags().map((t) => t.tag)).not.toContain('reactjs'),
    );
    expect(meta.idsWithTag('react')).toHaveLength(3);

    // Rename inline.
    await userEvent.click(within(dialog).getByRole('button', { name: '#food' }));
    const input = within(dialog).getByRole('textbox', { name: 'Rename #food' });
    await userEvent.clear(input);
    await userEvent.type(input, 'recipes{Enter}');
    await vi.waitFor(() => expect(meta.tagsOf(id('C'))).toContain('recipes'));

    // Recolour.
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Colour of #recipes' }),
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Teal' }));
    expect(meta.getSnapshot().colors.get('recipes')).toBe(2);

    // View jumps to the tag.
    const row = dialog.querySelector('[data-tag-row="recipes"]') as HTMLElement;
    await userEvent.click(within(row).getByRole('button', { name: 'View' }));
    expect(useUi.getState().tagFilter).toBe('recipes');
    expect(useOverlays.getState().tagManagerOpen).toBe(false);
  });

  it('merges checked tags into a chosen name', async () => {
    const { meta } = await setup();
    act(() => useOverlays.getState().setTagManagerOpen(true));
    const dialog = await screen.findByRole('dialog', { name: 'Manage tags' });
    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Select #docs' }));
    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Select #food' }));
    await userEvent.type(
      within(dialog).getByRole('combobox', { name: 'Merged tag name' }),
      'misc',
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Merge' }));
    await vi.waitFor(() => expect(meta.idsWithTag('misc')).toHaveLength(2));
    expect(meta.allTags().map((t) => t.tag)).not.toContain('docs');
  });
});
