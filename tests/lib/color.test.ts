import { contrastWithWhite, coverGradient, hslToRgb, rgbToHsl } from '@/src/lib/color';

describe('cover colours', () => {
  it('keeps white text at AA contrast for every hue and saturation', () => {
    for (let hue = 0; hue < 360; hue++) {
      for (const saturation of [0, 30, 60, 100]) {
        const { background } = coverGradient({ hue, saturation });
        const [, h, s, l] = background.match(/hsl\((\d+) (\d+)% (\d+)%\)/)!.map(Number);
        expect(contrastWithWhite({ h: h!, s: s!, l: l! })).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('uses a neutral slate for monochrome brands', () => {
    expect(coverGradient({ hue: null, saturation: 0 }).background).toContain('hsl(232');
  });

  it('round-trips rgb and hsl', () => {
    const [r, g, b] = hslToRgb(rgbToHsl(102, 86, 240));
    expect([Math.round(r), Math.round(g), Math.round(b)]).toEqual([102, 86, 240]);
  });
});
