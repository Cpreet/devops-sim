import type Phaser from 'phaser';
import { radial as tokens } from '../../theme/tokens';

export type RadialAction = 'stats' | 'config' | 'move' | 'delete';

export interface RadialOption {
    id: RadialAction;
    label: string;
    icon: string;
}

export const RADIAL_OPTIONS: RadialOption[] = [
    { id: 'stats', label: 'Stats', icon: '📊' },
    { id: 'config', label: 'Config', icon: '⚙' },
    { id: 'move', label: 'Move', icon: '✥' },
    { id: 'delete', label: 'Delete', icon: '✕' },
];

export interface RadialLayout {
    cx: number;
    cy: number;
    radius: number;
}

export function drawRadialMenu(
    gfx: Phaser.GameObjects.Graphics,
    layout: RadialLayout,
    selectedIndex: number,
): void {
    gfx.clear();
    const { cx, cy, radius } = layout;
    const innerRadius = radius * tokens.innerRatio;
    const slice = (Math.PI * 2) / RADIAL_OPTIONS.length;

    // Outer shadow
    gfx.fillStyle(0x000000, 0.10);
    gfx.fillCircle(cx + 2, cy + 3, radius + 4);

    // Outer ring border
    gfx.fillStyle(tokens.stroke, 0.3);
    gfx.fillCircle(cx, cy, radius + 1);

    for (let i = 0; i < RADIAL_OPTIONS.length; i++) {
        const start = -Math.PI / 2 + i * slice;
        const end = start + slice;
        const isSelected = i === selectedIndex;
        const fill = isSelected ? tokens.selectedFill : tokens.bgFill;
        const fillAlpha = isSelected ? tokens.selectedAlpha + 0.85 : tokens.bgAlpha;

        gfx.fillStyle(fill, fillAlpha);
        gfx.lineStyle(1, tokens.stroke, 0.4);
        gfx.slice(cx, cy, radius, start, end, false);
        gfx.lineTo(cx, cy);
        gfx.closePath();
        gfx.fillPath();
        gfx.strokePath();
    }

    // Separator lines between slices
    gfx.lineStyle(1, tokens.stroke, 0.25);
    for (let i = 0; i < RADIAL_OPTIONS.length; i++) {
        const angle = -Math.PI / 2 + i * slice;
        const ex = cx + Math.cos(angle) * radius;
        const ey = cy + Math.sin(angle) * radius;
        const ix = cx + Math.cos(angle) * innerRadius;
        const iy = cy + Math.sin(angle) * innerRadius;
        gfx.beginPath();
        gfx.moveTo(ix, iy);
        gfx.lineTo(ex, ey);
        gfx.strokePath();
    }

    // Center circle
    gfx.fillStyle(tokens.centerFill, 1);
    gfx.lineStyle(1.5, tokens.centerStroke, 0.5);
    gfx.fillCircle(cx, cy, innerRadius);
    gfx.strokeCircle(cx, cy, innerRadius);
}

export function radialIndexFromPointer(
    px: number,
    py: number,
    layout: RadialLayout,
): number | null {
    const dx = px - layout.cx;
    const dy = py - layout.cy;
    const dist = Math.hypot(dx, dy);
    if (dist < layout.radius * tokens.innerRatio || dist > layout.radius) return null;

    const rawAngle = Math.atan2(dy, dx);
    const normalized = rawAngle < -Math.PI / 2 ? rawAngle + Math.PI * 2 : rawAngle;
    const adjusted = normalized + Math.PI / 2;
    const slice = (Math.PI * 2) / RADIAL_OPTIONS.length;
    return Math.floor(adjusted / slice) % RADIAL_OPTIONS.length;
}
