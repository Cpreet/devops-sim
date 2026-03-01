// ── Isometric math helpers ──────────────────────────────────────────────
// All visual positions derive from these two functions plus the constants.

export const TILE_W = 160;
export const TILE_H = 80;
export const GRID_SIZE = 8;

/** Convert grid coords → screen pixel position (centre of diamond). */
export function gridToScreen(
  gx: number,
  gy: number,
  tileW: number = TILE_W,
  tileH: number = TILE_H,
): { x: number; y: number } {
  return {
    x: (gx - gy) * (tileW / 2),
    y: (gx + gy) * (tileH / 2),
  };
}

/** Convert screen pixel position → nearest grid coords (rounded). */
export function screenToGrid(
  sx: number,
  sy: number,
  tileW: number = TILE_W,
  tileH: number = TILE_H,
): { gx: number; gy: number } {
  const gx = Math.round(sx / (tileW / 2) + sy / (tileH / 2)) / 2;
  const gy = Math.round(sy / (tileH / 2) - sx / (tileW / 2)) / 2;
  return {
    gx: Math.round(gx),
    gy: Math.round(gy),
  };
}

/** Always true — the canvas is infinite. */
export function inBounds(_gx: number, _gy: number): boolean {
  return true;
}
