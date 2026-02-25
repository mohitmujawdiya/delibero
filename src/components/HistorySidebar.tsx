"use client";

import { useState, useEffect } from "react";
import { useDebateHistory, SavedDebate } from "@/hooks/useDebateHistory";

interface HistorySidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectDebate: (debate: SavedDebate) => void;
}

export function HistorySidebar({ isOpen, onClose, onSelectDebate }: HistorySidebarProps) {
  const { getHistory, deleteDebate } = useDebateHistory();
  const [history, setHistory] = useState<SavedDebate[]>([]);

  const [mounted, setMounted] = useState(false);

  // Load history when sidebar opens
  useEffect(() => {
    setMounted(true);
    if (isOpen) {
      setHistory(getHistory());
    }
  }, [isOpen, getHistory]);

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this debate?")) {
      const updated = deleteDebate(id);
      setHistory(updated); // Update local state immediately
    }
  };

  // Prevent hydration mismatch and FOUC (Flash of Unstyled Content)
  if (!mounted) {
    return null;
  }

  return (
    <>
      {/* Backdrop */}
      {isOpen && <div className="history-backdrop" onClick={onClose} />}

      {/* Sidebar Panel */}
      <div className={`history-sidebar ${isOpen ? "open" : ""}`}>
        <div className="history-header">
          <h2>🕑 Debate History</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="history-list">
          {history.length === 0 ? (
            <div className="history-empty">
              <p>No past debates found.</p>
              <small>Calculations are saved automatically when they complete.</small>
            </div>
          ) : (
            history.map((item) => (
              <div
                key={item.id}
                className="history-item"
                onClick={() => onSelectDebate(item)}
              >
                <div className="history-item-header">
                  <span className="history-date">{item.date}</span>
                  <button
                    className="delete-btn"
                    onClick={(e) => handleDelete(item.id, e)}
                    title="Delete"
                  >
                    🗑️
                  </button>
                </div>
                <div className="history-question">
                  {item.question.slice(0, 80)}{item.question.length > 80 ? "..." : ""}
                </div>
                {item.synthesisSnippet && (
                  <div className="history-verdict">
                    <strong>Verdict:</strong> {item.synthesisSnippet.slice(0, 60)}...
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <style jsx>{`
        .history-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          z-index: 998;
          backdrop-filter: blur(2px);
        }

        .history-sidebar {
          position: fixed;
          top: 0;
          right: -400px;
          bottom: 0;
          width: 400px;
          background: rgba(10, 10, 10, 0.85);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border-left: 1px solid rgba(255, 255, 255, 0.1);
          z-index: 999;
          transition: right 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          display: flex;
          flex-direction: column;
          box-shadow: -10px 0 40px rgba(0,0,0,0.5);
        }

        .history-sidebar.open {
          right: 0;
        }

        .history-header {
          padding: 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: transparent;
        }

        .history-header h2 {
          margin: 0;
          font-size: 1.15rem;
          font-weight: 600;
          letter-spacing: -0.02em;
          color: #eee;
        }

        .close-btn {
          background: none;
          border: none;
          color: #888;
          font-size: 1.5rem;
          cursor: pointer;
          padding: 0 4px;
        }

        .close-btn:hover {
          color: #fff;
        }

        .history-list {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
        }

        .history-empty {
          text-align: center;
          color: #666;
          padding: 40px 20px;
        }

        .history-item {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 6px;
          padding: 14px;
          margin-bottom: 12px;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .history-item:hover {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(255, 255, 255, 0.2);
        }

        .history-item-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
          font-size: 0.8rem;
          color: #888;
        }

        .delete-btn {
          background: none;
          border: none;
          cursor: pointer;
          opacity: 0.5;
          font-size: 0.9rem;
          padding: 0;
        }

        .delete-btn:hover {
          opacity: 1;
          transform: scale(1.1);
        }

        .history-question {
          font-size: 0.95rem;
          color: #eee;
          line-height: 1.4;
          margin-bottom: 8px;
          font-weight: 500;
        }

        .history-verdict {
          font-size: 0.85rem;
          color: #eab308; /* Gold */
          background: rgba(234, 179, 8, 0.1);
          padding: 4px 8px;
          border-radius: 4px;
          display: inline-block;
        }
      `}</style>
    </>
  );
}
