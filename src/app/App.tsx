import { useCallback, useRef, useState } from 'react';
import { PhaserHost } from '../game/PhaserHost';
import { TelemetryPanel } from './ui/TelemetryPanel';
import { ControlsPanel } from './ui/ControlsPanel';
import { ServicePalette } from './ui/ServicePalette';
import { NodeInspector } from './ui/NodeInspector';
import { ConfigModal } from './ui/ConfigModal';
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

export default function App() {
    const [engine] = useState<SimEngine>(() => new SimEngine());
    const [telemetry, setTelemetry] = useState<TelemetrySnapshot>(EMPTY_TELEMETRY);
    const [selectedNode, setSelectedNode] = useState<SimNode | null>(null);
    const [selectedAreaLabel, setSelectedAreaLabel] = useState<string | null>(null);
    const [configModalNode, setConfigModalNode] = useState<SimNode | null>(null);
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
                const a = snap.areas.find(
                    (ar) =>
                        found.gx >= ar.x &&
                        found.gx < ar.x + ar.w &&
                        found.gy >= ar.y &&
                        found.gy < ar.y + ar.h,
                );
                setSelectedAreaLabel(a ? `${a.label} (${a.kind})` : 'Unassigned');
            } else {
                setSelectedAreaLabel(null);
            }
        } else {
            setSelectedNode(null);
            setSelectedAreaLabel(null);
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
        if (action === 'config') {
            const snap = engine.getSnapshot();
            const node = snap.nodes.find((n) => n.id === snap.selectedNodeId);
            if (node) setConfigModalNode(node);
        }
    }, [engine]);

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

    const runBadgeClass =
        runState === 'running'
            ? 'header-badge header-badge--running'
            : runState === 'build'
                ? 'header-badge header-badge--build'
                : 'header-badge header-badge--build';

    return (
        <div className="app-shell">
            <header className="app-header">
                <h1>DevOps Simulator</h1>
                <span className={runBadgeClass}>{runState.toUpperCase()}</span>
                {isDirty && <span className="header-badge header-badge--error">DIRTY</span>}
                <span className="header-sub" style={{ marginLeft: 'auto' }}>
                    {submissionState} · {trafficActive ? 'traffic active' : 'traffic stopped'}
                </span>
            </header>

            <main className="app-main">
                <aside className="left-rail">
                    <ServicePalette />
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
                </aside>

                <div className="canvas-area">
                    <PhaserHost
                        engine={engine}
                        onSnapshot={handleSnapshot}
                        onRadialAction={handleRadialAction}
                        redrawToken={redrawToken}
                    />
                </div>

                {selectedNode && (
                    <aside className="inspector-sidebar">
                        <NodeInspector
                            node={selectedNode}
                            areaLabel={selectedAreaLabel}
                            onOpenConfig={() => setConfigModalNode(selectedNode)}
                            onClose={handleCloseInspector}
                        />
                    </aside>
                )}
            </main>

            <KeyboardLegend />

            {configModalNode && (
                <ConfigModal
                    node={configModalNode}
                    onUpdateConfig={handleUpdateConfig}
                    onUpdateBehavior={handleUpdateBehavior}
                    onUpdateScript={handleUpdateScript}
                    onClose={() => setConfigModalNode(null)}
                />
            )}
        </div>
    );
}
