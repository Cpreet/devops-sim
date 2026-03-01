// ── Node factory & default configs ──────────────────────────────────────
import type { NodeKind, NodeConfig, NodeState, SimNode, NodeBehaviorConfig } from '../types';

let nextId = 1;

export function resetNodeIds(): void {
    nextId = 1;
}

function freshState(): NodeState {
    return {
        inRps: 0,
        outRps: 0,
        errRps: 0,
        p95ms: 0,
        saturation: 0,
        dbConns: 0,
        queueDepth: 0,
        costPerMin: 0,
    };
}

export function defaultConfigFor(kind: NodeKind): NodeConfig {
    switch (kind) {
        case 'LB':
            return {
                capacityRps: 500,
                timeoutMs: 5000,
                retries: 0,
                ttlSec: 0,
                hitRate: 0,
                maxConns: 0,
                throughputRps: 0,
                concurrency: 0,
                costPerMin: 0.5,
            };
        case 'API':
            return {
                capacityRps: 200,
                timeoutMs: 3000,
                retries: 2,
                ttlSec: 0,
                hitRate: 0,
                maxConns: 0,
                throughputRps: 0,
                concurrency: 0,
                costPerMin: 1.0,
            };
        case 'DB':
            return {
                capacityRps: 100,
                timeoutMs: 2000,
                retries: 0,
                ttlSec: 0,
                hitRate: 0,
                maxConns: 50,
                throughputRps: 0,
                concurrency: 0,
                costPerMin: 2.0,
            };
        case 'CACHE':
            return {
                capacityRps: 1000,
                timeoutMs: 100,
                retries: 0,
                ttlSec: 60,
                hitRate: 0.8,
                maxConns: 0,
                throughputRps: 0,
                concurrency: 0,
                costPerMin: 0.3,
            };
        case 'QUEUE':
            return {
                capacityRps: 500,
                timeoutMs: 30000,
                retries: 3,
                ttlSec: 0,
                hitRate: 0,
                maxConns: 0,
                throughputRps: 0,
                concurrency: 0,
                costPerMin: 0.4,
            };
        case 'WORKER':
            return {
                capacityRps: 50,
                timeoutMs: 10000,
                retries: 2,
                ttlSec: 0,
                hitRate: 0,
                maxConns: 0,
                throughputRps: 30,
                concurrency: 4,
                costPerMin: 0.8,
            };
    }
}

export function defaultBehaviorFor(kind: NodeKind): NodeBehaviorConfig {
    void kind;
    return {
        routing: {
            mode: 'auto',
            targetNodeIds: [],
            fallback: 'auto',
            queueWeightPct: 0.3,
            workerDbWritePct: 0.5,
        },
        dependencies: {
            preferredNodeIds: [],
        },
        policies: {
            dropOnInvalidTargets: false,
        },
    };
}

export function createNode(kind: NodeKind, gx: number, gy: number): SimNode {
    return {
        id: `node-${nextId++}`,
        kind,
        gx,
        gy,
        config: defaultConfigFor(kind),
        behavior: defaultBehaviorFor(kind),
        state: freshState(),
    };
}
