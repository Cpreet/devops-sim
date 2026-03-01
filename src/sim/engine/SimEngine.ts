// ── Tick-based simulation engine ────────────────────────────────────────
import type { SimNode, Edge, SimSnapshot, NodeKind, SimArea, ValidationSnapshot, NodeConfig } from '../types';
import { createNode, resetNodeIds } from '../model/nodes';
import { deriveEdges } from '../model/graph';
import { PlacementInputSchema } from '../schemas';
import type { LevelPreset } from '../schemas';
import { validateTopology } from '../validation/topology';

export class SimEngine {
    nodes: SimNode[] = [];
    edges: Edge[] = [];
    areas: SimArea[] = [];
    validation: ValidationSnapshot = { isValid: true, issues: [] };
    selectedNodeId: string | null = null;
    tick = 0;
    trafficRps = 100;
    elapsedSec = 0;

    // ── mutators ──────────────────────────────────────────────────────────

    addNode(kind: NodeKind, gx: number, gy: number): SimNode | null {
        const result = PlacementInputSchema.safeParse({ kind, gx, gy });
        if (!result.success) return null;

        // prevent duplicate placement on same tile
        if (this.nodes.some((n) => n.gx === gx && n.gy === gy)) return null;

        const node = createNode(kind, gx, gy);
        this.nodes.push(node);
        this.edges = deriveEdges(this.nodes);
        this.recomputeValidation();
        return node;
    }

    loadPreset(preset: LevelPreset): void {
        this.reset();
        this.trafficRps = preset.trafficRps;
        if (preset.areas) {
            this.areas = [...preset.areas];
        }
        for (const p of preset.nodes) {
            this.addNode(p.kind, p.gx, p.gy);
        }
    }

    reset(): void {
        this.nodes = [];
        this.edges = [];
        this.areas = [];
        this.tick = 0;
        this.elapsedSec = 0;
        this.trafficRps = 100;
        this.selectedNodeId = null;
        this.recomputeValidation();
        resetNodeIds();
    }

    // ── config API ────────────────────────────────────────────────────────

    getNodeById(nodeId: string): SimNode | undefined {
        return this.nodes.find((n) => n.id === nodeId);
    }

    selectNode(nodeId: string | null): void {
        this.selectedNodeId = nodeId;
    }

    updateNodeConfig(nodeId: string, patch: Partial<NodeConfig>): void {
        const node = this.getNodeById(nodeId);
        if (node) {
            node.config = { ...node.config, ...patch };
            // Changing config might technically change validation if we add more rules,
            // so we recompute just in case.
            this.recomputeValidation();
        }
    }

    private recomputeValidation(): void {
        this.validation = validateTopology(this.nodes, this.edges, this.areas);
    }

    // ── simulation step ───────────────────────────────────────────────────

