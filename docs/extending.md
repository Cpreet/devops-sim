# Extending the Project

> How to add new features, node types, modes, and UI to the DevOps Simulator.

---

## Adding a New Node Kind

Adding a new component type (e.g., `CDN`, `FIREWALL`, `REPLICA_DB`) requires changes in 4 places:

### 1. Add to types

In `src/sim/types.ts`, add the new kind to the union and the `ALL_KINDS` array:

```diff
- export type NodeKind = 'LB' | 'API' | 'DB' | 'CACHE' | 'QUEUE' | 'WORKER';
+ export type NodeKind = 'LB' | 'API' | 'DB' | 'CACHE' | 'QUEUE' | 'WORKER' | 'CDN';
```

### 2. Add default config

In `src/sim/model/nodes.ts`, add a `case` to `defaultConfigFor()`:

```typescript
case 'CDN':
  return {
    capacityRps: 2000,
    timeoutMs: 50,
    // ... other config values
    costPerMin: 0.2,
  };
```

### 3. Add wiring rules

In `src/sim/model/graph.ts`, add connection rules to `deriveEdges()`:

```typescript
// CDN → LB (CDN sits in front of load balancer)
connect('CDN', 'LB');
```

### 4. Add visuals

In `src/game/scenes/BuildScene.ts`:
- Add an entry to `KIND_COLORS` (fallback color)
- Add an entry to `KIND_LABELS` (display name)
- Add an entry to `KIND_ICON_KEY` (icon texture key)
- Add the icon SVG to `public/icons/` and load it in `preload()`
- Add a keybind in `KEY_MAP` (e.g., `SEVEN: 'CDN'`)

### 5. Update schemas

In `src/sim/schemas.ts`, add the new kind to the `NodeKindSchema` enum:

```diff
- const NodeKindSchema = z.enum(['LB', 'API', 'DB', 'CACHE', 'QUEUE', 'WORKER']);
+ const NodeKindSchema = z.enum(['LB', 'API', 'DB', 'CACHE', 'QUEUE', 'WORKER', 'CDN']);
```

---

## Adding a New Preset Level

Create a new file in `src/sim/presets/`, e.g., `level2.ts`:

```typescript
import { LevelPresetSchema } from '../schemas';
import type { LevelPreset } from '../schemas';

const level2Data = {
  name: 'Level 2 — High Traffic',
  trafficRps: 500,
  nodes: [
    { kind: 'LB' as const, gx: 3, gy: 0 },
    //...
  ],
  areas: [
    { id: 'area-1', kind: 'PUBLIC' as const, label: 'Public Edge', x: 0, y: 0, w: 8, h: 2 },
    //...
  ]
};

export const level2: LevelPreset = LevelPresetSchema.parse(level2Data);
```

Then add a button in `ControlsPanel.tsx` and a handler in `App.tsx`.

---

## Adding Manual Graph Editing

The current auto-wiring system in `graph.ts` can be augmented with manual overrides:

1. Add a `manualEdges: Edge[]` array to `SimEngine`
2. Modify `deriveEdges()` to merge auto-derived edges with manual ones
3. Add an "edge mode" to `BuildScene` where clicking two nodes creates a manual edge
4. Store manual edges separately so auto-wiring still works for the default case

The `Edge` type already uses node IDs (`{ from: string, to: string }`), which makes manual connections straightforward.

---

## Adding New Validation Rules

Topology validation runs on every state change. To add a new rule:

1. In `src/sim/types.ts`:
   - Add the new issue code to `ValidationIssueCode` (e.g., `TOO_MANY_DBS`)
2. In `src/sim/validation/topology.ts`:
   - Add the check logic to `validateTopology()`.
   - Call `addIssue('warning', 'TOO_MANY_DBS', '...', [dbIds])` if the check fails.
3. The UI (`ValidationPanel.tsx` and `BuildScene.ts`) will automatically reflect the new errors/warnings.

---

## Adding Incident Mode (Mode 2)

Mode 2 requires:

1. **Scenario definitions**: A preset that includes *broken* nodes (high saturation, misconfigured, etc.)
2. **Incident detection**: Logic that identifies when metrics exceed thresholds
3. **Player actions**: Ability to reconfigure nodes, add capacity, or toggle circuit breakers
4. **Win condition**: Metrics return to healthy ranges within a time limit

Suggested approach:
- Create `src/sim/incidents/` for scenario definitions
- Add an `IncidentEngine` that wraps `SimEngine` with time limits and win conditions
- Create a new Phaser scene (`IncidentScene`) or mode toggle in `BuildScene`
- Add an incident-specific UI panel

---

## Adding Scoring

Scoring can be computed from telemetry snapshots:

```typescript
interface Score {
  reliability: number;  // inversely proportional to error rate
  performance: number;  // inversely proportional to p95 latency
  efficiency: number;   // throughput per dollar
  overall: number;      // weighted combination
}
```

Compute score in `src/sim/telemetry/` alongside `computeTelemetry()`.

---

## Adding Multiple Traffic Patterns

Currently `trafficRps` is a flat constant. To add patterns:

1. Define traffic profiles in `src/sim/traffic/`:
   ```typescript
   type TrafficProfile = {
     name: string;
     rpsAt: (elapsedSec: number) => number;
   };
   ```
2. Example profiles: constant, ramp-up, spike, sinusoidal, bursty
3. Set the active profile on `SimEngine` and compute `trafficRps` per tick from it

---

## Adding Persistence (LocalStorage / Backend)

The simulation state can be serialized using `SimSnapshotSchema`:

```typescript
// Save
const data = JSON.stringify(engine.getSnapshot());
localStorage.setItem('devops-sim-save', data);

// Load
const raw = JSON.parse(localStorage.getItem('devops-sim-save')!);
const snapshot = SimSnapshotSchema.parse(raw);
// Reconstruct engine from snapshot...
```

For a backend, replace `localStorage` with API calls and add auth.

---

## Project Conventions

| Convention | Details |
|-----------|---------|
| **Exports** | Named exports everywhere (no default exports except `App.tsx`) |
| **Types** | Explicit TypeScript types, no `any` |
| **State** | Simulation state lives in `SimEngine`. React reads via snapshots. |
| **Validation** | Zod at boundaries (input, presets, serialization). Not on every internal call. |
| **Rendering** | All visual logic in Phaser. React never draws to canvas. |
| **CSS** | Vanilla CSS, dark theme, no Tailwind or CSS-in-JS |
| **Dependencies** | Minimal. No new libraries without strong justification. |
