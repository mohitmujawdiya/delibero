"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownContentProps {
    text: string;
    className?: string;
}

/**
 * Renders markdown text as properly formatted HTML.
 * Supports bold, italic, tables, code blocks, lists, headings, etc.
 */
export function MarkdownContent({ text, className }: MarkdownContentProps) {
    return (
        <div className={`markdown-content ${className || ""}`}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {text}
            </ReactMarkdown>
        </div>
    );
}
