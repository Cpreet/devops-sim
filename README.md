# DevOps Simulator

A game-like interactive simulator for **software systems design and reliability thinking**. Players build distributed architectures on an isometric grid, configure service behavior, validate topology, and explicitly submit/start traffic runs.

![Level 1 — Standard Stack](docs/assets/level1-screenshot.png)

## Quick Start

```bash
bun install
bun dev
```

Open [http://localhost:5173](http://localhost:5173).

## What Is This?

DevOps Simulator is a **strategy / management game for backend infrastructure concepts**:

- **Mode 1 — Build & Submit** *(implemented)*: Place and move infrastructure components (Load Balancer, API, Cache, Database, Queue, Worker), configure routing/dependency behavior, review validation, then explicitly submit/start traffic.
- **Mode 2 — Ops / Incident** *(planned)*: Inherit a degraded system and diagnose + fix it under pressure.

## Controls

| Input | Action |
|-------|--------|
| `1`–`6` | Select component type (LB, API, DB, Cache, Queue, Worker) |
| `Arrows` / `WASD` | Move placement cursor |
| `Enter` / `Space` | Place/select/confirm action |
| Left drag | Place ghost / move selected node with grid snap |
| `M` | Enter keyboard move mode for selected node |
| `R` | Open radial node menu |
| `Tab` / `Q` | Cycle radial menu actions |
| `F` / `C` | Switch inspector tab to Stats / Config |
| `Del` / `Backspace` | Delete selected node |
| `T` | Submit and start traffic |
| Right-drag | Pan the camera |
| Scroll wheel | Zoom in / out |
| Submit Architecture | Re-run validation and freeze submission snapshot |
| Start / Pause / Stop | Explicitly control traffic execution lifecycle |
| Load Level 1 | Load the preset architecture and areas |
| Reset | Clear all nodes and reset lifecycle state |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | [Bun](https://bun.sh) |
| Bundler | [Vite](https://vite.dev) |
| UI | [React 19](https://react.dev) |
| Rendering | [Phaser 3](https://phaser.io) (Canvas) |
| Validation | [Zod 4](https://zod.dev) |
| Language | TypeScript 5.9 |
| Icons | AWS Architecture Icons |

## Project Structure

```
src/
├── app/                    # React application layer
│   ├── App.tsx             # App shell — layout, state, callbacks
│   └── ui/
│       ├── TelemetryPanel.tsx   # Live metrics dashboard
│       ├── ControlsPanel.tsx    # Submit / start / pause / stop / reset
│       ├── NodeInspector.tsx    # Stats/config inspector for selected node
│       ├── ConfigEditor.tsx     # Structured + JSON behavior editor
│       └── KeyboardLegend.tsx   # Keyboard accessibility legend
├── game/                   # Phaser rendering layer
│   ├── PhaserHost.tsx      # React ↔ Phaser bridge
│   ├── input/
│   │   ├── keymap.ts       # Central key -> action mapping
│   │   └── interactionState.ts  # Scene interaction mode state
│   ├── iso/
│   │   └── isoMath.ts      # Isometric grid ↔ screen math
│   ├── render/
│   │   ├── edgeRouting.ts  # Deterministic edge route generation
│   │   ├── flowArrows.ts   # Directed flow rendering + pulses
│   │   └── radialMenu.ts   # Radial node action menu
│   └── scenes/
│       └── BuildScene.ts   # Grid, nodes, radial UX, drag/keyboard input
├── sim/                    # Simulation layer (pure logic)
│   ├── types.ts            # Domain types
│   ├── schemas.ts          # Zod validation schemas
│   ├── engine/
│   │   └── SimEngine.ts    # Lifecycle, submit/run state, traffic sim
│   ├── model/
│   │   ├── nodes.ts        # Node factory + default configs
│   │   ├── graph.ts        # Edge derivation facade
│   │   └── resolveConnections.ts # Config-driven connection resolver
│   ├── presets/
│   │   └── level1.ts       # Starter architecture preset
│   ├── validation/
│   │   └── topology.ts     # Topology and placement validation rules
│   └── telemetry/
│       └── computeTelemetry.ts  # Snapshot → dashboard aggregation
├── main.tsx                # Entry point
└── styles.css              # Global dark theme CSS
```

## Documentation

See [`docs/`](docs/) for detailed architecture and design documentation:

- [**Architecture Overview**](docs/architecture.md) — layered responsibilities, data flow, interaction model
- [**Simulation Model**](docs/simulation-model.md) — lifecycle, submission flow, traffic physics, validation
- [**Extending the Project**](docs/extending.md) — adding node kinds, behaviors, validation rules, modes

## License

Private — not yet licensed for distribution.
