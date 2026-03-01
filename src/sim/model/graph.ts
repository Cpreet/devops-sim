// ── Auto-wiring graph derivation ────────────────────────────────────────
import type { SimNode, Edge } from '../types';

/**
 * Derive dependency edges from the set of placed nodes.
 *
 * Rules:
 *  LB  → API
 *  API → CACHE  (if CACHE exists, else API → DB)
 *  CACHE → DB   (if both exist)
 *  API → QUEUE  (if QUEUE exists)
 *  QUEUE → WORKER (if WORKER exists)
 *  WORKER → DB  (if DB exists)
 *
 * When multiple nodes of the same kind exist, each source connects to
 * every target of the required kind (fan-out).
 */
export function deriveEdges(nodes: SimNode[]): Edge[] {
    const byKind = new Map<string, SimNode[]>();
    for (const n of nodes) {
        const list = byKind.get(n.kind) ?? [];
        list.push(n);
        byKind.set(n.kind, list);
    }

    const edges: Edge[] = [];

    const connect = (fromKind: string, toKind: string) => {
        const froms = byKind.get(fromKind) ?? [];
        const tos = byKind.get(toKind) ?? [];
        for (const f of froms) {
            for (const t of tos) {
                edges.push({ from: f.id, to: t.id });
            }
        }
    };

    // LB → API
    connect('LB', 'API');

    // API → CACHE or API → DB
    const hasCache = (byKind.get('CACHE')?.length ?? 0) > 0;
    if (hasCache) {
        connect('API', 'CACHE');
        connect('CACHE', 'DB');
    } else {
        connect('API', 'DB');
    }

    // API → QUEUE
    connect('API', 'QUEUE');

    // QUEUE → WORKER
    connect('QUEUE', 'WORKER');

    // WORKER → DB
    connect('WORKER', 'DB');

    return edges;
}
