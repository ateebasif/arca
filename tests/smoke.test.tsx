import { render, screen } from '@testing-library/react';
import { Popup } from '@/src/components/Popup';

describe('scaffold smoke', () => {
  it('renders the popup', () => {
    render(<Popup />);
    expect(screen.getByRole('heading', { name: 'Arca' })).toBeInTheDocument();
  });

  it('exposes a fake browser API in tests', async () => {
    await browser.storage.local.set({ ping: 'pong' });
    expect(await browser.storage.local.get('ping')).toEqual({ ping: 'pong' });
  });
});
