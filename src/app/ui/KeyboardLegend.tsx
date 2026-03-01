const SHORTCUTS = [
    { keys: ['1-6'], label: 'Select service' },
    { keys: ['WASD'], label: 'Move cursor' },
    { keys: ['Enter'], label: 'Place / Select' },
    { keys: ['M'], label: 'Move node' },
    { keys: ['R'], label: 'Radial menu' },
    { keys: ['F'], label: 'Stats' },
    { keys: ['C'], label: 'Config' },
    { keys: ['T'], label: 'Start traffic' },
    { keys: ['Del'], label: 'Delete' },
    { keys: ['Esc'], label: 'Cancel' },
];

export function KeyboardLegend() {
    return (
        <div className="keyboard-strip">
            {SHORTCUTS.map((s, i) => (
                <div key={i} className="keyboard-strip__group">
                    {s.keys.map((k) => (
                        <kbd key={k}>{k}</kbd>
                    ))}
                    <span className="keybind-label">{s.label}</span>
                </div>
            ))}
        </div>
    );
}
