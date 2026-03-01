// ── Zod schemas for runtime validation ──────────────────────────────────
import { z } from 'zod';
import { GRID_SIZE } from '../game/iso/isoMath';

// ── Node kinds ──────────────────────────────────────────────────────────

const NodeKindSchema = z.enum(['LB', 'API', 'DB', 'CACHE', 'QUEUE', 'WORKER']);

// ── Placement input validation ──────────────────────────────────────────

export const PlacementInputSchema = z.object({
    kind: NodeKindSchema,
    gx: z.number().int().min(0).max(GRID_SIZE - 1),
    gy: z.number().int().min(0).max(GRID_SIZE - 1),
});

export type PlacementInput = z.infer<typeof PlacementInputSchema>;

// ── Level preset validation ─────────────────────────────────────────────

const PresetNodeSchema = z.object({
    kind: NodeKindSchema,
    gx: z.number().int().min(0).max(GRID_SIZE - 1),
    gy: z.number().int().min(0).max(GRID_SIZE - 1),
});

const AreaKindSchema = z.enum(['PUBLIC', 'APP', 'DATA', 'ASYNC']);

const AreaSchema = z.object({
    id: z.string(),
    kind: AreaKindSchema,
    label: z.string(),
    x: z.number().int(),
    y: z.number().int(),
    w: z.number().int().positive(),
    h: z.number().int().positive(),
});

export const LevelPresetSchema = z.object({
    name: z.string().min(1),
    trafficRps: z.number().positive(),
    nodes: z.array(PresetNodeSchema).min(1),
    areas: z.array(AreaSchema).optional(),
});

export type LevelPreset = z.infer<typeof LevelPresetSchema>;

// ── Sim snapshot validation (lightweight) ───────────────────────────────

export const SimSnapshotSchema = z.object({
    nodes: z.array(
        z.object({
            id: z.string(),
            kind: NodeKindSchema,
            gx: z.number(),
            gy: z.number(),
        }),
    ),
    edges: z.array(
        z.object({
            from: z.string(),
            to: z.string(),
        }),
    ),
    tick: z.number().int().min(0),
    trafficRps: z.number().min(0),
    elapsedSec: z.number().min(0),
});
