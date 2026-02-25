"use client";

import { useState, useEffect } from "react";
import { Persona, PERSONAS } from "@/lib/personas";
import { ModelConfig } from "@/lib/llm";

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
        apiKey?: string;
    }) => void;
    availableModels: { model: string; label: string; provider: "openai" | "anthropic" | "gemini" }[];
    serverProviders: string[];
    isLoading: boolean;
    requireApiKey?: boolean;
}

export function DebateSetup({
    onStart,
    availableModels,
    serverProviders,
    isLoading,
    requireApiKey,
}: DebateSetupProps) {
    const [question, setQuestion] = useState("");
    const [constraints, setConstraints] = useState("");
    const [customKeys, setCustomKeys] = useState<{ openai: string; anthropic: string; gemini: string }>({
        openai: "",
        anthropic: "",
        gemini: "",
    });
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [selectedPersonas, setSelectedPersonas] = useState<string[]>([
        "cfo",
        "strategist",
        "devils-advocate",
    ]);
    const [rounds, setRounds] = useState(3);
    const [accessCode, setAccessCode] = useState("");
    const [modelId, setModelId] = useState(availableModels[0]?.model || "");

    // Auto-expand advanced settings if requireApiKey is triggered (free tier exhausted)
    useEffect(() => {
        if (requireApiKey) {
            setShowAdvanced(true);
        }
    }, [requireApiKey]);

    // Dynamic models state
    const [fetchedModels, setFetchedModels] = useState<ModelConfig[]>([]);
    const [isFetchingModels, setIsFetchingModels] = useState(false);
    const [hasFetchedModels, setHasFetchedModels] = useState(false);

    // Initial load from local storage
    useEffect(() => {
        const savedKeys = localStorage.getItem("delibero_custom_keys");
        if (savedKeys) {
            try {
                setCustomKeys(JSON.parse(savedKeys));
            } catch (e) {
                console.error("Failed to parse saved keys", e);
            }
        }
    }, []);

    // Explicit model fetching function triggered by user interaction
    const fetchModels = async () => {
        setIsFetchingModels(true);
        try {
            const res = await fetch("/api/models", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ customKeys })
            });
            if (res.ok) {
                const data = await res.json();
                setFetchedModels(data.models || []);
            }
        } catch (error) {
            console.error("Failed to fetch dynamic models:", error);
        } finally {
            setIsFetchingModels(false);
            setHasFetchedModels(true);
        }
    };

    // The models available to the user.
    // If they have fetched dynamic models, use that exact list (validating any custom keys).
    // Otherwise, ONLY fall back to statically configured server models (ignoring unverified typed custom keys).
    const accessibleModels = hasFetchedModels
        ? fetchedModels
        : availableModels.filter(m => serverProviders.includes(m.provider));

    // Sync modelId when accessibleModels list changes
    useEffect(() => {
        if (!isFetchingModels && accessibleModels.length > 0) {
            if (!modelId || !accessibleModels.find((m) => m.model === modelId)) {
                setModelId(accessibleModels[0].model);
            }
        } else if (accessibleModels.length === 0) {
            setModelId("");
        }
    }, [accessibleModels, modelId, isFetchingModels]);

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
        modelId &&
        // Ensure that if the server *demands* a key (rate limited), they have provided the key for their selected model
        (!requireApiKey || customKeys[accessibleModels.find(m => m.model === modelId)?.provider as keyof typeof customKeys]?.trim().length > 10);

    const handleKeyChange = (provider: keyof typeof customKeys, value: string) => {
        const newKeys = { ...customKeys, [provider]: value };
        setCustomKeys(newKeys);
        setHasFetchedModels(false);
        setFetchedModels([]);
        localStorage.setItem("delibero_custom_keys", JSON.stringify(newKeys));
    };

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
            apiKey: customKeys[availableModels.find(m => m.model === modelId)?.provider as keyof typeof customKeys]?.trim() || undefined,
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
                        <label className="setup-label" style={{ marginBottom: 6, fontSize: "0.78rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            Model {isFetchingModels && <span style={{ fontSize: "0.7rem", color: "var(--primary)" }}>Refreshing...</span>}
                        </label>
                        <select
                            className="setting-select"
                            value={modelId}
                            onChange={(e) => setModelId(e.target.value)}
                            disabled={isLoading || isFetchingModels}
                        >
                            {accessibleModels.length > 0 ? (
                                accessibleModels.map((m) => (
                                    <option key={m.model} value={m.model}>
                                        {m.label}
                                    </option>
                                ))
                            ) : (
                                <option disabled value="">{isFetchingModels ? "Loading..." : "No models available - Add API Key below"}</option>
                            )}
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

            {/* Advanced Settings: Custom API Keys */}
            <div className={`setup-section advanced-section ${showAdvanced ? "expanded" : ""}`}>
                <div
                    className={`advanced-header ${requireApiKey ? "error-mode" : ""}`}
                    onClick={() => setShowAdvanced(!showAdvanced)}
                >
                    <span className="setup-label" style={{ marginBottom: 0, cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}>
                        ⚙️ Advanced: Custom API Keys
                        <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: "normal" }}>
                            {showAdvanced ? "▼" : "▶"}
                        </span>
                    </span>
                    {requireApiKey && !showAdvanced && (
                        <span className="error-badge">API Key Required (Free limit reached)</span>
                    )}
                </div>

                {showAdvanced && (
                    <div className="advanced-content" style={{ marginTop: "16px", padding: "16px", background: "rgba(255, 255, 255, 0.02)", borderRadius: "8px", border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "12px" }}>
                        {requireApiKey && (
                            <div style={{ padding: "12px", background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: "6px", marginBottom: "8px" }}>
                                <p style={{ fontSize: "0.9rem", color: "var(--danger)", margin: 0, fontWeight: "500" }}>
                                    🎉 You&apos;ve used your one free debate! Please provide an API key for your chosen model to continue. Keys are saved locally in your browser.
                                </p>
                            </div>
                        )}
                        <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", margin: 0, lineHeight: 1.4 }}>
                            Use your own API keys. Models will only appear in the dropdown if their corresponding key is provided below (or configured by the server).
                        </p>

                        <div className="key-input-group">
                            <label className="setup-label" style={{ fontSize: "0.8rem", marginBottom: "4px" }}>OpenAI API Key (sk-...)</label>
                            <input
                                type="password"
                                className="constraints-input"
                                placeholder="..."
                                value={customKeys.openai}
                                onChange={(e) => handleKeyChange("openai", e.target.value)}
                                disabled={isLoading}
                                style={{ padding: "8px" }}
                            />
                        </div>

                        <div className="key-input-group">
                            <label className="setup-label" style={{ fontSize: "0.8rem", marginBottom: "4px" }}>Anthropic API Key (sk-ant-...)</label>
                            <input
                                type="password"
                                className="constraints-input"
                                placeholder="..."
                                value={customKeys.anthropic}
                                onChange={(e) => handleKeyChange("anthropic", e.target.value)}
                                disabled={isLoading}
                                style={{ padding: "8px" }}
                            />
                        </div>

                        <div className="key-input-group">
                            <label className="setup-label" style={{ fontSize: "0.8rem", marginBottom: "4px" }}>Google Gemini API Key (AIza...)</label>
                            <input
                                type="password"
                                className="constraints-input"
                                placeholder="..."
                                value={customKeys.gemini}
                                onChange={(e) => handleKeyChange("gemini", e.target.value)}
                                disabled={isLoading || isFetchingModels}
                                style={{ padding: "8px" }}
                            />
                        </div>

                        <button
                            type="button"
                            onClick={fetchModels}
                            className="start-button"
                            disabled={isFetchingModels || isLoading || (!customKeys.openai && !customKeys.anthropic && !customKeys.gemini)}
                            style={{
                                marginTop: "12px",
                                padding: "10px",
                                fontSize: "0.85rem",
                                background: "var(--primary)",
                                color: "var(--background)",
                                fontWeight: "600",
                                display: "flex",
                                justifyContent: "center",
                                alignItems: "center",
                                gap: "8px"
                            }}
                        >
                            {isFetchingModels ? "⏳ Fetching Latest Models..." : "🔄 Fetch Available Models"}
                        </button>
                    </div>
                )}
            </div>

            <button
                type="submit"
                className="start-button"
                disabled={!canStart || isLoading}
            >
                {isLoading ? "Setting up debate..." : "⚡ Start Debate"}
            </button>
        </form >
    );
}
