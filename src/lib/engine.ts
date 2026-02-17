import { Persona } from "./personas";
import { ModelConfig, callLLM } from "./llm";
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
    | { type: "round_summary"; round: number; content: string }
    | { type: "constraint_check"; content: string }
    | { type: "synthesis"; content: string }
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

    for (let round = 1; round <= rounds; round++) {
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
            const content = await callLLM(persona.systemPrompt, userMessage, model);
            return { persona, content };
        });

        const agentResponses = await Promise.all(agentPromises);

        // Emit each agent's response (strip system prompt before sending to client)
        for (const { persona, content } of agentResponses) {
            onEvent({ type: "agent_response", round, persona: stripPrompt(persona), content });
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

    // --- Final synthesis (informed by constraint critic) ---
    const synthesizerInput = buildSynthesizerMessage(
        question,
        roundSummaries,
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
    onEvent({ type: "debate_end" });
}
