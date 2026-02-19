"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { DebateSetup } from "@/components/DebateSetup";
import {
  ConstraintCheck,
  Synthesis,
  LoadingIndicator,
  ReframingCard,
  EvidenceReportCard,
  CounterfactualReportCard,
} from "@/components/DebateStream";
import { RoundCard } from "@/components/RoundCard";
import { RoundDetailPanel } from "@/components/RoundDetailPanel";
import { CopyButton } from "@/components/CopyButton";
import { MarkdownContent } from "@/components/MarkdownContent";
import {
  runDebate,
  DebateConfig,
  DebateEvent,
  ClientPersona
} from "@/lib/engine";
import {
  analyzePersonaChemistry,
  sortPersonasByRelevance
} from "@/lib/chemistry";
import {
  getPersonasByIds,
  PERSONAS
} from "@/lib/personas";
import { EvidenceReport } from "@/lib/evidence";
import { CrossExamResult, DivergenceResult } from "@/lib/topology";
import { CounterfactualReport } from "@/lib/counterfactuals";
import { useDebateHistory, SavedDebate } from "@/hooks/useDebateHistory";
import { HistorySidebar } from "@/components/HistorySidebar";

// Resume Banner Component
function ResumeBanner({ timestamp, onResume, onDiscard }: { timestamp: number, onResume: () => void, onDiscard: () => void }) {
  return (
    <div className="fixed bottom-6 right-6 max-w-sm bg-white border border-blue-200 shadow-xl rounded-lg p-4 z-50 animate-fade-in-up">
      <h4 className="font-semibold text-gray-800 mb-1">Unfinished Debate Found</h4>
      <p className="text-sm text-gray-600 mb-3">
        From {new Date(timestamp).toLocaleString()}
      </p>
      <div className="flex gap-2">
        <button
          onClick={onResume}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-3 rounded transition-colors"
        >
          Resume
        </button>
        <button
          onClick={onDiscard}
          className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium py-2 px-3 rounded transition-colors"
        >
          Discard
        </button>
      </div>
    </div>
  );
}

interface RoundData {
  round: number;
  agentResponses: { persona: ClientPersona; content: string }[];
  summary: string | null;
  evidenceReport: EvidenceReport | null;
  crossExams: CrossExamResult[];
  disruptions: string[];
  divergence: DivergenceResult | null;
  constraintCheck: string | null; // New field for per-round critique
}

type AppState = "setup" | "debating" | "complete" | "error";

