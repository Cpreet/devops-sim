# Architecture Overview

> How the DevOps Simulator is structured, how data flows, and why.

---

## High-Level Layers

The codebase is divided into three strictly separated layers. Each layer has a single responsibility and communicates through well-defined interfaces.

```
┌─────────────────────────────────────────────────────┐
│                   React Layer                        │
│  App.tsx · TelemetryPanel · ControlsPanel            │
│  NodeInspector · ValidationPanel                     │
│  Owns: app state, UI dashboards, config forms        │
├─────────────────────────────────────────────────────┤
│                   Phaser Layer                       │
│  PhaserHost.tsx · BuildScene · isoMath               │
│  Owns: rendering, camera, input, visual feedback     │
├─────────────────────────────────────────────────────┤
│                 Simulation Layer                     │
│  SimEngine · nodes · graph · telemetry               │
│  topology.ts (validation) · schemas                  │
│  Owns: game logic, tick loop, validation, traffic    │
└─────────────────────────────────────────────────────┘
```

### Layer Rules

| Rule | Description |
|------|-------------|
| **Sim → nothing** | The simulation layer has zero dependencies on React or Phaser. It is pure TypeScript logic. |
| **Phaser → Sim** | The Phaser scene holds a reference to `SimEngine` and calls `step()` / `getSnapshot()`. |
| **React → Sim** | React creates the `SimEngine` instance and passes it to Phaser. React reads snapshots via callbacks. |
| **React ↔ Phaser** | Communication flows through `PhaserHost.tsx` with scene callbacks and a `redrawToken`. |

---

## Data Flow

```
                        ┌──────────────┐
                        │  User Input  │
                        │  (click/key) │
                        └──────┬───────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────┐
│                      BuildScene (Phaser)                  │
│                                                          │
│  1. screenToGrid() → grid coordinates                    │
│  2. engine.addNode(kind, gx, gy)                         │
│  3. redrawNodes() → re-render icons + edges              │
│                                                          │
│  On every frame:                                         │
│  4. engine.step(dt)                                      │
│  5. drawFlowEdges(engine.getSnapshot()) -> flowArrows     │
│  6. onSnapshot(engine.getSnapshot())  ──────────────┐    │
└──────────────────────────────────────────────────────┼────┘
                                                       │
                                                       ▼
┌──────────────────────────────────────────────────────────┐
│                       App.tsx (React)                     │
│                                                          │
│  7. computeTelemetry(snapshot) → TelemetrySnapshot       │
│  8. setTelemetry(result), setValidation(snap.validation) │
│  9. <TelemetryPanel> and <ValidationPanel> update        │
└──────────────────────────────────────────────────────────┘
```

---

## File Responsibilities

### React Layer (`src/app/`)

| File | Responsibility |
|------|---------------|
| `ui/TelemetryPanel.tsx` | Renders live metrics (RPS, latency, error rate, cost, etc.) from `TelemetrySnapshot` and architecture health from validation. Updates ~8 times/second via throttled React state. |
| `ui/ControlsPanel.tsx` | Submission and lifecycle controls (`Submit`, `Start/Pause`, `Stop`, `Load`, `Reset`). |
| `ui/NodeInspector.tsx` | Inspector with Stats/Config tabs for selected node. |
| `ui/ConfigEditor.tsx` | Behavior/routing/dependency editor with optional JSON script mode. |
| `ui/KeyboardLegend.tsx` | Keyboard accessibility reference panel. |
| `ui/ValidationPanel.tsx` | Dash rendering active validation alerts preventing ideal configuration. |

### Phaser Layer (`src/game/`)

| File | Responsibility |
|------|---------------|
| `PhaserHost.tsx` | React component that mounts/destroys a `Phaser.Game` instance. Bridges React and scene callbacks (`snapshot`, `radialAction`) plus redraw signals. |
| `input/keymap.ts` | Centralized key → action mapping for keyboard-first interactions. |
| `input/interactionState.ts` | Typed interaction states (`placing`, `dragging`, `move-node`, etc). |
| `scenes/BuildScene.ts` | Main scene for rendering, drag/drop placement/movement, keyboard cursor placement, move mode, radial menu interaction, and camera controls. Calls `engine.step(dt)` each frame (engine decides if running). |
| `iso/isoMath.ts` | Pure math helpers: `gridToScreen()`, `screenToGrid()`, `inBounds()`. Also exports constants `TILE_W`, `TILE_H`, `GRID_SIZE`. Every visual position derives from these functions. |
| `render/edgeRouting.ts` | Pure deterministic grid-lane routing helper used for edge polylines and area-aware boundary crossing points. |
| `render/flowArrows.ts` | Draws routed directional edges, arrowheads, and animated flow pulses with healthy/warn/error/active visual states. |
| `render/edgeRenderer.ts` | Compatibility wrapper that re-exports the current flow-edge renderer API. |

