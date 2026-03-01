interface Props {
    onLoadLevel1: () => void;
    onReset: () => void;
    onSubmit: () => void;
    onStartPause: () => void;
    onStop: () => void;
    runState: string;
    isDirty: boolean;
    trafficActive: boolean;
}

export function ControlsPanel({
    onLoadLevel1,
    onReset,
    onSubmit,
    onStartPause,
    onStop,
    runState,
    isDirty,
    trafficActive,
}: Props) {
    return (
        <div className="panel controls-panel">
            <h3 className="panel-title">Controls</h3>
            <button className="btn btn-primary" onClick={onSubmit}>
                Submit Architecture
            </button>
            <button className="btn btn-ghost" onClick={onStartPause}>
                {runState === 'paused' || !trafficActive ? 'Start Traffic' : 'Pause Traffic'}
            </button>
            <button className="btn btn-ghost" onClick={onStop}>
                Stop Traffic
            </button>
            <button className="btn btn-ghost" onClick={onLoadLevel1}>
                Load Level 1
            </button>
            <button className="btn btn-warm" onClick={onReset}>
                Reset
            </button>
            <div className="state-line">
                {runState} · {isDirty ? 'dirty' : 'clean'}
            </div>
        </div>
    );
}
