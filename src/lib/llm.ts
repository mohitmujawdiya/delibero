import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

export type ModelProvider = "openai" | "anthropic";

export interface ModelConfig {
    provider: ModelProvider;
    model: string;
    label: string;
}

export const AVAILABLE_MODELS: ModelConfig[] = [
    { provider: "openai", model: "gpt-4o", label: "GPT-4o" },
    { provider: "openai", model: "gpt-4o-mini", label: "GPT-4o Mini (Cheaper)" },
    {
        provider: "anthropic",
        model: "claude-sonnet-4-20250514",
        label: "Claude Sonnet 4",
    },
    {
        provider: "anthropic",
        model: "claude-3-5-haiku-20241022",
        label: "Claude 3.5 Haiku (Cheaper)",
    },
];

/**
 * Check which providers have API keys configured.
 */
export function getAvailableProviders(): ModelProvider[] {
    const providers: ModelProvider[] = [];
    if (process.env.OPENAI_API_KEY) providers.push("openai");
    if (process.env.ANTHROPIC_API_KEY) providers.push("anthropic");
    return providers;
}

/**
 * Get models filtered by available API keys.
 */
export function getAvailableModels(): ModelConfig[] {
    const providers = getAvailableProviders();
    return AVAILABLE_MODELS.filter((m) => providers.includes(m.provider));
}

/**
 * Call an LLM with a system prompt and user message.
 * Returns the full text response (non-streaming).
 */
export async function callLLM(
    systemPrompt: string,
    userMessage: string,
    modelConfig: ModelConfig,
    temperature: number = 0.7
): Promise<string> {
    // Check if running on client
    const isClient = typeof window !== "undefined";

    if (isClient) {
        // Client: call proxy
        try {
            const accessCode = localStorage.getItem("delibero_access_code") || "";
            const response = await fetch("/api/chat", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-access-code": accessCode,
                },
                body: JSON.stringify({
                    systemPrompt,
                    userMessage,
                    modelConfig,
                    temperature,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `API Error: ${response.statusText}`);
            }

            const data = await response.json();
            return data.content || "";
        } catch (error) {
            console.error("LLM Proxy Call Failed:", error);
            throw error;
        }
    } else {
        // Server: call direct
        if (modelConfig.provider === "openai") {
            return callOpenAI(systemPrompt, userMessage, modelConfig.model, temperature);
        } else {
            return callAnthropic(
                systemPrompt,
                userMessage,
                modelConfig.model,
                temperature
            );
        }
    }
}

async function callOpenAI(
    systemPrompt: string,
    userMessage: string,
    model: string,
    temperature: number
): Promise<string> {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.chat.completions.create({
        model,
        temperature,
        max_tokens: 800,
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
        ],
    });
    return response.choices[0]?.message?.content || "";
}

async function callAnthropic(
    systemPrompt: string,
    userMessage: string,
    model: string,
    temperature: number
): Promise<string> {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({
        model,
        max_tokens: 800,
        temperature,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
    });
    const block = response.content[0];
    return block.type === "text" ? block.text : "";
}

/**
 * Call an LLM and return a ReadableStream of the text response.
 */
export async function streamLLM(
    systemPrompt: string,
    userMessage: string,
    modelConfig: ModelConfig,
    temperature: number = 0.7
): Promise<ReadableStream<Uint8Array>> {
    // Check if running on client
    const isClient = typeof window !== "undefined";

    if (isClient) {
        // Client: call proxy with stream flag
        try {
            const accessCode = localStorage.getItem("delibero_access_code") || "";
            const response = await fetch("/api/chat", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-access-code": accessCode,
                },
                body: JSON.stringify({
                    systemPrompt,
                    userMessage,
                    modelConfig,
                    temperature,
                    stream: true,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `API Error: ${response.statusText}`);
            }

            if (!response.body) throw new Error("No response body received");
            return response.body;
        } catch (error) {
            console.error("LLM Proxy Stream Failed:", error);
            throw error;
        }
    } else {
        // Server: call direct streaming methods
        if (modelConfig.provider === "openai") {
            return streamOpenAI(systemPrompt, userMessage, modelConfig.model, temperature);
        } else {
            return streamAnthropic(
                systemPrompt,
                userMessage,
                modelConfig.model,
                temperature
            );
        }
    }
}

async function streamOpenAI(
    systemPrompt: string,
    userMessage: string,
    model: string,
    temperature: number
): Promise<ReadableStream<Uint8Array>> {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const stream = await client.chat.completions.create({
        model,
        temperature,
        max_tokens: 800,
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
        ],
        stream: true,
    });

    return new ReadableStream({
        async start(controller) {
            for await (const chunk of stream) {
                const content = chunk.choices[0]?.delta?.content || "";
                if (content) {
                    controller.enqueue(new TextEncoder().encode(content));
                }
            }
            controller.close();
        },
    });
}

async function streamAnthropic(
    systemPrompt: string,
    userMessage: string,
    model: string,
    temperature: number
): Promise<ReadableStream<Uint8Array>> {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const stream = await client.messages.create({
        model,
        max_tokens: 800,
        temperature,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
        stream: true,
    });

    return new ReadableStream({
        async start(controller) {
            for await (const chunk of stream) {
                if (
                    chunk.type === "content_block_delta" &&
                    chunk.delta.type === "text_delta"
                ) {
                    controller.enqueue(new TextEncoder().encode(chunk.delta.text));
                }
            }
            controller.close();
        },
    });
}
