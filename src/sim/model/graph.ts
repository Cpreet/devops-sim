// ── Auto-wiring graph derivation ────────────────────────────────────────
import type { SimNode, Edge } from '../types';
import { resolveConnections } from './resolveConnections';

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
    return resolveConnections(nodes);
}
