/**
 * Where a preview card goes next to the item it previews, kept fully on
 * screen. Wide anchors (list rows) get the card below the row, or above when
 * there's no room, aligned with the title; tiles get it beside them, falling
 * back to below/above in tight corners. `maxHeight` caps the card to the
 * space it got (its content scrolls).
 */
export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface Placement {
  left: number;
  top: number;
  maxHeight: number;
}

const GAP = 8;
/** Below/above a row the card touches it, so the pointer never crosses another row. */
const ROW_GAP = 2;
const MARGIN = 8;

export function placeCard(
  anchor: Rect,
  card: { width: number; height: number },
  viewport: { width: number; height: number },
): Placement {
  const clampX = (x: number) =>
    Math.max(MARGIN, Math.min(x, viewport.width - card.width - MARGIN));
  const below = viewport.height - anchor.bottom - ROW_GAP - MARGIN;
  const above = anchor.top - ROW_GAP - MARGIN;
  const vertical = (): Placement => {
    // Prefer below; go above when the card fits there but not below, or there's more room.
    if (card.height <= below || below >= above) {
      return {
        left: clampX(anchor.left + 32),
        top: anchor.bottom + ROW_GAP,
        maxHeight: Math.max(120, below),
      };
    }
    const h = Math.min(card.height, above);
    return {
      left: clampX(anchor.left + 32),
      top: Math.max(MARGIN, anchor.top - ROW_GAP - h),
      maxHeight: Math.max(120, above),
    };
  };

  const wide = anchor.width > card.width * 1.4;
  if (wide) return vertical();

  const fullHeight = viewport.height - 2 * MARGIN;
  const top = Math.max(
    MARGIN,
    Math.min(anchor.top, viewport.height - card.height - MARGIN),
  );
  if (anchor.right + GAP + card.width <= viewport.width - MARGIN) {
    return { left: anchor.right + GAP, top, maxHeight: fullHeight };
  }
  if (anchor.left - GAP - card.width >= MARGIN) {
    return { left: anchor.left - GAP - card.width, top, maxHeight: fullHeight };
  }
  return vertical();
}
