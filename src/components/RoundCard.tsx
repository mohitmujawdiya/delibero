"use client";

import { ClientPersona } from "@/lib/engine";
import { MarkdownContent } from "@/components/MarkdownContent";

interface RoundCardProps {
    round: number;
    agentResponses: { persona: ClientPersona; content: string }[];
    summary: string | null;
    isInProgress: boolean;
    onViewDetails: () => void;
}

export function RoundCard({
    round,
    agentResponses,
    summary,
    isInProgress,
    onViewDetails,
}: RoundCardProps) {
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
