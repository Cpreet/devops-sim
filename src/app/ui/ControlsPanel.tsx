// ── Controls Panel — Industrial Style ───────────────────────────────────

interface Props {
    onLoadLevel1: () => void;
    onReset: () => void;
}

export function ControlsPanel({ onLoadLevel1, onReset }: Props) {
    return (
        <div className="panel controls-panel">
            <h3 className="panel-title">Controls</h3>
            <button className="btn btn-ghost" onClick={onLoadLevel1}>
                Load Level 1
            </button>
            <button className="btn btn-ghost btn-warm" onClick={onReset}>
                Reset
            </button>
        </div>
    );
}
