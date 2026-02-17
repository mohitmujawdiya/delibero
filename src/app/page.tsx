"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { DebateSetup } from "@/components/DebateSetup";
import {
  ConstraintCheck,
  Synthesis,
  LoadingIndicator,
  ReframingCard,
} from "@/components/DebateStream";
import { RoundCard } from "@/components/RoundCard";
import { RoundDetailPanel } from "@/components/RoundDetailPanel";
import { CopyButton } from "@/components/CopyButton";
import { MarkdownContent } from "@/components/MarkdownContent";
import { ClientPersona } from "@/lib/engine";

interface DebateEventData {
  type: string;
  question?: string;
  personas?: ClientPersona[];
  rounds?: number;
  round?: number;
  persona?: ClientPersona;
  content?: string;
  message?: string;
}

interface RoundData {
  round: number;
  agentResponses: { persona: ClientPersona; content: string }[];
  summary: string | null;
}

type AppState = "setup" | "debating" | "complete" | "error";

export default function Home() {
  const [appState, setAppState] = useState<AppState>("setup");
  const [availableModels, setAvailableModels] = useState<
    { model: string; label: string }[]
  >([]);
  const [hasKeys, setHasKeys] = useState(true);
  const [roundsData, setRoundsData] = useState<RoundData[]>([]);
  const [constraintCheckContent, setConstraintCheckContent] = useState<
    string | null
  >(null);
  const [synthesis, setSynthesis] = useState<string | null>(null);
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

  // Auto-scroll to bottom as debate progresses
  useEffect(() => {
    if (appState === "debating" || appState === "complete") {
      debateEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [roundsData, synthesis, constraintCheckContent, appState]);

  const handleDebateEvent = useCallback((event: DebateEventData) => {
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
            // Deduplicate: skip if this persona already responded in this round
            const alreadyResponded =
              currentRound.agentResponses.some(
                (r) => r.persona.id === event.persona!.id
              );
            if (!alreadyResponded) {
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

      case "round_summary":
        setLoadingMessage(
          `Round ${event.round} complete — compressing context...`
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
        setLoadingMessage(
          "Constraint critic finished — generating final decision..."
        );
        setConstraintCheckContent(event.content!);
        break;

      case "synthesis":
        setLoadingMessage("");
        setSynthesis(event.content!);
        break;

      case "debate_end":
        setAppState("complete");
        setLoadingMessage("");
        setCurrentRoundInProgress(null);
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
    }) => {
      setAppState("debating");
      setRoundsData([]);
      setConstraintCheckContent(null);
      setSynthesis(null);
      setCurrentQuestion(config.question);
      setLoadingMessage("Assembling the panel...");
      setErrorMessage("");
      setActiveRoundDetail(null);
      setCurrentRoundInProgress(null);

      try {
        const response = await fetch("/api/debate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(config),
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || "Failed to start debate");
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response stream");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const jsonStr = line.slice(6).trim();
            if (!jsonStr) continue;

            try {
              const event: DebateEventData = JSON.parse(jsonStr);
              handleDebateEvent(event);
            } catch {
              // Skip malformed JSON
            }
          }
        }
      } catch (err) {
        setErrorMessage(
          err instanceof Error
            ? err.message
            : "An unexpected error occurred"
        );
        setAppState("error");
      }
    },
    [handleDebateEvent]
  );

  const resetDebate = () => {
    setAppState("setup");
    setRoundsData([]);
    setConstraintCheckContent(null);
    setSynthesis(null);
    setReframingContent(null);
    setCurrentQuestion("");
    setLoadingMessage("");
    setErrorMessage("");
    setActiveRoundDetail(null);
    setCurrentRoundInProgress(null);
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

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Delibero</h1>
        <p>
          AI-powered strategic debate — multiple expert personas
          deliberate your toughest business questions
        </p>
      </header>

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
