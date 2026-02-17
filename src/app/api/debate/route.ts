import { NextRequest } from "next/server";
import { runDebate, DebateEvent, DebateConfig } from "@/lib/engine";
import { getPersonasByIds, Persona } from "@/lib/personas";
import { getAvailableModels, getAvailableProviders, ModelConfig } from "@/lib/llm";

export const maxDuration = 120;

/**
 * POST /api/debate
 * Runs a multi-agent debate and streams events via SSE.
 */
export async function POST(req: NextRequest) {
    const providers = getAvailableProviders();
    if (providers.length === 0) {
        return new Response(
            JSON.stringify({
                error:
                    "No LLM API keys configured. Add OPENAI_API_KEY or ANTHROPIC_API_KEY to .env.local",
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

    if (!question || !personaIds?.length || !rounds) {
        return new Response(
            JSON.stringify({
                error: "Missing required fields: question, personaIds, rounds",
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

    const personas: Persona[] = getPersonasByIds(personaIds);
    if (personas.length < 2) {
        return new Response(
            JSON.stringify({ error: "At least 2 valid personas are required" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
        );
    }

    const clampedRounds = Math.min(Math.max(Number(rounds), 1), 5);

    const config: DebateConfig = {
        question,
        personas,
        rounds: clampedRounds,
        model,
        constraints: (constraints as string)?.trim() || undefined,
    };

    const stream = new ReadableStream({
        async start(controller) {
            const encoder = new TextEncoder();

            const sendEvent = (event: DebateEvent) => {
                const data = `data: ${JSON.stringify(event)}\n\n`;
                controller.enqueue(encoder.encode(data));
            };

            try {
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
