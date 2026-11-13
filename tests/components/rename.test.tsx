import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dashboard } from '@/src/components/Dashboard';
import { useUi } from '@/src/store/ui';
import { act } from '@testing-library/react';
import { renderWithBookmarks } from '../helpers/render';

// A folder that shows both in the sidebar tree and as a card in the main view.
const seed = {
  bar: [
    { title: 'TimeSeriesAnalysis', children: [{ title: 'A', url: 'https://a.dev/' }] },
  ],
};

describe('rename from the item menu', () => {
  it('renames the folder card, not its sidebar copy as well', async () => {
    const { fake } = await renderWithBookmarks(<Dashboard surface="dashboard" />, seed);
    act(() => useUi.getState().openFolder('1'));
    const card = await screen.findByRole('button', { name: /^TimeSeriesAnalysis,/ });
    fireEvent.contextMenu(card);
    await userEvent.click(await screen.findByRole('menuitem', { name: /Rename/ }));

    const inputs = screen.getAllByRole('textbox', { name: 'Name' });
    expect(inputs).toHaveLength(1);
    expect(inputs[0]).toHaveFocus();
    expect(screen.getByRole('tree', { name: 'Folders' })).not.toContainElement(
      inputs[0]!,
    );
    await userEvent.clear(inputs[0]!);
    await userEvent.type(inputs[0]!, 'Time Series{Enter}');
    await vi.waitFor(() => expect(fake.findByTitle('Time Series')).toBeDefined());
  });

  it('renames in the sidebar when started there', async () => {
    await renderWithBookmarks(<Dashboard surface="dashboard" />, seed);
    act(() => useUi.getState().openFolder('1'));
    const tree = screen.getByRole('tree', { name: 'Folders' });
    const row = await within(tree).findByText('TimeSeriesAnalysis');
    fireEvent.contextMenu(row);
    await userEvent.click(await screen.findByRole('menuitem', { name: /Rename/ }));
    const inputs = screen.getAllByRole('textbox', { name: 'Name' });
    expect(inputs).toHaveLength(1);
    expect(tree).toContainElement(inputs[0]!);
    expect(inputs[0]).toHaveFocus();
  });
});
