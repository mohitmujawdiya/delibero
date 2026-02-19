"use client";

import { useState, useEffect } from "react";
import { Persona, PERSONAS } from "@/lib/personas";

interface PersonaCardProps {
    persona: Persona;
    selected: boolean;
    onToggle: (id: string) => void;
}

export function PersonaCard({ persona, selected, onToggle }: PersonaCardProps) {
    return (
        <div
            className={`persona-card ${selected ? "selected" : ""}`}
            onClick={() => onToggle(persona.id)}
            role="checkbox"
            aria-checked={selected}
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onToggle(persona.id);
                }
            }}
        >
            <div
                className="persona-icon"
                style={{
                    background: selected
                        ? `${persona.color}20`
                        : undefined,
                }}
            >
                {persona.icon}
            </div>
            <div className="persona-info">
                <div
                    className="persona-name"
                    style={{ color: selected ? persona.color : undefined }}
                >
                    {persona.name}
                </div>
                <div className="persona-role">{persona.role}</div>
            </div>
        </div>
    );
}

interface DebateSetupProps {
    onStart: (config: {
        question: string;
        personaIds: string[];
        rounds: number;
        modelId: string;
        constraints?: string;
        accessCode?: string;
    }) => void;
    availableModels: { model: string; label: string }[];
    isLoading: boolean;
}

export function DebateSetup({
    onStart,
    availableModels,
    isLoading,
}: DebateSetupProps) {
    const [question, setQuestion] = useState("");
    const [constraints, setConstraints] = useState("");
    const [selectedPersonas, setSelectedPersonas] = useState<string[]>([
        "cfo",
        "strategist",
        "devils-advocate",
    ]);
    const [rounds, setRounds] = useState(3);
    const [accessCode, setAccessCode] = useState("");
    const [modelId, setModelId] = useState(availableModels[0]?.model || "");

    // Sync modelId when availableModels loads (async fetch)
    useEffect(() => {
        if (availableModels.length > 0 && !modelId) {
            setModelId(availableModels[0].model);
        }
    }, [availableModels, modelId]);

    const [autoSelect, setAutoSelect] = useState(false);

    const togglePersona = (id: string) => {
        if (autoSelect) setAutoSelect(false);
        setSelectedPersonas((prev) =>
            prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
        );
    };

    const toggleAutoSelect = () => {
        setAutoSelect((prev) => !prev);
        if (!autoSelect) {
            setSelectedPersonas([]); // Clear manual selection when auto is on
        }
    };

    const canStart =
        question.trim().length > 10 &&
        (autoSelect || (selectedPersonas.length >= 2 && selectedPersonas.length <= 5)) &&
        modelId;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!canStart) return;
        onStart({
            question: question.trim(),
            personaIds: autoSelect ? ["auto"] : selectedPersonas,
            rounds,
            modelId,
            constraints: constraints.trim() || undefined,
            accessCode: accessCode.trim() || undefined,
        });
    };

    return (
        <form className="setup-container" onSubmit={handleSubmit}>
            <div className="setup-section">
                <label className="setup-label" htmlFor="question">
                    Strategic Question
                </label>
                <textarea
                    id="question"
                    className="question-input"
                    placeholder="e.g. Should our company expand into the European market given current macroeconomic conditions?"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    disabled={isLoading}
                />
            </div>

            <div className="setup-section">
                <label className="setup-label" htmlFor="constraints">
                    Resource Constraints
                    <span className="label-optional"> (recommended)</span>
                </label>
                <textarea
                    id="constraints"
                    className="constraints-input"
                    placeholder="e.g. $50M budget, 18-month timeline, team of 120 engineers, must maintain >15% EBITDA margin"
                    value={constraints}
                    onChange={(e) => setConstraints(e.target.value)}
                    disabled={isLoading}
                    rows={2}
                />
                <p className="constraints-hint">
                    Define hard limits like budget, timeline, headcount, or margin floors.
                    The panel will be forced to respect these — no &quot;do everything&quot; compromises.
                </p>
            </div>

            <div className="setup-section">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <span className="setup-label" style={{ marginBottom: 0 }}>
                        Select Panelists {autoSelect ? "(Auto-Detect)" : `(${selectedPersonas.length}/5)`}
                    </span>
                    <button
                        type="button"
                        className={`auto-select-btn ${autoSelect ? "active" : ""}`}
                        onClick={toggleAutoSelect}
                    >
                        {autoSelect ? "✨ AI Auto-Selection Active" : "✨ Use AI Auto-Selection"}
                    </button>
                </div>

                <div className={`persona-grid ${autoSelect ? "disabled" : ""}`}>
                    {PERSONAS.map((persona) => (
                        <PersonaCard
                            key={persona.id}
                            persona={persona}
                            selected={selectedPersonas.includes(persona.id)}
                            onToggle={togglePersona}
                        />
                    ))}
                </div>
                <p className="persona-count-hint">
                    Select 2-5 panelists. Odd numbers recommended for better debate dynamics.
                </p>
            </div>

            <div className="setup-section">
                <span className="setup-label">Settings</span>
                <div className="settings-row">
                    <div className="setting-group">
                        <label className="setup-label" style={{ marginBottom: 6, fontSize: "0.78rem" }}>
                            Model
                        </label>
                        <select
                            className="setting-select"
                            value={modelId}
                            onChange={(e) => setModelId(e.target.value)}
                            disabled={isLoading}
                        >
                            {availableModels.map((m) => (
                                <option key={m.model} value={m.model}>
                                    {m.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="setting-group">
                        <label className="setup-label" style={{ marginBottom: 6, fontSize: "0.78rem" }}>
                            Debate Rounds
                        </label>
                        <select
                            className="setting-select"
                            value={rounds}
                            onChange={(e) => setRounds(Number(e.target.value))}
                            disabled={isLoading}
                        >
                            <option value={1}>1 Round (Quick Take)</option>
                            <option value={2}>2 Rounds</option>
                            <option value={3}>3 Rounds (Recommended)</option>
                            <option value={4}>4 Rounds</option>
                            <option value={5}>5 Rounds (Deep Dive)</option>
                        </select>
                    </div>
                </div>
            </div>

            <button
                type="submit"
                className="start-button"
                disabled={!canStart || isLoading}
            >
                {isLoading ? "Setting up debate..." : "⚡ Start Debate"}
            </button>
        </form>
    );
}
