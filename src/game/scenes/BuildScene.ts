import Phaser from 'phaser';
import {
    gridToScreen,
    screenToGrid,
    inBounds,
    TILE_W,
    TILE_H,
    GRID_SIZE,
} from '../iso/isoMath';
import { drawFlowEdges, drawFlowPulses } from '../render/flowArrows';
import { drawArea } from '../render/areaRenderer';
import { drawNode as drawNodePremium, preloadNodeIcons } from '../render/nodeRenderer';
import { KEY_TO_ACTION, type GameAction } from '../input/keymap';
import { createInitialInteractionState, type InteractionState } from '../input/interactionState';
import {
    drawRadialMenu,
    radialIndexFromPointer,
    RADIAL_OPTIONS,
    type RadialAction,
    type RadialLayout,
} from '../render/radialMenu';
import { canvas as canvasTokens, hover as hoverTokens, node as nodeTokens, KIND_LABELS } from '../../theme/tokens';
import type { SimEngine } from '../../sim/engine/SimEngine';
import type { SimSnapshot, NodeKind } from '../../sim/types';

export class BuildScene extends Phaser.Scene {
    private engine!: SimEngine;
    private onSnapshot!: (snap: SimSnapshot) => void;
    private onRadialAction?: (action: RadialAction) => void;
    private selectedKind: NodeKind = 'LB';

    private gridGfx!: Phaser.GameObjects.Graphics;
    private areaGfx!: Phaser.GameObjects.Graphics;
    private hoverGfx!: Phaser.GameObjects.Graphics;
    private edgeGfx!: Phaser.GameObjects.Graphics;
    private flowGfx!: Phaser.GameObjects.Graphics;
    private radialGfx!: Phaser.GameObjects.Graphics;
    private ghostGfx!: Phaser.GameObjects.Graphics;
    private ghostLabel!: Phaser.GameObjects.Text;
    private nodeLayer!: Phaser.GameObjects.Container;
    private hudText!: Phaser.GameObjects.Text;

    private originX = 2000;
    private originY = 2000;

    private hoverGX = -1;
    private hoverGY = -1;
    private interaction: InteractionState = createInitialInteractionState(
        Math.floor(GRID_SIZE / 2),
        Math.floor(GRID_SIZE / 2),
    );
    private cursorVisible = false;
    private radialOpen = false;
    private radialIndex = 0;
    private radialLayout: RadialLayout | null = null;
    private radialLabels: Phaser.GameObjects.Text[] = [];

    private isDragging = false;
    private dragStartX = 0;
    private dragStartY = 0;
    private camStartX = 0;
    private camStartY = 0;

    private lastGridKey = '';

    private simAccum = 0;
    private readonly SIM_DT = 1 / 10;

    constructor() {
        super({ key: 'BuildScene' });
    }

    init(data: {
        engine: SimEngine;
        onSnapshot: (s: SimSnapshot) => void;
        onRadialAction?: (action: RadialAction) => void;
    }): void {
        this.engine = data.engine;
        this.onSnapshot = data.onSnapshot;
        this.onRadialAction = data.onRadialAction;
    }

    preload(): void {
        preloadNodeIcons(this);
    }

