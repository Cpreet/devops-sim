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
                <div style={{ color: '#5a9e6f', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '14px' }}>✓</span> All checks passed
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ fontSize: '10px', color: '#556680' }}>
                        {errorCount} error(s), {warningCount} warning(s)
                    </div>
                    {lastSubmission && (
                        <div style={{ fontSize: '10px', color: '#556680' }}>
                            Submit result: {lastSubmission.blockingIssueIds.length} blocking / {lastSubmission.degradationIssueIds.length} degradation
                        </div>
                    )}
                    {sortedIssues.map((i) => (
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
