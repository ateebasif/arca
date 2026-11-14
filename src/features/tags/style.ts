import type { CSSProperties } from 'react';
import { tagHue } from './meta';

/** The eight tag colours (hues), in the order the colour picker shows them. */
export const TAG_HUES = [262, 200, 160, 120, 45, 20, 330, 290] as const;
export const TAG_COLOR_NAMES = [
  'Violet',
  'Blue',
  'Teal',
  'Green',
  'Amber',
  'Orange',
  'Pink',
  'Purple',
] as const;

/** Colour slot for a tag: the one you picked, else a stable default. */
export function tagSlot(tag: string, colors?: ReadonlyMap<string, number>): number {
  return colors?.get(tag) ?? tagHue(tag);
}

export function tagStyle(
  tag: string,
  colors?: ReadonlyMap<string, number>,
): CSSProperties {
  const hue = TAG_HUES[tagSlot(tag, colors)];
  return {
    color: `hsl(${hue} 70% 68%)`,
    backgroundColor: `hsl(${hue} 70% 60% / 0.14)`,
  };
}
