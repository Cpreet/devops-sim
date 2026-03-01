import * as Phaser from 'phaser';
import type { SimSnapshot } from '../../sim/types';
import { buildEdgeRoute, routeToScreen, samplePointOnRoute } from './edgeRouting';

const EDGE_GLOW_COLOR = 0x4fc3f7;
const EDGE_COLOR = 0x4a5a8a;
const WARNING_COLOR = 0xc49a3c;
const ERROR_COLOR = 0xc0675a;
const ACTIVE_COLOR = 0x69d1ff;

type EdgeStyle = {
    color: number;
    glowColor: number;
    coreAlpha: number;
    glowAlpha: number;
    width: number;
};

function resolveEdgeStyle(
    hasError: boolean,
    hasWarning: boolean,
    isActive: boolean,
    isSelected: boolean,
): EdgeStyle {
    let color = EDGE_COLOR;
    let glowColor = EDGE_GLOW_COLOR;
    let coreAlpha = 0.65;
    let glowAlpha = 0.15;
    let width = 1.5;

    if (hasError) {
        color = ERROR_COLOR;
        glowColor = ERROR_COLOR;
        coreAlpha = 0.8;
        glowAlpha = 0.25;
    } else if (hasWarning) {
        color = WARNING_COLOR;
        glowColor = WARNING_COLOR;
        coreAlpha = 0.75;
        glowAlpha = 0.22;
    } else if (isActive) {
        color = ACTIVE_COLOR;
        glowColor = ACTIVE_COLOR;
        coreAlpha = 0.8;
        glowAlpha = 0.2;
    }

    if (isSelected) {
        width = 2.2;
        coreAlpha = Math.min(1, coreAlpha + 0.15);
    }

    return { color, glowColor, coreAlpha, glowAlpha, width };
}

function drawPolyline(gfx: Phaser.GameObjects.Graphics, points: Array<{ x: number; y: number }>): void {
    if (points.length < 2) return;
    gfx.beginPath();
    gfx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
        gfx.lineTo(points[i].x, points[i].y);
    }
    gfx.strokePath();
}

function drawArrowHead(
    gfx: Phaser.GameObjects.Graphics,
    points: Array<{ x: number; y: number }>,
    color: number,
): void {
    if (points.length < 2) return;
    const tip = points[points.length - 1];
    const prev = points[points.length - 2];
    const dx = tip.x - prev.x;
    const dy = tip.y - prev.y;
    const len = Math.hypot(dx, dy);
    if (len <= 0) return;

    const nx = dx / len;
    const ny = dy / len;
    const px = -ny;
    const py = nx;
    const size = 6;
    const offset = 12;
    const ax = tip.x - nx * offset;
    const ay = tip.y - ny * offset;

    gfx.fillStyle(color, 0.95);
    gfx.fillTriangle(
        ax,
        ay,
        ax - nx * size + px * size * 0.55,
        ay - ny * size + py * size * 0.55,
        ax - nx * size - px * size * 0.55,
        ay - ny * size - py * size * 0.55,
    );
}

export function drawFlowEdges(
    gfx: Phaser.GameObjects.Graphics,
    snap: SimSnapshot,
    originX: number,
    originY: number,
): void {
    gfx.clear();
    const nodeById = new Map(snap.nodes.map((n) => [n.id, n]));
    const selectedId = snap.selectedNodeId;

    for (const e of snap.edges) {
        const from = nodeById.get(e.from);
        const to = nodeById.get(e.to);
        if (!from || !to) continue;

        const issues = snap.validation.issues.filter(
            (i) => i.nodeIds?.includes(from.id) || i.nodeIds?.includes(to.id),
        );
        const hasError = issues.some((i) => i.severity === 'error');
        const hasWarning = !hasError && issues.some((i) => i.severity === 'warning');
        const isActive = from.state.outRps > 0;
        const isSelected = selectedId === from.id || selectedId === to.id;
        const style = resolveEdgeStyle(hasError, hasWarning, isActive, isSelected);

        const route = buildEdgeRoute(from, to, snap.areas);
        const screenPoints = routeToScreen(route, originX, originY);

        gfx.lineStyle(style.width + 2, style.glowColor, style.glowAlpha);
        drawPolyline(gfx, screenPoints);

        gfx.lineStyle(style.width, style.color, style.coreAlpha);
        drawPolyline(gfx, screenPoints);
        drawArrowHead(gfx, screenPoints, style.color);
    }
}

export function drawFlowPulses(
    gfx: Phaser.GameObjects.Graphics,
    snap: SimSnapshot,
    originX: number,
    originY: number,
    time: number,
): void {
    gfx.clear();
    const nodeById = new Map(snap.nodes.map((n) => [n.id, n]));

    for (const e of snap.edges) {
        const from = nodeById.get(e.from);
        const to = nodeById.get(e.to);
        if (!from || !to) continue;

        const flowRate = from.state.outRps;
        if (flowRate <= 0) continue;

        const route = buildEdgeRoute(from, to, snap.areas);
        const screenPoints = routeToScreen(route, originX, originY);

        const speed = 0.0008 * (1 + Math.log10(flowRate + 1));
        const pulseCount = Math.min(4, Math.max(1, Math.floor(Math.log10(flowRate + 1))));

        for (let i = 0; i < pulseCount; i++) {
            const phase = i / pulseCount;
            const t = (time * speed + phase) % 1;
            const p = samplePointOnRoute(screenPoints, t);
            if (!p) continue;
            gfx.fillStyle(0xffffff, 0.8);
            gfx.fillCircle(p.x, p.y, 2.2);
        }
    }
}
