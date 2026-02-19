import { NextRequest } from "next/server";
import { runDebate, DebateEvent, DebateConfig } from "@/lib/engine";
import { getPersonasByIds, Persona, PERSONAS } from "@/lib/personas";
import { getAvailableModels, getAvailableProviders, ModelConfig } from "@/lib/llm";
import { analyzePersonaChemistry, sortPersonasByRelevance } from "@/lib/chemistry";

export const maxDuration = 120;

/**
 * POST /api/debate
 * Runs a multi-agent debate and streams events via SSE.
 */
export async function POST(req: NextRequest) {
    const providers = getAvailableProviders();
    const accessCode = process.env.DELIBERO_ACCESS_CODE;
    const clientAccessCode = req.headers.get("x-access-code");

    // Optional: Protect with access code if env var is set
    if (accessCode && clientAccessCode !== accessCode) {
        return new Response(
            JSON.stringify({
                error: "Unauthorized: Invalid Access Code",
            }),
            { status: 401, headers: { "Content-Type": "application/json" } }
        );
    }

    if (providers.length === 0) {
        return new Response(
            JSON.stringify({
                error: "No LLM API keys configured. Add OPENAI_API_KEY or ANTHROPIC_API_KEY to .env.local",
            }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }

    let body: Record<string, unknown>;

    try {
        body = await req.json();
    } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        });
    }

    const { question, personaIds, rounds, constraints, modelId } = body as {
        question: string;
        personaIds: string[];
        rounds: number;
        constraints?: string;
        modelId: string;
    };

    // If auto-selecting, we don't strictly require personaIds
    const isAutoSelection =
        !personaIds ||
        personaIds.length === 0 ||
        (personaIds.length === 1 && personaIds[0] === "auto");

    if (!question || (!isAutoSelection && !personaIds?.length) || !rounds) {
        return new Response(
            JSON.stringify({
                error: "Missing required fields: question, rounds (and personaIds if not auto)",
            }),
            { status: 400, headers: { "Content-Type": "application/json" } }
        );
    }

    const availableModels = getAvailableModels();
    const model: ModelConfig | undefined = availableModels.find(
        (m) => m.model === modelId
    );
    if (!model) {
        return new Response(
            JSON.stringify({
                error: `Model "${modelId}" not available. Available: ${availableModels.map((m) => m.model).join(", ")}`,
            }),
            { status: 400, headers: { "Content-Type": "application/json" } }
        );
    }

    const clampedRounds = Math.min(Math.max(Number(rounds), 1), 5);

    // --- Smart Panel Selection (Persona Chemistry) ---
    // If personaIds is empty or explicitly "auto", we use the chemistry engine.
    let selectedPersonas: Persona[] = [];

    if (!isAutoSelection) {
        // Manual selection
        selectedPersonas = getPersonasByIds(personaIds);

        if (selectedPersonas.length < 2) {
            return new Response(
                JSON.stringify({ error: "At least 2 valid personas are required" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }
    }

    const stream = new ReadableStream({
        async start(controller) {
            const encoder = new TextEncoder();

            const sendEvent = (event: DebateEvent) => {
                const data = `data: ${JSON.stringify(event)}\n\n`;
                controller.enqueue(encoder.encode(data));
            };

            try {
                // If auto-selection, run chemistry analysis
                if (isAutoSelection) {
                    sendEvent({
                        type: "reframing",
                        content:
                            "🔬 **Analyzing Question DNA...**\n\nIdentifying the core conflict and assembling the optimal expert panel.",
                    });

                    try {
                        const analysis = await analyzePersonaChemistry(
                            question,
                            PERSONAS,
                            model
                        );

                        // Sort all personas by relevance
                        const rankedPersonas = sortPersonasByRelevance(
                            PERSONAS,
                            analysis.recommendedPersonas
                        );

                        // --- Mandatory Persona Enforcement ---
                        // Dr. Marcus Chen (Red Team Lead) must ALWAYS be on the panel
                        const mandatoryId = "devils-advocate";
                        const mandatoryPersona = PERSONAS.find((p) => p.id === mandatoryId);

                        // Filter out the mandatory persona from the ranked list to pick the rest
                        const candidates = rankedPersonas.filter((p) => p.id !== mandatoryId);

                        // Determine panel size (Dynamic)
                        const panelSize = analysis.recommendedPanelSize;

                        // Fill remaining slots
                        const selectedCandidates = candidates.slice(0, panelSize - 1);

                        // Combine: Mandatory + Top Candidates
                        // We re-sort them based on relevance for display order, or keep mandatory first?
                        // Let's keep them in relevance order (with mandatory inserted if he wasn't top).
                        const finalSet = mandatoryPersona
                            ? [mandatoryPersona, ...selectedCandidates]
                            : selectedCandidates.slice(0, panelSize); // Fallback if ID wrong

                        // Re-sort the final set by relevance logic to ensure the best "Chemistry" display
                        selectedPersonas = sortPersonasByRelevance(
                            finalSet,
                            analysis.recommendedPersonas
                        );

                        const matchScores = analysis.recommendedPersonas;

                        sendEvent({
                            type: "reframing",
                            content: `**Panel Chemistry Analysis Completed**
Category: **${analysis.questionCategory}** | Complexity: **${analysis.complexityScore}/10**
Recommended Panel Size: **${panelSize} Experts**

**Selected Experts:**
${selectedPersonas
                                    .map((p) => {
                                        const score =
                                            matchScores.find((r) => r.personaId === p.id)?.relevanceScore || 0;
                                        return `- **${p.name}** (${p.role}) — Match Score: ${score}%`;
                                    })
                                    .join("\n")}`,
                        });
                    } catch (error) {
                        console.error(
                            "Chemistry analysis failed, falling back to default:",
                            error
                        );
                        // Fallback defaults
                        selectedPersonas = PERSONAS.slice(0, 3);
                    }
                }

                // Final safety check
                if (selectedPersonas.length < 2) {
                    selectedPersonas = PERSONAS.slice(0, 2);
                }

                const config: DebateConfig = {
                    question,
                    personas: selectedPersonas,
                    rounds: clampedRounds,
                    model,
                    constraints: (constraints as string)?.trim() || undefined,
                };

                await runDebate(config, sendEvent);
            } catch (err) {
                const message =
                    err instanceof Error ? err.message : "Unknown error";
                sendEvent({ type: "error", message });
            } finally {
                controller.close();
            }
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
        },
    });
}

/**
 * GET /api/debate
 * Returns available models and providers (for the setup UI).
 */
export async function GET() {
    const providers = getAvailableProviders();
    const models = getAvailableModels();

    return Response.json({
        providers,
        models,
        hasKeys: providers.length > 0,
    });
}
