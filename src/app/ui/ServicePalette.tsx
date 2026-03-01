import { KIND_LABELS } from '../../theme/tokens';
import type { NodeKind } from '../../sim/types';
import { ALL_KINDS } from '../../sim/types';

const KEY_MAP: Record<NodeKind, string> = {
    LB: '1',
    API: '2',
    DB: '3',
    CACHE: '4',
    QUEUE: '5',
    WORKER: '6',
};

export function ServicePalette() {
    return (
        <div className="panel">
            <h3 className="panel-title">Services</h3>
            <div className="service-palette">
                {ALL_KINDS.map((kind) => (
                    <div key={kind} className="service-card">
                        <div className="service-card__icon">
                            <img src={`icons/${kind.toLowerCase()}.svg`} alt={kind} />
                        </div>
                        <span className="service-card__label">{KIND_LABELS[kind]}</span>
                        <span className="service-card__key">{KEY_MAP[kind]}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
