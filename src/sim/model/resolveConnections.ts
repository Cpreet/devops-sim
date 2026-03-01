import type { Edge, NodeKind, SimNode } from '../types';

export const ALLOWED_KIND_DIRECTIONS: ReadonlyArray<`${NodeKind}->${NodeKind}`> = [
    'LB->API',
    'API->CACHE',
    'API->DB',
    'CACHE->DB',
    'API->QUEUE',
    'QUEUE->WORKER',
    'WORKER->DB',
];

function defaultTargetKindsFor(sourceKind: NodeKind, hasCache: boolean): NodeKind[] {
    switch (sourceKind) {
        case 'LB':
            return ['API'];
        case 'API':
            return hasCache ? ['CACHE', 'QUEUE'] : ['DB', 'QUEUE'];
        case 'CACHE':
            return ['DB'];
        case 'QUEUE':
            return ['WORKER'];
        case 'WORKER':
            return ['DB'];
        case 'DB':
            return [];
    }
}

function sortUnique(values: string[]): string[] {
    return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

export function resolveConnections(nodes: SimNode[]): Edge[] {
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    const byKind = new Map<NodeKind, SimNode[]>();
    for (const n of nodes) {
        const list = byKind.get(n.kind) ?? [];
        list.push(n);
        byKind.set(n.kind, list);
    }
    const hasCache = (byKind.get('CACHE')?.length ?? 0) > 0;
    const edges: Edge[] = [];

    const pushEdge = (fromId: string, toId: string): void => {
        if (fromId === toId) return;
        edges.push({ from: fromId, to: toId });
    };

    for (const source of nodes) {
        const routing = source.behavior.routing;
        const explicitTargets = sortUnique(routing.targetNodeIds)
            .map((id) => nodeById.get(id))
            .filter((n): n is SimNode => Boolean(n))
            .map((n) => n.id);

        if (routing.mode === 'explicit' && explicitTargets.length > 0) {
            for (const targetId of explicitTargets) {
                pushEdge(source.id, targetId);
            }
            continue;
        }

        if (routing.mode === 'explicit' && routing.fallback === 'none') {
            continue;
        }

        const targetKinds = defaultTargetKindsFor(source.kind, hasCache);
        for (const targetKind of targetKinds) {
            const targets = byKind.get(targetKind) ?? [];
            for (const target of targets) {
                pushEdge(source.id, target.id);
            }
        }
    }

    return edges.sort((a, b) => {
        const byFrom = a.from.localeCompare(b.from);
        if (byFrom !== 0) return byFrom;
        return a.to.localeCompare(b.to);
    });
}
