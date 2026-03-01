// ── App Shell ───────────────────────────────────────────────────────────
import { useCallback, useRef, useState } from 'react';
import { PhaserHost } from '../game/PhaserHost';
import { TelemetryPanel } from './ui/TelemetryPanel';
import { ControlsPanel } from './ui/ControlsPanel';
import { SimEngine } from '../sim/engine/SimEngine';
import { computeTelemetry } from '../sim/telemetry/computeTelemetry';
import { level1 } from '../sim/presets/level1';
import type { SimSnapshot, TelemetrySnapshot } from '../sim/types';

const EMPTY_TELEMETRY: TelemetrySnapshot = {
    simTimeSec: 0,
    inputRps: 0,
    successRps: 0,
    errorRps: 0,
    errorRatePct: 0,
    p95ms: 0,
    dbConns: 0,
    queueDepth: 0,
    costPerMin: 0,
};

export default function App() {
    const engineRef = useRef(new SimEngine());
    const [telemetry, setTelemetry] = useState<TelemetrySnapshot>(EMPTY_TELEMETRY);
    const [redrawToken, setRedrawToken] = useState(0);

    // Throttle React state updates to ~8 fps
    const lastUpdate = useRef(0);
    const handleSnapshot = useCallback((snap: SimSnapshot) => {
        const now = performance.now();
        if (now - lastUpdate.current < 125) return;
        lastUpdate.current = now;
        setTelemetry(computeTelemetry(snap));
    }, []);

    const handleLoadLevel1 = useCallback(() => {
        engineRef.current.loadPreset(level1);
        setRedrawToken((t) => t + 1);
    }, []);

    const handleReset = useCallback(() => {
        engineRef.current.reset();
        setTelemetry(EMPTY_TELEMETRY);
        setRedrawToken((t) => t + 1);
    }, []);

    return (
        <div className="app-shell">
            <header className="app-header">
                <h1>DevOps Simulator</h1>
                <span className="header-sub">Mode 1 — Build</span>
            </header>

            <main className="app-main">
                <div className="canvas-area">
                    <PhaserHost
                        engine={engineRef.current}
                        onSnapshot={handleSnapshot}
                        redrawToken={redrawToken}
                    />
                </div>

                <aside className="sidebar">
                    <TelemetryPanel telemetry={telemetry} />
                    <ControlsPanel
                        onLoadLevel1={handleLoadLevel1}
                        onReset={handleReset}
                    />
                    <div className="panel keybind-panel">
                        <h3 className="panel-title">🎮 Keybinds</h3>
                        <div className="keybind-list">
                            <kbd>1</kbd> LB &nbsp;
                            <kbd>2</kbd> API &nbsp;
                            <kbd>3</kbd> DB &nbsp;
                            <kbd>4</kbd> CACHE &nbsp;
                            <kbd>5</kbd> QUEUE &nbsp;
                            <kbd>6</kbd> WORKER
                        </div>
                    </div>
                </aside>
            </main>
        </div>
    );
}
