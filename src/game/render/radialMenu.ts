import type Phaser from 'phaser';

export type RadialAction = 'stats' | 'config' | 'move' | 'delete';

export interface RadialOption {
    id: RadialAction;
    label: string;
}

export const RADIAL_OPTIONS: RadialOption[] = [
    { id: 'stats', label: 'Stats' },
    { id: 'config', label: 'Config' },
    { id: 'move', label: 'Move' },
    { id: 'delete', label: 'Delete' },
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
    const innerRadius = radius * 0.45;
    const slice = (Math.PI * 2) / RADIAL_OPTIONS.length;

    for (let i = 0; i < RADIAL_OPTIONS.length; i++) {
        const start = -Math.PI / 2 + i * slice;
        const end = start + slice;
        const isSelected = i === selectedIndex;
        const fill = isSelected ? 0x2a4f7a : 0x101828;
        const stroke = isSelected ? 0x4fc3f7 : 0x2a3a5c;

        gfx.fillStyle(fill, 0.9);
        gfx.lineStyle(1.5, stroke, 1);
        gfx.slice(cx, cy, radius, start, end, false);
        gfx.lineTo(cx, cy);
        gfx.closePath();
        gfx.fillPath();
        gfx.strokePath();
    }

    gfx.fillStyle(0x0a0e1a, 1);
    gfx.lineStyle(1.5, 0x3a4a6a, 1);
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
    if (dist < layout.radius * 0.45 || dist > layout.radius) return null;

    const rawAngle = Math.atan2(dy, dx);
    const normalized = rawAngle < -Math.PI / 2 ? rawAngle + Math.PI * 2 : rawAngle;
    const adjusted = normalized + Math.PI / 2;
    const slice = (Math.PI * 2) / RADIAL_OPTIONS.length;
    return Math.floor(adjusted / slice) % RADIAL_OPTIONS.length;
}
