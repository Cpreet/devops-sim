// ── App Shell ───────────────────────────────────────────────────────────
import { useCallback, useRef, useState } from 'react';
import { PhaserHost } from '../game/PhaserHost';
import { TelemetryPanel } from './ui/TelemetryPanel';
import { ControlsPanel } from './ui/ControlsPanel';
import { NodeInspector } from './ui/NodeInspector';
import { ValidationPanel } from './ui/ValidationPanel';
import { SimEngine } from '../sim/engine/SimEngine';
import { computeTelemetry } from '../sim/telemetry/computeTelemetry';
import { level1 } from '../sim/presets/level1';
import type { SimSnapshot, TelemetrySnapshot, SimNode, NodeConfig, ValidationSnapshot } from '../sim/types';

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

const KEYBINDS: Array<{ key: string; label: string; color: string }> = [
    { key: '1', label: 'LB', color: '#4a9ebb' },
    { key: '2', label: 'API', color: '#5a9e6f' },
    { key: '3', label: 'DB', color: '#c0675a' },
    { key: '4', label: 'CACHE', color: '#c49a3c' },
    { key: '5', label: 'QUEUE', color: '#8a6aad' },
    { key: '6', label: 'WORKER', color: '#8a8fa0' },
];

export default function App() {
    const engineRef = useRef(new SimEngine());
    const [telemetry, setTelemetry] = useState<TelemetrySnapshot>(EMPTY_TELEMETRY);
    const [selectedNode, setSelectedNode] = useState<SimNode | null>(null);
    const [validation, setValidation] = useState<ValidationSnapshot>({ isValid: true, issues: [] });
    const [redrawToken, setRedrawToken] = useState(0);

    const lastUpdate = useRef(0);
    const handleSnapshot = useCallback((snap: SimSnapshot) => {
        const now = performance.now();
        if (now - lastUpdate.current < 125) return;
        lastUpdate.current = now;
        setTelemetry(computeTelemetry(snap));
        setValidation(snap.validation);

        if (snap.selectedNodeId) {
            const found = snap.nodes.find(n => n.id === snap.selectedNodeId);
            setSelectedNode(found || null);
        } else {
            setSelectedNode(null);
        }
    }, []);

    const handleLoadLevel1 = useCallback(() => {
        engineRef.current.loadPreset(level1);
        setRedrawToken((t) => t + 1);
    }, []);

    const handleReset = useCallback(() => {
        engineRef.current.reset();
        setTelemetry(EMPTY_TELEMETRY);
        setValidation({ isValid: true, issues: [] });
        setSelectedNode(null);
        setRedrawToken((t) => t + 1);
    }, []);

    const handleUpdateConfig = useCallback((nodeId: string, patch: Partial<NodeConfig>) => {
        engineRef.current.updateNodeConfig(nodeId, patch);
    }, []);

    const handleCloseInspector = useCallback(() => {
        engineRef.current.selectNode(null);
        setSelectedNode(null);
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
                    <ValidationPanel validation={validation} />
                    <ControlsPanel
                        onLoadLevel1={handleLoadLevel1}
                        onReset={handleReset}
                    />
                    <div className="panel keybind-panel">
                        <h3 className="panel-title">Keybinds</h3>
                        <div className="keybind-list">
                            {KEYBINDS.map((kb) => (
                                <div key={kb.key} className="keybind-row">
                                    <kbd>{kb.key}</kbd>
                                    <span className="status-dot" style={{ backgroundColor: kb.color }} />
                                    <span className="keybind-label">{kb.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </aside>
                {selectedNode && (
                    <aside className="sidebar inspector-sidebar" style={{ width: '260px' }}>
                        <NodeInspector
                            node={selectedNode}
                            onUpdateConfig={handleUpdateConfig}
                            onClose={handleCloseInspector}
                        />
                    </aside>
                )}
            </main>
        </div>
    );
}
