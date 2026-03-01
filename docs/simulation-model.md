# Simulation Model

> How the tick-based simulation engine works: traffic flow, physics rules, and node behaviors.

---

## Overview

The simulation runs as a **fixed-step tick loop** at 10 ticks per second. Each tick, traffic flows through the placed architecture following auto-derived dependency edges, and per-node physics (saturation, latency, errors) are computed.

The engine is in `src/sim/engine/SimEngine.ts`.

---

## Traffic Flow Pipeline

Each tick processes traffic in topological order:

```
                    trafficRps
                        │
                        ▼
                   ┌─────────┐
                   │   LB    │  Distributes evenly across LBs
                   └────┬────┘
                        │  outRps
                        ▼
                   ┌─────────┐
                   │   API   │  Processes requests
                   └────┬────┘
                        │
              ┌─────────┼─────────┐
              │         │         │
              ▼         ▼         ▼
         ┌────────┐ ┌───────┐ ┌───────┐
         │ CACHE  │ │ QUEUE │ │  DB   │  (if no cache)
         └───┬────┘ └───┬───┘ └───────┘
             │          │
             ▼          ▼
         ┌───────┐ ┌────────┐
         │  DB   │ │ WORKER │
         └───────┘ └───┬────┘
                       │
                       ▼
                   ┌───────┐
                   │  DB   │
                   └───────┘
```

### Step-by-step

1. **LB receives traffic**: `trafficRps` is split evenly across all LB nodes.
2. **LB → API**: Total LB output is split evenly across all API nodes.
3. **API → CACHE** (if cache exists): API output goes to cache. Cache hit rate (`config.hitRate`, default 80%) reduces downstream DB traffic. Only cache *misses* reach the DB.
4. **API → DB** (if no cache): API output goes directly to DB.
5. **API → QUEUE**: 30% of API output is routed to queues as background work.
6. **QUEUE → WORKER**: Workers drain queue output, capped by `throughputRps × concurrency`.
7. **WORKER → DB**: 50% of worker output generates DB load.
8. **DB processing**: DBs are processed last since they receive traffic from multiple sources (cache misses, direct API, workers).

---

## Node Physics

Every node that receives traffic has three physics applied:

### Saturation

```
saturation = min(inRps / capacityRps, 1.0)
```

A value from 0 to 1 representing how loaded the node is. At 1.0 the node is at maximum capacity.

### Latency (p95)

```
p95ms = baseMs × (1 + saturation² × 5)
```

Latency grows quadratically with saturation. Base latencies:

| Kind | Base ms |
|------|---------|
| CACHE | 5 |
| DB | 20 |
| All others | 10 |

At 100% saturation, latency is **6× the base** (e.g., DB goes from 20ms → 120ms).

### Error Rate

```
if saturation > 0.8:
    errRps = (saturation - 0.8) × 5 × inRps
else:
    errRps = 0
```

Errors only appear when saturation exceeds 80%. At 100% saturation, the error coefficient is `0.2 × 5 = 1.0`, meaning every request errors. Output is reduced accordingly:

```
outRps = max(0, inRps - errRps)
```

---

## Node Types & Default Configs

| Kind | capacityRps | timeoutMs | costPerMin | Special |
|------|-------------|-----------|------------|---------|
| **LB** | 500 | 5000 | $0.50 | Entry point for all traffic |
| **API** | 200 | 3000 | $1.00 | Routes to cache/DB/queue |
| **DB** | 100 | 2000 | $2.00 | `maxConns: 50`, bottleneck-prone |
| **CACHE** | 1000 | 100 | $0.30 | `hitRate: 0.8`, `ttlSec: 60` |
| **QUEUE** | 500 | 30000 | $0.40 | Buffers work, tracks `queueDepth` |
| **WORKER** | 50 | 10000 | $0.80 | `throughputRps: 30`, `concurrency: 4` |

---

## Queue Depth Accumulation

Queue depth is a continuous accumulator that persists between ticks:

```
drain = sum(worker.throughputRps × worker.concurrency)  for all workers
intake = queue.outRps

queueDepth += (intake - drain) × dt
queueDepth = max(0, queueDepth)
```

If intake exceeds drain capacity, the queue grows over time. If workers catch up, it shrinks.

---

## DB Connection Tracking

```
dbConns = min(floor(inRps × 0.5), maxConns)
```

Each DB request holds ~0.5 connections on average. The connection count is capped at `maxConns` (default 50).

---

## Cost

Each node contributes a fixed `costPerMin` from its config. Total cost is the sum across all nodes.

```
totalCost = sum(node.config.costPerMin)  for all nodes
```

---

## Auto-Wiring Rules

Dependency edges are derived (not manually drawn) based on which node kinds are present:

| Rule | Condition |
|------|-----------|
| LB → API | Always (if both exist) |
| API → CACHE | If any CACHE exists |
| API → DB | If no CACHE exists |
| CACHE → DB | If both exist |
| API → QUEUE | If any QUEUE exists |
| QUEUE → WORKER | If both exist |
| WORKER → DB | If both exist |

When multiple nodes of the same kind exist, connections fan out (every source connects to every target of the required kind).

The wiring function is `deriveEdges()` in `src/sim/model/graph.ts`. It rebuilds the full edge list on every topology change (node added/removed).

---

## Telemetry Aggregation

The `computeTelemetry()` function in `src/sim/telemetry/computeTelemetry.ts` reduces a `SimSnapshot` into a `TelemetrySnapshot`:

| Metric | Computation |
|--------|-------------|
| Input RPS | Sum of `inRps` across all LB nodes |
| Success RPS | Sum of `outRps` across all API nodes |
| Error RPS | Sum of `errRps` across all API nodes |
| Error Rate % | `errorRps / (successRps + errorRps) × 100` |
| p95 Latency | Max `p95ms` across all nodes |
| DB Connections | Sum of `dbConns` across all nodes |
| Queue Depth | Max `queueDepth` across all nodes |
| Cost / min | Sum of `costPerMin` across all nodes |

---

## Zod Validation

Three schemas guard the simulation boundaries:

| Schema | Used For |
|--------|----------|
| `PlacementInputSchema` | Validates `(kind, gx, gy)` before `addNode()`. Ensures kind is valid and coordinates are within grid bounds. |
| `LevelPresetSchema` | Validates preset definitions. Level 1 is validated at module load — a malformed preset crashes immediately. |
| `SimSnapshotSchema` | Lightweight validation of snapshot structure. Available for debugging and future serialization. |
