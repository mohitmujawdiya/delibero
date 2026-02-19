import { ModelConfig, callLLM } from "./llm";
import { Persona } from "./personas";
import {
    DIVERGENCE_SCORER_SYSTEM_PROMPT,
    CROSS_EXAM_SYSTEM_PROMPT,
    DISRUPTION_SYSTEM_PROMPT,
    buildDivergenceScoreMessage,
    buildCrossExamMessage,
    buildDisruptionMessage,
} from "./prompts";

// --- Types ---

export interface CrossExamPair {
    challenger: Persona;
    target: Persona;
    /** The specific claim or position being challenged */
    focusPoint: string;
}

export interface CrossExamResult {
    challenger: string;
    target: string;
    exchange: string;
}

export interface DivergenceResult {
    score: number; // 0–100
    assessment: string;
}

// --- Divergence Scoring ---

/**
 * Score how much the panel has converged or diverged (0 = full consensus, 100 = total disagreement).
 * Used to decide whether to extend the debate or inject a disruption.
 */
export async function scoreDivergence(
    roundSummary: string,
    model: ModelConfig
): Promise<DivergenceResult> {
    const input = buildDivergenceScoreMessage(roundSummary);
    const raw = await callLLM(
        DIVERGENCE_SCORER_SYSTEM_PROMPT,
        input,
        model,
        0.1
    );

    return parseDivergenceScore(raw);
}

// --- Cross-Examination Pairing ---

/**
 * Pick the most productive cross-exam pairs based on whose positions
 * are most in tension. Returns at most `maxPairs` pairs.
 */
export function selectCrossExamPairs(
    personas: Persona[],
    agentResponses: { persona: Persona; content: string }[],
    maxPairs: number = 1
): CrossExamPair[] {
    // Simple heuristic: pair agents with the longest responses (most conviction)
    // against the devil's advocate or the persona with the most opposing role.
    // In the future this can be LLM-scored.
    const pairs: CrossExamPair[] = [];

    if (agentResponses.length < 2) return pairs;

    // Find the devil's advocate if present
    const devilsAdvocate = agentResponses.find(
        (r) => r.persona.id === "devils-advocate"
    );

    // Pair the devil's advocate with the agent whose response is longest
    // (most assertive / most to challenge)
    if (devilsAdvocate) {
        const otherAgents = agentResponses.filter(
            (r) => r.persona.id !== "devils-advocate"
        );
        const mostAssertive = otherAgents.reduce((a, b) =>
            a.content.length > b.content.length ? a : b
        );
        pairs.push({
            challenger: devilsAdvocate.persona,
            target: mostAssertive.persona,
            focusPoint: "strongest assertion",
        });
    } else {
        // No devil's advocate: pair the two agents with the most different roles
        // (CFO vs Customer Champion, Strategist vs Risk, etc.)
        const sorted = [...agentResponses].sort(
            (a, b) => b.content.length - a.content.length
        );
        if (sorted.length >= 2) {
            pairs.push({
                challenger: sorted[0].persona,
                target: sorted[1].persona,
                focusPoint: "core disagreement",
            });
        }
    }

    return pairs.slice(0, maxPairs);
}

/**
 * Run a cross-examination exchange: challenger questions target.
 */
export async function runCrossExam(
    pair: CrossExamPair,
    challengerResponse: string,
    targetResponse: string,
    question: string,
    model: ModelConfig
): Promise<CrossExamResult> {
    const input = buildCrossExamMessage(
        pair.challenger.name,
        pair.target.name,
        challengerResponse,
        targetResponse,
        question
    );

    const exchange = await callLLM(
        CROSS_EXAM_SYSTEM_PROMPT,
        input,
        model,
        0.6
    );

    return {
        challenger: pair.challenger.name,
        target: pair.target.name,
        exchange,
    };
}

// --- Disruption Injection ---

/**
 * Generate a disruptive "what if" scenario when the panel converges too early.
 */
export async function generateDisruption(
    question: string,
    roundSummary: string,
    model: ModelConfig
): Promise<string> {
    const input = buildDisruptionMessage(question, roundSummary);
    return callLLM(DISRUPTION_SYSTEM_PROMPT, input, model, 0.8);
}

// --- Decision Logic ---

/**
 * Determine if the debate should be extended by 1 round.
 */
export function shouldExtendDebate(
    divergenceScore: number,
    currentRound: number,
    maxRounds: number
): boolean {
    // Extend if divergence is still high (>65) in the final round and we haven't
    // already extended (maxRounds hasn't changed)
    return currentRound === maxRounds && divergenceScore > 65;
}

/**
 * Determine if a disruption prompt should be injected.
 */
export function shouldDisrupt(
    divergenceScore: number,
    currentRound: number
): boolean {
    // Disrupt if the panel converges too early (score < 25 before the final round)
    return divergenceScore < 25 && currentRound <= 2;
}

// --- Parsers ---

function parseDivergenceScore(raw: string): DivergenceResult {
    try {
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            const score = Math.min(100, Math.max(0, Number(parsed.score) || 50));
            return {
                score,
                assessment: parsed.assessment || "",
            };
        }
    } catch {
        // Fall through
    }

    // Fallback: try to extract a number
    const numMatch = raw.match(/\b(\d{1,3})\b/);
    return {
        score: numMatch ? Math.min(100, Number(numMatch[1])) : 50,
        assessment: raw,
    };
}
