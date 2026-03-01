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

export type RoutingMode = 'auto' | 'explicit';
export type RoutingFallback = 'auto' | 'none';

export interface NodeRoutingConfig {
    mode: RoutingMode;
    targetNodeIds: string[];
    fallback: RoutingFallback;
    queueWeightPct: number; // 0-1, API background traffic split
    workerDbWritePct: number; // 0-1, worker output written to DB
}

export interface NodeDependencyConfig {
    preferredNodeIds: string[];
}

export interface NodePolicyConfig {
    dropOnInvalidTargets: boolean;
}

export interface NodeBehaviorConfig {
    routing: NodeRoutingConfig;
    dependencies: NodeDependencyConfig;
    policies: NodePolicyConfig;
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
    behavior: NodeBehaviorConfig;
    scriptText?: string;
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
    areas: SimArea[];
    validation: ValidationSnapshot;
    selectedNodeId: string | null;
    tick: number;
    trafficRps: number;
    elapsedSec: number;
    runState: ArchitectureRunState;
    submissionState: SubmissionState;
    isDirty: boolean;
    trafficActive: boolean;
    lastSubmitAtTick: number | null;
    lastSubmission: SubmissionResult | null;
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

// ── Areas & VPCs ────────────────────────────────────────────────────────

export type AreaKind = 'PUBLIC' | 'APP' | 'DATA' | 'ASYNC';

export interface SimArea {
    id: string;
    kind: AreaKind;
    label: string;
    x: number;
    y: number;
    w: number;
    h: number;
}

// ── Validation ──────────────────────────────────────────────────────────

export type ValidationSeverity = 'info' | 'warning' | 'error';

export type ValidationIssueCode =
    | 'NO_ENTRYPOINT'
    | 'NO_API'
    | 'NO_STORAGE'
    | 'API_WITHOUT_BACKING'
    | 'QUEUE_WITHOUT_WORKER'
    | 'WORKER_WITHOUT_QUEUE'
    | 'CACHE_WITHOUT_DB'
    | 'DB_UNREACHABLE'
    | 'PUBLIC_TO_PRIVATE_VIOLATION'
    | 'INVALID_DEPENDENCY_DIRECTION'
    | 'ISOLATED_NODE';

export interface ValidationIssue {
    id: string;
    severity: ValidationSeverity;
    code: ValidationIssueCode;
    message: string;
    nodeIds?: string[];
}

export interface ValidationSnapshot {
    isValid: boolean;
    issues: ValidationIssue[];
}

export type ArchitectureRunState = 'build' | 'review' | 'running' | 'paused' | 'stopped';
export type SubmissionState = 'clean' | 'dirty' | 'validated' | 'invalid';

export interface SubmissionResult {
    accepted: boolean;
    blockingIssueIds: string[];
    degradationIssueIds: string[];
}
