// ── Level 1 preset ──────────────────────────────────────────────────────
import { LevelPresetSchema } from '../schemas';
import type { LevelPreset } from '../schemas';

const level1Data = {
    name: 'Level 1 — Standard Stack',
    trafficRps: 100,
    nodes: [
        { kind: 'LB' as const, gx: 3, gy: 1 },
        { kind: 'API' as const, gx: 3, gy: 3 },
        { kind: 'CACHE' as const, gx: 1, gy: 4 },
        { kind: 'DB' as const, gx: 5, gy: 4 },
        { kind: 'QUEUE' as const, gx: 5, gy: 6 },
        { kind: 'WORKER' as const, gx: 3, gy: 6 },
    ],
    areas: [
        { id: 'area-1', kind: 'PUBLIC' as const, label: 'Public Edge', x: 0, y: 0, w: 8, h: 2 },
        { id: 'area-2', kind: 'APP' as const, label: 'App Tier', x: 0, y: 2, w: 8, h: 2 },
        { id: 'area-3', kind: 'DATA' as const, label: 'Data Tier', x: 0, y: 4, w: 8, h: 2 },
        { id: 'area-4', kind: 'ASYNC' as const, label: 'Async Zone', x: 0, y: 6, w: 8, h: 2 },
    ]
};

// Validate at module load — fail fast if preset is malformed
export const level1: LevelPreset = LevelPresetSchema.parse(level1Data);
