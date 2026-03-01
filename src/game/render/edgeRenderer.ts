import * as Phaser from 'phaser';
import { gridToScreen } from '../iso/isoMath';
import type { SimSnapshot } from '../../sim/types';

const EDGE_GLOW_COLOR = 0x4fc3f7;
const EDGE_COLOR = 0x4a5a8a;
const WARNING_COLOR = 0xc49a3c;
const ERROR_COLOR = 0xc0675a;

export function drawEdges(
    gfx: Phaser.GameObjects.Graphics,
    snap: SimSnapshot,
    originX: number,
    originY: number
): void {
    gfx.clear();
    const nodeById = new Map(snap.nodes.map((n) => [n.id, n]));

    for (const e of snap.edges) {
        const from = nodeById.get(e.from);
        const to = nodeById.get(e.to);
        if (!from || !to) continue;

        const fp = gridToScreen(from.gx, from.gy);
        const mp = gridToScreen(from.gx, to.gy);
        const tp = gridToScreen(to.gx, to.gy);

        const fx = originX + fp.x;
        const fy = originY + fp.y;
        const mx = originX + mp.x;
        const my = originY + mp.y;
        const tx = originX + tp.x;
        const ty = originY + tp.y;

        const issues = snap.validation.issues.filter(i => (i.nodeIds?.includes(from.id) || i.nodeIds?.includes(to.id)));
        const isError = issues.some(i => i.severity === 'error');
        const isWarning = issues.some(i => i.severity === 'warning');

        let color = EDGE_COLOR;
        let glowColor = EDGE_GLOW_COLOR;
        if (isError) { color = ERROR_COLOR; glowColor = ERROR_COLOR; }
        else if (isWarning) { color = WARNING_COLOR; glowColor = WARNING_COLOR; }

        // Glow pass (wider, low alpha)
        gfx.lineStyle(4, glowColor, 0.15);
        gfx.beginPath();
        gfx.moveTo(fx, fy);
        gfx.lineTo(mx, my);
        gfx.lineTo(tx, ty);
        gfx.strokePath();

        // Core pass
        gfx.lineStyle(1.5, color, 0.65);
        gfx.beginPath();
        gfx.moveTo(fx, fy);
        gfx.lineTo(mx, my);
        gfx.lineTo(tx, ty);
        gfx.strokePath();

        const dx = tx - mx;
        const dy = ty - my;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > 0) {
            const nx = dx / len;
            const ny = dy / len;
            const offset = 12;
            const ax = tx - nx * offset;
            const ay = ty - ny * offset;

            const px = -ny;
            const py = nx;
            const size = 6;

            gfx.fillStyle(color, 0.9);
            gfx.fillTriangle(
                ax, ay,
                ax - nx * size + px * size * 0.5, ay - ny * size + py * size * 0.5,
                ax - nx * size - px * size * 0.5, ay - ny * size - py * size * 0.5
            );
        }
    }
}

export function drawFlowPulses(
    gfx: Phaser.GameObjects.Graphics,
    snap: SimSnapshot,
    originX: number,
    originY: number,
    time: number
): void {
    gfx.clear();
    const nodeById = new Map(snap.nodes.map((n) => [n.id, n]));

    for (const e of snap.edges) {
        const from = nodeById.get(e.from);
        const to = nodeById.get(e.to);
        if (!from || !to) continue;

        const flowRate = from.state.outRps;
        if (flowRate <= 0) continue;

        const fp = gridToScreen(from.gx, from.gy);
        const mp = gridToScreen(from.gx, to.gy);
        const tp = gridToScreen(to.gx, to.gy);

        const fx = originX + fp.x;
        const fy = originY + fp.y;
        const mx = originX + mp.x;
        const my = originY + mp.y;
        const tx = originX + tp.x;
        const ty = originY + tp.y;

        const pulseSpeed = 0.001 * (1 + Math.log10(flowRate + 1));
        const t = (time * pulseSpeed) % 1;

        let pX, pY;
        const d1 = Math.sqrt(Math.pow(mx - fx, 2) + Math.pow(my - fy, 2));
        const dx = tx - mx;
        const dy = ty - my;
        const d2 = Math.sqrt(dx * dx + dy * dy);
        const totalD = d1 + d2;

        if (totalD > 0) {
            const covered = t * totalD;
            if (covered <= d1) {
                const frac = covered / d1;
                pX = fx + (mx - fx) * frac;
                pY = fy + (my - fy) * frac;
            } else {
                const frac = (covered - d1) / d2;
                pX = mx + (tx - mx) * frac;
                pY = my + (ty - my) * frac;
            }

            gfx.fillStyle(0xffffff, 0.8);
            gfx.fillCircle(pX, pY, 2.5);
        }
    }
}
