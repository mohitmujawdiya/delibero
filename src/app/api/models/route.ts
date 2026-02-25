import { NextResponse } from "next/server";
import { ModelConfig } from "@/lib/llm";

export async function POST(req: Request) {
    try {
        const { customKeys = {} } = await req.json();

        const openaiKey = customKeys.openai || process.env.OPENAI_API_KEY;
        const anthropicKey = customKeys.anthropic || process.env.ANTHROPIC_API_KEY;
        const geminiKey = customKeys.gemini || process.env.GEMINI_API_KEY;

        const allModels: ModelConfig[] = [];

        // 1. Fetch OpenAI Models
        if (openaiKey) {
            try {
                const res = await fetch("https://api.openai.com/v1/models", {
                    headers: { Authorization: `Bearer ${openaiKey}` },
                });
                if (res.ok) {
                    const data = await res.json();
                    data.data
                        .filter((m: any) =>
                            (m.id.startsWith("gpt-3.5") || m.id.startsWith("gpt-4") || m.id.startsWith("o1") || m.id.startsWith("o3")) &&
                            !m.id.includes("vision") &&
                            !m.id.includes("audio")
                        )
                        .forEach((m: any) => {
                            allModels.push({
                                provider: "openai",
                                model: m.id,
                                label: `OpenAI ${m.id}`,
                            });
                        });
                }
            } catch (e) {
                console.error("Failed to fetch OpenAI models", e);
            }
        }

        // 2. Fetch Anthropic Models
        if (anthropicKey) {
            try {
                const res = await fetch("https://api.anthropic.com/v1/models", {
                    headers: {
                        "x-api-key": anthropicKey,
                        "anthropic-version": "2023-06-01",
                    },
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.data) {
                        data.data.forEach((m: any) => {
                            allModels.push({
                                provider: "anthropic",
                                model: m.id,
                                label: `Anthropic ${m.id}`,
                            });
                        });
                    }
                }
            } catch (e) {
                console.error("Failed to fetch Anthropic models", e);
            }
        }

        // 3. Fetch Gemini Models
        if (geminiKey) {
            try {
                const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`);
                if (res.ok) {
                    const data = await res.json();
                    data.models
                        .filter((m: any) => m.supportedGenerationMethods.includes("generateContent"))
                        .forEach((m: any) => {
                            const modelId = m.name.replace("models/", "");
                            allModels.push({
                                provider: "gemini",
                                model: modelId,
                                label: m.displayName || `Gemini ${modelId}`,
                            });
                        });
                }
            } catch (e) {
                console.error("Failed to fetch Gemini models", e);
            }
        }

        // Sort alphabetically by label for the dropdown
        allModels.sort((a, b) => a.label.localeCompare(b.label));

        return NextResponse.json({ models: allModels });
    } catch (error) {
        console.error("Model fetch error:", error);
        return NextResponse.json({ error: "Failed to fetch models" }, { status: 500 });
    }
}