### Simulation Layer (`src/sim/`)

| File | Responsibility |
|------|---------------|
| `types.ts` | Domain types including lifecycle state, submission state/result, and structured node behavior config. |
| `engine/SimEngine.ts` | Core engine with lifecycle methods (`submit/start/pause/stop`), dirty tracking, node movement, config/script mutation boundaries, and runtime stepping logic. |
| `model/nodes.ts` | Node factory with default runtime config + default behavior config. |
| `model/resolveConnections.ts` | Typed config-driven dependency resolution with fallback defaults. |
| `model/graph.ts` | Stable facade (`deriveEdges`) that delegates to config-driven resolver. |
| `validation/topology.ts`| `validateTopology()` — Checks dependency direction, persistence paths, queue/worker/cache rules, reachability, isolation, and area placement guidance. |
| `presets/level1.ts` | The Level 1 starter architecture (LB, API, Cache, DB, Queue, Worker) bundled with predefined public/private VPC areas. Validated against `LevelPresetSchema` at module load. |
| `telemetry/computeTelemetry.ts` | Pure function: `SimSnapshot → TelemetrySnapshot`. Aggregates per-node metrics into dashboard values. |

---

## Key Design Decisions

### 1. Simulation is a plain class, not a Phaser plugin

The `SimEngine` is a standalone TypeScript class with no framework dependencies. This makes it testable, portable, and reusable if we ever extract it to a Web Worker or shared library.

### 2. Config-driven graph with safe defaults

Dependency edges are derived by `resolveConnections()` from per-node behavior config. In `auto` mode, rules fall back to kind-based defaults; in `explicit` mode, configured targets are used. This preserves deterministic behavior while enabling script-like routing control.

### 3. React owns state, Phaser owns rendering

React manages the `SimEngine` instance and telemetry state. Phaser never stores application state — it reads from the engine and pushes snapshots back via a callback. This avoids the classic "two sources of truth" problem.

### 4. Throttled telemetry updates + immediate selection updates

The `onSnapshot` callback fires every Phaser frame (~60 fps), but telemetry and validation updates are throttled to ~8 fps via `performance.now()` gating. Node selection updates are applied immediately so inspector interactions stay responsive.

### 5. Explicit build-submit-run lifecycle

The engine now models architecture lifecycle explicitly (`build`, `review`, `running`, `paused`, `stopped`) and tracks dirty/submission state. Traffic only advances when the run state is active; submit/start controls are player-driven.

### 6. Camera-based infinite canvas

The Phaser camera can pan and zoom freely. Nodes live in world-space coordinates (offset from `originX/Y = 2000`), and the grid is always rendered at fixed world positions. This means the canvas feels infinite — you can pan anywhere and zoom from 0.3× to 3×.

### 7. AWS service icons loaded as SVGs

Icons are loaded in Phaser's `preload()` step from `/public/icons/`. Each is a 48×48 SVG from the official AWS Architecture Icon set, mapped to our game's node kinds (LB → ELB, API → API Gateway, DB → DynamoDB, CACHE → ElastiCache, QUEUE → SQS, WORKER → Lambda).

---

## Technology Choices

| Choice | Rationale |
|--------|-----------|
| **Phaser 3** | Battle-tested 2D game engine with built-in camera, input handling, and rendering pipeline. Avoids reinventing scroll/zoom/input. |
| **React** | Handles the UI panels and app state naturally. Phaser handles the game canvas. Clean separation. |
| **Zod 4** | Lightweight runtime validation for node placement, presets, and snapshots. Catches bad data before it enters the simulation. |
| **Vanilla CSS** | No build-time CSS tooling needed. Dark theme with CSS gradients and custom properties. Simple and predictable. |
| **Canvas renderer** | Chosen over WebGL for maximum compatibility. The game uses simple shapes and icons — no need for GPU acceleration. |
