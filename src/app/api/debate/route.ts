import { getAvailableModels, getAvailableProviders } from "@/lib/llm";

export const dynamic = "force-dynamic"; // Ensure it's not cached

/**
 * GET /api/debate
 * Returns available models and providers (for the setup UI).
 * This endpoint was previously used for the debate POST, but now only provides metadata.
 */
export async function GET() {
    const providers = getAvailableProviders();
    const models = getAvailableModels();

    if (providers.length === 0) {
        console.warn("No API Keys configured. Please check .env.local");
    }

    return Response.json({
        providers,
        models,
        hasKeys: providers.length > 0,
    });
}
