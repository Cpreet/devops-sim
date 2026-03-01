// ── Phaser Build Scene — Visual Overhaul ────────────────────────────────
import Phaser from 'phaser';
import {
    gridToScreen,
    screenToGrid,
    inBounds,
    TILE_W,
    TILE_H,
    GRID_SIZE,
} from '../iso/isoMath';
import { drawEdges, drawFlowPulses } from '../render/edgeRenderer';
import type { SimEngine } from '../../sim/engine/SimEngine';
import type { SimSnapshot, SimNode, NodeKind, SimArea } from '../../sim/types';

// ── Color palette (muted-professional) ──────────────────────────────────

const KIND_COLORS: Record<NodeKind, number> = {
    LB: 0x4a9ebb,
    API: 0x5a9e6f,
    DB: 0xc0675a,
    CACHE: 0xc49a3c,
    QUEUE: 0x8a6aad,
    WORKER: 0x8a8fa0,
};

const KIND_LABELS: Record<NodeKind, string> = {
    LB: 'LB',
    API: 'API',
    DB: 'DB',
    CACHE: 'CACHE',
    QUEUE: 'QUEUE',
    WORKER: 'WORKER',
};

const KEY_MAP: Record<string, NodeKind> = {
    ONE: 'LB',
    TWO: 'API',
    THREE: 'DB',
    FOUR: 'CACHE',
    FIVE: 'QUEUE',
    SIX: 'WORKER',
};

// ── Tile / board constants ──────────────────────────────────────────────

const TILE_FILL = 0x12152a;
const TILE_FILL_ALPHA = 0.55;
const TILE_STROKE = 0x2a3a5c;
const TILE_STROKE_ALPHA = 0.7;

const HOVER_FILL = 0x1e2850;
const HOVER_FILL_ALPHA = 0.7;
const HOVER_STROKE = 0x4a6090;

// ── Scene ───────────────────────────────────────────────────────────────

export class BuildScene extends Phaser.Scene {
    private engine!: SimEngine;
    private onSnapshot!: (snap: SimSnapshot) => void;
    private selectedKind: NodeKind = 'LB';

    // Graphics layers (drawn in this order)
    private gridGfx!: Phaser.GameObjects.Graphics;
    private areaGfx!: Phaser.GameObjects.Graphics;
    private hoverGfx!: Phaser.GameObjects.Graphics;
    private edgeGfx!: Phaser.GameObjects.Graphics;
    private flowGfx!: Phaser.GameObjects.Graphics;
    private nodeLayer!: Phaser.GameObjects.Container;
    private hudText!: Phaser.GameObjects.Text;

    // World-space origin
    private originX = 2000;
    private originY = 2000;

    // Hover tracking
    private hoverGX = -1;
    private hoverGY = -1;

    // Camera drag state
    private isDragging = false;
    private dragStartX = 0;
    private dragStartY = 0;
    private camStartX = 0;
    private camStartY = 0;

    // Sim tick accumulator
    private simAccum = 0;
    private readonly SIM_DT = 1 / 10;

    constructor() {
        super({ key: 'BuildScene' });
    }

    init(data: { engine: SimEngine; onSnapshot: (s: SimSnapshot) => void }): void {
        this.engine = data.engine;
        this.onSnapshot = data.onSnapshot;
    }

