import { ModelConfig, callLLM } from "./llm";
import { Persona } from "./personas";
import { CHEMISTRY_SYSTEM_PROMPT, buildChemistryMessage } from "./prompts";

export interface PersonaRecommendation {
    personaId: string;
    relevanceScore: number; // 0-100
    reasoning: string;
}

export interface ChemistryResult {
    questionCategory: string; // e.g. "Strategic Growth", "Crisis Management"
    complexityScore: number; // 1-10
    recommendedPanelSize: number; // 2-5
    recommendedPersonas: PersonaRecommendation[];
}

/**
 * Analyze the user's question to recommend the best panel of personas.
 * Returns a list of recommended persona IDs with relevance scores.
 */
export async function analyzePersonaChemistry(
    question: string,
    availablePersonas: Persona[],
    model: ModelConfig
): Promise<ChemistryResult> {
    const input = buildChemistryMessage(question, availablePersonas);

    const raw = await callLLM(CHEMISTRY_SYSTEM_PROMPT, input, model, 0.2);

    return parseChemistryResult(raw);
}

function parseChemistryResult(raw: string): ChemistryResult {
    try {
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            return {
                questionCategory: parsed.questionCategory || "General Strategy",
                complexityScore: parsed.complexityScore || 5,
                recommendedPanelSize: Math.max(2, Math.min(5, parsed.recommendedPanelSize || 3)),
                recommendedPersonas: parsed.recommendedPersonas || [],
            };
        }
    } catch (e) {
        console.error("Failed to parse persona chemistry result:", e);
    }

    return {
        questionCategory: "General Strategy",
        complexityScore: 5,
        recommendedPanelSize: 3,
        recommendedPersonas: [],
    };
}

/**
 * Sort personas by relevance based on the chemistry analysis.
 */
export function sortPersonasByRelevance(
    personas: Persona[],
    recommendations: PersonaRecommendation[]
): Persona[] {
    const map = new Map(recommendations.map((r) => [r.personaId, r.relevanceScore]));

    // Create a copy to sort
    return [...personas].sort((a, b) => {
        const scoreA = map.get(a.id) || 0;
        const scoreB = map.get(b.id) || 0;
        return scoreB - scoreA; // Descending order
    });
}
