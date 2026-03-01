interface LegendItem {
    key: string;
    label: string;
    color?: string;
}

interface Props {
    keybinds: LegendItem[];
}

const EXTRA_KEYS: LegendItem[] = [
    { key: 'Arrows/WASD', label: 'Move cursor' },
    { key: 'Enter', label: 'Place / Confirm' },
    { key: 'M', label: 'Move selected node' },
    { key: 'R', label: 'Open radial menu' },
    { key: 'F', label: 'Stats tab' },
    { key: 'C', label: 'Config tab' },
    { key: 'T', label: 'Start traffic' },
    { key: 'Esc', label: 'Cancel mode' },
    { key: 'Del/Back', label: 'Delete node' },
];

export function KeyboardLegend({ keybinds }: Props) {
    const all = [...keybinds, ...EXTRA_KEYS];
    return (
        <div className="panel keybind-panel">
            <h3 className="panel-title">Keyboard</h3>
            <div className="keybind-list">
                {all.map((kb) => (
                    <div key={`${kb.key}-${kb.label}`} className="keybind-row">
                        <kbd style={{ width: 'auto', minWidth: '18px', padding: '0 5px' }}>{kb.key}</kbd>
                        {kb.color && <span className="status-dot" style={{ backgroundColor: kb.color }} />}
                        <span className="keybind-label">{kb.label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