export default function Home() {
  const [appState, setAppState] = useState<AppState>("setup");
  // History State
  const { saveDebate, saveDraft, getDraft, clearDraft } = useDebateHistory();
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [currentDebateId, setCurrentDebateId] = useState<string | null>(null);
  const [draftFound, setDraftFound] = useState<{ timestamp: number } | null>(null);

  const [availableModels, setAvailableModels] = useState<
    { model: string; label: string }[]
  >([]);
  const [hasKeys, setHasKeys] = useState(true);
  const [roundsData, setRoundsData] = useState<RoundData[]>([]);
  const [constraintCheckContent, setConstraintCheckContent] = useState<
    string | null
  >(null);
  const [synthesis, setSynthesis] = useState<string | null>(null);
  const [counterfactualReport, setCounterfactualReport] = useState<CounterfactualReport | null>(null);
  const [reframingContent, setReframingContent] = useState<string | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [loadingMessage, setLoadingMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [activeRoundDetail, setActiveRoundDetail] = useState<number | null>(
    null
  );
  const [currentRoundInProgress, setCurrentRoundInProgress] = useState<
    number | null
  >(null);
  const debateEndRef = useRef<HTMLDivElement>(null);

  // Fetch available models on mount
  useEffect(() => {
    fetch("/api/debate")
      .then((res) => res.json())
      .then((data) => {
        setAvailableModels(data.models || []);
        setHasKeys(data.hasKeys);
      })
      .catch(() => {
        setHasKeys(false);
      });
  }, []);

  // Check for draft on mount
  useEffect(() => {
    const draft = getDraft();
    if (draft && draft.appState === "debating") {
      setDraftFound({ timestamp: draft.timestamp });
    }
  }, []);

  // Auto-Save Draft Effect
  useEffect(() => {
    if (appState === "debating" && roundsData.length > 0) {
      saveDraft({
        appState,
        roundsData,
        currentQuestion,
        currentRoundInProgress,
        constraints: constraintCheckContent, // Note: constraints might be in a different var name
        activeRoundDetail,
        // Save other necessary state
        reframingContent,
        synthesis,
        constraintCheckContent,
        counterfactualReport
      });
    } else if (appState === "complete" || appState === "setup") {
      if (appState === "complete") {
        clearDraft();
      }
    }
  }, [appState, roundsData, currentQuestion, currentRoundInProgress, reframingContent, synthesis, constraintCheckContent, counterfactualReport]);

  // Auto-scroll to bottom as debate progresses
  useEffect(() => {
    if (appState === "debating" || appState === "complete") {
      debateEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [roundsData, synthesis, constraintCheckContent, appState]);

  const handleDebateEvent = useCallback((event: DebateEvent) => {
    switch (event.type) {
      case "debate_start":
        setLoadingMessage("Reframing the strategic question...");
        break;

      case "reframing":
        setReframingContent(event.content!);
        setLoadingMessage("Panel assembled — starting Round 1...");
        break;

      case "round_start":
        setLoadingMessage(
          `Round ${event.round} — agents are deliberating...`
        );
        setCurrentRoundInProgress(event.round!);
        setRoundsData((prev) => [
          ...prev,
          {
            round: event.round!,
            agentResponses: [],
            summary: null,
            evidenceReport: null,
            crossExams: [],
            disruptions: [],
            divergence: null,
            constraintCheck: null, // Init new field
          },
        ]);
        break;

      case "agent_response":
        setRoundsData((prev) => {
          const updated = [...prev];
          const currentRound = updated.find(
            (r) => r.round === event.round
          );
          if (currentRound) {
            // Check if we already have an entry for this persona
            const existingEntryIndex = currentRound.agentResponses.findIndex(
              (r) => r.persona.id === event.persona!.id
            );

            if (existingEntryIndex !== -1) {
              // Update existing entry with new cumulative content
              // We create a new object to ensure React detects the change
              const newResponses = [...currentRound.agentResponses];
              newResponses[existingEntryIndex] = {
                ...newResponses[existingEntryIndex],
                content: event.content!
              };
              currentRound.agentResponses = newResponses;
            } else {
              // Add new entry
              currentRound.agentResponses = [
                ...currentRound.agentResponses,
                {
                  persona: event.persona!,
                  content: event.content!,
                },
              ];
            }
          }
          return updated;
        });
        break;

      case "evidence_report":
        setRoundsData((prev) => {
          const updated = [...prev];
          const currentRound = updated.find(
            (r) => r.round === event.round
          );
          if (currentRound) {
            currentRound.evidenceReport = event.report as EvidenceReport;
          }
          return updated;
        });
        setLoadingMessage(
          `Evidence analyzed — summarizing Round ${event.round}...`
        );
        break;

      case "cross_examination":
        setRoundsData((prev) => {
          const updated = [...prev];
          const currentRound = updated.find((r) => r.round === event.round);
          if (currentRound) {
            currentRound.crossExams.push(event.result!);
          }
          return updated;
        });
        setLoadingMessage(`Cross-examination in progress: ${event.result?.challenger} vs ${event.result?.target}...`);
        break;

      case "disruption":
        setRoundsData((prev) => {
          const updated = [...prev];
          const currentRound = updated.find((r) => r.round === event.round);
          if (currentRound) {
            currentRound.disruptions.push(event.content!);
          }
          return updated;
        });
        setLoadingMessage(`⚠️ Disruption injected! Re-evaluating...`);
        break;

      case "divergence":
        setRoundsData((prev) => {
          const updated = [...prev];
          const currentRound = updated.find((r) => r.round === event.round);
          if (currentRound) {
            currentRound.divergence = {
              score: event.score!,
              assessment: event.assessment!,
            };
          }
          return updated;
        });
        break;

      case "round_summary":
        setLoadingMessage(
          `Round ${event.round} complete — checking constraints...`
        );
        setCurrentRoundInProgress(null);
        setRoundsData((prev) => {
          const updated = [...prev];
          const currentRound = updated.find(
            (r) => r.round === event.round
          );
          if (currentRound) {
            currentRound.summary = event.content!;
          }
          return updated;
        });
        break;

      case "constraint_check":
        // Handle Iterative Critique
        if (event.round) {
          setRoundsData((prev) => {
            const updated = [...prev];
            const currentRound = updated.find((r) => r.round === event.round);
            if (currentRound) {
              currentRound.constraintCheck = event.content!;
            }
            return updated;
          });
          setLoadingMessage(
            `Round ${event.round} verified — starting next round...`
          );
        } else {
          // Fallback for global check (legacy or final guard)
          setConstraintCheckContent(event.content!);
          setLoadingMessage(
            "Final review complete — generating decision..."
          );
        }
        break;

      case "synthesis":
        setSynthesis(event.content!);
        setLoadingMessage("Generating Decision Journal (Counterfactual Analysis)...");
        break;

      case "counterfactual_report":
        setCounterfactualReport(event.report as CounterfactualReport);
        break;

      case "debate_end":
        setAppState("complete");
        setLoadingMessage("");
        setCurrentRoundInProgress(null);
        // Auto-save happens in the effect
        break;

      case "error":
        setErrorMessage(
          event.message || "Unknown error during debate"
        );
        setAppState("error");
        break;
    }
  }, []);

  const startDebate = useCallback(
    async (config: {
      question: string;
      personaIds: string[];
      rounds: number;
      modelId: string;
      constraints?: string;
      accessCode?: string;
    }) => {
      setAppState("debating");
      setRoundsData([]);
      setConstraintCheckContent(null);
      setSynthesis(null);
      setCounterfactualReport(null);
      setCurrentQuestion(config.question);
      setLoadingMessage("Initializing debate engine...");
      setErrorMessage("");
      setActiveRoundDetail(null);
      setCurrentRoundInProgress(null);

      // Store access code in localStorage for proxy usage
      if (config.accessCode) {
        localStorage.setItem("delibero_access_code", config.accessCode);
      }

      try {
        const selectedModel = availableModels.find(m => m.model === config.modelId);
        if (!selectedModel) throw new Error("Selected model not found");

        const modelConfig = {
          provider: selectedModel.model.startsWith("gpt") ? "openai" as const : "anthropic" as const,
          model: selectedModel.model,
          label: selectedModel.label
        };

        // --- Client-Side Chemistry (if auto) ---
        let selectedPersonas = [];
        const isAuto = !config.personaIds || config.personaIds.length === 0 || config.personaIds[0] === "auto";

        if (isAuto) {
          handleDebateEvent({ type: "reframing", content: "🔬 **Analyzing Question DNA...**\n\nIdentifying the core conflict and assembling the optimal expert panel." } as any);

          try {
            const analysis = await analyzePersonaChemistry(config.question, PERSONAS, modelConfig);

            // Mandatory Ops
            const mandatoryId = "devils-advocate";
            const mandatoryPersona = PERSONAS.find(p => p.id === mandatoryId);

            // Sort
            const sorted = sortPersonasByRelevance(PERSONAS, analysis.recommendedPersonas);
            const candidates = sorted.filter(p => p.id !== mandatoryId);

            // Select
            const panelSize = analysis.recommendedPanelSize;
            const selection = candidates.slice(0, panelSize - 1);
            const finalSet = mandatoryPersona ? [mandatoryPersona, ...selection] : selection.slice(0, panelSize);

            // Re-sort for display (chemistry order)
            selectedPersonas = sortPersonasByRelevance(finalSet, analysis.recommendedPersonas);

            // Emit Reframing Update
            handleDebateEvent({
              type: "reframing",
              content: `**Panel Chemistry Analysis Completed**
Category: **${analysis.questionCategory}** | Complexity: **${analysis.complexityScore}/10**
Recommended Panel Size: **${panelSize} Experts**

**Selected Experts:**
${selectedPersonas.map(p => {
                const score = analysis.recommendedPersonas.find(r => r.personaId === p.id)?.relevanceScore || 0;
                return `- **${p.name}** (${p.role}) — Match Score: ${score}%`;
              }).join("\n")}`
            } as any);

          } catch (e) {
            console.error("Chemistry failed, fallback", e);
            selectedPersonas = PERSONAS.slice(0, 3);
          }
        } else {
          selectedPersonas = getPersonasByIds(config.personaIds);
        }

        if (selectedPersonas.length < 2) selectedPersonas = PERSONAS.slice(0, 2);

        // --- Run Debate (Client-Side) ---
        const debateConfig: DebateConfig = {
          question: config.question,
          personas: selectedPersonas,
          rounds: config.rounds,
          model: modelConfig,
          constraints: config.constraints
        };

        // Execute locally!
        await runDebate(debateConfig, handleDebateEvent);

      } catch (err) {
        console.error("Debate Error:", err);
        setErrorMessage(
          err instanceof Error
            ? err.message
            : "An unexpected error occurred"
        );
        setAppState("error");
      }
    },
    [handleDebateEvent, availableModels]
  );


  // Auto-Save Effect
  useEffect(() => {
    if (appState === "complete" && synthesis && !currentDebateId) {
      // Only save if it's a NEW run (no currentDebateId)
      // If we loaded a past debate, currentDebateId will be set, so we don't duplicate save
      const snippet = synthesis.split('\n')[0].replace(/^#+\s*/, '').slice(0, 100);

      saveDebate({
        question: currentQuestion,
        synthesisSnippet: snippet,
        rounds: roundsData,
        synthesis,
        constraintCheck: constraintCheckContent,
        counterfactual: counterfactualReport,
        reframing: reframingContent
      });
      // We won't set currentDebateId here because we don't need to track it for the session
      // unless we want to prevent double-saving on re-renders. 
      // The check !currentDebateId helps, but we should probably set a "hasSaved" flag ref.
    }
  }, [appState, synthesis]); // Run when state becomes complete and we have synthesis

  // Load Debate Handler
  const loadDebate = (saved: SavedDebate) => {
    setRoundsData(saved.rounds);
    setSynthesis(saved.synthesis);
    setConstraintCheckContent(saved.constraintCheck);
    setCounterfactualReport(saved.counterfactual);
    setReframingContent(saved.reframing);
    setCurrentQuestion(saved.question);
    setCurrentDebateId(saved.id); // Mark as "loaded" so we don't auto-save again
    setAppState("complete");
    setLoadingMessage("");
    setIsHistoryOpen(false);
    setErrorMessage("");
  };

  const resetDebate = () => {
    setAppState("setup");
    setRoundsData([]);
    setConstraintCheckContent(null);
    setSynthesis(null);
    setCounterfactualReport(null);
    setReframingContent(null);
    setCurrentQuestion("");
    setLoadingMessage("");
    setErrorMessage("");
    setActiveRoundDetail(null);
    setCurrentRoundInProgress(null);
    setCurrentDebateId(null); // Reset ID so next run triggers auto-save
  };



  // Build full debate text for copy
  const buildFullDebateText = useCallback(() => {
    let text = `# ${currentQuestion}\n\n`;
    for (const round of roundsData) {
      text += `## Round ${round.round}\n\n`;
      for (const r of round.agentResponses) {
        text += `### ${r.persona.name} (${r.persona.role})\n\n${r.content}\n\n`;
      }
      if (round.summary) {
        text += `### Round Summary\n\n${round.summary}\n\n`;
      }
      text += `---\n\n`;
    }
    if (constraintCheckContent) {
      text += `## Constraint Check\n\n${constraintCheckContent}\n\n---\n\n`;
    }
    if (synthesis) {
      text += `## Final Decision\n\n${synthesis}\n`;
    }
    return text;
  }, [currentQuestion, roundsData, constraintCheckContent, synthesis]);

  // Find the round for the detail panel
  const detailRound = activeRoundDetail
    ? roundsData.find((r) => r.round === activeRoundDetail)
    : null;

  // --- Render ---

  if (!hasKeys) {
    return (
      <div className="app-container">
        <header className="app-header">
          <h1>Delibero</h1>
          <p>Multi-Agent Strategic Debate Platform</p>
        </header>
        <div className="no-keys-banner">
          <h2>🔑 API Keys Required</h2>
          <p>
            Add your LLM API key(s) to <code>.env.local</code> in
            the project root:
          </p>
          <p style={{ marginTop: 12 }}>
            <code>OPENAI_API_KEY=sk-...</code>
            <br />
            <code>ANTHROPIC_API_KEY=sk-ant-...</code>
          </p>
          <p style={{ marginTop: 12 }}>
            Then restart the dev server.
          </p>
        </div>
      </div>
    );
  }

  const handleResumeDraft = () => {
    const draft = getDraft();
    if (draft) {
      setAppState(draft.appState);
      setRoundsData(draft.roundsData);
      setCurrentQuestion(draft.currentQuestion);
      setCurrentRoundInProgress(draft.currentRoundInProgress);
      setConstraintCheckContent(draft.constraints); // Restoring constraints
      setActiveRoundDetail(draft.activeRoundDetail);
      setReframingContent(draft.reframingContent);
      setSynthesis(draft.synthesis);
      setConstraintCheckContent(draft.constraintCheckContent); // Overwrite if both present (should assume consistent naming in future)
      setCounterfactualReport(draft.counterfactualReport);

      setDraftFound(null); // Hide banner
      // Note: we don't clear draft yet, will clear on completion or discard
    }
  };

  const handleDiscardDraft = () => {
    clearDraft();
    setDraftFound(null);
  };

  return (
    <div className="app-container">
      {draftFound && (
        <ResumeBanner
          timestamp={draftFound.timestamp}
          onResume={handleResumeDraft}
          onDiscard={handleDiscardDraft}
        />
      )}

      <header className="app-header">
        <div className="header-content">
          <h1>Delibero</h1>
          <p>
            Enterprise-Grade Multi-Agent Decision Intelligence.
            Harness the power of diverse AI experts to solve complex strategic challenges.
          </p>
        </div>
        <button
          onClick={() => setIsHistoryOpen(true)}
          className="history-toggle-btn"
          title="View Past Debates"
        >
          🕑 History
        </button>
      </header>

      <HistorySidebar
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        onSelectDebate={loadDebate}
      />

      {appState === "setup" && (
        <DebateSetup
          onStart={startDebate}
          availableModels={availableModels}
          isLoading={false}
        />
      )}

      {(appState === "debating" || appState === "complete") && (
        <div className={`debate-layout ${detailRound ? "debate-layout--split" : ""}`}>
          <div className="debate-container">
            <div className="debate-question-banner">
              <div className="debate-question-header">
                <span className="debate-question-badge">📋 Question Under Debate</span>
                <CopyButton text={currentQuestion} label="Copy question" />
              </div>
              <div className="debate-question-content">
                <MarkdownContent text={currentQuestion} />
              </div>
            </div>

            {errorMessage && (
              <div className="error-banner">⚠️ {errorMessage}</div>
            )}

            {/* Strategic Reframing (Round 0) */}
            {reframingContent && (
              <ReframingCard content={reframingContent} />
            )}

            {/* Collapsed round cards */}
            <div className="rounds-timeline">
              {roundsData.map((round) => (
                <RoundCard
                  key={round.round}
                  round={round.round}
                  agentResponses={round.agentResponses}
                  summary={round.summary}
                  evidenceReport={round.evidenceReport}
                  constraintCheck={round.constraintCheck} // Pass the critique
                  isInProgress={
                    currentRoundInProgress === round.round
                  }
                  onViewDetails={() =>
                    setActiveRoundDetail(
                      activeRoundDetail === round.round ? null : round.round
                    )
                  }
                />
              ))}
            </div>

            {constraintCheckContent && (
              <ConstraintCheck content={constraintCheckContent} />
            )}

            {synthesis && <Synthesis content={synthesis} />}

            {counterfactualReport && (
              <div className="counterfactual-section-wrapper">
                <CounterfactualReportCard report={counterfactualReport} />
              </div>
            )}

            {loadingMessage && appState === "debating" && (
              <LoadingIndicator message={loadingMessage} />
            )}

            {appState === "complete" && (
              <div className="debate-actions">
                <button
                  className="new-debate-button"
                  onClick={resetDebate}
                >
                  ← Start New Debate
                </button>
                <CopyButton
                  text={buildFullDebateText()}
                  label="Copy full debate"
                  className="copy-full-debate-btn"
                />
              </div>
            )}

            <div ref={debateEndRef} />
          </div>

          {/* Inline detail panel — right 1/3 */}
          {detailRound && (
            <RoundDetailPanel
              round={detailRound.round}
              agentResponses={detailRound.agentResponses}
              summary={detailRound.summary}
              evidenceReport={detailRound.evidenceReport}
              crossExams={detailRound.crossExams}
              disruptions={detailRound.disruptions}
              onClose={() => setActiveRoundDetail(null)}
            />
          )}
        </div>
      )}

      {appState === "error" && (
        <div>
          <div className="error-banner">⚠️ {errorMessage}</div>
          <button
            className="new-debate-button"
            onClick={resetDebate}
          >
            ← Try Again
          </button>
        </div>
      )}
    </div>
  );
}
