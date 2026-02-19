"use client";

import { useEffect, useCallback } from "react";
import { ClientPersona } from "@/lib/engine";
import { EvidenceReport } from "@/lib/evidence";
import { CrossExamResult } from "@/lib/topology";
import {
    AgentMessage,
    RoundSummary,
    EvidenceReportCard,
    CrossExaminationCard,
    DisruptionCard,
} from "@/components/DebateStream"; // Ensure these are exported from DebateStream
import { CopyButton } from "@/components/CopyButton";

interface RoundDetailPanelProps {
    round: number;
    agentResponses: { persona: ClientPersona; content: string }[];
    summary: string | null;
    evidenceReport: EvidenceReport | null;
    crossExams: CrossExamResult[];
    disruptions: string[];
    onClose: () => void;
}

export function RoundDetailPanel({
    round,
    agentResponses,
    summary,
    evidenceReport,
    crossExams,
    disruptions,
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

                {evidenceReport && (
                    <EvidenceReportCard round={round} report={evidenceReport} />
                )}

                {crossExams.map((exam, i) => (
                    <CrossExaminationCard key={i} round={round} result={exam} />
                ))}

                {disruptions.map((content, i) => (
                    <DisruptionCard key={i} round={round} content={content} />
                ))}

                {summary && (
                    <RoundSummary round={round} content={summary} />
                )}
            </div>
        </div>
    );
}
