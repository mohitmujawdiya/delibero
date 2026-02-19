import { ModelConfig, callLLM } from "./llm";
import { Persona } from "./personas";
import {
    CLAIM_EXTRACTOR_SYSTEM_PROMPT,
    CONSISTENCY_CHECKER_SYSTEM_PROMPT,
    buildClaimExtractionMessage,
    buildConsistencyCheckMessage,
} from "./prompts";

// --- Types ---

export interface Claim {
    agent: string;
    claim: string;
    category: "number" | "timeline" | "market" | "causal" | "recommendation";
    confidence: "stated_as_fact" | "estimated" | "assumed";
}

export interface Contradiction {
    claimA: { agent: string; claim: string };
    claimB: { agent: string; claim: string };
    explanation: string;
    severity: "critical" | "moderate" | "minor";
}

export interface EvidenceReport {
    claims: Claim[];
    contradictions: Contradiction[];
    unsubstantiatedClaims: string[];
    summary: string;
}

// --- Extraction ---

/**
 * Extract concrete claims from all agent responses in a round,
 * then cross-check for contradictions and unsubstantiated assertions.
 */
export async function analyzeEvidence(
    round: number,
    agentResponses: { persona: Persona; content: string }[],
    model: ModelConfig
): Promise<EvidenceReport> {
    try {
        // Step 1: Extract claims from all responses
        const extractionInput = buildClaimExtractionMessage(round, agentResponses);
        const rawExtraction = await callLLM(
            CLAIM_EXTRACTOR_SYSTEM_PROMPT,
            extractionInput,
            model,
            0.1 // Very low temperature for structured extraction
        );

        const claims = parseClaims(rawExtraction);

        // Step 2: Cross-check consistency
        const consistencyInput = buildConsistencyCheckMessage(claims);
        const rawConsistency = await callLLM(
            CONSISTENCY_CHECKER_SYSTEM_PROMPT,
            consistencyInput,
            model,
            0.1
        );

        const { contradictions, unsubstantiatedClaims, summary } =
            parseConsistencyReport(rawConsistency);

        return { claims, contradictions, unsubstantiatedClaims, summary };
    } catch (error) {
        console.error("Evidence analysis failed:", error);
        return {
            claims: [],
            contradictions: [],
            unsubstantiatedClaims: [],
            summary: "Evidence analysis unavailable for this round due to an error.",
        };
    }
}

// --- Parsers (robust against LLM formatting quirks) ---

function parseClaims(raw: string): Claim[] {
    try {
        // Try to extract JSON array from the response
        const jsonMatch = raw.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            return parsed.map((c: Record<string, string>) => ({
                agent: c.agent || "Unknown",
                claim: c.claim || "",
                category: validateCategory(c.category),
                confidence: validateConfidence(c.confidence),
            }));
        }
    } catch {
        // Fall through to fallback
    }

    // Fallback: return empty if parsing fails
    return [];
}

function parseConsistencyReport(raw: string): {
    contradictions: Contradiction[];
    unsubstantiatedClaims: string[];
    summary: string;
} {
    try {
        // Try to extract JSON object from the response
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            return {
                contradictions: (parsed.contradictions || []).map(
                    (c: Record<string, unknown>) => ({
                        claimA: c.claimA || { agent: "Unknown", claim: "" },
                        claimB: c.claimB || { agent: "Unknown", claim: "" },
                        explanation: (c.explanation as string) || "",
                        severity: validateSeverity(c.severity as string),
                    })
                ),
                unsubstantiatedClaims: parsed.unsubstantiatedClaims || [],
                summary: parsed.summary || "",
            };
        }
    } catch {
        // Fall through to fallback
    }

    // Fallback: use the raw text as summary
    return { contradictions: [], unsubstantiatedClaims: [], summary: raw };
}

// --- Validators ---

function validateCategory(
    cat: string
): Claim["category"] {
    const valid = ["number", "timeline", "market", "causal", "recommendation"];
    return valid.includes(cat) ? (cat as Claim["category"]) : "causal";
}

function validateConfidence(
    conf: string
): Claim["confidence"] {
    const valid = ["stated_as_fact", "estimated", "assumed"];
    return valid.includes(conf) ? (conf as Claim["confidence"]) : "assumed";
}

function validateSeverity(
    sev: string
): Contradiction["severity"] {
    const valid = ["critical", "moderate", "minor"];
    return valid.includes(sev) ? (sev as Contradiction["severity"]) : "moderate";
}
