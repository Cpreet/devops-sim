// ── Controls Panel ──────────────────────────────────────────────────────

interface Props {
    onLoadLevel1: () => void;
    onReset: () => void;
}

export function ControlsPanel({ onLoadLevel1, onReset }: Props) {
    return (
        <div className="panel controls-panel">
            <h3 className="panel-title">⚙️ Controls</h3>
            <button className="btn btn-primary" onClick={onLoadLevel1}>
                Load Level 1
            </button>
            <button className="btn btn-danger" onClick={onReset}>
                Reset
            </button>
        </div>
    );
}
