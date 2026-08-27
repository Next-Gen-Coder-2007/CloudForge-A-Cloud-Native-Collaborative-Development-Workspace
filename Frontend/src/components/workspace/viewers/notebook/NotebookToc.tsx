import React from "react";
import { List, X, Bookmark } from "lucide-react";
import { type NotebookCell } from "../../../../types/notebook";

interface TocItem {
  level: number;
  text: string;
  cellIndex: number;
}

interface NotebookTocProps {
  cells: NotebookCell[];
  isDark: boolean;
  isOpen: boolean;
  onClose: () => void;
  onSelectCell: (index: number) => void;
}

export const NotebookToc: React.FC<NotebookTocProps> = ({
  cells,
  isDark,
  isOpen,
  onClose,
  onSelectCell,
}) => {
  if (!isOpen) return null;

  const headings: TocItem[] = [];

  cells.forEach((cell, cellIndex) => {
    if (cell.cell_type === "markdown") {
      const src = Array.isArray(cell.source) ? cell.source.join("") : cell.source || "";
      const lines = src.split("\n");
      lines.forEach((line) => {
        const match = line.match(/^(#{1,4})\s+(.+)$/);
        if (match) {
          headings.push({
            level: match[1].length,
            text: match[2].replace(/[#*`_~]/g, "").trim(),
            cellIndex,
          });
        }
      });
    }
  });

  return (
    <div
      className={`absolute inset-y-0 right-0 w-80 sm:w-88 z-30 shadow-2xl border-l flex flex-col font-sans transition-all animate-in slide-in-from-right duration-200 ${
        isDark
          ? "bg-[#0c0c0e] border-neutral-800 text-neutral-200"
          : "bg-white border-slate-200 text-slate-800 shadow-slate-200/50"
      }`}
    >
      {/* 1. Header */}
      <div
        className={`px-4 py-3 border-b flex items-center justify-between select-none ${
          isDark ? "bg-[#111114] border-neutral-800" : "bg-slate-50/90 border-slate-200 text-slate-900"
        }`}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600">
            <List className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="text-xs font-bold tracking-tight">Table of Contents</h3>
            <span className="text-[10px] opacity-60 font-sans">
              {headings.length} sections outlined
            </span>
          </div>
        </div>

        <button
          onClick={onClose}
          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
            isDark
              ? "hover:bg-white/10 text-neutral-400 hover:text-white"
              : "hover:bg-slate-200 text-slate-600 hover:text-slate-900"
          }`}
          title="Close TOC"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 2. Headings Outline List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5 text-xs">
        {headings.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center p-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 ${
              isDark ? "bg-neutral-800/60 text-neutral-400" : "bg-slate-100 text-slate-500"
            }`}>
              <Bookmark className="w-6 h-6 opacity-60" />
            </div>
            <p className="text-xs font-semibold mb-1">No Headings Found</p>
            <p className="text-[11px] opacity-60 max-w-[220px] leading-relaxed">
              Add headings (e.g. <span className="font-mono"># Title</span> or <span className="font-mono">## Subtitle</span>) in markdown cells to generate an outline.
            </p>
          </div>
        ) : (
          headings.map((item, idx) => (
            <button
              key={idx}
              onClick={() => onSelectCell(item.cellIndex)}
              style={{ paddingLeft: `${(item.level - 1) * 12 + 8}px` }}
              className={`w-full text-left py-2 px-2 rounded-lg transition-all flex items-center gap-2 truncate cursor-pointer group ${
                isDark
                  ? "hover:bg-blue-600/15 text-neutral-300 hover:text-blue-300"
                  : "hover:bg-blue-50 text-slate-700 hover:text-blue-700 hover:border-slate-200"
              }`}
            >
              {/* Level indicator pill */}
              <span
                className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold shrink-0 ${
                  item.level === 1
                    ? isDark ? "bg-blue-500/20 text-blue-300" : "bg-blue-100 text-blue-800"
                    : item.level === 2
                    ? isDark ? "bg-cyan-500/20 text-cyan-300" : "bg-cyan-100 text-cyan-800"
                    : isDark ? "bg-neutral-800 text-neutral-400" : "bg-slate-100 text-slate-600"
                }`}
              >
                H{item.level}
              </span>

              <span
                className={`truncate ${
                  item.level === 1
                    ? "font-bold text-xs"
                    : item.level === 2
                    ? "font-semibold text-xs"
                    : "font-normal text-[11px]"
                }`}
              >
                {item.text}
              </span>

              <span className="ml-auto text-[10px] opacity-40 font-mono group-hover:opacity-80 shrink-0">
                #{item.cellIndex + 1}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
};
