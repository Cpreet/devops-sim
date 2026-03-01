# DevOps Simulator

A game-like interactive simulator for **software systems design and reliability thinking**. Players visually build distributed software architectures on an isometric grid and watch a tick-based simulation stress-test them in real time.

![Level 1 — Standard Stack](docs/assets/level1-screenshot.png)

## Quick Start

```bash
bun install
bun dev
```

Open [http://localhost:5173](http://localhost:5173).

## What Is This?

DevOps Simulator is a **strategy / management game for backend infrastructure concepts**:

- **Mode 1 — Build** *(implemented)*: Place infrastructure components (Load Balancer, API Gateway, Cache, Database, Queue, Worker) on an isometric grid. The simulation auto-wires dependencies and runs continuously, showing live telemetry for throughput, latency, error rates, and cost.
- **Mode 2 — Ops / Incident** *(planned)*: Inherit a degraded system and diagnose + fix it under pressure.

## Controls

| Input | Action |
|-------|--------|
| `1`–`6` | Select component type (LB, API, DB, Cache, Queue, Worker) |
| Left click | Place selected component on grid tile |
| Right-drag | Pan the camera |
| Scroll wheel | Zoom in / out |
| Load Level 1 | Load the preset 6-component architecture |
| Reset | Clear all nodes and restart simulation |

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
│       └── ControlsPanel.tsx    # Load / Reset buttons
├── game/                   # Phaser rendering layer
│   ├── PhaserHost.tsx      # React ↔ Phaser bridge
│   ├── iso/
│   │   └── isoMath.ts      # Isometric grid ↔ screen math
│   └── scenes/
│       └── BuildScene.ts   # Grid, nodes, edges, camera, input
├── sim/                    # Simulation layer (pure logic)
│   ├── types.ts            # Domain types
│   ├── schemas.ts          # Zod validation schemas
│   ├── engine/
│   │   └── SimEngine.ts    # Tick loop, traffic flow, physics
│   ├── model/
│   │   ├── nodes.ts        # Node factory + default configs
│   │   └── graph.ts        # Auto-wiring edge derivation
│   ├── presets/
│   │   └── level1.ts       # Starter architecture preset
│   └── telemetry/
│       └── computeTelemetry.ts  # Snapshot → dashboard aggregation
├── main.tsx                # Entry point
└── styles.css              # Global dark theme CSS
```

## Documentation

See [`docs/`](docs/) for detailed architecture and design documentation:

- [**Architecture Overview**](docs/architecture.md) — system layers, data flow, key design decisions
- [**Simulation Model**](docs/simulation-model.md) — tick engine, traffic flow, physics rules
- [**Extending the Project**](docs/extending.md) — how to add features, new node types, modes

## License

Private — not yet licensed for distribution.
