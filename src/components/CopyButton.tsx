"use client";

import { useState, useCallback } from "react";

interface CopyButtonProps {
    text: string;
    label?: string;
    className?: string;
}

/**
 * Clipboard copy button with ✓ feedback animation.
 */
export function CopyButton({ text, label = "Copy", className }: CopyButtonProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Fallback for older browsers
            const textarea = document.createElement("textarea");
            textarea.value = text;
            textarea.style.position = "fixed";
            textarea.style.opacity = "0";
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand("copy");
            document.body.removeChild(textarea);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    }, [text]);

    return (
        <button
            className={`copy-btn ${copied ? "copy-btn--copied" : ""} ${className || ""}`}
            onClick={handleCopy}
            title={copied ? "Copied!" : label}
        >
            {copied ? "✓" : "⧉"}
        </button>
    );
}
