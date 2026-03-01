// ── Telemetry aggregation ───────────────────────────────────────────────
import type { SimSnapshot, TelemetrySnapshot } from '../types';

/** Aggregate per-node metrics into a single telemetry view. */
export function computeTelemetry(snap: SimSnapshot): TelemetrySnapshot {
    let inputRps = 0;
    let successRps = 0;
    let errorRps = 0;
    let maxP95 = 0;
    let dbConns = 0;
    let maxQueueDepth = 0;
    let costPerMin = 0;

    for (const n of snap.nodes) {
        // Only count LB inRps as "input" to avoid double-counting
        if (n.kind === 'LB') {
            inputRps += n.state.inRps;
        }
        // Successful RPS = API outRps (end-user perspective)
        if (n.kind === 'API') {
            successRps += n.state.outRps;
            errorRps += n.state.errRps;
        }
        maxP95 = Math.max(maxP95, n.state.p95ms);
        dbConns += n.state.dbConns;
        maxQueueDepth = Math.max(maxQueueDepth, n.state.queueDepth);
        costPerMin += n.state.costPerMin;
    }

    const totalHandled = successRps + errorRps;
    const errorRatePct = totalHandled > 0 ? (errorRps / totalHandled) * 100 : 0;

    return {
        simTimeSec: snap.elapsedSec,
        inputRps: round2(inputRps),
        successRps: round2(successRps),
        errorRps: round2(errorRps),
        errorRatePct: round2(errorRatePct),
        p95ms: round2(maxP95),
        dbConns,
        queueDepth: round2(maxQueueDepth),
        costPerMin: round2(costPerMin),
    };
}

function round2(n: number): number {
    return Math.round(n * 100) / 100;
}