    create(): void {
        this.gridGfx = this.add.graphics();
        this.areaGfx = this.add.graphics();
        this.hoverGfx = this.add.graphics();
        this.edgeGfx = this.add.graphics();
        this.flowGfx = this.add.graphics();
        this.radialGfx = this.add.graphics();
        this.nodeLayer = this.add.container(0, 0);
        this.ghostGfx = this.add.graphics();
        this.ghostLabel = this.add.text(0, 0, '', {
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: '11px',
            fontStyle: 'bold',
            color: '#1a2233',
            align: 'center',
        });
        this.ghostLabel.setOrigin(0.5, 0);
        this.ghostLabel.setAlpha(0);

        this.drawGrid();

        const mid = gridToScreen(GRID_SIZE / 2, GRID_SIZE / 2);
        const cam = this.cameras.main;
        cam.centerOn(this.originX + mid.x, this.originY + mid.y);

        this.hudText = this.add.text(14, 14, '', {
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: '12px',
            color: '#5f6b7a',
            backgroundColor: '#ffffffcc',
            padding: { x: 12, y: 6 },
        });
        this.hudText.setScrollFactor(0);
        this.hudText.setDepth(100);
        this.updateHud();

        for (const [keyName, action] of Object.entries(KEY_TO_ACTION)) {
            this.input.keyboard!.on(`keydown-${keyName}`, () => {
                this.handleAction(action);
            });
        }

        this.input.on('pointermove', (ptr: Phaser.Input.Pointer) => {
            if (this.isDragging) return;

            if (this.radialOpen && this.radialLayout) {
                const idx = radialIndexFromPointer(ptr.worldX, ptr.worldY, this.radialLayout);
                const newIdx = idx ?? -1;
                if (newIdx !== this.radialIndex) {
                    this.radialIndex = newIdx;
                    this.refreshRadialVisuals();
                }
                return;
            }

            const worldX = ptr.worldX - this.originX;
            const worldY = ptr.worldY - this.originY;
            const { gx, gy } = screenToGrid(worldX, worldY);
            if (inBounds(gx, gy)) {
                if (this.interaction.mode === 'dragging') {
                    this.interaction.previewGX = gx;
                    this.interaction.previewGY = gy;
                    const isValid = this.isValidDropTarget(gx, gy, this.interaction.dragNodeId ?? undefined);
                    this.drawHover(gx, gy, isValid);

                    const ghostKind = this.interaction.dragKind
                        ?? this.engine.getNodeById(this.interaction.dragNodeId ?? '')?.kind
                        ?? null;
                    if (ghostKind) {
                        this.drawGhostNode(gx, gy, ghostKind as NodeKind, isValid);
                    }
                    return;
                }
                if (gx !== this.hoverGX || gy !== this.hoverGY) {
                    this.hoverGX = gx;
                    this.hoverGY = gy;
                    this.drawHover(gx, gy, true);
                }
            } else {
                this.clearHover();
            }
        });

        this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
            if (ptr.middleButtonDown()) {
                this.isDragging = true;
                this.dragStartX = ptr.x;
                this.dragStartY = ptr.y;
                this.camStartX = cam.scrollX;
                this.camStartY = cam.scrollY;
                return;
            }

            if (ptr.rightButtonDown()) {
                const worldX = ptr.worldX - this.originX;
                const worldY = ptr.worldY - this.originY;
                const { gx, gy } = screenToGrid(worldX, worldY);
                if (inBounds(gx, gy)) {
                    const clickedNode = this.engine.nodes.find((n) => n.gx === gx && n.gy === gy);
                    if (clickedNode) {
                        this.engine.selectNode(clickedNode.id);
                        this.radialOpen = true;
                        this.radialIndex = -1;
                        this.redrawNodes();
                        return;
                    }
                }
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

        this.input.on(
            'wheel',
            (_ptr: Phaser.Input.Pointer, _over: Phaser.GameObjects.GameObject[], _dx: number, deltaY: number) => {
                const step = deltaY > 0 ? -0.06 : 0.06;
                cam.zoom = Phaser.Math.Clamp(cam.zoom + step, 0.3, 3);
            },
        );

        this.game.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
            if (!ptr.leftButtonDown() || this.isDragging) return;
            if (this.radialOpen && this.radialLayout) {
                if (this.radialIndex >= 0 && this.radialIndex < RADIAL_OPTIONS.length) {
                    this.activateRadialOption(RADIAL_OPTIONS[this.radialIndex].id);
                    return;
                }
                this.radialOpen = false;
                this.redrawNodes();
                return;
            }
            const worldX = ptr.worldX - this.originX;
            const worldY = ptr.worldY - this.originY;
            const { gx, gy } = screenToGrid(worldX, worldY);
            if (!inBounds(gx, gy)) return;

            const existingNode = this.engine.nodes.find((n) => n.gx === gx && n.gy === gy);

            if (existingNode) {
                this.engine.selectNode(existingNode.id);
                this.interaction.mode = 'dragging';
                this.interaction.dragNodeId = existingNode.id;
                this.interaction.dragKind = null;
                this.interaction.previewGX = gx;
                this.interaction.previewGY = gy;
                this.interaction.moveNodeId = existingNode.id;
                this.redrawNodes();
            } else {
                this.engine.selectNode(null);
                this.interaction.mode = 'dragging';
                this.interaction.dragNodeId = null;
                this.interaction.dragKind = this.selectedKind;
                this.interaction.previewGX = gx;
                this.interaction.previewGY = gy;
                this.drawHover(gx, gy, this.isValidDropTarget(gx, gy));
            }
        });

