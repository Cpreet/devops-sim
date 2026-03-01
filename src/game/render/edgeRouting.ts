import { gridToScreen } from '../iso/isoMath';
import type { SimArea, SimNode } from '../../sim/types';

export interface GridPoint {
    gx: number;
    gy: number;
}

export interface ScreenPoint {
    x: number;
    y: number;
}

function areaForNode(node: SimNode, areas: SimArea[]): SimArea | undefined {
    return areas.find(
        (a) => node.gx >= a.x && node.gx < a.x + a.w && node.gy >= a.y && node.gy < a.y + a.h,
    );
}

function normalizeRoute(points: GridPoint[]): GridPoint[] {
    const out: GridPoint[] = [];
    for (const p of points) {
        const prev = out[out.length - 1];
        if (!prev || prev.gx !== p.gx || prev.gy !== p.gy) {
            out.push(p);
        }
    }
    return out;
}

/**
 * Deterministic lane-style route.
 * - same area: single shared middle corridor
 * - different areas: route through a boundary crossing corridor
 */
export function buildEdgeRoute(from: SimNode, to: SimNode, areas: SimArea[]): GridPoint[] {
    const start: GridPoint = { gx: from.gx, gy: from.gy };
    const end: GridPoint = { gx: to.gx, gy: to.gy };
    const fromArea = areaForNode(from, areas);
    const toArea = areaForNode(to, areas);

    if (from.gx === to.gx || from.gy === to.gy) {
        return [start, end];
    }

    if (fromArea && toArea && fromArea.id !== toArea.id) {
        const movingDown = from.gy < to.gy;
        const boundaryGy = movingDown ? fromArea.y + fromArea.h : fromArea.y;
        const crossingGy = movingDown ? boundaryGy - 0.5 : boundaryGy + 0.5;
        return normalizeRoute([
            start,
            { gx: from.gx, gy: crossingGy },
            { gx: to.gx, gy: crossingGy },
            end,
        ]);
    }

    const corridorGy = (from.gy + to.gy) / 2;
    return normalizeRoute([
        start,
        { gx: from.gx, gy: corridorGy },
        { gx: to.gx, gy: corridorGy },
        end,
    ]);
}

export function routeToScreen(
    route: GridPoint[],
    originX: number,
    originY: number,
): ScreenPoint[] {
    return route.map((p) => {
        const s = gridToScreen(p.gx, p.gy);
        return { x: originX + s.x, y: originY + s.y };
    });
}

export function routeLength(points: ScreenPoint[]): number {
    let total = 0;
    for (let i = 1; i < points.length; i++) {
        const dx = points[i].x - points[i - 1].x;
        const dy = points[i].y - points[i - 1].y;
        total += Math.hypot(dx, dy);
    }
    return total;
}

export function samplePointOnRoute(points: ScreenPoint[], t: number): ScreenPoint | null {
    if (points.length < 2) return null;
    const total = routeLength(points);
    if (total <= 0) return null;

    const clampedT = Math.min(1, Math.max(0, t));
    let remaining = total * clampedT;

    for (let i = 1; i < points.length; i++) {
        const from = points[i - 1];
        const to = points[i];
        const segLen = Math.hypot(to.x - from.x, to.y - from.y);
        if (segLen <= 0) continue;

        if (remaining <= segLen) {
            const frac = remaining / segLen;
            return {
                x: from.x + (to.x - from.x) * frac,
                y: from.y + (to.y - from.y) * frac,
            };
        }
        remaining -= segLen;
    }

    return points[points.length - 1];
}
