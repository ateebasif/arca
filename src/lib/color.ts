/** Small colour helpers for tile covers. */

export interface Hsl {
  h: number;
  s: number;
  l: number;
}

export function hslToRgb({ h, s, l }: Hsl): [number, number, number] {
  const sat = s / 100;
  const lig = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(lig, 1 - lig);
  const f = (n: number) =>
    lig - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}

export function rgbToHsl(r: number, g: number, b: number): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: l * 100 };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return { h: h * 60, s: s * 100, l: l * 100 };
}

function luminance([r, g, b]: [number, number, number]): number {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Contrast ratio of white text on this colour. */
export function contrastWithWhite(color: Hsl): number {
  return 1.05 / (luminance(hslToRgb(color)) + 0.05);
}

const css = ({ h, s, l }: Hsl) =>
  `hsl(${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}%)`;

/** Cover tone: `hue` null means a neutral (monochrome) brand. */
export interface CoverTone {
  hue: number | null;
  saturation: number;
}

/**
 * Gradient for a tile cover in the brand's hue, darkened until white text on
 * its lightest stop reaches WCAG AA (4.5:1).
 */
export function coverGradient(tone: CoverTone): { background: string; glow: string } {
  if (tone.hue === null) {
    return {
      background: 'linear-gradient(135deg, hsl(232 14% 27%), hsl(232 16% 17%))',
      glow: 'hsl(232 30% 60% / 0.35)',
    };
  }
  const s = Math.min(78, Math.max(48, tone.saturation));
  let top: Hsl = { h: tone.hue, s, l: 50 };
  while (contrastWithWhite(top) < 4.5 && top.l > 18) top = { ...top, l: top.l - 2 };
  const bottom: Hsl = { h: (tone.hue + 18) % 360, s, l: Math.max(12, top.l - 13) };
  return {
    background: `linear-gradient(135deg, ${css(top)}, ${css(bottom)})`,
    glow: `hsl(${Math.round(tone.hue)} ${Math.round(s)}% 55% / 0.45)`,
  };
}
