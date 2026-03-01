# Architecture Overview

> How the DevOps Simulator is structured, how data flows, and why.

---

## High-Level Layers

The codebase is divided into three strictly separated layers. Each layer has a single responsibility and communicates through well-defined interfaces.

```
┌─────────────────────────────────────────────────────┐
│                   React Layer                        │
│  App.tsx · TelemetryPanel · ControlsPanel            │
│  Owns: app state, telemetry display, user actions    │
├─────────────────────────────────────────────────────┤
│                   Phaser Layer                       │
│  PhaserHost.tsx · BuildScene · isoMath               │
│  Owns: rendering, camera, input, visual feedback     │
├─────────────────────────────────────────────────────┤
│                 Simulation Layer                     │
│  SimEngine · nodes · graph · telemetry · schemas     │
│  Owns: game logic, tick loop, traffic physics        │
└─────────────────────────────────────────────────────┘
```

### Layer Rules

| Rule | Description |
|------|-------------|
| **Sim → nothing** | The simulation layer has zero dependencies on React or Phaser. It is pure TypeScript logic. |
| **Phaser → Sim** | The Phaser scene holds a reference to `SimEngine` and calls `step()` / `getSnapshot()`. |
| **React → Sim** | React creates the `SimEngine` instance and passes it to Phaser. React reads snapshots via callbacks. |
| **React ↔ Phaser** | Communication flows through `PhaserHost.tsx` which bridges the two worlds via refs and a `redrawToken`. |

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
│  5. onSnapshot(engine.getSnapshot())  ──────────────┐    │
└──────────────────────────────────────────────────────┼────┘
                                                       │
                                                       ▼
┌──────────────────────────────────────────────────────────┐
│                       App.tsx (React)                     │
│                                                          │
│  6. computeTelemetry(snapshot) → TelemetrySnapshot        │
│  7. setTelemetry(result)                                 │
│  8. <TelemetryPanel> re-renders with new data             │
└──────────────────────────────────────────────────────────┘
```

---

## File Responsibilities

### React Layer (`src/app/`)

| File | Responsibility |
|------|---------------|
| `App.tsx` | Creates `SimEngine`, manages telemetry state, wires callbacks between Phaser and UI panels. Flexbox layout with canvas left, sidebar right. |
| `ui/TelemetryPanel.tsx` | Renders live metrics (RPS, latency, error rate, cost, etc.) from `TelemetrySnapshot`. Updates ~8 times/second via throttled React state. |
| `ui/ControlsPanel.tsx` | Two buttons: "Load Level 1" (calls `engine.loadPreset()`) and "Reset" (calls `engine.reset()`). Signals Phaser to redraw via `redrawToken`. |

### Phaser Layer (`src/game/`)

| File | Responsibility |
|------|---------------|
| `PhaserHost.tsx` | React component that mounts/destroys a `Phaser.Game` instance. Uses `Scale.RESIZE` so the canvas fills all available space. Bridges React → Phaser via scene data and a `redrawToken` ref. |
| `scenes/BuildScene.ts` | The main Phaser scene. Draws the isometric grid, renders AWS icons on placed nodes, draws dependency edges, handles keybinds (1–6), left-click placement, right-drag camera pan, scroll zoom. Calls `engine.step(dt)` on every frame and pushes snapshots to React. |
| `iso/isoMath.ts` | Pure math helpers: `gridToScreen()`, `screenToGrid()`, `inBounds()`. Also exports constants `TILE_W`, `TILE_H`, `GRID_SIZE`. Every visual position derives from these functions. |

### Simulation Layer (`src/sim/`)

| File | Responsibility |
|------|---------------|
| `types.ts` | All domain types: `NodeKind`, `NodeConfig`, `NodeState`, `SimNode`, `Edge`, `SimSnapshot`, `TelemetrySnapshot`. |
| `schemas.ts` | Zod schemas: `PlacementInputSchema` (validates node placement), `LevelPresetSchema` (validates presets), `SimSnapshotSchema` (validates snapshots). |
| `engine/SimEngine.ts` | The core tick engine. Manages nodes/edges, processes `step(dt)` with traffic flow and physics, exposes `getSnapshot()`. See [Simulation Model](simulation-model.md) for details. |
| `model/nodes.ts` | `createNode()` factory with `defaultConfigFor()` per kind. Generates stable IDs. |
| `model/graph.ts` | `deriveEdges()` — auto-wires dependency edges based on which node kinds exist. Rebuilt on every topology change. |
| `presets/level1.ts` | The Level 1 starter architecture (LB, API, Cache, DB, Queue, Worker). Validated against `LevelPresetSchema` at module load. |
| `telemetry/computeTelemetry.ts` | Pure function: `SimSnapshot → TelemetrySnapshot`. Aggregates per-node metrics into dashboard values. |

---

## Key Design Decisions

### 1. Simulation is a plain class, not a Phaser plugin

The `SimEngine` is a standalone TypeScript class with no framework dependencies. This makes it testable, portable, and reusable if we ever extract it to a Web Worker or shared library.

### 2. Auto-wired graph instead of manual connections

For the MVP, dependency edges are **derived from node types**, not manually drawn by the user. The `deriveEdges()` function rebuilds the full edge list whenever nodes change. This keeps the initial experience simple while the code is structured to support manual editing later (just swap or augment `deriveEdges`).

### 3. React owns state, Phaser owns rendering

React manages the `SimEngine` instance and telemetry state. Phaser never stores application state — it reads from the engine and pushes snapshots back via a callback. This avoids the classic "two sources of truth" problem.

### 4. Throttled React updates

The `onSnapshot` callback fires every Phaser frame (~60 fps), but React state updates are throttled to ~8 fps via `performance.now()` gating. This keeps the telemetry panel responsive without drowning React in re-renders.

### 5. Camera-based infinite canvas

The Phaser camera can pan and zoom freely. Nodes live in world-space coordinates (offset from `originX/Y = 2000`), and the grid is always rendered at fixed world positions. This means the canvas feels infinite — you can pan anywhere and zoom from 0.3× to 3×.

### 6. AWS service icons loaded as SVGs

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
