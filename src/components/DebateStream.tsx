"use client";

import { ClientPersona } from "@/lib/engine";
import { EvidenceReport } from "@/lib/evidence";
import { CrossExamResult } from "@/lib/topology";
import { CounterfactualReport } from "@/lib/counterfactuals";
import { MarkdownContent } from "@/components/MarkdownContent";
import { CopyButton } from "@/components/CopyButton";

// --- Evidence Report ---

interface EvidenceReportCardProps {
    round: number;
    report: EvidenceReport;
}

export function EvidenceReportCard({ round, report }: EvidenceReportCardProps) {
    const hasCritical = report.contradictions.some((c) => c.severity === "critical");
    const severityClass = hasCritical ? "evidence--critical" : "";

    // Build copy text
    const copyText = [
        `Evidence Report — Round ${round}`,
        "",
        report.summary,
        "",
        report.contradictions.length > 0
            ? `Contradictions:\n${report.contradictions.map((c) => `- [${c.severity.toUpperCase()}] ${c.claimA.agent}: "${c.claimA.claim}" vs ${c.claimB.agent}: "${c.claimB.claim}" — ${c.explanation}`).join("\n")}`
            : "",
        report.unsubstantiatedClaims.length > 0
            ? `Unsubstantiated:\n${report.unsubstantiatedClaims.map((c) => `- ${c}`).join("\n")}`
            : "",
    ]
        .filter(Boolean)
        .join("\n");

    return (
        <div className={`evidence-report ${severityClass}`}>
            <div className="evidence-header">
                <span className="evidence-badge">
                    🔬 Evidence Report — Round {round}
                </span>
                <CopyButton text={copyText} label="Copy evidence report" />
            </div>

            {/* Summary */}
            <div className="evidence-summary">
                <MarkdownContent text={report.summary} />
            </div>

            {/* Contradictions */}
            {report.contradictions.length > 0 && (
                <div className="evidence-section">
                    <div className="evidence-section-title">
                        ⚡ Contradictions ({report.contradictions.length})
                    </div>
                    {report.contradictions.map((c, i) => (
                        <div
                            key={i}
                            className={`evidence-contradiction evidence-contradiction--${c.severity}`}
                        >
                            <span className={`severity-badge severity-badge--${c.severity}`}>
                                {c.severity.toUpperCase()}
                            </span>
                            <div className="contradiction-claims">
                                <div className="contradiction-claim">
                                    <strong>{c.claimA.agent}:</strong> &ldquo;{c.claimA.claim}&rdquo;
                                </div>
                                <div className="contradiction-vs">vs</div>
                                <div className="contradiction-claim">
                                    <strong>{c.claimB.agent}:</strong> &ldquo;{c.claimB.claim}&rdquo;
                                </div>
                            </div>
                            <div className="contradiction-explanation">
                                {c.explanation}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Unsubstantiated Claims */}
            {report.unsubstantiatedClaims.length > 0 && (
                <div className="evidence-section">
                    <div className="evidence-section-title">
                        ⚠️ Unsubstantiated Claims ({report.unsubstantiatedClaims.length})
                    </div>
                    <ul className="evidence-unsub-list">
                        {report.unsubstantiatedClaims.map((claim, i) => (
                            <li key={i}>{claim}</li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Claims count */}
            {report.claims.length > 0 && (
                <div className="evidence-claims-count">
                    📊 {report.claims.length} claims extracted · {report.contradictions.length} contradictions · {report.unsubstantiatedClaims.length} unsubstantiated
                </div>
            )}
        </div>
    );
}

// --- Cross-Examination Card ---

interface CrossExamCardProps {
    round: number;
    result: CrossExamResult;
}

export function CrossExaminationCard({ round, result }: CrossExamCardProps) {
    return (
        <div className="cross-exam-card">
            <div className="cross-exam-header">
                <span className="cross-exam-badge">
                    ⚔️ Cross-Examination — Round {round}
                </span>
                <CopyButton text={result.exchange} label="Copy cross-exam" />
            </div>
            <div className="cross-exam-participants">
                <span className="cross-exam-challenger">{result.challenger}</span>
                <span className="cross-exam-arrow">→</span>
                <span className="cross-exam-target">{result.target}</span>
            </div>
            <div className="cross-exam-content">
                <MarkdownContent text={result.exchange} />
            </div>
        </div>
    );
}

// --- Disruption Card ---

interface DisruptionCardProps {
    round: number;
    content: string;
}

export function DisruptionCard({ round, content }: DisruptionCardProps) {
    return (
        <div className="disruption-card">
            <div className="disruption-header">
                <span className="disruption-badge">
                    ⚠️ Disruption Injected — Round {round}
                </span>
                <CopyButton text={content} label="Copy disruption" />
            </div>
            <div className="disruption-content">
                <MarkdownContent text={content} />
            </div>
        </div>
    );
}


interface ReframingCardProps {
    content: string;
}

export function ReframingCard({ content }: ReframingCardProps) {
    return (
        <div className="reframing-card">
            <div className="reframing-header">
                <span className="reframing-badge">🔮 Strategic Reframing — Pre-Debate Analysis</span>
                <CopyButton text={content} label="Copy reframing" />
            </div>
            <div className="reframing-content">
                <MarkdownContent text={content} />
            </div>
        </div>
    );
}

interface AgentMessageProps {
    persona: ClientPersona;
    content: string;
    round: number;
}

export function AgentMessage({ persona, content }: AgentMessageProps) {
    return (
        <div className="agent-message">
            <div className="agent-header">
                <div
                    className="agent-avatar"
                    style={{ background: `${persona.color}18` }}
                >
                    {persona.icon}
                </div>
                <div className="agent-meta">
                    <div className="agent-name" style={{ color: persona.color }}>
                        {persona.name}
                    </div>
                    <div className="agent-role">{persona.role}</div>
                </div>
                <CopyButton
                    text={content}
                    label={`Copy ${persona.name}'s response`}
                />
            </div>
            <div className="agent-content">
                <MarkdownContent text={content} />
            </div>
        </div>
    );
}

interface RoundSummaryProps {
    round: number;
    content: string;
}

export function RoundSummary({ round, content }: RoundSummaryProps) {
    return (
        <div className="round-summary">
            <div className="round-summary-header">
                📋 Round {round} Summary — Context Handoff
            </div>
            <div className="round-summary-content">
                <MarkdownContent text={content} />
            </div>
        </div>
    );
}

interface ConstraintCheckProps {
    content: string;
}

export function ConstraintCheck({ content }: ConstraintCheckProps) {
    return (
        <div className="constraint-check">
            <div className="constraint-check-header">
                <span className="constraint-badge">🔍 Constraint Critic — Feasibility Check</span>
                <CopyButton text={content} label="Copy constraint check" />
            </div>
            <div className="constraint-check-content">
                <MarkdownContent text={content} />
            </div>
        </div>
    );
}

interface SynthesisProps {
    content: string;
}

export function Synthesis({ content }: SynthesisProps) {
    return (
        <div className="synthesis-section">
            <div className="synthesis-card">
                <div className="synthesis-header">
                    <span className="synthesis-badge">⚖️ Final Decision</span>
                    <CopyButton text={content} label="Copy final decision" />
                </div>
                <div className="synthesis-content">
                    <MarkdownContent text={content} />
                </div>
            </div>
        </div>
    );
}



// --- Counterfactual Report Card ---

interface CounterfactualReportCardProps {
    report: CounterfactualReport;
}

export function CounterfactualReportCard({ report }: CounterfactualReportCardProps) {
    console.log("Rendering CounterfactualReportCard with report:", report);
    // Build copy text
    const copyText = [
        "Decision Journal (Counterfactual Analysis)",
        `Decision Quality Score: ${report.decisionQualityScore}/100`,
        "",
        "## Pre-Mortems (Failure Scenarios)",
        ...report.preMortems.map(
            (p) => `- [${p.likelihood}] ${p.scenario} (Mitigation: ${p.mitigation})`
        ),
        "",
        "## Reversal Triggers",
        ...report.reversalTriggers.map(
            (t) => `- Trigger: ${t.trigger} -> Action: ${t.action}`
        ),
        "",
        "## Preserved Options",
        ...report.preservedOptions.map(
            (o) => `- ${o.rejectedOption}: ${o.preservationStrategy}`
        ),
    ].join("\n");

    return (
        <div className="counterfactual-card">
            <div className="counterfactual-header">
                <span className="counterfactual-badge">
                    📓 Decision Journal
                </span>
                <div className="counterfactual-score">
                    Rigor Score: <strong>{report.decisionQualityScore}</strong>/100
                </div>
                <CopyButton text={copyText} label="Copy decision journal" />
            </div>

            <div className="counterfactual-section">
                <div className="counterfactual-section-title">💀 Pre-Mortems (Failure Scenarios)</div>
                <div className="counterfactual-grid">
                    {report.preMortems.map((pm, i) => (
                        <div key={i} className="counterfactual-item">
                            <div className="counterfactual-item-header">
                                <span className={`likelihood-badge likelihood--${pm.likelihood.toLowerCase()}`}>
                                    {pm.likelihood} Probability
                                </span>
                            </div>
                            <div className="counterfactual-scenario">{pm.scenario}</div>
                            <div className="counterfactual-mitigation">
                                <strong>Mitigation:</strong> {pm.mitigation}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="counterfactual-section">
                <div className="counterfactual-section-title">🔄 Reversal Triggers</div>
                <ul className="reversal-list">
                    {report.reversalTriggers.map((rt, i) => (
                        <li key={i}>
                            <span className="reversal-trigger">If {rt.trigger}</span>
                            <span className="reversal-arrow">➞</span>
                            <span className="reversal-action">{rt.action}</span>
                        </li>
                    ))}
                </ul>
            </div>

            <div className="counterfactual-section">
                <div className="counterfactual-section-title">💎 Preserved Options (Option Value)</div>
                <div className="preserved-options-grid">
                    {report.preservedOptions.map((po, i) => (
                        <div key={i} className="preserved-option">
                            <div className="preserved-option-name">{po.rejectedOption}</div>
                            <div className="preserved-option-reason">Rejected because: {po.reason}</div>
                            <div className="preserved-option-strategy">
                                <strong>Keep alive by:</strong> {po.preservationStrategy}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export function LoadingIndicator({ message }: { message: string }) {
    return (
        <div className="loading-indicator">
            <div className="loading-dots">
                <span />
                <span />
                <span />
            </div>
            <span>{message}</span>
        </div>
    );
}
