import { useMemo, useState } from 'react';
import type { NodeBehaviorConfig, SimNode } from '../../sim/types';

interface Props {
    node: SimNode;
    onUpdateBehavior: (nodeId: string, patch: Partial<NodeBehaviorConfig>) => void;
    onUpdateScript: (nodeId: string, scriptText: string) => boolean;
}

function parseCsvIds(input: string): string[] {
    return input
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
}

export function ConfigEditor({ node, onUpdateBehavior, onUpdateScript }: Props) {
    const [mode, setMode] = useState<'structured' | 'json'>('structured');
    const [targetIds, setTargetIds] = useState(node.behavior.routing.targetNodeIds.join(', '));
    const [preferredIds, setPreferredIds] = useState(node.behavior.dependencies.preferredNodeIds.join(', '));
    const [script, setScript] = useState(node.scriptText ?? JSON.stringify(node.behavior, null, 2));
    const [scriptError, setScriptError] = useState<string | null>(null);

    const queuePct = useMemo(
        () => Math.round(node.behavior.routing.queueWeightPct * 100),
        [node.behavior.routing.queueWeightPct],
    );
    const workerDbPct = useMemo(
        () => Math.round(node.behavior.routing.workerDbWritePct * 100),
        [node.behavior.routing.workerDbWritePct],
    );

    const applyScript = (): void => {
        const ok = onUpdateScript(node.id, script);
        setScriptError(ok ? null : 'Invalid JSON or invalid behavior shape');
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div className="inspector-tabs" style={{ marginBottom: '4px' }}>
                <button
                    className={`inspector-tab${mode === 'structured' ? ' inspector-tab--active' : ''}`}
                    onClick={() => setMode('structured')}
                >
                    Structured
                </button>
                <button
                    className={`inspector-tab${mode === 'json' ? ' inspector-tab--active' : ''}`}
                    onClick={() => setMode('json')}
                >
                    JSON
                </button>
            </div>

            {mode === 'structured' ? (
                <>
                    <div className="metric-row">
                        <label className="metric-label">Routing Mode</label>
                        <select
                            className="inspector-input"
                            style={{ width: '100px' }}
                            value={node.behavior.routing.mode}
                            onChange={(e) =>
                                onUpdateBehavior(node.id, {
                                    routing: {
                                        ...node.behavior.routing,
                                        mode: e.target.value as NodeBehaviorConfig['routing']['mode'],
                                    },
                                })
                            }
                        >
                            <option value="auto">auto</option>
                            <option value="explicit">explicit</option>
                        </select>
                    </div>
                    <div className="metric-row">
                        <label className="metric-label">Targets</label>
                        <input
                            className="inspector-input"
                            style={{ width: '120px', textAlign: 'left' }}
                            value={targetIds}
                            onChange={(e) => setTargetIds(e.target.value)}
                            onBlur={() =>
                                onUpdateBehavior(node.id, {
                                    routing: {
                                        ...node.behavior.routing,
                                        targetNodeIds: parseCsvIds(targetIds),
                                    },
                                })
                            }
                        />
                    </div>
                    <div className="metric-row">
                        <label className="metric-label">Fallback</label>
                        <select
                            className="inspector-input"
                            style={{ width: '100px' }}
                            value={node.behavior.routing.fallback}
                            onChange={(e) =>
                                onUpdateBehavior(node.id, {
                                    routing: {
                                        ...node.behavior.routing,
                                        fallback: e.target.value as NodeBehaviorConfig['routing']['fallback'],
                                    },
                                })
                            }
                        >
                            <option value="auto">auto</option>
                            <option value="none">none</option>
                        </select>
                    </div>
                    <div className="metric-row">
                        <label className="metric-label">Queue Wt %</label>
                        <input
                            type="number"
                            className="inspector-input"
                            value={queuePct}
                            onChange={(e) =>
                                onUpdateBehavior(node.id, {
                                    routing: {
                                        ...node.behavior.routing,
                                        queueWeightPct: Math.min(1, Math.max(0, Number(e.target.value) / 100)),
                                    },
                                })
                            }
                        />
                    </div>
                    <div className="metric-row">
                        <label className="metric-label">Worker DB %</label>
                        <input
                            type="number"
                            className="inspector-input"
                            value={workerDbPct}
                            onChange={(e) =>
                                onUpdateBehavior(node.id, {
                                    routing: {
                                        ...node.behavior.routing,
                                        workerDbWritePct: Math.min(1, Math.max(0, Number(e.target.value) / 100)),
                                    },
                                })
                            }
                        />
                    </div>
                    <div className="metric-row">
                        <label className="metric-label">Pref. Deps</label>
                        <input
                            className="inspector-input"
                            style={{ width: '120px', textAlign: 'left' }}
                            value={preferredIds}
                            onChange={(e) => setPreferredIds(e.target.value)}
                            onBlur={() =>
                                onUpdateBehavior(node.id, {
                                    dependencies: {
                                        preferredNodeIds: parseCsvIds(preferredIds),
                                    },
                                })
                            }
                        />
                    </div>
                    <div className="metric-row">
                        <label className="metric-label">Drop Invalid</label>
                        <input
                            type="checkbox"
                            checked={node.behavior.policies.dropOnInvalidTargets}
                            onChange={(e) =>
                                onUpdateBehavior(node.id, {
                                    policies: {
                                        dropOnInvalidTargets: e.target.checked,
                                    },
                                })
                            }
                            style={{ width: '16px', height: '16px', accentColor: '#2979FF' }}
                        />
                    </div>
                </>
            ) : (
                <>
                    <textarea
                        className="inspector-input"
                        style={{
                            width: '100%',
                            minHeight: '160px',
                            textAlign: 'left',
                            resize: 'vertical',
                            lineHeight: 1.4,
                        }}
                        value={script}
                        onChange={(e) => setScript(e.target.value)}
                    />
                    {scriptError && <div style={{ color: '#E53935', fontSize: '11px' }}>{scriptError}</div>}
                    <button className="btn btn-primary" onClick={applyScript}>
                        Apply Script
                    </button>
                </>
            )}
        </div>
    );
}
