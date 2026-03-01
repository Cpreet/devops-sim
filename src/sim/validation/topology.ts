import type { SimNode, Edge, SimArea, ValidationSnapshot, ValidationIssue } from '../types';

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

    const byKind = new Map<string, SimNode[]>();
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
    if (apis.length > 0 && dbs.length === 0 && caches.length === 0 && queues.length === 0) {
        addIssue('warning', 'API_WITHOUT_BACKING', 'API exists but has no downstream services', apis.map(a => a.id));
    }

    // DB rules
    if (dbs.length === 0) {
        addIssue('warning', 'NO_STORAGE', 'Architecture has no Database for persistence');
    }

    // CACHE - DB rules
    if (caches.length > 0 && dbs.length === 0) {
        addIssue('error', 'CACHE_WITHOUT_DB', 'Cache exists but no Database backing it', caches.map(c => c.id));
    }

    // QUEUE - WORKER rules
    if (queues.length > 0 && workers.length === 0) {
        addIssue('error', 'QUEUE_WITHOUT_WORKER', 'Queue exists but no Worker consuming it', queues.map(q => q.id));
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

    // Determine area boundaries and violations
    for (const n of nodes) {
        let insideArea: SimArea | undefined;
        for (const a of areas) {
            if (n.gx >= a.x && n.gx < a.x + a.w && n.gy >= a.y && n.gy < a.y + a.h) {
                insideArea = a;
                break;
            }
        }
        if (insideArea) {
            let valid = true;
            switch (n.kind) {
                case 'LB': valid = insideArea.kind === 'PUBLIC'; break;
                // case 'API': valid = insideArea.kind === 'APP'; break;
                case 'DB': valid = insideArea.kind === 'DATA'; break;
                // Allow some flex for worker, queues, cache
            }
            if (!valid) {
                addIssue('warning', 'PUBLIC_TO_PRIVATE_VIOLATION', `${n.kind} placed in unrecommended zone (${insideArea.kind})`, [n.id]);
            }
        }
    }

    const hasErrors = issues.some(i => i.severity === 'error');
    return {
        isValid: !hasErrors,
        issues,
    };
}
