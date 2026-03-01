import { useState, useEffect, useCallback } from 'react';
import type { SimNode, NodeConfig, NodeBehaviorConfig } from '../../sim/types';
import { ConfigEditor } from './ConfigEditor';

interface Props {
    node: SimNode;
    onUpdateConfig: (nodeId: string, patch: Partial<NodeConfig>) => void;
    onUpdateBehavior: (nodeId: string, patch: Partial<NodeBehaviorConfig>) => void;
    onUpdateScript: (nodeId: string, scriptText: string) => boolean;
    onClose: () => void;
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
        if (parsed !== value) onChange(parsed);
    };

    return (
        <div className="metric-row">
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

export function ConfigModal({
    node,
    onUpdateConfig,
    onUpdateBehavior,
    onUpdateScript,
    onClose,
}: Props) {
    const c = node.config;

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
    }, [onClose]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    return (
        <div className="config-modal-backdrop" onClick={onClose}>
            <div className="config-modal" onClick={(e) => e.stopPropagation()}>
                <div className="config-modal__header">
                    <div className="config-modal__icon">
                        <img src={`icons/${node.kind.toLowerCase()}.svg`} alt={node.kind} />
                    </div>
                    <div>
                        <div className="config-modal__title">{node.kind} Configuration</div>
                        <div className="config-modal__subtitle">
                            {node.id} · ({node.gx}, {node.gy})
                        </div>
                    </div>
                    <button className="config-modal__close" onClick={onClose}>×</button>
                </div>

                <div className="config-modal__body">
                    <div className="config-modal__section">
                        <div className="section-label">Runtime Config</div>

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

                    <div className="config-modal__divider" />

                    <div className="config-modal__section">
                        <div className="section-label">Behavior Config</div>
                        <ConfigEditor
                            key={node.id}
                            node={node}
                            onUpdateBehavior={onUpdateBehavior}
                            onUpdateScript={onUpdateScript}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