        this.input.on('pointerup', (ptr: Phaser.Input.Pointer) => {
            if (ptr.button !== 0) return;

            if (this.interaction.mode !== 'dragging') return;

            const previewGX = this.interaction.previewGX;
            const previewGY = this.interaction.previewGY;
            const dragNodeId = this.interaction.dragNodeId;
            const dragKind = this.interaction.dragKind;

            if (
                previewGX !== null &&
                previewGY !== null &&
                inBounds(previewGX, previewGY)
            ) {
                if (dragNodeId) {
                    const moved = this.engine.moveNode(dragNodeId, previewGX, previewGY);
                    if (moved) this.redrawNodes();
                } else if (dragKind) {
                    const added = this.engine.addNode(dragKind as NodeKind, previewGX, previewGY);
                    if (added) this.redrawNodes();
                }
            }

            this.interaction.dragNodeId = null;
            this.interaction.dragKind = null;
            this.interaction.previewGX = null;
            this.interaction.previewGY = null;
            this.interaction.mode = this.engine.selectedNodeId ? 'selected' : 'placing';
            this.clearGhost();
        });

        this.drawCursor();
    }

    update(time: number, delta: number): void {
        this.drawGrid();

        this.simAccum += delta / 1000;
        while (this.simAccum >= this.SIM_DT) {
            this.engine.step(this.SIM_DT);
            this.simAccum -= this.SIM_DT;
        }
        const snap = this.engine.getSnapshot();
        this.onSnapshot(snap);
        drawFlowPulses(this.flowGfx, snap, this.originX, this.originY, time);
    }

    redrawNodes(): void {
        this.nodeLayer.removeAll(true);
        this.edgeGfx.clear();
        this.areaGfx.clear();
        this.radialGfx.clear();
        this.clearGhost();

        const snap = this.engine.getSnapshot();

        for (const a of snap.areas) {
            drawArea(this.areaGfx, this.nodeLayer, this, a, this.originX, this.originY);
        }

        drawFlowEdges(this.edgeGfx, snap, this.originX, this.originY);

        for (const n of snap.nodes) {
            const issues = snap.validation.issues.filter(i => i.nodeIds?.includes(n.id));
            const isError = issues.some(i => i.severity === 'error');
            const isWarning = issues.some(i => i.severity === 'warning');
            const isSelected = n.id === snap.selectedNodeId;
            drawNodePremium(this, this.nodeLayer, n, isSelected, isError, isWarning, this.originX, this.originY);
        }
        this.drawRadialOverlay(snap);
        this.hoverGfx.clear();
        this.drawCursor();
    }

    clearAll(): void {
        this.nodeLayer.removeAll(true);
        this.edgeGfx.clear();
        this.flowGfx.clear();
        this.areaGfx.clear();
        this.radialGfx.clear();
        this.clearGhost();
    }

    // ── Grid ──────────────────────────────────────────────────────────────

    private getVisibleGridRange(): { minGX: number; maxGX: number; minGY: number; maxGY: number } {
        const cam = this.cameras.main;
        const pad = 2;
        const left = cam.scrollX;
        const top = cam.scrollY;
        const right = left + cam.width / cam.zoom;
        const bottom = top + cam.height / cam.zoom;

        const corners = [
            screenToGrid(left - this.originX, top - this.originY),
            screenToGrid(right - this.originX, top - this.originY),
            screenToGrid(left - this.originX, bottom - this.originY),
            screenToGrid(right - this.originX, bottom - this.originY),
        ];

        let minGX = Infinity, maxGX = -Infinity, minGY = Infinity, maxGY = -Infinity;
        for (const c of corners) {
            if (c.gx < minGX) minGX = c.gx;
            if (c.gx > maxGX) maxGX = c.gx;
            if (c.gy < minGY) minGY = c.gy;
            if (c.gy > maxGY) maxGY = c.gy;
        }

        return {
            minGX: Math.floor(minGX) - pad,
            maxGX: Math.ceil(maxGX) + pad,
            minGY: Math.floor(minGY) - pad,
            maxGY: Math.ceil(maxGY) + pad,
        };
    }

    private drawGrid(): void {
        const range = this.getVisibleGridRange();
        const key = `${range.minGX},${range.maxGX},${range.minGY},${range.maxGY}`;
        if (key === this.lastGridKey) return;
        this.lastGridKey = key;

        this.gridGfx.clear();

        for (let gx = range.minGX; gx <= range.maxGX; gx++) {
            for (let gy = range.minGY; gy <= range.maxGY; gy++) {
                this.drawTile(this.gridGfx, gx, gy,
                    canvasTokens.gridFill, canvasTokens.gridFillAlpha,
                    canvasTokens.gridStroke, canvasTokens.gridStrokeAlpha);
            }
        }

        for (let gx = range.minGX; gx <= range.maxGX + 1; gx++) {
            for (let gy = range.minGY; gy <= range.maxGY + 1; gy++) {
                const p = gridToScreen(gx, gy);
                this.gridGfx.fillStyle(canvasTokens.gridDot, canvasTokens.gridDotAlpha);
                this.gridGfx.fillCircle(this.originX + p.x, this.originY + p.y, 1.5);
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

        gfx.fillStyle(fill, fillAlpha);
        gfx.beginPath();
        gfx.moveTo(cx, cy - hh);
        gfx.lineTo(cx + hw, cy);
        gfx.lineTo(cx, cy + hh);
        gfx.lineTo(cx - hw, cy);
        gfx.closePath();
        gfx.fillPath();

        gfx.lineStyle(1, stroke, strokeAlpha);
        gfx.beginPath();
        gfx.moveTo(cx, cy - hh);
        gfx.lineTo(cx + hw, cy);
        gfx.lineTo(cx, cy + hh);
        gfx.lineTo(cx - hw, cy);
        gfx.closePath();
        gfx.strokePath();
    }

    // ── Hover / Cursor ────────────────────────────────────────────────────

    private drawHover(gx: number, gy: number, isValid: boolean): void {
        this.hoverGfx.clear();
        if (isValid) {
            this.drawTile(this.hoverGfx, gx, gy,
                hoverTokens.validFill, hoverTokens.validFillAlpha,
                hoverTokens.validStroke, hoverTokens.validStrokeAlpha);
        } else {
            this.drawTile(this.hoverGfx, gx, gy,
                hoverTokens.invalidFill, hoverTokens.invalidFillAlpha,
                hoverTokens.invalidStroke, hoverTokens.invalidStrokeAlpha);
        }
        this.drawCursor();
    }

    private clearHover(): void {
        this.hoverGX = -1;
        this.hoverGY = -1;
        this.hoverGfx.clear();
        this.drawCursor();
    }

    private drawCursor(): void {
        if (!this.cursorVisible) return;
        const { cursorGX, cursorGY } = this.interaction;
        this.drawTile(this.hoverGfx, cursorGX, cursorGY,
            hoverTokens.cursorFill, hoverTokens.cursorFillAlpha,
            hoverTokens.cursorStroke, hoverTokens.cursorStrokeAlpha);
    }

    private isValidDropTarget(gx: number, gy: number, movingNodeId?: string): boolean {
        return !this.engine.nodes.some((n) => n.id !== movingNodeId && n.gx === gx && n.gy === gy);
    }

    // ── Ghost node (drag preview) ─────────────────────────────────────────

    private drawGhostNode(gx: number, gy: number, kind: NodeKind, isValid: boolean): void {
        this.ghostGfx.clear();
        const pos = gridToScreen(gx, gy);
        const sx = this.originX + pos.x;
        const sy = this.originY + pos.y;
        const tokens = nodeTokens[kind];
        const alpha = isValid ? 0.45 : 0.2;

        // Base plate diamond
        const padHW = TILE_W * 0.42;
        const padHH = TILE_H * 0.42;
        this.ghostGfx.fillStyle(tokens.base, alpha * 0.35);
        this.ghostGfx.beginPath();
        this.ghostGfx.moveTo(sx, sy - padHH + 4);
        this.ghostGfx.lineTo(sx + padHW, sy + 4);
        this.ghostGfx.lineTo(sx, sy + padHH + 4);
        this.ghostGfx.lineTo(sx - padHW, sy + 4);
        this.ghostGfx.closePath();
        this.ghostGfx.fillPath();

        this.ghostGfx.lineStyle(1.5, tokens.base, alpha * 0.6);
        this.ghostGfx.beginPath();
        this.ghostGfx.moveTo(sx, sy - padHH + 4);
        this.ghostGfx.lineTo(sx + padHW, sy + 4);
        this.ghostGfx.lineTo(sx, sy + padHH + 4);
        this.ghostGfx.lineTo(sx - padHW, sy + 4);
        this.ghostGfx.closePath();
        this.ghostGfx.strokePath();

        // Service body
        const bodyW = 44;
        const bodyH = 36;
        const bodyX = sx - bodyW / 2;
        const bodyY = sy - bodyH / 2 - 8;
        this.ghostGfx.fillStyle(tokens.base, alpha);
        this.ghostGfx.fillRoundedRect(bodyX, bodyY, bodyW, bodyH, 6);
        this.ghostGfx.lineStyle(1, 0xffffff, alpha * 0.5);
        this.ghostGfx.strokeRoundedRect(bodyX, bodyY, bodyW, bodyH, 6);

        // Invalid X overlay
        if (!isValid) {
            this.ghostGfx.lineStyle(3, 0xe53935, 0.6);
            this.ghostGfx.beginPath();
            this.ghostGfx.moveTo(sx - 10, sy - 18);
            this.ghostGfx.lineTo(sx + 10, sy + 2);
            this.ghostGfx.strokePath();
            this.ghostGfx.beginPath();
            this.ghostGfx.moveTo(sx + 10, sy - 18);
            this.ghostGfx.lineTo(sx - 10, sy + 2);
            this.ghostGfx.strokePath();
        }

        // Label
        const labelText = KIND_LABELS[kind];
        this.ghostLabel.setText(labelText);
        this.ghostLabel.setPosition(sx, sy + padHH + 2);
        this.ghostLabel.setAlpha(alpha);
    }

    private clearGhost(): void {
        this.ghostGfx.clear();
        this.ghostLabel.setAlpha(0);
    }

    private moveCursor(dx: number, dy: number): void {
        this.cursorVisible = true;
        this.interaction.cursorGX += dx;
        this.interaction.cursorGY += dy;
        this.hoverGfx.clear();
        this.drawCursor();
    }

    // ── Actions ───────────────────────────────────────────────────────────

    private handleAction(action: GameAction): void {
        if (action === 'select-lb') this.selectedKind = 'LB';
        if (action === 'select-api') this.selectedKind = 'API';
        if (action === 'select-db') this.selectedKind = 'DB';
        if (action === 'select-cache') this.selectedKind = 'CACHE';
        if (action === 'select-queue') this.selectedKind = 'QUEUE';
        if (action === 'select-worker') this.selectedKind = 'WORKER';

        if (action === 'cursor-up') this.moveCursor(0, -1);
        if (action === 'cursor-down') this.moveCursor(0, 1);
        if (action === 'cursor-left') this.moveCursor(-1, 0);
        if (action === 'cursor-right') this.moveCursor(1, 0);

        if (action === 'open-radial' && this.engine.selectedNodeId) {
            this.radialOpen = !this.radialOpen;
            this.radialIndex = this.radialOpen ? 0 : -1;
            this.redrawNodes();
            return;
        }

        if (action === 'radial-next' && this.radialOpen) {
            this.radialIndex = this.radialIndex < 0
                ? 0
                : (this.radialIndex + 1) % RADIAL_OPTIONS.length;
            this.redrawNodes();
            return;
        }
        if (action === 'radial-prev' && this.radialOpen) {
            this.radialIndex = this.radialIndex < 0
                ? RADIAL_OPTIONS.length - 1
                : (this.radialIndex - 1 + RADIAL_OPTIONS.length) % RADIAL_OPTIONS.length;
            this.redrawNodes();
            return;
        }

        if (action === 'show-stats' && this.engine.selectedNodeId) {
            this.onRadialAction?.('stats');
            this.radialOpen = false;
            this.redrawNodes();
            return;
        }
        if (action === 'show-config' && this.engine.selectedNodeId) {
            this.onRadialAction?.('config');
            this.radialOpen = false;
            this.redrawNodes();
            return;
        }

        if (action === 'confirm') {
            if (this.radialOpen) {
                if (this.radialIndex >= 0 && this.radialIndex < RADIAL_OPTIONS.length) {
                    this.activateRadialOption(RADIAL_OPTIONS[this.radialIndex].id);
                }
                return;
            }
            if (this.interaction.mode === 'move-node' && this.interaction.moveNodeId) {
                const moved = this.engine.moveNode(
                    this.interaction.moveNodeId,
                    this.interaction.cursorGX,
                    this.interaction.cursorGY,
                );
                if (moved) this.redrawNodes();
                this.interaction.mode = 'selected';
            } else {
                const existing = this.engine.nodes.find(
                    (n) => n.gx === this.interaction.cursorGX && n.gy === this.interaction.cursorGY,
                );
                if (existing) {
                    this.engine.selectNode(existing.id);
                    this.interaction.mode = 'selected';
                    this.interaction.moveNodeId = existing.id;
                } else {
                    const added = this.engine.addNode(
                        this.selectedKind,
                        this.interaction.cursorGX,
                        this.interaction.cursorGY,
                    );
                    if (added) this.redrawNodes();
                }
            }
        }

        if (action === 'move-mode' && this.engine.selectedNodeId) {
            const selectedNode = this.engine.getNodeById(this.engine.selectedNodeId);
            if (selectedNode) {
                this.interaction.mode = 'move-node';
                this.interaction.moveNodeId = selectedNode.id;
                this.interaction.moveStartGX = selectedNode.gx;
                this.interaction.moveStartGY = selectedNode.gy;
                this.interaction.cursorGX = selectedNode.gx;
                this.interaction.cursorGY = selectedNode.gy;
                this.hoverGfx.clear();
                this.drawCursor();
            }
        }

        if (action === 'cancel') {
            if (
                this.interaction.mode === 'move-node' &&
                this.interaction.moveStartGX !== null &&
                this.interaction.moveStartGY !== null
            ) {
                this.interaction.cursorGX = this.interaction.moveStartGX;
                this.interaction.cursorGY = this.interaction.moveStartGY;
            }
            this.interaction.mode = this.engine.selectedNodeId ? 'selected' : 'placing';
            this.interaction.dragKind = null;
            this.interaction.dragNodeId = null;
            this.interaction.previewGX = null;
            this.interaction.previewGY = null;
            this.hoverGfx.clear();
            this.drawCursor();
            this.radialOpen = false;
        }

        if (action === 'delete-node' && this.engine.selectedNodeId) {
            const removed = this.engine.removeNode(this.engine.selectedNodeId);
            if (removed) {
                this.interaction.mode = 'placing';
                this.interaction.moveNodeId = null;
                this.redrawNodes();
            }
        }

        if (action === 'submit-start-traffic') {
            this.engine.startTraffic();
        }

        this.updateHud();
    }

    private activateRadialOption(action: RadialAction): void {
        if (action === 'stats' || action === 'config') {
            this.onRadialAction?.(action);
        } else if (action === 'move') {
            this.handleAction('move-mode');
        } else if (action === 'delete' && this.engine.selectedNodeId) {
            const removed = this.engine.removeNode(this.engine.selectedNodeId);
            if (removed) {
                this.interaction.mode = 'placing';
                this.interaction.moveNodeId = null;
            }
        }
        this.radialOpen = false;
        this.redrawNodes();
    }

    // ── Radial ────────────────────────────────────────────────────────────

    private drawRadialOverlay(snap: SimSnapshot): void {
        for (const lbl of this.radialLabels) lbl.destroy();
        this.radialLabels = [];
        this.radialLayout = null;
        if (!this.radialOpen || !snap.selectedNodeId) return;
        const n = snap.nodes.find((nd) => nd.id === snap.selectedNodeId);
        if (!n) return;

        const p = gridToScreen(n.gx, n.gy);
        const cx = this.originX + p.x;
        const cy = this.originY + p.y;
        const radius = 100;
        this.radialLayout = { cx, cy, radius };
        drawRadialMenu(this.radialGfx, this.radialLayout, this.radialIndex);

        const slice = (Math.PI * 2) / RADIAL_OPTIONS.length;
        const labelDist = radius * 0.78;
        for (let i = 0; i < RADIAL_OPTIONS.length; i++) {
            const angle = -Math.PI / 2 + i * slice + slice / 2;
            const tx = cx + Math.cos(angle) * labelDist;
            const ty = cy + Math.sin(angle) * labelDist;
            const isHovered = i === this.radialIndex;
            const label = this.add.text(tx, ty, RADIAL_OPTIONS[i].label, {
                fontFamily: "'Inter', system-ui, sans-serif",
                fontSize: '12px',
                fontStyle: isHovered ? 'bold' : 'normal',
                color: isHovered ? '#2979FF' : '#5f6b7a',
            });
            label.setOrigin(0.5, 0.5);
            this.nodeLayer.add(label);
            this.radialLabels.push(label);
        }
    }

    private refreshRadialVisuals(): void {
        if (!this.radialLayout) return;
        drawRadialMenu(this.radialGfx, this.radialLayout, this.radialIndex);
        for (let i = 0; i < this.radialLabels.length; i++) {
            const isHovered = i === this.radialIndex;
            this.radialLabels[i].setStyle({
                fontStyle: isHovered ? 'bold' : 'normal',
                color: isHovered ? '#2979FF' : '#5f6b7a',
            });
        }
    }

    // ── HUD ───────────────────────────────────────────────────────────────

    private updateHud(): void {
        const kindColor = nodeTokens[this.selectedKind].css;
        this.hudText.setText(
            `  ● ${this.selectedKind} [1-6]  ·  mode: ${this.interaction.mode}  ·  Enter: place/select  ·  M: move  ·  T: start  ·  Esc: cancel  `,
        );
        this.hudText.setColor('#5f6b7a');
    }
}
