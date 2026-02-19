"use client";

import { ClientPersona } from "@/lib/engine";
import { EvidenceReport } from "@/lib/evidence";
import { MarkdownContent } from "@/components/MarkdownContent";

interface RoundCardProps {
    round: number;
    agentResponses: { persona: ClientPersona; content: string }[];
    summary: string | null;
    evidenceReport: EvidenceReport | null;
    constraintCheck?: string | null; // Optional prop
    isInProgress: boolean;
    onViewDetails: () => void;
}

export function RoundCard({
    round,
    agentResponses,
    summary,
    evidenceReport,
    constraintCheck,
    isInProgress,
    onViewDetails,
}: RoundCardProps) {
    // Only show constraint check if it's not empty/null
    const hasCritique = constraintCheck && constraintCheck.trim().length > 0;

    return (
        <div
            className={`round-card ${isInProgress ? "round-card--active" : ""}`}
        >
            <div className="round-card-top">
                <span className="round-badge">Round {round}</span>
                {isInProgress ? (
                    <span className="round-card-status round-card-status--active">
                        <span className="loading-dots-inline">
                            <span />
                            <span />
                            <span />
                        </span>
                        In Progress
                    </span>
                ) : (
                    <span className="round-card-status round-card-status--done">
                        ✓ Complete
                    </span>
                )}
            </div>

            {/* Agent avatar row */}
            <div className="round-card-avatars">
                {agentResponses.map((r) => (
                    <div
                        key={r.persona.id}
                        className="round-card-avatar"
                        style={{ background: `${r.persona.color}20` }}
                        title={`${r.persona.name} — ${r.persona.role}`}
                    >
                        {r.persona.icon}
                    </div>
                ))}
                {isInProgress && agentResponses.length === 0 && (
                    <span className="round-card-waiting">
                        Waiting for agents…
                    </span>
                )}
                {!isInProgress && (
                    <span className="round-card-agent-count">
                        {agentResponses.length} agent
                        {agentResponses.length !== 1 ? "s" : ""} responded
                    </span>
                )}
            </div>

            {/* Summary */}
            {summary && (
                <div className="round-card-summary">
                    <MarkdownContent text={summary} />
                </div>
            )}

            {/* Constraint Critic Warning */}
            {hasCritique && (
                <div className="round-card-critique" style={{
                    marginTop: '0.75rem',
                    padding: '0.75rem',
                    background: '#FFF3CD',
                    border: '1px solid #FFEEBA',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                    color: '#856404'
                }}>
                    <strong style={{ display: 'block', marginBottom: '0.25rem' }}>🛡️ Constraint Check:</strong>
                    <MarkdownContent text={constraintCheck} />
                </div>
            )}

            {/* Evidence indicator */}
            {evidenceReport && evidenceReport.contradictions.length > 0 && (
                <div className="round-card-evidence">
                    <span className={`evidence-indicator ${evidenceReport.contradictions.some(c => c.severity === "critical") ? "evidence-indicator--critical" : "evidence-indicator--moderate"}`}>
                        ⚡ {evidenceReport.contradictions.length} contradiction{evidenceReport.contradictions.length !== 1 ? "s" : ""} found
                    </span>
                </div>
            )}

            {/* View details button */}
            {!isInProgress && agentResponses.length > 0 && (
                <button
                    className="round-card-details-btn"
                    onClick={onViewDetails}
                >
                    View Full Debate →
                </button>
            )}
        </div>
    );
}
