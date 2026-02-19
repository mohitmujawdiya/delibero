import { ModelConfig, callLLM } from "./llm";
import {
    COUNTERFACTUAL_SYSTEM_PROMPT,
    buildCounterfactualMessage,
} from "./prompts";

export interface PreMortem {
    scenario: string;
    likelihood: string; // "High", "Medium", "Low"
    mitigation: string;
}

export interface ReversalTrigger {
    trigger: string;
    action: string;
}

export interface OptionPreservation {
    rejectedOption: string;
    reason: string;
    preservationStrategy: string; // How to keep this option alive cheaply
}

export interface CounterfactualReport {
    preMortems: PreMortem[];
    reversalTriggers: ReversalTrigger[];
    preservedOptions: OptionPreservation[];
    decisionQualityScore: number; // 0-100
}

/**
 * Generate a "Decision Journal" artifact including pre-mortem analysis,
 * reversal triggers, and option preservation strategies.
 */
export async function generateCounterfactuals(
    question: string,
    synthesis: string,
    roundSummaries: string[],
    model: ModelConfig
): Promise<CounterfactualReport> {
    const input = buildCounterfactualMessage(question, synthesis, roundSummaries);

    const raw = await callLLM(
        COUNTERFACTUAL_SYSTEM_PROMPT,
        input,
        model,
        0.2 // Low temperature for analytical rigor
    );

    return parseCounterfactualReport(raw);
}

function parseCounterfactualReport(raw: string): CounterfactualReport {
    try {
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
    } catch (e) {
        console.error("Failed to parse counterfactual report:", e);
    }

    // Fallback if parsing fails (return structure with error note or empty)
    return {
        preMortems: [],
        reversalTriggers: [],
        preservedOptions: [],
        decisionQualityScore: 0,
    };
}
