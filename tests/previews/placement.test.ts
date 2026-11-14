import { placeCard } from '@/src/components/preview/placement';

const vp = { width: 1280, height: 800 };
const card = { width: 340, height: 300 };
const rect = (left: number, top: number, width: number, height: number) => ({
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height,
});

describe('preview card placement', () => {
  it('puts the card below a list row, aligned with the title, never over it', () => {
    const row = rect(400, 200, 860, 40);
    const p = placeCard(row, card, vp);
    expect(p.top).toBe(242);
    expect(p.left).toBe(432);
  });

  it('flips above a row near the bottom', () => {
    const row = rect(400, 700, 860, 40);
    const p = placeCard(row, card, vp);
    expect(p.top + card.height).toBeLessThanOrEqual(700);
  });

  it('stays inside the window in tight corners', () => {
    const p = placeCard(rect(1100, 760, 900, 30), card, vp);
    expect(p.left + card.width).toBeLessThanOrEqual(vp.width - 8);
    expect(p.top).toBeGreaterThanOrEqual(8);
    // Very short window: the card gets the bigger side and scrolls.
    const short = placeCard(rect(0, 150, 900, 40), card, { width: 1280, height: 400 });
    expect(short.maxHeight).toBeLessThan(card.height);
  });

  it('puts the card beside tiles, then the other side, then below', () => {
    expect(placeCard(rect(100, 100, 180, 144), card, vp).left).toBe(288);
    expect(placeCard(rect(1000, 100, 180, 144), card, vp).left).toBe(652);
    const middle = placeCard(rect(300, 100, 180, 144), card, { width: 700, height: 800 });
    expect(middle.top).toBe(246);
  });
});
