import { useState, useEffect } from 'react';
import type { SimNode, NodeConfig } from '../../sim/types';

interface Props {
    node: SimNode;
    onUpdateConfig: (nodeId: string, patch: Partial<NodeConfig>) => void;
    onClose: () => void;
}

function Metric({ label, value, unit = '' }: { label: string; value: string | number; unit?: string }) {
    return (
        <div className="metric-row">
            <span className="metric-label">{label}</span>
            <span className="metric-value">
                {value}
                {unit && <span className="metric-unit"> {unit}</span>}
            </span>
        </div>
    );
}

function ConfigField({
    label,
    value,
    min = 0,
    max,
    onChange,
}: {
    label: string;
    value: number;
    min?: number;
    max?: number;
    onChange: (v: number) => void;
}) {
    const [localVal, setLocalVal] = useState(String(value));

    useEffect(() => {
        setLocalVal(String(value));
    }, [value]);

    const handleBlur = () => {
        let parsed = parseFloat(localVal);
        if (isNaN(parsed)) parsed = min;
        if (max !== undefined && parsed > max) parsed = max;
        if (parsed < min) parsed = min;
        setLocalVal(String(parsed));
        if (parsed !== value) {
            onChange(parsed);
        }
    };

    return (
        <div className="metric-row" style={{ marginTop: '4px' }}>
            <label className="metric-label">{label}</label>
            <input
                type="number"
                className="inspector-input"
                value={localVal}
                onChange={(e) => setLocalVal(e.target.value)}
                onBlur={handleBlur}
                step={max && max <= 1 ? 0.1 : 1}
            />
        </div>
    );
}

export function NodeInspector({ node, onUpdateConfig, onClose }: Props) {
    const c = node.config;
    const s = node.state;

    return (
        <div className="panel inspector-panel" style={{ borderLeft: '3px solid #4fc3f7' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px' }}>
                <h3 className="panel-title" style={{ margin: 0, color: '#4fc3f7' }}>
                    {node.kind} Inspector
                </h3>
                <button className="btn btn-ghost" style={{ padding: '2px 6px', width: 'auto', fontSize: '10px' }} onClick={onClose}>
                    ×
                </button>
            </div>

            <div style={{ fontSize: '11px', color: '#6a7a9a', marginBottom: '10px', fontFamily: '"JetBrains Mono", monospace' }}>
                ID: {node.id} &nbsp;|&nbsp; Pos: ({node.gx}, {node.gy})
            </div>

            <div className="metric-divider" />
            <div style={{ fontSize: '10px', color: '#44506a', textTransform: 'uppercase', marginBottom: '6px' }}>Live Metrics</div>

            <Metric label="In RPS" value={s.inRps.toFixed(1)} />
            <Metric label="Out RPS" value={s.outRps.toFixed(1)} />
            <Metric label="Err RPS" value={s.errRps.toFixed(1)} />
            <Metric label="p95 Latency" value={s.p95ms.toFixed(1)} unit="ms" />
            <Metric label="Saturation" value={(s.saturation * 100).toFixed(1)} unit="%" />

            {node.kind === 'DB' && <Metric label="DB Conns" value={s.dbConns} />}
            {node.kind === 'QUEUE' && <Metric label="Queue Depth" value={s.queueDepth.toFixed(0)} />}

            <div className="metric-divider" />
            <div style={{ fontSize: '10px', color: '#44506a', textTransform: 'uppercase', marginBottom: '6px' }}>Configuration</div>

            <ConfigField
                label="Capacity RPS"
                value={c.capacityRps}
                min={0}
                onChange={(v) => onUpdateConfig(node.id, { capacityRps: v })}
            />
            <ConfigField
                label="Timeout ms"
                value={c.timeoutMs}
                min={0}
                onChange={(v) => onUpdateConfig(node.id, { timeoutMs: v })}
            />

            {node.kind === 'CACHE' && (
                <>
                    <ConfigField
                        label="Hit Rate"
                        value={c.hitRate}
                        min={0}
                        max={1}
                        onChange={(v) => onUpdateConfig(node.id, { hitRate: v })}
                    />
                    <ConfigField
                        label="TTL Sec"
                        value={c.ttlSec}
                        min={0}
                        onChange={(v) => onUpdateConfig(node.id, { ttlSec: v })}
                    />
                </>
            )}

            {node.kind === 'DB' && (
                <ConfigField
                    label="Max Conns"
                    value={c.maxConns}
                    min={0}
                    onChange={(v) => onUpdateConfig(node.id, { maxConns: v })}
                />
            )}

            {node.kind === 'WORKER' && (
                <>
                    <ConfigField
                        label="Throughput/W"
                        value={c.throughputRps}
                        min={1}
                        onChange={(v) => onUpdateConfig(node.id, { throughputRps: v })}
                    />
                    <ConfigField
                        label="Concurrency"
                        value={c.concurrency}
                        min={1}
                        max={100}
                        onChange={(v) => onUpdateConfig(node.id, { concurrency: v })}
                    />
                </>
            )}
        </div>
    );
}
