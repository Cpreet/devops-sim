import type { SimNode } from '../../sim/types';

interface Props {
    node: SimNode;
    areaLabel: string | null;
    onOpenConfig: () => void;
    onClose: () => void;
}

function Metric({ label, value, unit = '' }: { label: string; value: string | number; unit?: string }) {
    return (
        <div className="metric-row">
            <span className="metric-label">{label}</span>
            <span className="metric-value">
                {value}
                {unit && <span className="metric-unit">{unit}</span>}
            </span>
        </div>
    );
}

export function NodeInspector({
    node,
    areaLabel,
    onOpenConfig,
    onClose,
}: Props) {
    const s = node.state;

    return (
        <div className="panel inspector-panel">
            <div className="inspector-header">
                <div className="inspector-header__icon">
                    <img src={`icons/${node.kind.toLowerCase()}.svg`} alt={node.kind} />
                </div>
                <div className="inspector-header__title">
                    <div className="inspector-header__kind">{node.kind} Inspector</div>
                    <div className="inspector-header__id">
                        {node.id} · ({node.gx}, {node.gy})
                    </div>
                </div>
                <button className="inspector-close" onClick={onClose}>×</button>
            </div>

            <div className="inspector-meta">
                <span>Area: <span className="inspector-meta__area">{areaLabel ?? 'Unassigned'}</span></span>
            </div>

            <div className="section-label">Live Metrics</div>
            <Metric label="In RPS" value={s.inRps.toFixed(1)} />
            <Metric label="Out RPS" value={s.outRps.toFixed(1)} />
            <Metric label="Err RPS" value={s.errRps.toFixed(1)} />
            <Metric label="p95 Latency" value={s.p95ms.toFixed(1)} unit="ms" />
            <Metric label="Saturation" value={(s.saturation * 100).toFixed(1)} unit="%" />
            <Metric label="DB Conns" value={s.dbConns} />
            <Metric label="Queue Depth" value={s.queueDepth.toFixed(0)} />

            <div className="metric-divider" />
            <button className="btn btn-ghost" onClick={onOpenConfig}>
                ⚙ Open Config
            </button>
        </div>
    );
}
