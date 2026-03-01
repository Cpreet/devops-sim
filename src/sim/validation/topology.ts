import type { SimNode, Edge, SimArea, ValidationSnapshot, ValidationIssue, NodeKind } from '../types';
import { ALLOWED_KIND_DIRECTIONS } from '../model/resolveConnections';

let issueIdSeq = 1;

export function validateTopology(
    nodes: SimNode[],
    edges: Edge[],
    areas: SimArea[]
): ValidationSnapshot {
    const issues: ValidationIssue[] = [];
    issueIdSeq = 1;

    const addIssue = (
        severity: ValidationIssue['severity'],
        code: ValidationIssue['code'],
        message: string,
        nodeIds?: string[]
    ) => {
        issues.push({
            id: `v-${issueIdSeq++}`,
            severity,
            code,
            message,
            nodeIds,
        });
    };

    if (nodes.length === 0) {
        return { isValid: true, issues: [] };
    }

    const byKind = new Map<NodeKind, SimNode[]>();
    const nodeById = new Map<string, SimNode>();
    for (const n of nodes) {
        const list = byKind.get(n.kind) || [];
        list.push(n);
        byKind.set(n.kind, list);
        nodeById.set(n.id, n);
    }

    const lbs = byKind.get('LB') || [];
    const apis = byKind.get('API') || [];
    const caches = byKind.get('CACHE') || [];
    const dbs = byKind.get('DB') || [];
    const queues = byKind.get('QUEUE') || [];
    const workers = byKind.get('WORKER') || [];

    // Edges connected to each node
    const inEdges = new Map<string, string[]>();
    const outEdges = new Map<string, string[]>();
    for (const n of nodes) {
        inEdges.set(n.id, []);
        outEdges.set(n.id, []);
    }
    for (const e of edges) {
        inEdges.get(e.to)?.push(e.from);
        outEdges.get(e.from)?.push(e.to);
    }

    // Detect invalid directional edges (future-safe for manual edges)
    const allowedDirectionalEdges = new Set(ALLOWED_KIND_DIRECTIONS);

    for (const e of edges) {
        const fromNode = nodeById.get(e.from);
        const toNode = nodeById.get(e.to);
        if (!fromNode || !toNode) continue;
        const key = `${fromNode.kind}->${toNode.kind}` as `${NodeKind}->${NodeKind}`;
        if (!allowedDirectionalEdges.has(key)) {
            addIssue(
                'error',
                'INVALID_DEPENDENCY_DIRECTION',
                `Invalid dependency direction: ${fromNode.kind} -> ${toNode.kind}`,
                [fromNode.id, toNode.id],
            );
        }
    }

    // Isolated nodes
    for (const n of nodes) {
        const ins = inEdges.get(n.id)?.length || 0;
        const outs = outEdges.get(n.id)?.length || 0;
        if (ins === 0 && outs === 0) {
            // LBs are allowed to have 0 inEdges, but must have outs.
            // DBs are allowed to have 0 outEdges, but must have ins.
            // If it has truly 0 of both (and there are other nodes), it's isolated.
            if (nodes.length > 1) {
                addIssue('warning', 'ISOLATED_NODE', `${n.kind} is isolated (no connections)`, [n.id]);
            }
        }
    }

    // LB rules
    if (lbs.length === 0) {
        addIssue('warning', 'NO_ENTRYPOINT', 'Architecture has no Load Balancer for entry');
    }

    // API rules
    if (lbs.length > 0 && apis.length === 0) {
        addIssue('error', 'NO_API', 'Load Balancer exists but no API to route traffic to', lbs.map(l => l.id));
    }
    // DB / storage rules
    if (dbs.length === 0) {
        addIssue('error', 'NO_STORAGE', 'Architecture has no Database for persistence');
    }

    // CACHE - DB rules
    if (caches.length > 0 && dbs.length === 0) {
        addIssue('error', 'CACHE_WITHOUT_DB', 'Cache exists but no Database backing it', caches.map(c => c.id));
    }

    // Required persistence paths:
    //   API -> DB
    //   API -> CACHE -> DB
    //   API -> QUEUE -> WORKER -> DB
    const hasEdgeBetweenKinds = (fromKind: NodeKind, toKind: NodeKind): boolean => {
        return edges.some((e) => {
            const fromNode = nodeById.get(e.from);
            const toNode = nodeById.get(e.to);
            return fromNode?.kind === fromKind && toNode?.kind === toKind;
        });
    };

    const hasApiDbPath =
        hasEdgeBetweenKinds('API', 'DB') ||
        (hasEdgeBetweenKinds('API', 'CACHE') && hasEdgeBetweenKinds('CACHE', 'DB')) ||
        (hasEdgeBetweenKinds('API', 'QUEUE') &&
            hasEdgeBetweenKinds('QUEUE', 'WORKER') &&
            hasEdgeBetweenKinds('WORKER', 'DB'));

    if (apis.length > 0 && !hasApiDbPath) {
        addIssue(
            'error',
            'API_WITHOUT_BACKING',
            'API exists but no persistence path is reachable (API->DB, API->CACHE->DB, or API->QUEUE->WORKER->DB)',
            apis.map((a) => a.id),
        );
    }

    // QUEUE - WORKER rules
    if (queues.length > 0 && workers.length === 0) {
        const queueHasIngress = queues.some((q) => (inEdges.get(q.id)?.length || 0) > 0);
        addIssue(
            queueHasIngress ? 'error' : 'warning',
            'QUEUE_WITHOUT_WORKER',
            queueHasIngress
                ? 'Queue receives routed traffic but no Worker is consuming it'
                : 'Queue exists but no Worker consuming it',
            queues.map((q) => q.id),
        );
    }
    if (workers.length > 0 && queues.length === 0) {
        addIssue('warning', 'WORKER_WITHOUT_QUEUE', 'Worker exists but no Queue feeding it', workers.map(w => w.id));
    }

    // DB Reachability
    // basic BFS from any LB or API
    const reachable = new Set<string>();
    const queue: string[] = [];
    for (const n of [...lbs, ...apis]) {
        queue.push(n.id);
        reachable.add(n.id);
    }
    while (queue.length > 0) {
        const curr = queue.shift()!;
        const outs = outEdges.get(curr) || [];
        for (const outId of outs) {
            if (!reachable.has(outId)) {
                reachable.add(outId);
                queue.push(outId);
            }
        }
    }

    for (const db of dbs) {
        if (!reachable.has(db.id)) {
            // if we have no LB/API at all, everything is unreachable, but we already have NO_ENTRYPOINT warning
            if (lbs.length > 0 || apis.length > 0) {
                addIssue('warning', 'DB_UNREACHABLE', 'Database is unreachable from traffic graph', [db.id]);
            }
        }
    }

    // Determine area boundaries and placement violations
    const recommendedAreasByKind: Record<NodeKind, ReadonlyArray<SimArea['kind']>> = {
        LB: ['PUBLIC'],
        API: ['APP'],
        DB: ['DATA'],
        CACHE: ['DATA'],
        QUEUE: ['ASYNC', 'APP'],
        WORKER: ['ASYNC', 'APP'],
    };

    for (const n of nodes) {
        const insideArea = areas.find(
            (a) => n.gx >= a.x && n.gx < a.x + a.w && n.gy >= a.y && n.gy < a.y + a.h,
        );
        if (!insideArea) {
            addIssue(
                'warning',
                'PUBLIC_TO_PRIVATE_VIOLATION',
                `${n.kind} is outside all defined areas`,
                [n.id],
            );
            continue;
        }

        if (!recommendedAreasByKind[n.kind].includes(insideArea.kind)) {
            addIssue(
                'warning',
                'PUBLIC_TO_PRIVATE_VIOLATION',
                `${n.kind} placed in unrecommended zone (${insideArea.kind})`,
                [n.id],
            );
        }
    }

    const hasErrors = issues.some(i => i.severity === 'error');
    return {
        isValid: !hasErrors,
        issues,
    };
}
