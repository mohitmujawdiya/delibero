import { getAvailableProviders, AVAILABLE_MODELS } from "@/lib/llm";

export const dynamic = "force-dynamic"; // Ensure it's not cached

/**
 * GET /api/debate
 * Returns available models and server providers (for the setup UI).
 * This endpoint was previously used for the debate POST, but now only provides metadata.
 */
export async function GET() {
    const serverProviders = getAvailableProviders();

    if (serverProviders.length === 0) {
        console.warn("No server-side API Keys configured. Users must supply their own.");
    }

    return Response.json({
        serverProviders,
        models: AVAILABLE_MODELS, // Always return all models now, UI handles filtering based on custom keys
    });
}
