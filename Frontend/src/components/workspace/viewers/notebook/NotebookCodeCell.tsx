import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Editor, { type Monaco } from "@monaco-editor/react";
import {
  Play,
  Loader2,
  Trash2,
  ArrowUp,
  ArrowDown,
  Copy,
  Plus,
  Zap,
  Check,
  RotateCcw,
} from "lucide-react";
import { type NotebookCell, type CellType } from "../../../../types/notebook";
import { NotebookCellOutput } from "./NotebookCellOutput";

interface NotebookCodeCellProps {
  cell: NotebookCell;
  index: number;
  totalCells: number;
  isDark: boolean;
  language?: string;
  onUpdateSource: (cellId: string, newSource: string) => void;
  onRunCell: (cellId: string) => Promise<void>;
  onDeleteCell: (cellId: string) => void;
  onMoveCell: (index: number, direction: "up" | "down") => void;
  onInsertCellBelow: (index: number, type: CellType) => void;
  onChangeCellType: (cellId: string, newType: CellType) => void;
  onDuplicateCell: (cellId: string) => void;
  onClearCellOutputs: (cellId: string) => void;
}

export const NotebookCodeCell: React.FC<NotebookCodeCellProps> = ({
  cell,
  index,
  totalCells,
  isDark,
  language = "python",
  onUpdateSource,
  onRunCell,
  onDeleteCell,
  onMoveCell,
  onInsertCellBelow,
  onChangeCellType,
  onDuplicateCell,
  onClearCellOutputs,
}) => {
  const rawSource = Array.isArray(cell.source) ? cell.source.join("") : cell.source || "";
  const [sourceVal, setSourceVal] = useState(rawSource);
  const [copied, setCopied] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editorRef = useRef<any>(null);

  useEffect(() => {
    setSourceVal(Array.isArray(cell.source) ? cell.source.join("") : cell.source || "");
  }, [cell.source]);

  // Compute lines count for dynamic editor height
  const linesCount = useMemo(() => {
    return Math.max(2, sourceVal.split("\n").length);
  }, [sourceVal]);

  const editorHeight = useMemo(() => {
    return Math.min(600, Math.max(70, linesCount * 19 + 20));
  }, [linesCount]);

  const handleEditorChange = (val: string | undefined) => {
    const v = val || "";
    setSourceVal(v);
    onUpdateSource(cell.id, v);
  };

  const handleEditorMount = useCallback(
    (editor: any, monaco: Monaco) => {
      editorRef.current = editor;

      // Register Shift+Enter -> Run Cell & Advance
      editor.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.Enter, () => {
        onRunCell(cell.id);
      });

      // Register Ctrl+Enter -> Run Cell in place
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
        onRunCell(cell.id);
      });

      // Register Alt+Enter -> Run Cell & Insert Below
      editor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.Enter, () => {
        onRunCell(cell.id);
        onInsertCellBelow(index, "code");
      });
    },
    [cell.id, index, onRunCell, onInsertCellBelow]
  );

  const handleCopyCode = () => {
    navigator.clipboard.writeText(sourceVal);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const executionBadge = useMemo(() => {
    if (cell.isExecuting) {
      return (
        <span className="flex items-center gap-1 text-amber-400 font-bold animate-pulse">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>[*]</span>
        </span>
      );
    }
    if (cell.execution_count !== undefined && cell.execution_count !== null) {
      return (
        <span className="text-emerald-400 font-bold">
          [{cell.execution_count}]
        </span>
      );
    }
    return <span className="opacity-40">[ ]</span>;
  }, [cell.isExecuting, cell.execution_count]);

  return (
    <div
      className={`group relative rounded-xl border transition-all duration-150 mb-3 shadow-xs ${
        isDark
          ? cell.isExecuting
            ? "bg-[#0a0a0d] border-amber-500/50 shadow-amber-500/5"
            : "bg-[#09090b] border-neutral-800/80 hover:border-neutral-700"
          : cell.isExecuting
          ? "bg-white border-amber-500 shadow-amber-500/5"
          : "bg-white border-neutral-200 hover:border-neutral-300"
      }`}
    >
      {/* Cell Header & Gutter Controls */}
      <div
        className={`flex items-center justify-between px-3 py-1.5 border-b rounded-t-xl text-[11px] select-none font-mono ${
          isDark ? "bg-[#111114] border-neutral-800 text-neutral-400" : "bg-neutral-50 border-neutral-200 text-neutral-600"
        }`}
      >
        {/* Left: Execution Count & Info */}
        <div className="flex items-center gap-2">
          {/* Run Button */}
          <button
            onClick={() => onRunCell(cell.id)}
            disabled={cell.isExecuting}
            className={`px-2 py-0.5 rounded font-sans font-semibold text-[11px] flex items-center gap-1.5 cursor-pointer transition-all shadow-xs ${
              cell.isExecuting
                ? "bg-amber-500/20 text-amber-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-500 active:scale-95 text-white"
            }`}
            title="Execute Cell (Shift+Enter or Ctrl+Enter)"
          >
            {cell.isExecuting ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Play className="w-3 h-3 fill-current" />
            )}
            <span>Run</span>
          </button>

          {/* Execution Counter Badge */}
          <span className="text-xs">{executionBadge}</span>

          {/* Execution Duration Badge */}
          {cell.executionDurationMs !== undefined && (
            <span className="text-[10px] opacity-70 flex items-center gap-1 font-mono text-blue-400">
              <Zap className="w-2.5 h-2.5" />
              <span>
                {cell.executionDurationMs < 1000
                  ? `${cell.executionDurationMs}ms`
                  : `${(cell.executionDurationMs / 1000).toFixed(2)}s`}
              </span>
            </span>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1">
          {/* Cell Type Selector */}
          <select
            value={cell.cell_type}
            onChange={(e) => onChangeCellType(cell.id, e.target.value as CellType)}
            className={`text-[10px] px-1.5 py-0.5 rounded border font-sans font-medium cursor-pointer ${
              isDark ? "border-neutral-700 text-neutral-300 bg-neutral-900" : "border-slate-300 text-slate-700 bg-white"
            }`}
          >
            <option value="code">Code</option>
            <option value="markdown">Markdown</option>
            <option value="raw">Raw</option>
          </select>

          {/* Copy Code */}
          <button
            onClick={handleCopyCode}
            className={`p-1 rounded transition-colors cursor-pointer ${
              isDark ? "hover:bg-white/10 text-neutral-400 hover:text-white" : "hover:bg-slate-200 text-slate-600 hover:text-slate-900"
            }`}
            title="Copy Code"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          {/* Clear Output */}
          {cell.outputs && cell.outputs.length > 0 && (
            <button
              onClick={() => onClearCellOutputs(cell.id)}
              className={`p-1 rounded transition-colors cursor-pointer ${
                isDark ? "hover:bg-white/10 text-neutral-400 hover:text-amber-400" : "hover:bg-slate-200 text-slate-600 hover:text-amber-600"
              }`}
              title="Clear cell output"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Move Up/Down */}
          <button
            disabled={index === 0}
            onClick={() => onMoveCell(index, "up")}
            className={`p-1 rounded disabled:opacity-30 transition-colors cursor-pointer ${
              isDark ? "hover:bg-white/10 text-neutral-400 hover:text-white" : "hover:bg-slate-200 text-slate-600 hover:text-slate-900"
            }`}
            title="Move cell up"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
          <button
            disabled={index === totalCells - 1}
            onClick={() => onMoveCell(index, "down")}
            className={`p-1 rounded disabled:opacity-30 transition-colors cursor-pointer ${
              isDark ? "hover:bg-white/10 text-neutral-400 hover:text-white" : "hover:bg-slate-200 text-slate-600 hover:text-slate-900"
            }`}
            title="Move cell down"
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>

          {/* Duplicate */}
          <button
            onClick={() => onDuplicateCell(cell.id)}
            className={`p-1 rounded transition-colors cursor-pointer ${
              isDark ? "hover:bg-white/10 text-neutral-400 hover:text-white" : "hover:bg-slate-200 text-slate-600 hover:text-slate-900"
            }`}
            title="Duplicate cell"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>

          {/* Delete */}
          <button
            onClick={() => onDeleteCell(cell.id)}
            className="p-1 rounded hover:bg-rose-500/20 text-neutral-400 hover:text-rose-500 transition-colors cursor-pointer"
            title="Delete cell"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Editor Body */}
      <div className={`pt-1.5 pb-1 px-1 rounded-b-xl ${isDark ? "bg-[#09090b]" : "bg-white"}`}>
        <Editor
          height={`${editorHeight}px`}
          language={language === "javascript" ? "javascript" : "python"}
          value={sourceVal}
          onChange={handleEditorChange}
          onMount={handleEditorMount}
          theme={isDark ? "vs-dark" : "vs"}
          options={{
            fontSize: 13,
            fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, Monaco, Consolas, monospace",
            lineNumbers: "on",
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            wordWrap: "on",
            automaticLayout: true,
            tabSize: 4,
            renderLineHighlight: "line",
            folding: true,
            contextmenu: false,
            scrollbar: {
              vertical: "hidden",
              horizontal: "hidden",
              handleMouseWheel: true,
            },
            overviewRulerLanes: 0,
            hideCursorInOverviewRuler: true,
            glyphMargin: false,
            lineDecorationsWidth: 6,
            lineNumbersMinChars: 3,
            padding: { top: 6, bottom: 6 },
          }}
        />
      </div>

      {/* Cell Outputs Area */}
      {cell.outputs && cell.outputs.length > 0 && (
        <div className="px-3 pb-3">
          <NotebookCellOutput
            outputs={cell.outputs}
            isDark={isDark}
            onClearOutputs={() => onClearCellOutputs(cell.id)}
          />
        </div>
      )}

      {/* Floating Add Cell Gutter on Hover */}
      <div
        className={`absolute -bottom-3 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex items-center gap-1 backdrop-blur-md px-2 py-0.5 rounded-full border text-[10px] ${
          isDark
            ? "bg-[#141418]/90 border-neutral-700 text-neutral-200 shadow-lg"
            : "bg-white/95 border-slate-300 text-slate-700 shadow-md"
        }`}
      >
        <button
          onClick={() => onInsertCellBelow(index, "code")}
          className={`flex items-center gap-1 px-1.5 py-0.5 rounded font-medium cursor-pointer transition-colors ${
            isDark ? "hover:bg-blue-600 text-blue-400 hover:text-white" : "hover:bg-blue-600 text-blue-600 hover:text-white"
          }`}
        >
          <Plus className="w-3 h-3" />
          <span>Code</span>
        </button>
        <span className="opacity-30">|</span>
        <button
          onClick={() => onInsertCellBelow(index, "markdown")}
          className={`flex items-center gap-1 px-1.5 py-0.5 rounded font-medium cursor-pointer transition-colors ${
            isDark ? "hover:bg-emerald-600 text-emerald-400 hover:text-white" : "hover:bg-emerald-600 text-emerald-600 hover:text-white"
          }`}
        >
          <Plus className="w-3 h-3" />
          <span>Markdown</span>
        </button>
      </div>
    </div>
  );
};
