import { createContext } from 'react';

/** Lists longer than this are virtualized (PRD §10). */
export const VIRTUALIZE_OVER = 200;

/** The element that scrolls the folder contents (provided by the Dashboard). */
export const ScrollParentContext = createContext<HTMLElement | null>(null);
