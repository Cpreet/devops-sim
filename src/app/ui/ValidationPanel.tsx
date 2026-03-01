import type { ValidationSnapshot } from '../../sim/types';

export function ValidationPanel({ validation }: { validation: ValidationSnapshot }) {
    return (
        <div className="panel validation-panel">
            <h3 className="panel-title">Architecture Health</h3>
            {validation.isValid && validation.issues.length === 0 ? (
                <div style={{ color: '#5a9e6f', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '14px' }}>✓</span> All checks passed
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {validation.issues.map((i) => (
                        <div key={i.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                            <span style={{ fontSize: '13px', lineHeight: '14px' }}>
                                {i.severity === 'error' ? '❌' : '⚠️'}
                            </span>
                            <span style={{
                                fontSize: '11px',
                                color: i.severity === 'error' ? '#c0675a' : '#c49a3c',
                                lineHeight: '1.3'
                            }}>
                                {i.message}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
