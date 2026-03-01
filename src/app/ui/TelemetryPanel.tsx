import type { TelemetrySnapshot, ValidationSnapshot } from '../../sim/types';

interface Props {
    telemetry: TelemetrySnapshot;
    validation: ValidationSnapshot;
    runState: string;
    submissionState: string;
    isDirty: boolean;
    trafficActive: boolean;
}

type HealthLevel = 'ok' | 'warn' | 'crit';

function getHealth(errorRatePct: number, p95ms: number): HealthLevel {
    if (errorRatePct > 5 || p95ms > 200) return 'crit';
    if (errorRatePct > 1 || p95ms > 100) return 'warn';
    return 'ok';
}

const healthColors: Record<HealthLevel, string> = {
    ok: '#43A047',
    warn: '#F9A825',
    crit: '#E53935',
};

const healthValueColors: Record<HealthLevel, string | undefined> = {
    ok: undefined,
    warn: '#F9A825',
    crit: '#E53935',
};

function Metric({
    label,
    value,
    unit = '',
    health,
}: {
    label: string;
    value: string | number;
    unit?: string;
    health?: HealthLevel;
}) {
    return (
        <div className="metric-row">
            <span className="metric-label">
                {health && (
                    <span
                        className="status-dot"
                        style={{ backgroundColor: healthColors[health] }}
                    />
                )}
                {label}
            </span>
            <span
                className="metric-value"
                style={healthValueColors[health ?? 'ok'] ? { color: healthValueColors[health ?? 'ok'] } : undefined}
            >
                {value}
                {unit && <span className="metric-unit">{unit}</span>}
            </span>
        </div>
    );
}

export function TelemetryPanel({
    telemetry,
    validation,
}: Props) {
    const t = telemetry;
    const health = getHealth(t.errorRatePct, t.p95ms);
    const architectureHealth: HealthLevel = !validation.isValid
        ? 'crit'
        : validation.issues.length > 0
            ? 'warn'
            : 'ok';
    const architectureLabel =
        architectureHealth === 'crit'
            ? 'Invalid'
            : architectureHealth === 'warn'
                ? 'Degraded'
                : 'Healthy';

    return (
        <div className="panel telemetry-panel">
            <h3 className="panel-title">Telemetry</h3>
            <Metric label="Sim Time" value={t.simTimeSec.toFixed(1)} unit="s" />
            <Metric label="Architecture" value={architectureLabel} health={architectureHealth} />
            <div className="metric-divider" />
            <Metric label="Input RPS" value={t.inputRps} health={health} />
            <Metric label="Success RPS" value={t.successRps} health={health} />
            <Metric label="Error RPS" value={t.errorRps} health={health} />
            <Metric label="Error Rate" value={t.errorRatePct.toFixed(1)} unit="%" health={health} />
            <div className="metric-divider" />
            <Metric label="p95 Latency" value={t.p95ms.toFixed(1)} unit="ms" health={health} />
            <Metric label="DB Conns" value={t.dbConns} />
            <Metric label="Queue Depth" value={t.queueDepth.toFixed(0)} />
            <div className="metric-divider" />
            <Metric label="Cost / min" value={`$${t.costPerMin.toFixed(2)}`} />
        </div>
    );
}
