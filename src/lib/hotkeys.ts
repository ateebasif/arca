import { useEffect, useLayoutEffect, useRef } from 'react';

/**
 * Tiny shortcut helper. Combos look like "mod+k", "mod+shift+n", "/", "f2".
 * `mod` is ⌘ on macOS and Ctrl elsewhere.
 */

const isMac =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

export function matchesCombo(event: KeyboardEvent, combo: string): boolean {
  const parts = combo.toLowerCase().split('+');
  const key = parts.pop();
  const want = new Set(parts);
  const mod = isMac ? event.metaKey : event.ctrlKey;
  const otherMod = isMac ? event.ctrlKey : event.metaKey;
  if (otherMod || want.has('mod') !== mod) return false;
  if (want.has('alt') !== event.altKey) return false;
  // Punctuation like "?" already implies shift, so only check shift for
  // letters, digits and named keys.
  const isSymbol = key !== undefined && key.length === 1 && !/[a-z0-9]/.test(key);
  if (!isSymbol && want.has('shift') !== event.shiftKey) return false;
  return event.key.toLowerCase() === key;
}

/** True when focus is in a text field, where plain-key shortcuts must not fire. */
export function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT'
  );
}

export interface HotkeyOptions {
  /** Fire even while typing in a field (for modifier combos like ⌘K). */
  allowInInputs?: boolean;
}

/** A handler returns `false` to let the event through to other handlers. */
export type HotkeyHandler = (event: KeyboardEvent) => unknown;

/** Binds window-level shortcuts. */
export function useHotkeys(
  bindings: Record<string, HotkeyHandler>,
  options: HotkeyOptions = {},
): void {
  const ref = useRef(bindings);
  useLayoutEffect(() => {
    ref.current = bindings;
  });
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      for (const [combo, handler] of Object.entries(ref.current)) {
        if (!matchesCombo(event, combo)) continue;
        const plain = !combo.includes('mod') && !combo.includes('alt');
        if (plain && !options.allowInInputs && isTyping(event.target)) continue;
        if (handler(event) === false) continue;
        event.preventDefault();
        return;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [options.allowInInputs]);
}
