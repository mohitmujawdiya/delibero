import { useCallback } from "react";

export interface SavedDebate {
    id: string; // timestamp
    date: string;
    question: string;
    synthesisSnippet: string;
    // Full State for Restoration
    rounds: any[]; // Using any to avoid circular deps, or duplicate types. Let's try to import types if possible, or keep it loose for storage.
    synthesis: string | null;
    constraintCheck: string | null;
    counterfactual: any | null;
    reframing: string | null;
}

export function useDebateHistory() {
    const getHistory = useCallback((): SavedDebate[] => {
        if (typeof window === "undefined") return [];
        try {
            const item = localStorage.getItem("delibero_history");
            return item ? JSON.parse(item) : [];
        } catch (e) {
            console.error("Failed to load history", e);
            return [];
        }
    }, []);

    const saveDebate = useCallback((debate: Omit<SavedDebate, "id" | "date">) => {
        try {
            const history = getHistory();
            const newDebate: SavedDebate = {
                ...debate,
                id: Date.now().toString(),
                date: new Date().toLocaleString(),
            };
            // Prepend new debate
            const updated = [newDebate, ...history].slice(0, 50); // Limit to 50
            localStorage.setItem("delibero_history", JSON.stringify(updated));
            return true;
        } catch (e) {
            console.error("Failed to save debate history", e);
            return false;
        }
    }, [getHistory]);

    const deleteDebate = useCallback((id: string) => {
        const history = getHistory();
        const updated = history.filter((d) => d.id !== id);
        localStorage.setItem("delibero_history", JSON.stringify(updated));
        return updated; // Return updated list for UI update
    }, [getHistory]);

    const clearHistory = useCallback(() => {
        localStorage.removeItem("delibero_history");
    }, []);

    // --- Draft Management (Session Recovery) ---

    const saveDraft = useCallback((state: any) => {
        try {
            if (!state) return;
            localStorage.setItem("delibero_draft", JSON.stringify({
                ...state,
                timestamp: Date.now()
            }));
        } catch (e) {
            console.error("Failed to save draft", e);
        }
    }, []);

    const getDraft = useCallback(() => {
        if (typeof window === "undefined") return null;
        try {
            const item = localStorage.getItem("delibero_draft");
            return item ? JSON.parse(item) : null;
        } catch (e) {
            console.error("Failed to load draft", e);
            return null;
        }
    }, []);

    const clearDraft = useCallback(() => {
        localStorage.removeItem("delibero_draft");
    }, []);

    return { saveDebate, getHistory, deleteDebate, clearHistory, saveDraft, getDraft, clearDraft };
}
