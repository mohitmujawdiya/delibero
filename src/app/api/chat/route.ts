import { NextRequest } from "next/server";
import { callLLM, streamLLM, ModelConfig } from "@/lib/llm";


// Switch to Edge Runtime for better streaming support and no 10s/60s timeout
export const runtime = "edge";

export async function POST(req: NextRequest) {
    const accessCode = process.env.DELIBERO_ACCESS_CODE;
    const clientAccessCode = req.headers.get("x-access-code");

    // Protect with access code if env var is set
    if (accessCode && clientAccessCode !== accessCode) {
        return new Response(
            JSON.stringify({
                error: "Unauthorized: Invalid Access Code",
            }),
            { status: 401, headers: { "Content-Type": "application/json" } }
        );
    }

    try {
        const body = await req.json();
        const { systemPrompt, userMessage, modelConfig, temperature, stream } = body as {
            systemPrompt: string;
            userMessage: string;
            modelConfig: ModelConfig;
            temperature: number;
            stream?: boolean;
        };

        if (!systemPrompt || !userMessage || !modelConfig) {
            return new Response(
                JSON.stringify({ error: "Missing required fields" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        // Force server-side execution of callLLM
        // We know we are on the server here, so current callLLM (before refactor) works.
        // After refactor, callLLM checks environment. On server, it calls direct.
        // So we can just import and use it.

        if (stream) {
            const streamResponse = await streamLLM(systemPrompt, userMessage, modelConfig, temperature);
            return new Response(streamResponse, {
                headers: { "Content-Type": "text/plain; charset=utf-8" },
            });
        }

        const response = await callLLM(systemPrompt, userMessage, modelConfig, temperature);

        return new Response(JSON.stringify({ content: response }), {
            headers: { "Content-Type": "application/json" },
        });

    } catch (error) {
        console.error("Chat proxy error:", error);
        return new Response(
            JSON.stringify({
                error: error instanceof Error ? error.message : "Unknown error",
            }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
}