    create(): void {
        this.gridGfx = this.add.graphics();
        this.areaGfx = this.add.graphics();
        this.hoverGfx = this.add.graphics();
        this.edgeGfx = this.add.graphics();
        this.flowGfx = this.add.graphics();
        this.nodeLayer = this.add.container(0, 0);

        this.drawGrid();

        // Centre camera
        const mid = gridToScreen(GRID_SIZE / 2, GRID_SIZE / 2);
        const cam = this.cameras.main;
        cam.centerOn(this.originX + mid.x, this.originY + mid.y);

        // ── HUD ─────────────────────────────────────────────────────────────

        this.hudText = this.add.text(14, 14, '', {
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: '12px',
            color: '#8899bb',
            backgroundColor: '#0a0e1acc',
            padding: { x: 10, y: 6 },
        });
        this.hudText.setScrollFactor(0);
        this.hudText.setDepth(100);
        this.updateHud();

        // ── Keybinds ────────────────────────────────────────────────────────

        for (const [keyName, kind] of Object.entries(KEY_MAP)) {
            this.input.keyboard!.on(`keydown-${keyName}`, () => {
                this.selectedKind = kind;
                this.updateHud();
            });
        }

        // ── Hover tracking ──────────────────────────────────────────────────

        this.input.on('pointermove', (ptr: Phaser.Input.Pointer) => {
            if (this.isDragging) return;
            const worldX = ptr.worldX - this.originX;
            const worldY = ptr.worldY - this.originY;
            const { gx, gy } = screenToGrid(worldX, worldY);
            if (inBounds(gx, gy)) {
                if (gx !== this.hoverGX || gy !== this.hoverGY) {
                    this.hoverGX = gx;
                    this.hoverGY = gy;
                    this.drawHover(gx, gy);
                }
            } else {
                this.clearHover();
            }
        });

        // ── Camera pan (right / middle drag) ────────────────────────────────

        this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
            if (ptr.rightButtonDown() || ptr.middleButtonDown()) {
                this.isDragging = true;
                this.dragStartX = ptr.x;
                this.dragStartY = ptr.y;
                this.camStartX = cam.scrollX;
                this.camStartY = cam.scrollY;
            }
        });

        this.input.on('pointermove', (ptr: Phaser.Input.Pointer) => {
            if (this.isDragging) {
                cam.scrollX = this.camStartX - (ptr.x - this.dragStartX);
                cam.scrollY = this.camStartY - (ptr.y - this.dragStartY);
            }
        });

        this.input.on('pointerup', (ptr: Phaser.Input.Pointer) => {
            if (!ptr.rightButtonDown() && !ptr.middleButtonDown()) {
                this.isDragging = false;
            }
        });

        // ── Zoom ────────────────────────────────────────────────────────────

        this.input.on(
            'wheel',
            (_ptr: Phaser.Input.Pointer, _dx: number[], _dy: number[], _dz: number, deltaY: number) => {
                const step = deltaY > 0 ? -0.06 : 0.06;
                cam.zoom = Phaser.Math.Clamp(cam.zoom + step, 0.3, 3);
            },
        );

        this.game.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        // ── Left-click to place or select ───────────────────────────────────

        this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
            if (!ptr.leftButtonDown() || this.isDragging) return;
            const worldX = ptr.worldX - this.originX;
            const worldY = ptr.worldY - this.originY;
            const { gx, gy } = screenToGrid(worldX, worldY);
            if (!inBounds(gx, gy)) return;

            const existingNode = this.engine.nodes.find((n) => n.gx === gx && n.gy === gy);

            if (existingNode) {
                this.engine.selectNode(existingNode.id);
                this.redrawNodes();
            } else {
                this.engine.selectNode(null);
                const added = this.engine.addNode(this.selectedKind, gx, gy);
                if (added) this.redrawNodes();
            }
        });
    }

    update(time: number, delta: number): void {
        this.simAccum += delta / 1000;
        while (this.simAccum >= this.SIM_DT) {
            this.engine.step(this.SIM_DT);
            this.simAccum -= this.SIM_DT;
        }
        const snap = this.engine.getSnapshot();
        this.onSnapshot(snap);

        drawFlowPulses(this.flowGfx, snap, this.originX, this.originY, time);
    }

    // ══════════════════════════════════════════════════════════════════════
    //  Public helpers (called from React via PhaserHost)
    // ══════════════════════════════════════════════════════════════════════

    redrawNodes(): void {
        this.nodeLayer.removeAll(true);
        this.edgeGfx.clear();
        this.areaGfx.clear();

        const snap = this.engine.getSnapshot();

        // ── Areas ───────────────────────────────────────────────────────────

        for (const area of snap.areas) {
            this.drawArea(area);
        }

        // ── Edges ───────────────────────────────────────────────────────────

        drawEdges(this.edgeGfx, snap, this.originX, this.originY);

        // ── Nodes ───────────────────────────────────────────────────────────

        for (const n of snap.nodes) {
            const issues = snap.validation.issues.filter(i => i.nodeIds?.includes(n.id));
            const isError = issues.some(i => i.severity === 'error');
            const isWarning = issues.some(i => i.severity === 'warning');
            const isSelected = n.id === snap.selectedNodeId;
            this.drawNode(n, isSelected, isError, isWarning);
        }
    }

    clearAll(): void {
        this.nodeLayer.removeAll(true);
        this.edgeGfx.clear();
        this.flowGfx.clear();
        this.areaGfx.clear();
    }

    // ══════════════════════════════════════════════════════════════════════
    //  Private — Area rendering
    // ══════════════════════════════════════════════════════════════════════

    private drawArea(area: SimArea): void {
        const p1 = gridToScreen(area.x, area.y);
        const p2 = gridToScreen(area.x + area.w, area.y);
        const p3 = gridToScreen(area.x + area.w, area.y + area.h);
        const p4 = gridToScreen(area.x, area.y + area.h);

        this.areaGfx.fillStyle(0x1a233a, 0.4);
        this.areaGfx.lineStyle(2, 0x4a5a8a, 0.4);
        this.areaGfx.beginPath();
        this.areaGfx.moveTo(this.originX + p1.x, this.originY + p1.y);
        this.areaGfx.lineTo(this.originX + p2.x, this.originY + p2.y);
        this.areaGfx.lineTo(this.originX + p3.x, this.originY + p3.y);
        this.areaGfx.lineTo(this.originX + p4.x, this.originY + p4.y);
        this.areaGfx.closePath();
        this.areaGfx.fillPath();
        this.areaGfx.strokePath();

        const label = this.add.text(this.originX + p4.x + 30, this.originY + p4.y - 10, area.label.toUpperCase(), {
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: '11px',
            color: '#4fc3f7',
            fontStyle: 'bold',
        });
        label.setAlpha(0.3);
        label.setOrigin(0, 1);
        this.nodeLayer.add(label);
    }

    // ══════════════════════════════════════════════════════════════════════
    //  Private — Grid rendering
    // ══════════════════════════════════════════════════════════════════════

    private drawGrid(): void {
        for (let gx = 0; gx < GRID_SIZE; gx++) {
            for (let gy = 0; gy < GRID_SIZE; gy++) {
                this.drawTile(this.gridGfx, gx, gy, TILE_FILL, TILE_FILL_ALPHA, TILE_STROKE, TILE_STROKE_ALPHA);
            }
        }
    }

    private drawTile(
        gfx: Phaser.GameObjects.Graphics,
        gx: number,
        gy: number,
        fill: number,
        fillAlpha: number,
        stroke: number,
        strokeAlpha: number,
    ): void {
        const c = gridToScreen(gx, gy);
        const cx = this.originX + c.x;
        const cy = this.originY + c.y;
        const hw = TILE_W / 2;
        const hh = TILE_H / 2;

        // Fill
        gfx.fillStyle(fill, fillAlpha);
        gfx.beginPath();
        gfx.moveTo(cx, cy - hh);
        gfx.lineTo(cx + hw, cy);
        gfx.lineTo(cx, cy + hh);
        gfx.lineTo(cx - hw, cy);
        gfx.closePath();
        gfx.fillPath();

        // Stroke
        gfx.lineStyle(1, stroke, strokeAlpha);
        gfx.beginPath();
        gfx.moveTo(cx, cy - hh);
        gfx.lineTo(cx + hw, cy);
        gfx.lineTo(cx, cy + hh);
        gfx.lineTo(cx - hw, cy);
        gfx.closePath();
        gfx.strokePath();
    }

    // ══════════════════════════════════════════════════════════════════════
    //  Private — Hover
    // ══════════════════════════════════════════════════════════════════════

    private drawHover(gx: number, gy: number): void {
        this.hoverGfx.clear();
        this.drawTile(this.hoverGfx, gx, gy, HOVER_FILL, HOVER_FILL_ALPHA, HOVER_STROKE, 0.9);
    }

    private clearHover(): void {
        this.hoverGX = -1;
        this.hoverGY = -1;
        this.hoverGfx.clear();
    }

    // ══════════════════════════════════════════════════════════════════════
    //  Private — Node rendering (per-kind custom shapes)
    // ══════════════════════════════════════════════════════════════════════

    private drawNode(n: SimNode, isSelected: boolean, isError: boolean, isWarning: boolean): void {
        const pos = gridToScreen(n.gx, n.gy);
        const sx = this.originX + pos.x;
        const sy = this.originY + pos.y;
        const color = KIND_COLORS[n.kind];
        const gfx = this.add.graphics();

        // 1. Base pad — small isometric diamond (shadow/platform)
        const padHW = TILE_W * 0.28;
        const padHH = TILE_H * 0.28;
        gfx.fillStyle(color, 0.15);
        gfx.beginPath();
        gfx.moveTo(sx, sy - padHH + 4);
        gfx.lineTo(sx + padHW, sy + 4);
        gfx.lineTo(sx, sy + padHH + 4);
        gfx.lineTo(sx - padHW, sy + 4);
        gfx.closePath();
        gfx.fillPath();

        // 2. Module body — per-kind shape
        this.drawModuleShape(gfx, sx, sy, n.kind, color);

        // 3. Saturation glow ring
        if (n.state.saturation > 0.6) {
            const glowAlpha = Math.min((n.state.saturation - 0.6) * 2.5, 0.8);
            const glowColor = n.state.saturation > 0.9 ? 0xff4444 : 0xffaa44;
            gfx.lineStyle(2, glowColor, glowAlpha);
            gfx.strokeCircle(sx, sy - 6, 22);
        }

        this.nodeLayer.add(gfx);

        // Selection / Health Outline
        if (isSelected || isError || isWarning) {
            const outline = this.add.graphics();
            let outColor = 0x4fc3f7; // Cyan for selection
            if (isError) outColor = 0xc0675a;
            else if (isWarning) outColor = 0xc49a3c;

            outline.lineStyle(isSelected ? 2 : 1.5, outColor, 1);

            // Draw an isometric diamond outline
            const hw = TILE_W * 0.4;
            const hh = TILE_H * 0.4;
            outline.beginPath();
            outline.moveTo(sx, sy - hh);
            outline.lineTo(sx + hw, sy);
            outline.lineTo(sx, sy + hh);
            outline.lineTo(sx - hw, sy);
            outline.closePath();
            outline.strokePath();

            this.nodeLayer.add(outline);
        }

        // 4. Label
        const label = this.add.text(sx, sy + 16, KIND_LABELS[n.kind], {
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: '9px',
            color: '#7788aa',
            align: 'center',
        });
        label.setOrigin(0.5, 0);
        this.nodeLayer.add(label);
    }

    private drawModuleShape(
        gfx: Phaser.GameObjects.Graphics,
        sx: number,
        sy: number,
        kind: NodeKind,
        color: number,
    ): void {
        switch (kind) {
            case 'LB':
                // Wide horizontal bar — gateway feel
                this.drawRoundedBar(gfx, sx, sy - 8, 32, 12, color);
                // Small triangle arrows
                gfx.fillStyle(0xffffff, 0.3);
                gfx.fillTriangle(sx - 8, sy - 8, sx - 4, sy - 11, sx - 4, sy - 5);
                gfx.fillTriangle(sx + 8, sy - 8, sx + 4, sy - 11, sx + 4, sy - 5);
                break;

            case 'API':
                // Balanced square block — core service
                this.drawRoundedBar(gfx, sx, sy - 8, 22, 18, color);
                // Inner detail line
                gfx.lineStyle(1, 0xffffff, 0.2);
                gfx.beginPath();
                gfx.moveTo(sx - 8, sy - 6);
                gfx.lineTo(sx + 8, sy - 6);
                gfx.strokePath();
                break;

            case 'DB':
                // Taller block with stripes — storage feel
                this.drawRoundedBar(gfx, sx, sy - 10, 20, 22, color);
                // Cylinder-ish stripes
                gfx.lineStyle(1, 0xffffff, 0.2);
                gfx.beginPath();
                gfx.moveTo(sx - 7, sy - 8);
                gfx.lineTo(sx + 7, sy - 8);
                gfx.moveTo(sx - 7, sy - 3);
                gfx.lineTo(sx + 7, sy - 3);
                gfx.moveTo(sx - 7, sy + 2);
                gfx.lineTo(sx + 7, sy + 2);
                gfx.strokePath();
                break;

            case 'CACHE':
                // Compact diamond — fast access
                gfx.fillStyle(color, 0.8);
                gfx.beginPath();
                gfx.moveTo(sx, sy - 16);
                gfx.lineTo(sx + 12, sy - 6);
                gfx.lineTo(sx, sy + 4);
                gfx.lineTo(sx - 12, sy - 6);
                gfx.closePath();
                gfx.fillPath();
                gfx.lineStyle(1, 0xffffff, 0.25);
                gfx.strokePath();
                // Inner dot
                gfx.fillStyle(0xffffff, 0.3);
                gfx.fillCircle(sx, sy - 6, 3);
                break;

            case 'QUEUE':
                // Three stacked bars — buffer/segments
                for (let i = 0; i < 3; i++) {
                    const barY = sy - 14 + i * 7;
                    const barAlpha = 0.6 + i * 0.1;
                    gfx.fillStyle(color, barAlpha);
                    gfx.fillRoundedRect(sx - 14, barY, 28, 5, 2);
                }
                gfx.lineStyle(1, 0xffffff, 0.15);
                gfx.strokeRoundedRect(sx - 14, sy - 14, 28, 19, 2);
                break;

            case 'WORKER':
                // Hexagon — processing unit
                gfx.fillStyle(color, 0.75);
                gfx.beginPath();
                const r = 12;
                const cy = sy - 6;
                for (let i = 0; i < 6; i++) {
                    const angle = (Math.PI / 3) * i - Math.PI / 6;
                    const px = sx + r * Math.cos(angle);
                    const py = cy + r * Math.sin(angle);
                    if (i === 0) gfx.moveTo(px, py);
                    else gfx.lineTo(px, py);
                }
                gfx.closePath();
                gfx.fillPath();
                gfx.lineStyle(1, 0xffffff, 0.25);
                gfx.strokePath();
                // Inner gear dot
                gfx.fillStyle(0xffffff, 0.3);
                gfx.fillCircle(sx, cy, 3);
                break;
        }
    }

    private drawRoundedBar(
        gfx: Phaser.GameObjects.Graphics,
        cx: number,
        cy: number,
        w: number,
        h: number,
        color: number,
    ): void {
        gfx.fillStyle(color, 0.8);
        gfx.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, 3);
        gfx.lineStyle(1, 0xffffff, 0.2);
        gfx.strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, 3);
    }

    // ══════════════════════════════════════════════════════════════════════
    //  Private — HUD
    // ══════════════════════════════════════════════════════════════════════

    private updateHud(): void {
        this.hudText.setText(
            `  ● ${this.selectedKind}  [1-6]  ·  scroll = zoom  ·  right-drag = pan  `,
        );
    }
}
