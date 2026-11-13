import { render, screen } from '@testing-library/react';
import { Dashboard } from '@/src/components/Dashboard';
import { Popup } from '@/src/components/Popup';

describe('scaffold smoke', () => {
  it('renders the dashboard for each surface', () => {
    const { rerender } = render(<Dashboard surface="newtab" />);
    expect(screen.getByRole('heading', { name: 'Arca' })).toBeInTheDocument();
    expect(screen.getByText(/New Tab/)).toBeInTheDocument();

    rerender(<Dashboard surface="dashboard" />);
    expect(screen.getByText(/Dashboard/)).toBeInTheDocument();
  });

  it('renders the popup', () => {
    render(<Popup />);
    expect(screen.getByRole('heading', { name: 'Arca' })).toBeInTheDocument();
  });

  it('exposes a fake browser API in tests', async () => {
    await browser.storage.local.set({ ping: 'pong' });
    expect(await browser.storage.local.get('ping')).toEqual({ ping: 'pong' });
  });
});
