import { gridToScreen, TILE_W, TILE_H } from '../iso/isoMath';
import { node as nodeTokens, selection, status, KIND_LABELS } from '../../theme/tokens';
import type { SimNode, NodeKind } from '../../sim/types';

const ICON_KEYS: Record<NodeKind, string> = {
    LB: 'icon-lb',
    API: 'icon-api',
    DB: 'icon-db',
    CACHE: 'icon-cache',
    QUEUE: 'icon-queue',
    WORKER: 'icon-worker',
};

const ICON_SIZE = 88;

export function preloadNodeIcons(scene: Phaser.Scene): void {
    scene.load.svg('icon-lb', 'icons/lb.svg', { width: ICON_SIZE, height: ICON_SIZE });
    scene.load.svg('icon-api', 'icons/api.svg', { width: ICON_SIZE, height: ICON_SIZE });
    scene.load.svg('icon-db', 'icons/db.svg', { width: ICON_SIZE, height: ICON_SIZE });
    scene.load.svg('icon-cache', 'icons/cache.svg', { width: ICON_SIZE, height: ICON_SIZE });
    scene.load.svg('icon-queue', 'icons/queue.svg', { width: ICON_SIZE, height: ICON_SIZE });
    scene.load.svg('icon-worker', 'icons/worker.svg', { width: ICON_SIZE, height: ICON_SIZE });
}

export function drawNode(
    scene: Phaser.Scene,
    nodeLayer: Phaser.GameObjects.Container,
    n: SimNode,
    isSelected: boolean,
    isError: boolean,
    isWarning: boolean,
    originX: number,
    originY: number,
): void {
    const pos = gridToScreen(n.gx, n.gy);
    const sx = originX + pos.x;
    const sy = originY + pos.y;
    const tokens = nodeTokens[n.kind];
    const gfx = scene.add.graphics();

    // 1. Drop shadow
    gfx.fillStyle(0x000000, 0.06);
    gfx.fillEllipse(sx + 2, sy + 6, TILE_W * 0.48, TILE_H * 0.22);

    // 2. Base plate (isometric diamond)
    const padHW = TILE_W * 0.42;
    const padHH = TILE_H * 0.42;
    const plateAlpha = isSelected ? 0.18 : 0.1;
    gfx.fillStyle(tokens.base, plateAlpha);
    gfx.beginPath();
    gfx.moveTo(sx, sy - padHH + 4);
    gfx.lineTo(sx + padHW, sy + 4);
    gfx.lineTo(sx, sy + padHH + 4);
    gfx.lineTo(sx - padHW, sy + 4);
    gfx.closePath();
    gfx.fillPath();

    gfx.lineStyle(1.5, tokens.base, 0.25);
    gfx.beginPath();
    gfx.moveTo(sx, sy - padHH + 4);
    gfx.lineTo(sx + padHW, sy + 4);
    gfx.lineTo(sx, sy + padHH + 4);
    gfx.lineTo(sx - padHW, sy + 4);
    gfx.closePath();
    gfx.strokePath();

    // 3. Icon (no covering body)
    const iconDisplaySize = 72;
    const iconKey = ICON_KEYS[n.kind];
    if (scene.textures.exists(iconKey)) {
        const icon = scene.add.image(sx, sy - 6, iconKey);
        icon.setDisplaySize(iconDisplaySize, iconDisplaySize);
        icon.setTint(0xffffff);
        icon.setAlpha(0.95);
        nodeLayer.add(icon);
    }

    // 4. Saturation glow ring
    if (n.state.saturation > 0.6) {
        const glowAlpha = Math.min((n.state.saturation - 0.6) * 2.5, 0.8);
        const glowColor = n.state.saturation > 0.9 ? status.error.hex : status.warn.hex;
        gfx.lineStyle(2.5, glowColor, glowAlpha);
        gfx.strokeCircle(sx, sy - 6, 44);
    }

    nodeLayer.add(gfx);

    // 5. Selection / error / warning ring
    if (isSelected || isError || isWarning) {
        const outline = scene.add.graphics();
        let outColor = selection.color;
        let ringWidth = selection.ringWidth;
        if (isError) { outColor = status.error.hex; ringWidth = 2; }
        else if (isWarning) { outColor = status.warn.hex; ringWidth = 2; }

        outline.lineStyle(ringWidth, outColor, 0.85);
        const rhw = TILE_W * 0.46;
        const rhh = TILE_H * 0.46;
        outline.beginPath();
        outline.moveTo(sx, sy - rhh + 2);
        outline.lineTo(sx + rhw, sy + 2);
        outline.lineTo(sx, sy + rhh + 2);
        outline.lineTo(sx - rhw, sy + 2);
        outline.closePath();
        outline.strokePath();
        nodeLayer.add(outline);
    }

    // 6. Status indicator dot
    const statusDotX = sx + 32;
    const statusDotY = sy - 34;
    const dotGfx = scene.add.graphics();
    let dotColor = status.ok.hex;
    if (isError) dotColor = status.error.hex;
    else if (isWarning) dotColor = status.warn.hex;
    else if (n.state.saturation > 0.6) dotColor = status.warn.hex;
    dotGfx.fillStyle(dotColor, 0.9);
    dotGfx.fillCircle(statusDotX, statusDotY, 3.5);
    nodeLayer.add(dotGfx);

    // 7. Label plate
    const labelBgGfx = scene.add.graphics();
    const labelText = KIND_LABELS[n.kind];
    const label = scene.add.text(sx, sy + padHH + 2, labelText, {
        fontFamily: "'Inter', system-ui, sans-serif",
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#1a2233',
        align: 'center',
    });
    label.setOrigin(0.5, 0);

    const lw = label.width + 10;
    const lh = label.height + 4;
    labelBgGfx.fillStyle(0xffffff, 0.88);
    labelBgGfx.fillRoundedRect(sx - lw / 2, sy + padHH, lw, lh, 3);
    labelBgGfx.lineStyle(1, 0xd0d5e0, 0.5);
    labelBgGfx.strokeRoundedRect(sx - lw / 2, sy + padHH, lw, lh, 3);

    nodeLayer.add(labelBgGfx);
    nodeLayer.add(label);
}
