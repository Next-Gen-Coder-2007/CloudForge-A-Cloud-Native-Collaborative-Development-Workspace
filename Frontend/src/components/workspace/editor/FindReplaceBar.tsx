import React, { useEffect, useRef } from "react";
import {
  Search,
  ChevronDown,
  ChevronUp,
  X,
  Replace,
  Sparkles,
} from "lucide-react";
import type { EditorTheme } from "./themes";

interface FindReplaceBarProps {
  theme: EditorTheme;
  query: string;
  onQueryChange: (q: string) => void;
  replaceQuery: string;
  onReplaceQueryChange: (r: string) => void;
  caseSensitive: boolean;
  onToggleCaseSensitive: () => void;
  matchCount: number;
  currentMatchIndex: number;
  onNextMatch: () => void;
  onPrevMatch: () => void;
  onReplaceCurrent: () => void;
  onReplaceAll: () => void;
  onClose: () => void;
}

export const FindReplaceBar: React.FC<FindReplaceBarProps> = ({
  theme,
  query,
  onQueryChange,
  replaceQuery,
  onReplaceQueryChange,
  caseSensitive,
  onToggleCaseSensitive,
  matchCount,
  currentMatchIndex,
  onNextMatch,
  onPrevMatch,
  onReplaceCurrent,
  onReplaceAll,
  onClose,
}) => {
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    searchInputRef.current?.focus();
    searchInputRef.current?.select();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) {
        onPrevMatch();
      } else {
        onNextMatch();
      }
    }
  };

  return (
    <div
      style={{
        backgroundColor: theme.toolbarBg,
        borderColor: theme.borderColor,
        color: theme.textColor,
      }}
      className="px-3 py-2 border-b flex flex-wrap items-center gap-2 text-xs shadow-md z-20 select-none animate-in fade-in slide-in-from-top-1 duration-150"
    >
      {/* Search Row */}
      <div className="flex items-center gap-1.5 flex-1 min-w-[240px]">
        <div className="relative flex items-center flex-1">
          <Search className="w-3.5 h-3.5 absolute left-2.5 opacity-50" />
          <input
            ref={searchInputRef}
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Find in code (Enter / Shift+Enter)..."
            className="w-full pl-8 pr-14 py-1 rounded bg-black/20 border border-white/10 text-inherit placeholder-white/40 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono text-xs"
          />
          <div className="absolute right-2 flex items-center gap-1">
            <button
              onClick={onToggleCaseSensitive}
              title="Match Case (Alt+C)"
              className={`px-1 rounded text-[10px] font-bold font-mono transition-colors ${
                caseSensitive
                  ? "bg-blue-600 text-white"
                  : "text-white/50 hover:bg-white/10"
              }`}
            >
              Aa
            </button>
          </div>
        </div>

        {/* Counter */}
        <span className="text-[11px] font-mono opacity-70 px-1 shrink-0 min-w-[55px] text-center">
          {query.trim()
            ? matchCount > 0
              ? `${currentMatchIndex + 1}/${matchCount}`
              : "0 of 0"
            : "No find"}
        </span>

        {/* Navigation */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={onPrevMatch}
            disabled={matchCount === 0}
            title="Previous match (Shift+Enter)"
            className="p-1 rounded hover:bg-white/10 disabled:opacity-30"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onNextMatch}
            disabled={matchCount === 0}
            title="Next match (Enter)"
            className="p-1 rounded hover:bg-white/10 disabled:opacity-30"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Replace Row */}
      <div className="flex items-center gap-1.5 flex-1 min-w-[240px]">
        <div className="relative flex items-center flex-1">
          <Replace className="w-3.5 h-3.5 absolute left-2.5 opacity-50" />
          <input
            type="text"
            value={replaceQuery}
            onChange={(e) => onReplaceQueryChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Replace with..."
            className="w-full pl-8 pr-3 py-1 rounded bg-black/20 border border-white/10 text-inherit placeholder-white/40 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono text-xs"
          />
        </div>

        <button
          onClick={onReplaceCurrent}
          disabled={matchCount === 0}
          title="Replace Current"
          className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 disabled:opacity-30 flex items-center gap-1 shrink-0 font-medium text-[11px]"
        >
          <span>Replace</span>
        </button>

        <button
          onClick={onReplaceAll}
          disabled={matchCount === 0}
          title="Replace All"
          className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-30 flex items-center gap-1 shrink-0 font-medium text-[11px] shadow-xs"
        >
          <Sparkles className="w-3 h-3" />
          <span>All</span>
        </button>

        <button
          onClick={onClose}
          title="Close (Esc)"
          className="p-1 rounded hover:bg-white/10 opacity-70 hover:opacity-100 ml-1"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
