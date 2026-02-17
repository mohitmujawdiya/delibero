"use client";

import { useEffect, useCallback } from "react";
import { ClientPersona } from "@/lib/engine";
import { AgentMessage, RoundSummary } from "@/components/DebateStream";
import { CopyButton } from "@/components/CopyButton";

interface RoundDetailPanelProps {
    round: number;
    agentResponses: { persona: ClientPersona; content: string }[];
    summary: string | null;
    onClose: () => void;
}

export function RoundDetailPanel({
    round,
    agentResponses,
    summary,
    onClose,
}: RoundDetailPanelProps) {
    // Build copy text for the entire round
    const roundCopyText = agentResponses
        .map((r) => `## ${r.persona.name} (${r.persona.role})\n\n${r.content}`)
        .join("\n\n---\n\n")
        + (summary ? `\n\n---\n\n## Round Summary\n\n${summary}` : "");

    // Close on Escape key
    const handleKeyDown = useCallback(
        (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        },
        [onClose]
    );

    useEffect(() => {
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [handleKeyDown]);

    return (
        <div className="detail-panel">
            <div className="detail-panel-header">
                <div className="detail-panel-title">
                    <span className="round-badge">Round {round}</span>
                    <span className="detail-panel-subtitle">
                        Full Agent Responses
                    </span>
                </div>
                <div className="detail-panel-actions">
                    <CopyButton
                        text={roundCopyText}
                        label="Copy entire round"
                    />
                    <button
                        className="detail-panel-close"
                        onClick={onClose}
                        aria-label="Close panel"
                    >
                        ✕
                    </button>
                </div>
            </div>

            <div className="detail-panel-body">
                {agentResponses.map((response) => (
                    <AgentMessage
                        key={`detail-${round}-${response.persona.id}`}
                        persona={response.persona}
                        content={response.content}
                        round={round}
                    />
                ))}

                {summary && (
                    <RoundSummary round={round} content={summary} />
                )}
            </div>
        </div>
    );
}
