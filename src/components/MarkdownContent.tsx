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
    // 1. Trim multiple blank lines to at most one (/\n{3,}/g -> '\n\n')
    // 2. Trim blank lines between list items to force tight lists (/\n\n+([*\-])/g -> '\n$1')
    const cleanText = text
        .replace(/\n{3,}/g, '\n\n') // Collapse huge gaps
        .replace(/\n\n+([*\-])/g, '\n$1') // Tighten list items (converts loose lists to tight)
        .trim();

    return (
        <div className={`markdown-content ${className || ""}`}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    // Override paragraph to avoid huge margins
                    p: ({ children }) => <p className="mb-2 last:mb-0 leading-snug">{children}</p>,
                    // Override lists to be tight
                    ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1 last:mb-0">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1 last:mb-0">{children}</ol>,
                    li: ({ children }) => <li className="pl-1 leading-snug">{children}</li>,
                    // Headings spacing
                    h1: ({ children }) => <h1 className="text-xl font-bold mt-4 mb-2 first:mt-0">{children}</h1>,
                    h2: ({ children }) => <h2 className="text-lg font-bold mt-3 mb-2 first:mt-0">{children}</h2>,
                    h3: ({ children }) => <h3 className="text-base font-semibold mt-2 mb-1 first:mt-0">{children}</h3>
                }}
            >
                {cleanText}
            </ReactMarkdown>
        </div>
    );
}
