// ── Phaser Build Scene ──────────────────────────────────────────────────
import Phaser from 'phaser';
import {
    gridToScreen,
    screenToGrid,
    inBounds,
    TILE_W,
    TILE_H,
    GRID_SIZE,
} from '../iso/isoMath';
import type { SimEngine } from '../../sim/engine/SimEngine';
import type { SimSnapshot, NodeKind } from '../../sim/types';

/** Colours per node kind (used for edge tinting and fallback). */
const KIND_COLORS: Record<NodeKind, number> = {
    LB: 0x4fc3f7,
    API: 0x81c784,
    DB: 0xffb74d,
    CACHE: 0xba68c8,
    QUEUE: 0xfff176,
    WORKER: 0xe57373,
};

const KIND_LABELS: Record<NodeKind, string> = {
    LB: 'ELB',
    API: 'API GW',
    DB: 'DynamoDB',
    CACHE: 'ElastiCache',
    QUEUE: 'SQS',
    WORKER: 'Lambda',
};

/** Icon texture keys — loaded in preload(). */
const KIND_ICON_KEY: Record<NodeKind, string> = {
    LB: 'icon-lb',
    API: 'icon-api',
    DB: 'icon-db',
    CACHE: 'icon-cache',
    QUEUE: 'icon-queue',
    WORKER: 'icon-worker',
};

const KEY_MAP: Record<string, NodeKind> = {
    ONE: 'LB',
    TWO: 'API',
    THREE: 'DB',
    FOUR: 'CACHE',
    FIVE: 'QUEUE',
    SIX: 'WORKER',
};

export class BuildScene extends Phaser.Scene {
    private engine!: SimEngine;
    private onSnapshot!: (snap: SimSnapshot) => void;
    private selectedKind: NodeKind = 'LB';

    // Graphics layers
    private gridGfx!: Phaser.GameObjects.Graphics;
    private edgeGfx!: Phaser.GameObjects.Graphics;
    private nodeLayer!: Phaser.GameObjects.Container;
    private hudText!: Phaser.GameObjects.Text;

    // Grid rendering origin — large world, camera moves
    private originX = 2000;
    private originY = 2000;

    // Camera drag state
    private isDragging = false;
    private dragStartX = 0;
    private dragStartY = 0;
    private camStartX = 0;
    private camStartY = 0;

    // Accumulator for fixed-step sim
    private simAccum = 0;
    private readonly SIM_DT = 1 / 10;

    constructor() {
        super({ key: 'BuildScene' });
    }

    init(data: { engine: SimEngine; onSnapshot: (s: SimSnapshot) => void }): void {
        this.engine = data.engine;
        this.onSnapshot = data.onSnapshot;
    }

    preload(): void {
        // Load AWS service icons from public/icons/
        this.load.svg('icon-lb', '/icons/lb.svg', { width: 48, height: 48 });
        this.load.svg('icon-api', '/icons/api.svg', { width: 48, height: 48 });
        this.load.svg('icon-db', '/icons/db.svg', { width: 48, height: 48 });
        this.load.svg('icon-cache', '/icons/cache.svg', { width: 48, height: 48 });
        this.load.svg('icon-queue', '/icons/queue.svg', { width: 48, height: 48 });
        this.load.svg('icon-worker', '/icons/worker.svg', { width: 48, height: 48 });
    }

