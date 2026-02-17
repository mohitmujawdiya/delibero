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
