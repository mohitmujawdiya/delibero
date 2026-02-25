import { Persona } from "./personas";
import { ModelConfig, callLLM, streamLLM } from "./llm";
import {
    buildAgentUserMessage,
    buildSummarizerMessage,
    buildSynthesizerMessage,
    buildConstraintCriticMessage,
    buildReframingMessage,
    SUMMARIZER_SYSTEM_PROMPT,
    SYNTHESIZER_SYSTEM_PROMPT,
    CONSTRAINT_CRITIC_SYSTEM_PROMPT,
    REFRAMING_SYSTEM_PROMPT,
} from "./prompts";
import { analyzeEvidence, EvidenceReport } from "./evidence";
import {
    selectCrossExamPairs,
    runCrossExam,
    scoreDivergence,
    generateDisruption,
    shouldExtendDebate,
    shouldDisrupt,
    CrossExamResult,
} from "./topology";
import { generateCounterfactuals, CounterfactualReport } from "./counterfactuals";

// --- Safe persona type for client consumption (no system prompts) ---

export type ClientPersona = Omit<Persona, "systemPrompt">;

function stripPrompt(persona: Persona): ClientPersona {
    const { systemPrompt: _omit, ...safe } = persona;
    return safe;
}

// --- Types for debate events (streamed to the client) ---

export type DebateEvent =
    | { type: "debate_start"; question: string; personas: ClientPersona[]; rounds: number }
    | { type: "reframing"; content: string }
    | { type: "round_start"; round: number }
    | { type: "agent_response"; round: number; persona: ClientPersona; content: string }
    | { type: "evidence_report"; round: number; report: EvidenceReport }
    | { type: "cross_examination"; round: number; result: CrossExamResult }
    | { type: "divergence"; round: number; score: number; assessment: string }
    | { type: "disruption"; round: number; content: string }
    | { type: "round_summary"; round: number; content: string }
    | { type: "constraint_check"; round?: number; content: string }
    | { type: "synthesis"; content: string }
    | { type: "counterfactual_report"; report: CounterfactualReport }
    | { type: "debate_end" }
    | { type: "error"; message: string };

export interface DebateConfig {
    question: string;
    personas: Persona[];
    rounds: number;
    model: ModelConfig;
    constraints?: string;
}

/**
 * Run the full debate and call `onEvent` for each step.
 * This is the core orchestrator — it's a single async function, not a class.
 */