    create(): void {
        // Graphics objects
        this.gridGfx = this.add.graphics();
        this.edgeGfx = this.add.graphics();
        this.nodeLayer = this.add.container(0, 0);

        this.drawGrid();

        // Centre camera on the middle of the grid
        const mid = gridToScreen(GRID_SIZE / 2, GRID_SIZE / 2);
        const cam = this.cameras.main;
        cam.centerOn(this.originX + mid.x, this.originY + mid.y);

        // HUD text (fixed to camera via scrollFactor)
        this.hudText = this.add.text(12, 12, '', {
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: '14px',
            color: '#e0e0e0',
            backgroundColor: '#1a1a2ecc',
            padding: { x: 10, y: 6 },
        });
        this.hudText.setScrollFactor(0);
        this.hudText.setDepth(100);
        this.updateHud();

        // Keybinds 1–6
        for (const [keyName, kind] of Object.entries(KEY_MAP)) {
            this.input.keyboard!.on(`keydown-${keyName}`, () => {
                this.selectedKind = kind;
                this.updateHud();
            });
        }

        // ── Camera pan: right-click or middle-click drag ────────────────────

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

        // ── Scroll to zoom ─────────────────────────────────────────────────

        this.input.on('wheel', (_ptr: Phaser.Input.Pointer, _gx: number[], _gy: number[], _gz: number, deltaY: number) => {
            const zoomDelta = deltaY > 0 ? -0.05 : 0.05;
            cam.zoom = Phaser.Math.Clamp(cam.zoom + zoomDelta, 0.3, 3);
        });

        // Disable the browser context menu on the canvas
        this.game.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        // ── Left-click to place ─────────────────────────────────────────────

        this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
            if (!ptr.leftButtonDown() || this.isDragging) return;
            const worldX = ptr.worldX - this.originX;
            const worldY = ptr.worldY - this.originY;
            const { gx, gy } = screenToGrid(worldX, worldY);
            if (!inBounds(gx, gy)) return;
            const added = this.engine.addNode(this.selectedKind, gx, gy);
            if (added) this.redrawNodes();
        });
    }

    update(_time: number, delta: number): void {
        this.simAccum += delta / 1000;
        while (this.simAccum >= this.SIM_DT) {
            this.engine.step(this.SIM_DT);
            this.simAccum -= this.SIM_DT;
        }
        this.onSnapshot(this.engine.getSnapshot());
    }

    // ── public helpers (called from React) ────────────────────────────────

    redrawNodes(): void {
        this.nodeLayer.removeAll(true);
        this.edgeGfx.clear();

        const snap = this.engine.getSnapshot();
        const nodeById = new Map(snap.nodes.map((n) => [n.id, n]));

        // Draw edges
        this.edgeGfx.lineStyle(2, 0x555577, 0.5);
        for (const e of snap.edges) {
            const from = nodeById.get(e.from);
            const to = nodeById.get(e.to);
            if (!from || !to) continue;
            const fp = gridToScreen(from.gx, from.gy);
            const tp = gridToScreen(to.gx, to.gy);
            this.edgeGfx.beginPath();
            this.edgeGfx.moveTo(this.originX + fp.x, this.originY + fp.y);
            this.edgeGfx.lineTo(this.originX + tp.x, this.originY + tp.y);
            this.edgeGfx.strokePath();
        }

        // Draw nodes with AWS icons
        for (const n of snap.nodes) {
            const pos = gridToScreen(n.gx, n.gy);
            const sx = this.originX + pos.x;
            const sy = this.originY + pos.y;

            const iconKey = KIND_ICON_KEY[n.kind];

            // Icon image
            if (this.textures.exists(iconKey)) {
                const icon = this.add.image(sx, sy - 10, iconKey);
                icon.setDisplaySize(40, 40);
                this.nodeLayer.add(icon);
            } else {
                // Fallback: colored diamond
                const gfx = this.add.graphics();
                const color = KIND_COLORS[n.kind];
                gfx.fillStyle(color, 0.85);
                gfx.beginPath();
                const hw = TILE_W * 0.3;
                const hh = TILE_H * 0.3;
                gfx.moveTo(sx, sy - hh);
                gfx.lineTo(sx + hw, sy);
                gfx.lineTo(sx, sy + hh);
                gfx.lineTo(sx - hw, sy);
                gfx.closePath();
                gfx.fillPath();
                this.nodeLayer.add(gfx);
            }

            // Saturation glow ring
            if (n.state.saturation > 0.6) {
                const glow = this.add.graphics();
                const glowAlpha = Math.min((n.state.saturation - 0.6) * 2.5, 1);
                glow.lineStyle(2.5, 0xff4444, glowAlpha);
                glow.strokeCircle(sx, sy - 10, 26);
                this.nodeLayer.add(glow);
            }

            // Label
            const label = this.add.text(sx, sy + 16, KIND_LABELS[n.kind], {
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: '9px',
                color: '#aaaacc',
                align: 'center',
            });
            label.setOrigin(0.5, 0);
            this.nodeLayer.add(label);
        }
    }

    clearAll(): void {
        this.nodeLayer.removeAll(true);
        this.edgeGfx.clear();
    }

    // ── private ───────────────────────────────────────────────────────────

    private drawGrid(): void {
        this.gridGfx.lineStyle(1, 0x334466, 0.35);

        for (let gx = 0; gx < GRID_SIZE; gx++) {
            for (let gy = 0; gy < GRID_SIZE; gy++) {
                const c = gridToScreen(gx, gy);
                const cx = this.originX + c.x;
                const cy = this.originY + c.y;

                this.gridGfx.beginPath();
                this.gridGfx.moveTo(cx, cy - TILE_H / 2);
                this.gridGfx.lineTo(cx + TILE_W / 2, cy);
                this.gridGfx.lineTo(cx, cy + TILE_H / 2);
                this.gridGfx.lineTo(cx - TILE_W / 2, cy);
                this.gridGfx.closePath();
                this.gridGfx.strokePath();
            }
        }
    }

    private updateHud(): void {
        this.hudText.setText(
            `  ${this.selectedKind}  [1-6]  ·  scroll = zoom  ·  right-drag = pan  `,
        );
    }
}
