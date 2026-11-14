import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/** Opens a FolderPicker by its label, types to filter and picks `title`. */
export async function pickFolder(scope: HTMLElement, label: string, title: string) {
  await userEvent.click(within(scope).getByRole('button', { name: label }));
  await userEvent.type(screen.getByRole('combobox', { name: 'Find a folder' }), title);
  const list = screen.getByRole('listbox', { name: 'Folders' });
  const option = within(list)
    .getAllByRole('option')
    .find((o) => o.textContent?.split(' · ')[0]?.replace('✓', '').trim() === title);
  if (!option) throw new Error(`No folder option "${title}"`);
  await userEvent.click(option);
}

/** Folder names offered by an open FolderPicker. */
export async function folderChoices(
  scope: HTMLElement,
  label: string,
): Promise<string[]> {
  await userEvent.click(within(scope).getByRole('button', { name: label }));
  return within(screen.getByRole('listbox', { name: 'Folders' }))
    .getAllByRole('option')
    .map((o) => o.textContent?.split(' · ')[0]?.replace('✓', '').trim() ?? '');
}
