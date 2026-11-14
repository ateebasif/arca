import type { CSSProperties } from 'react';
import { tagHue } from './meta';

/** Colour for a tag: one of eight hues, the same everywhere. */
export function tagStyle(tag: string): CSSProperties {
  const hue = [262, 200, 160, 120, 45, 20, 330, 290][tagHue(tag)];
  return {
    color: `hsl(${hue} 70% 68%)`,
    backgroundColor: `hsl(${hue} 70% 60% / 0.14)`,
  };
}