    /** Advance simulation by `dt` seconds. */
    step(dt: number): void {
        this.tick++;
        this.elapsedSec += dt;

        // Reset all node states for this tick
        for (const n of this.nodes) {
            n.state.inRps = 0;
            n.state.outRps = 0;
            n.state.errRps = 0;
            n.state.p95ms = 0;
            n.state.saturation = 0;
            n.state.dbConns = 0;
        }

        const byId = new Map<string, SimNode>();
        for (const n of this.nodes) byId.set(n.id, n);

        const nodesByKind = new Map<NodeKind, SimNode[]>();
        for (const n of this.nodes) {
            const list = nodesByKind.get(n.kind) ?? [];
            list.push(n);
            nodesByKind.set(n.kind, list);
        }

        const lbs = nodesByKind.get('LB') ?? [];
        const apis = nodesByKind.get('API') ?? [];
        const caches = nodesByKind.get('CACHE') ?? [];
        const dbs = nodesByKind.get('DB') ?? [];
        const queues = nodesByKind.get('QUEUE') ?? [];
        const workers = nodesByKind.get('WORKER') ?? [];

        // 1. Distribute traffic to LBs
        const perLb = lbs.length > 0 ? this.trafficRps / lbs.length : 0;
        for (const lb of lbs) {
            lb.state.inRps = perLb;
            this.applyNodePhysics(lb);
        }

        // 2. LB → API
        const lbOutTotal = lbs.reduce((s, n) => s + n.state.outRps, 0);
        const perApi = apis.length > 0 ? lbOutTotal / apis.length : 0;
        for (const api of apis) {
            api.state.inRps = perApi;
            this.applyNodePhysics(api);
        }

        // 3. API → CACHE (if exists)
        const apiOutTotal = apis.reduce((s, n) => s + n.state.outRps, 0);

        if (caches.length > 0) {
            const perCache = apiOutTotal / caches.length;
            for (const cache of caches) {
                cache.state.inRps = perCache;
                this.applyNodePhysics(cache);
                // cache hit rate reduces downstream DB traffic
                cache.state.outRps = cache.state.outRps * (1 - cache.config.hitRate);
            }

            // CACHE misses → DB
            const cacheMissTotal = caches.reduce((s, n) => s + n.state.outRps, 0);
            if (dbs.length > 0) {
                const perDb = cacheMissTotal / dbs.length;
                for (const db of dbs) {
                    db.state.inRps += perDb;
                }
            }
        } else {
            // No cache: API → DB directly
            if (dbs.length > 0) {
                const perDb = apiOutTotal / dbs.length;
                for (const db of dbs) {
                    db.state.inRps += perDb;
                }
            }
        }

        // 4. API → QUEUE
        if (queues.length > 0) {
            // 30% of API traffic goes to queue as background work
            const queueTraffic = apiOutTotal * 0.3;
            const perQueue = queueTraffic / queues.length;
            for (const q of queues) {
                q.state.inRps = perQueue;
                this.applyNodePhysics(q);
                // queue depth accumulates over time
                const drain = workers.reduce(
                    (s, w) => s + w.config.throughputRps * w.config.concurrency,
                    0,
                );
                const intake = q.state.outRps;
                q.state.queueDepth = Math.max(
                    0,
                    (q.state.queueDepth || 0) + (intake - drain) * dt,
                );
            }
        }

        // 5. QUEUE → WORKER
        if (workers.length > 0 && queues.length > 0) {
            const totalQueueOut = queues.reduce((s, n) => s + n.state.outRps, 0);
            const perWorker = totalQueueOut / workers.length;
            for (const w of workers) {
                const maxDrain = w.config.throughputRps * w.config.concurrency;
                w.state.inRps = Math.min(perWorker, maxDrain);
                this.applyNodePhysics(w);
            }
        }

        // 6. WORKER → DB
        if (workers.length > 0 && dbs.length > 0) {
            const workerDbTraffic = workers.reduce((s, w) => s + w.state.outRps * 0.5, 0);
            const perDb = workerDbTraffic / dbs.length;
            for (const db of dbs) {
                db.state.inRps += perDb;
            }
        }

        // 7. Process DBs last (they received traffic from multiple sources)
        for (const db of dbs) {
            this.applyNodePhysics(db);
            db.state.dbConns = Math.min(
                Math.floor(db.state.inRps * 0.5),
                db.config.maxConns,
            );
        }

        // 8. Set cost
        for (const n of this.nodes) {
            n.state.costPerMin = n.config.costPerMin;
        }
    }

    private applyNodePhysics(node: SimNode): void {
        const cap = node.config.capacityRps;
        const inRps = node.state.inRps;

        // Saturation: 0-1, based on load vs capacity
        const saturation = cap > 0 ? Math.min(inRps / cap, 1) : 0;
        node.state.saturation = saturation;

        // Latency: base + saturation-driven increase
        const baseMs = node.kind === 'CACHE' ? 5 : node.kind === 'DB' ? 20 : 10;
        node.state.p95ms = baseMs * (1 + saturation * saturation * 5);

        // Error rate: kicks in above 80% saturation
        if (saturation > 0.8) {
            node.state.errRps = (saturation - 0.8) * 5 * inRps;
        } else {
            node.state.errRps = 0;
        }

        // Successful output
        node.state.outRps = Math.max(0, inRps - node.state.errRps);
    }

    // ── snapshot ──────────────────────────────────────────────────────────

    getSnapshot(): SimSnapshot {
        return {
            nodes: this.nodes.map((n) => ({
                ...n,
                config: { ...n.config },
                state: { ...n.state },
            })),
            edges: [...this.edges],
            areas: [...this.areas],
            validation: { ...this.validation, issues: [...this.validation.issues] },
            selectedNodeId: this.selectedNodeId,
            tick: this.tick,
            trafficRps: this.trafficRps,
            elapsedSec: this.elapsedSec,
        };
    }
}
