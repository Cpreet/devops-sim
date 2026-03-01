// ── App Shell ───────────────────────────────────────────────────────────
import { useCallback, useRef, useState } from 'react';
import { PhaserHost } from '../game/PhaserHost';
import { TelemetryPanel } from './ui/TelemetryPanel';
import { ControlsPanel } from './ui/ControlsPanel';
import { NodeInspector, type InspectorTab } from './ui/NodeInspector';
import { ValidationPanel } from './ui/ValidationPanel';
import { KeyboardLegend } from './ui/KeyboardLegend';
import { SimEngine } from '../sim/engine/SimEngine';
import { computeTelemetry } from '../sim/telemetry/computeTelemetry';
import { level1 } from '../sim/presets/level1';
import type {
    SimSnapshot,
    TelemetrySnapshot,
    SimNode,
    NodeConfig,
    ValidationSnapshot,
    NodeBehaviorConfig,
    SubmissionResult,
} from '../sim/types';
import type { RadialAction } from '../game/render/radialMenu';

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
    const [engine] = useState<SimEngine>(() => new SimEngine());
    const [telemetry, setTelemetry] = useState<TelemetrySnapshot>(EMPTY_TELEMETRY);
    const [selectedNode, setSelectedNode] = useState<SimNode | null>(null);
    const [selectedAreaLabel, setSelectedAreaLabel] = useState<string | null>(null);
    const [inspectorTab, setInspectorTab] = useState<InspectorTab>('stats');
    const [validation, setValidation] = useState<ValidationSnapshot>({ isValid: true, issues: [] });
    const [runState, setRunState] = useState<SimSnapshot['runState']>('build');
    const [submissionState, setSubmissionState] = useState<SimSnapshot['submissionState']>('clean');
    const [isDirty, setIsDirty] = useState(false);
    const [trafficActive, setTrafficActive] = useState(false);
    const [lastSubmission, setLastSubmission] = useState<SubmissionResult | null>(null);
    const [redrawToken, setRedrawToken] = useState(0);

    const lastUpdate = useRef(0);
    const handleSnapshot = useCallback((snap: SimSnapshot) => {
        if (snap.selectedNodeId) {
            const found = snap.nodes.find((n) => n.id === snap.selectedNodeId) || null;
            setSelectedNode(found);
            if (found) {
                const area = snap.areas.find(
                    (a) =>
                        found.gx >= a.x &&
                        found.gx < a.x + a.w &&
                        found.gy >= a.y &&
                        found.gy < a.y + a.h,
                );
                setSelectedAreaLabel(area ? `${area.label} (${area.kind})` : 'Unassigned');
            } else {
                setSelectedAreaLabel(null);
            }
        } else {
            setSelectedNode(null);
            setSelectedAreaLabel(null);
            setInspectorTab('stats');
        }

        const now = performance.now();
        if (now - lastUpdate.current < 125) return;
        lastUpdate.current = now;
        setTelemetry(computeTelemetry(snap));
        setValidation(snap.validation);
        setRunState(snap.runState);
        setSubmissionState(snap.submissionState);
        setIsDirty(snap.isDirty);
        setTrafficActive(snap.trafficActive);
        setLastSubmission(snap.lastSubmission);
    }, []);

    const handleLoadLevel1 = useCallback(() => {
        engine.loadPreset(level1);
        setRedrawToken((t) => t + 1);
    }, [engine]);

    const handleReset = useCallback(() => {
        engine.reset();
        setTelemetry(EMPTY_TELEMETRY);
        setValidation({ isValid: true, issues: [] });
        setSelectedNode(null);
        setSelectedAreaLabel(null);
        setRedrawToken((t) => t + 1);
    }, [engine]);

    const handleUpdateConfig = useCallback((nodeId: string, patch: Partial<NodeConfig>) => {
        engine.updateNodeConfig(nodeId, patch);
    }, [engine]);

    const handleCloseInspector = useCallback(() => {
        engine.selectNode(null);
        setSelectedNode(null);
        setSelectedAreaLabel(null);
        setInspectorTab('stats');
        setRunState('build');
        setSubmissionState('clean');
        setIsDirty(false);
        setTrafficActive(false);
        setLastSubmission(null);
        setRedrawToken((t) => t + 1);
    }, [engine]);

    const handleUpdateBehavior = useCallback((nodeId: string, patch: Partial<NodeBehaviorConfig>) => {
        engine.updateNodeBehavior(nodeId, patch);
    }, [engine]);

    const handleUpdateScript = useCallback((nodeId: string, scriptText: string): boolean => {
        return engine.updateNodeScript(nodeId, scriptText);
    }, [engine]);

    const handleRadialAction = useCallback((action: RadialAction) => {
        if (action === 'stats') setInspectorTab('stats');
        if (action === 'config') setInspectorTab('config');
    }, []);

    const handleSubmit = useCallback(() => {
        engine.submitArchitecture();
        setRedrawToken((t) => t + 1);
    }, [engine]);

    const handleStartPause = useCallback(() => {
        const snap = engine.getSnapshot();
        if (snap.runState === 'running') {
            engine.pauseTraffic();
        } else {
            engine.startTraffic();
        }
        setRedrawToken((t) => t + 1);
    }, [engine]);

    const handleStop = useCallback(() => {
        engine.stopTraffic();
        setRedrawToken((t) => t + 1);
    }, [engine]);

    return (
        <div className="app-shell">
            <header className="app-header">
                <h1>DevOps Simulator</h1>
                <span className="header-sub">Mode 1 — Build</span>
            </header>

            <main className="app-main">
                <div className="canvas-area">
                    <PhaserHost
                        engine={engine}
                        onSnapshot={handleSnapshot}
                        onRadialAction={handleRadialAction}
                        redrawToken={redrawToken}
                    />
                </div>

                <aside className="sidebar">
                    <TelemetryPanel
                        telemetry={telemetry}
                        validation={validation}
                        runState={runState}
                        submissionState={submissionState}
                        isDirty={isDirty}
                        trafficActive={trafficActive}
                    />
                    <ValidationPanel validation={validation} lastSubmission={lastSubmission} />
                    <ControlsPanel
                        onLoadLevel1={handleLoadLevel1}
                        onReset={handleReset}
                        onSubmit={handleSubmit}
                        onStartPause={handleStartPause}
                        onStop={handleStop}
                        runState={runState}
                        isDirty={isDirty}
                        trafficActive={trafficActive}
                    />
                    <KeyboardLegend keybinds={KEYBINDS} />
                </aside>
                {selectedNode && (
                    <aside className="sidebar inspector-sidebar" style={{ width: '260px' }}>
                        <NodeInspector
                            node={selectedNode}
                            areaLabel={selectedAreaLabel}
                            activeTab={inspectorTab}
                            onTabChange={setInspectorTab}
                            onUpdateConfig={handleUpdateConfig}
                            onUpdateBehavior={handleUpdateBehavior}
                            onUpdateScript={handleUpdateScript}
                            onClose={handleCloseInspector}
                        />
                    </aside>
                )}
            </main>
        </div>
    );
}
