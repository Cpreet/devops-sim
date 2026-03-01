import * as Phaser from 'phaser';
import type { SimSnapshot } from '../../sim/types';
import { buildEdgeRoute, routeToScreen, samplePointOnRoute } from './edgeRouting';
import { edge as edgeTokens, node as nodeTokens } from '../../theme/tokens';

type EdgeStyle = {
    color: number;
    alpha: number;
    width: number;
};

function resolveEdgeStyle(
    hasError: boolean,
    hasWarning: boolean,
    isActive: boolean,
    isSelected: boolean,
): EdgeStyle {
    let color = edgeTokens.default.color;
    let alpha = edgeTokens.default.alpha;
    let width = edgeTokens.default.width;

    if (hasError) {
        color = edgeTokens.error.color;
        alpha = edgeTokens.error.alpha;
    } else if (hasWarning) {
        color = edgeTokens.warning.color;
        alpha = edgeTokens.warning.alpha;
    } else if (isActive) {
        color = edgeTokens.active.color;
        alpha = edgeTokens.active.alpha;
    }

    if (isSelected) {
        width += edgeTokens.selected.widthAdd;
        alpha = Math.min(1, alpha + edgeTokens.selected.alphaAdd);
    }

    return { color, alpha, width };
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
    alpha: number,
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
    const size = edgeTokens.arrowSize;
    const offset = edgeTokens.arrowOffset;
    const ax = tip.x - nx * offset;
    const ay = tip.y - ny * offset;

    gfx.fillStyle(color, alpha);
    gfx.fillTriangle(
        ax,
        ay,
        ax - nx * size + px * size * 0.5,
        ay - ny * size + py * size * 0.5,
        ax - nx * size - px * size * 0.5,
        ay - ny * size - py * size * 0.5,
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

        // Shadow line for depth
        gfx.lineStyle(style.width + edgeTokens.shadow.widthAdd, edgeTokens.shadow.color, edgeTokens.shadow.alpha);
        drawPolyline(gfx, screenPoints);

        // Core line
        gfx.lineStyle(style.width, style.color, style.alpha);
        drawPolyline(gfx, screenPoints);

        // Arrowhead
        drawArrowHead(gfx, screenPoints, style.color, style.alpha);
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

        const pulseColor = nodeTokens[from.kind]?.base ?? edgeTokens.active.color;

        for (let i = 0; i < pulseCount; i++) {
            const phase = i / pulseCount;
            const t = (time * speed + phase) % 1;
            const p = samplePointOnRoute(screenPoints, t);
            if (!p) continue;

            // Subtle trailing halo
            gfx.fillStyle(pulseColor, edgeTokens.pulse.alpha * 0.3);
            gfx.fillCircle(p.x, p.y, edgeTokens.pulse.radius * 1.8);

            // Core pulse
            gfx.fillStyle(pulseColor, edgeTokens.pulse.alpha);
            gfx.fillCircle(p.x, p.y, edgeTokens.pulse.radius);
        }
    }
}
