"use client";

import { ClientPersona } from "@/lib/engine";
import { MarkdownContent } from "@/components/MarkdownContent";
import { CopyButton } from "@/components/CopyButton";

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
