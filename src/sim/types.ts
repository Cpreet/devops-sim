// ── Simulation domain types ─────────────────────────────────────────────

export type NodeKind = 'LB' | 'API' | 'DB' | 'CACHE' | 'QUEUE' | 'WORKER';

export const ALL_KINDS: readonly NodeKind[] = [
    'LB',
    'API',
    'DB',
    'CACHE',
    'QUEUE',
    'WORKER',
] as const;

/** Per-node tuning knobs (only relevant ones populated per kind). */
export interface NodeConfig {
    capacityRps: number;
    timeoutMs: number;
    retries: number;
    ttlSec: number;
    hitRate: number;    // 0-1, only meaningful for CACHE
    maxConns: number;   // DB connection limit
    throughputRps: number;
    concurrency: number;
    costPerMin: number;
}

/** Runtime metrics for a node during simulation. */
export interface NodeState {
    inRps: number;
    outRps: number;
    errRps: number;
    p95ms: number;
    saturation: number; // 0-1
    dbConns: number;
    queueDepth: number;
    costPerMin: number;
}

/** A placed node on the board. */
export interface SimNode {
    id: string;
    kind: NodeKind;
    gx: number;
    gy: number;
    config: NodeConfig;
    state: NodeState;
}

/** A dependency edge between two nodes. */
export interface Edge {
    from: string; // node id
    to: string;   // node id
}

/** Full simulation state. */
export interface SimSnapshot {
    nodes: SimNode[];
    edges: Edge[];
    tick: number;
    trafficRps: number;
    elapsedSec: number;
}

/** Aggregated metrics for the React telemetry panel. */
export interface TelemetrySnapshot {
    simTimeSec: number;
    inputRps: number;
    successRps: number;
    errorRps: number;
    errorRatePct: number;
    p95ms: number;
    dbConns: number;
    queueDepth: number;
    costPerMin: number;
}