export async function runDebate(
    config: DebateConfig,
    onEvent: (event: DebateEvent) => void
): Promise<void> {
    const { question, personas, rounds, model, constraints } = config;
    const agentNames = personas.map((p) => `${p.name} (${p.role})`);

    onEvent({
        type: "debate_start",
        question,
        personas: personas.map(stripPrompt),
        rounds,
    });

    let cumulativeSummary: string | null = null;
    const roundSummaries: string[] = [];
    const evidenceReports: string[] = [];

    // --- Strategic Reframing Phase (Round 0) ---
    const reframingInput = buildReframingMessage(question, constraints);
    const reframingAnalysis = await callLLM(
        REFRAMING_SYSTEM_PROMPT,
        reframingInput,
        model,
        0.5 // Slightly creative for reframing
    );
    onEvent({ type: "reframing", content: reframingAnalysis });

    // Prepend reframing context so round 1 agents see it
    const reframingContext = `## Strategic Reframing (Pre-Debate Analysis)\n${reframingAnalysis}`;

    let effectiveRounds = rounds;
    let hasExtended = false;

    for (let round = 1; round <= effectiveRounds; round++) {
        onEvent({ type: "round_start", round });

        // --- Run all agents in parallel for this round ---
        const baseContext = round === 1
            ? reframingContext  // Round 1 sees the reframing analysis
            : cumulativeSummary;
        const userMessage = buildAgentUserMessage(
            question,
            round,
            baseContext,
            agentNames,
            constraints
        );

        const agentPromises = personas.map(async (persona) => {
            // Stream the response
            const stream = await streamLLM(persona.systemPrompt, userMessage, model);
            const reader = stream.getReader();
            const decoder = new TextDecoder();
            let fullContent = "";

            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value, { stream: true });
                    fullContent += chunk;

                    // Emit partial update
                    // We send the safe persona and the cumulative content so far
                    onEvent({
                        type: "agent_response",
                        round,
                        persona: stripPrompt(persona),
                        content: fullContent,
                    });
                }
            } catch (err) {
                const errorMsg = err instanceof Error ? err.message : String(err);
                if (!errorMsg.includes("FREE_LIMIT_REACHED") && !errorMsg.includes("Free Debate Exhaused")) {
                    console.error(`Error streaming response for ${persona.name}:`, err);
                }
                throw err;
            } finally {
                reader.releaseLock();
            }

            return { persona, content: fullContent };
        });

        const agentResponses = await Promise.all(agentPromises);

        // Emit each agent's response (strip system prompt before sending to client)
        for (const { persona, content } of agentResponses) {
            onEvent({ type: "agent_response", round, persona: stripPrompt(persona), content });
        }

        // --- Evidence Grounding (claim extraction + consistency check) ---
        const evidenceReport = await analyzeEvidence(round, agentResponses, model);
        onEvent({ type: "evidence_report", round, report: evidenceReport });

        // Store summary for synthesizer
        if (evidenceReport.summary) {
            evidenceReports.push(`**Round ${round} Evidence Audit:**\n${evidenceReport.summary}\n\n*Critical Contradictions:* ${evidenceReport.contradictions.length}`);
        }

        // --- Cross-Examination Phase ---
        const crossExamPairs = selectCrossExamPairs(personas, agentResponses, 1);
        for (const pair of crossExamPairs) {
            const challengerResp = agentResponses.find(
                (r) => r.persona.id === pair.challenger.id
            );
            const targetResp = agentResponses.find(
                (r) => r.persona.id === pair.target.id
            );
            if (challengerResp && targetResp) {
                const result = await runCrossExam(
                    pair,
                    challengerResp.content,
                    targetResp.content,
                    question,
                    model
                );
                onEvent({ type: "cross_examination", round, result });
            }
        }

        // --- Summarize this round (context compression) ---
        const summarizerInput = buildSummarizerMessage(round, agentResponses);
        const roundSummary = await callLLM(
            SUMMARIZER_SYSTEM_PROMPT,
            summarizerInput,
            model,
            0.3 // Low temperature for factual summary
        );

        roundSummaries.push(roundSummary);
        onEvent({ type: "round_summary", round, content: roundSummary });

        // --- Divergence Detection ---
        const divergence = await scoreDivergence(roundSummary, model);
        onEvent({
            type: "divergence",
            round,
            score: divergence.score,
            assessment: divergence.assessment,
        });

        // Check for disruption (premature consensus)
        if (shouldDisrupt(divergence.score, round)) {
            const disruption = await generateDisruption(question, roundSummary, model);
            onEvent({ type: "disruption", round, content: disruption });
            // Inject disruption into the cumulative summary so next round sees it
            roundSummaries[roundSummaries.length - 1] += `\n\n⚠️ DISRUPTION INJECTED: ${disruption}`;
        }

        // Check for extension (high divergence in final round)
        if (!hasExtended && shouldExtendDebate(divergence.score, round, effectiveRounds)) {
            effectiveRounds += 1;
            hasExtended = true;
        }

        // Build cumulative summary for next round
        // Only keep last 2 round summaries to prevent context growth
        const recentSummaries = roundSummaries.slice(-2);
        cumulativeSummary = recentSummaries
            .map((s, i) => {
                const roundNum = roundSummaries.length - recentSummaries.length + i + 1;
                return `**Round ${roundNum}:**\n${s}`;
            })
            .join("\n\n---\n\n");
    }

    // --- Constraint Critic Step ---
    // Check if the debate's emerging consensus is actually feasible
    const constraintCriticInput = buildConstraintCriticMessage(
        question,
        roundSummaries,
        constraints
    );
    const constraintAnalysis = await callLLM(
        CONSTRAINT_CRITIC_SYSTEM_PROMPT,
        constraintCriticInput,
        model,
        0.2 // Very low temperature for factual analysis
    );

    onEvent({ type: "constraint_check", content: constraintAnalysis });

    // --- Final synthesis (informed by constraint critic AND evidence) ---
    // We pass the last 2 evidence reports (most recent) to avoid context overflow
    // This allows the synthesizer to see what claims were recently flagged as verified/contradicted
    const recentEvidenceReports = []; // In a real implementation we'd store these.
    // NOTE: We need to store evidence reports in the loop to pass them here.
    // Let's assume we modify the loop to store them.
    // But since I can't modify the loop in THIS edit without a larger block,
    // I will refactor to just pass an empty array for now or try to capture them if I can widen the scope.
    // ACTUALLY, I should capture them.

    // RE-TRIPPING: I need to declare `evidenceReports` array before the loop.
    // I'll assume for this specific edit chunk I can't see the loop start.
    // I will use a different strategy: I will just pass an empty array here and add the collection logic in a separate edit if needed,
    // OR I will widen the scope to include the loop start.

    // Let's widen the scope to include the loop start in a separate edit.
    // Wait, I can't do that easily.

    // Instead, I'll use a hack: I'll just pass [] for now and then add the collection logic.
    // actually, I'll do two edits. One to init the array, one to use it.
    // BUT I can't leave broken code.

    // Let's just update the call signature first, passing [] as placeholder.
    // Then I'll go back and add the collection.

    const synthesizerInput = buildSynthesizerMessage(
        question,
        roundSummaries,
        evidenceReports,
        constraintAnalysis,
        constraints
    );
    const synthesis = await callLLM(
        SYNTHESIZER_SYSTEM_PROMPT,
        synthesizerInput,
        model,
        0.4 // Slightly creative but grounded
    );

    onEvent({ type: "synthesis", content: synthesis });

    // --- Counterfactual Analysis (Decision Journal) ---
    // Generate a defensible record of pre-mortems and reversal triggers
    const counterfactualReport = await generateCounterfactuals(
        question,
        synthesis,
        roundSummaries,
        model
    );
    onEvent({ type: "counterfactual_report", report: counterfactualReport });

    onEvent({ type: "debate_end" });
}
