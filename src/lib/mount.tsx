import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/src/styles/global.css';

/** Mounts a React tree into #root. Shared by every page entrypoint. */
export function mount(node: ReactNode): void {
  const container = document.getElementById('root');
  if (!container) throw new Error('Arca: #root element missing');
  createRoot(container).render(<StrictMode>{node}</StrictMode>);
}
