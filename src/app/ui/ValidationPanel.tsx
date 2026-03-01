import type { SubmissionResult, ValidationSnapshot } from '../../sim/types';

export function ValidationPanel({
    validation,
    lastSubmission,
}: {
    validation: ValidationSnapshot;
    lastSubmission: SubmissionResult | null;
}) {
    const severityRank: Record<'error' | 'warning' | 'info', number> = {
        error: 0,
        warning: 1,
        info: 2,
    };
    const sortedIssues = [...validation.issues].sort(
        (a, b) => severityRank[a.severity] - severityRank[b.severity],
    );
    const errorCount = sortedIssues.filter((i) => i.severity === 'error').length;
    const warningCount = sortedIssues.filter((i) => i.severity === 'warning').length;

    return (
        <div className="panel validation-panel">
            <h3 className="panel-title">Architecture Health</h3>
            {validation.isValid && validation.issues.length === 0 ? (
                <div className="validation-ok">
                    <span>✓</span> All checks passed
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ fontSize: '11px', color: '#8a94a6' }}>
                        {errorCount} error(s), {warningCount} warning(s)
                    </div>
                    {lastSubmission && (
                        <div style={{ fontSize: '11px', color: '#8a94a6' }}>
                            Submit: {lastSubmission.blockingIssueIds.length} blocking / {lastSubmission.degradationIssueIds.length} degradation
                        </div>
                    )}
                    {sortedIssues.map((i) => (
                        <div
                            key={i.id}
                            className={`validation-issue validation-issue--${i.severity}`}
                        >
                            <span className="validation-issue__icon">
                                {i.severity === 'error' ? '✕' : '⚠'}
                            </span>
                            <span className="validation-issue__text">{i.message}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
