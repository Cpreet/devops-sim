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
};

// Validate at module load — fail fast if preset is malformed
export const level1: LevelPreset = LevelPresetSchema.parse(level1Data);
