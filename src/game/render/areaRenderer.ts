import { gridToScreen, TILE_W, TILE_H } from '../iso/isoMath';
import { area as areaTokens } from '../../theme/tokens';
import type { SimArea } from '../../sim/types';

export function drawArea(
    gfx: Phaser.GameObjects.Graphics,
    nodeLayer: Phaser.GameObjects.Container,
    scene: Phaser.Scene,
    a: SimArea,
    originX: number,
    originY: number,
): void {
    const tokens = areaTokens[a.kind];
    if (!tokens) return;

    const x0 = a.x - 0.5;
    const y0 = a.y - 0.5;
    const x1 = a.x + a.w - 0.5;
    const y1 = a.y + a.h - 0.5;
    const p1 = gridToScreen(x0, y0);
    const p2 = gridToScreen(x1, y0);
    const p3 = gridToScreen(x1, y1);
    const p4 = gridToScreen(x0, y1);

    const ox = originX;
    const oy = originY;

    // Translucent region fill
    gfx.fillStyle(tokens.fill, tokens.fillAlpha);
    gfx.beginPath();
    gfx.moveTo(ox + p1.x, oy + p1.y);
    gfx.lineTo(ox + p2.x, oy + p2.y);
    gfx.lineTo(ox + p3.x, oy + p3.y);
    gfx.lineTo(ox + p4.x, oy + p4.y);
    gfx.closePath();
    gfx.fillPath();

    // Top edge highlight for depth
    gfx.lineStyle(1.5, tokens.stroke, tokens.strokeAlpha * 0.5);
    gfx.beginPath();
    gfx.moveTo(ox + p4.x, oy + p4.y);
    gfx.lineTo(ox + p1.x, oy + p1.y);
    gfx.lineTo(ox + p2.x, oy + p2.y);
    gfx.strokePath();

    // Border
    gfx.lineStyle(2, tokens.stroke, tokens.strokeAlpha);
    gfx.beginPath();
    gfx.moveTo(ox + p1.x, oy + p1.y);
    gfx.lineTo(ox + p2.x, oy + p2.y);
    gfx.lineTo(ox + p3.x, oy + p3.y);
    gfx.lineTo(ox + p4.x, oy + p4.y);
    gfx.closePath();
    gfx.strokePath();

    // Title chip at top corner
    const chipX = ox + p1.x;
    const chipY = oy + p1.y - 6;
    const chipPad = 6;
    const chipText = a.label.toUpperCase();

    const labelObj = scene.add.text(chipX, chipY, chipText, {
        fontFamily: "'Inter', system-ui, sans-serif",
        fontSize: '10px',
        fontStyle: 'bold',
        color: tokens.labelText,
        backgroundColor: tokens.labelBg,
        padding: { x: chipPad, y: 3 },
    });
    labelObj.setOrigin(0.5, 0.5);
    labelObj.setAlpha(0.85);
    nodeLayer.add(labelObj);
}
