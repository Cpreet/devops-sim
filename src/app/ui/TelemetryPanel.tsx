// ── Telemetry Panel ─────────────────────────────────────────────────────
import type { TelemetrySnapshot } from '../../sim/types';

interface Props {
    telemetry: TelemetrySnapshot;
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

export function TelemetryPanel({ telemetry }: Props) {
    const t = telemetry;
    return (
        <div className="panel telemetry-panel">
            <h3 className="panel-title">📊 Telemetry</h3>
            <Metric label="Sim Time" value={t.simTimeSec.toFixed(1)} unit="s" />
            <Metric label="Input RPS" value={t.inputRps} />
            <Metric label="Success RPS" value={t.successRps} />
            <Metric label="Error RPS" value={t.errorRps} />
            <Metric
                label="Error Rate"
                value={t.errorRatePct.toFixed(1)}
                unit="%"
            />
            <Metric label="p95 Latency" value={t.p95ms.toFixed(1)} unit="ms" />
            <Metric label="DB Conns" value={t.dbConns} />
            <Metric label="Queue Depth" value={t.queueDepth.toFixed(0)} />
            <Metric label="Cost / min" value={`$${t.costPerMin.toFixed(2)}`} />
        </div>
    );
}
