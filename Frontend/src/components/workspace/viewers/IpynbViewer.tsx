import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Play,
  RotateCcw,
  Plus,
  Trash2,
  Download,
  FileCode,
  List,
  Database,
  Code,
  Columns2,
  ChevronDown,
  Save,
} from "lucide-react";
import Editor from "@monaco-editor/react";
import { useTheme } from "../../../context/ThemeContext";
import {
  type NotebookData,
  type NotebookCell,
  type CellType,
  type KernelType,
  type KernelStatus,
  type KernelVariable,
} from "../../../types/notebook";
import kernelService, { AVAILABLE_KERNELS } from "../../../services/kernelService";
import { NotebookCodeCell } from "./notebook/NotebookCodeCell";
import { NotebookMarkdownCell } from "./notebook/NotebookMarkdownCell";
import { NotebookVariablesPanel } from "./notebook/NotebookVariablesPanel";
import { NotebookToc } from "./notebook/NotebookToc";
import { SiJupyter } from "react-icons/si";

interface IpynbViewerProps {
  content: string;
  filename: string;
  projectId?: string;
  isDirty?: boolean;
  onContentChange: (newContent: string) => void;
  onSave?: () => Promise<void>;
}

function generateCellId(): string {
  return "cell-" + Math.random().toString(36).substring(2, 9) + "-" + Date.now().toString(36);
}

function createDefaultNotebook(): NotebookData {
  return {
    cells: [],
    metadata: {
      kernelspec: {
        name: "python3",
        display_name: "Python 3 (Pyodide WASM)",
        language: "python",
      },
      language_info: {
        name: "python",
        version: "3.12.0",
        mimetype: "text/x-python",
        file_extension: ".py",
      },
    },
    nbformat: 4,
    nbformat_minor: 5,
  };
}

export const IpynbViewer: React.FC<IpynbViewerProps> = ({
  content,
  filename,
  projectId,
  isDirty = false,
  onContentChange,
  onSave,
}) => {
  const { isDark } = useTheme();

  // Parsing Notebook JSON
  const [notebook, setNotebook] = useState<NotebookData>(() => {
    try {
      if (!content || !content.trim()) return createDefaultNotebook();
      const parsed = JSON.parse(content);
      if (!parsed.cells || !Array.isArray(parsed.cells)) return createDefaultNotebook();
      const cellsWithIds = parsed.cells.map((c: any) => ({
        ...c,
        id: c.id || generateCellId(),
      }));
      return { ...parsed, cells: cellsWithIds };
    } catch {
      return createDefaultNotebook();
    }
  });

  const lastSerializedRef = useRef<string>("");

  // Sync with incoming content prop changes (e.g. tab switches or file reloads)
  useEffect(() => {
    if (content === lastSerializedRef.current) return;
    lastSerializedRef.current = content;

    try {
      if (!content || !content.trim()) {
        setNotebook(createDefaultNotebook());
        return;
      }
      const parsed = JSON.parse(content);
      if (!parsed.cells || !Array.isArray(parsed.cells)) {
        setNotebook(createDefaultNotebook());
        return;
      }
      const cellsWithIds = parsed.cells.map((c: any) => ({
        ...c,
        id: c.id || generateCellId(),
      }));
      setNotebook({ ...parsed, cells: cellsWithIds });
    } catch {
      setNotebook(createDefaultNotebook());
    }
  }, [content]);

  // Kernel state
  const [activeKernel, setActiveKernel] = useState<KernelType>(() => kernelService.getActiveKernelType());
  const [kernelStatus, setKernelStatus] = useState<KernelStatus>(() => kernelService.getStatus());
  const [kernelStatusMsg, setKernelStatusMsg] = useState<string>("");
  const [variables, setVariables] = useState<KernelVariable[]>([]);
  const [isVariablesOpen, setIsVariablesOpen] = useState(false);
  const [isTocOpen, setIsTocOpen] = useState(false);

  // View modes: "notebook" | "split" | "raw"
  const [viewMode, setViewMode] = useState<"notebook" | "split" | "raw">("notebook");
  const [copiedExport, setCopiedExport] = useState(false);
  const [showKernelMenu, setShowKernelMenu] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Sync Project ID to kernelService
  useEffect(() => {
    if (projectId) {
      kernelService.setProjectId(projectId);
    }
  }, [projectId]);

  // Subscribe to kernel service events
  useEffect(() => {
    const unsubStatus = kernelService.onStatusChange((status, msg) => {
      setKernelStatus(status);
      setKernelStatusMsg(msg || "");
    });
    const unsubVars = kernelService.onVariablesChange((vars) => {
      setVariables(vars);
    });

    return () => {
      unsubStatus();
      unsubVars();
    };
  }, []);

  // Update notebook JSON to parent
  const serializeAndNotify = useCallback(
    (nextNb: NotebookData) => {
      setNotebook(nextNb);
      try {
        // Strip out ephemeral UI fields while preserving id and schema
        const cleanCells = nextNb.cells.map((c) => {
          const { isExecuting, executionDurationMs, isEditingMarkdown, ...rest } = c;
          return { ...rest, id: c.id };
        });
        const serialized = JSON.stringify({ ...nextNb, cells: cleanCells }, null, 2);
        lastSerializedRef.current = serialized;
        onContentChange(serialized);
      } catch (err) {
        console.error("Failed to serialize notebook:", err);
      }
    },
    [onContentChange]
  );

  // Switch Kernel
  const handleSwitchKernel = async (type: KernelType) => {
    setShowKernelMenu(false);
    setActiveKernel(type);
    await kernelService.switchKernel(type);
  };

  // Restart Kernel
  const handleRestartKernel = async () => {
    await kernelService.restartKernel();
  };

  // Run Single Cell
  const handleRunCell = async (cellId: string) => {
    const cellIndex = notebook.cells.findIndex((c) => c.id === cellId);
    if (cellIndex === -1) return;

    const targetCell = notebook.cells[cellIndex];
    if (targetCell.cell_type === "markdown") {
      // Markdown cell execution renders it
      const nextCells = [...notebook.cells];
      nextCells[cellIndex] = { ...targetCell, isEditingMarkdown: false };
      serializeAndNotify({ ...notebook, cells: nextCells });
      return;
    }

    // Code Cell execution
    const code = Array.isArray(targetCell.source) ? targetCell.source.join("") : targetCell.source || "";

    // Set executing state
    const executingCells = [...notebook.cells];
    executingCells[cellIndex] = { ...targetCell, isExecuting: true };
    setNotebook({ ...notebook, cells: executingCells });

    const result = await kernelService.executeCode(code);

    const updatedCells = [...notebook.cells];
    updatedCells[cellIndex] = {
      ...targetCell,
      isExecuting: false,
      execution_count: result.executionCount,
      executionDurationMs: result.executionDurationMs,
      outputs: result.outputs,
    };

    serializeAndNotify({ ...notebook, cells: updatedCells });
  };

  // Run All Cells Sequentially
  const handleRunAll = async () => {
    for (let i = 0; i < notebook.cells.length; i++) {
      const cell = notebook.cells[i];
      if (cell.cell_type === "code") {
        await handleRunCell(cell.id);
      }
    }
  };

  // Clear All Outputs
  const handleClearAllOutputs = () => {
    const cleared = notebook.cells.map((c) => ({
      ...c,
      outputs: [],
      execution_count: null,
      executionDurationMs: undefined,
    }));
    serializeAndNotify({ ...notebook, cells: cleared });
  };

  // Cell manipulation handlers
  const handleUpdateSource = (cellId: string, newSource: string) => {
    const nextCells = notebook.cells.map((c) =>
      c.id === cellId ? { ...c, source: newSource } : c
    );
    serializeAndNotify({ ...notebook, cells: nextCells });
  };

  const handleDeleteCell = (cellId: string) => {
    if (notebook.cells.length <= 1) return;
    const nextCells = notebook.cells.filter((c) => c.id !== cellId);
    serializeAndNotify({ ...notebook, cells: nextCells });
  };

  const handleMoveCell = (index: number, direction: "up" | "down") => {
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= notebook.cells.length) return;

    const nextCells = [...notebook.cells];
    const temp = nextCells[index];
    nextCells[index] = nextCells[targetIdx];
    nextCells[targetIdx] = temp;
    serializeAndNotify({ ...notebook, cells: nextCells });
  };

  const handleInsertCellBelow = (index: number, type: CellType) => {
    const newCell: NotebookCell = {
      id: generateCellId(),
      cell_type: type,
      metadata: {},
      source: "",
      execution_count: null,
      outputs: [],
      isEditingMarkdown: type === "markdown",
    };
    const nextCells = [...notebook.cells];
    nextCells.splice(index + 1, 0, newCell);
    serializeAndNotify({ ...notebook, cells: nextCells });
  };

  const handleChangeCellType = (cellId: string, newType: CellType) => {
    const nextCells = notebook.cells.map((c) => {
      if (c.id === cellId) {
        return {
          ...c,
          cell_type: newType,
          outputs: newType === "code" ? c.outputs : [],
        };
      }
      return c;
    });
    serializeAndNotify({ ...notebook, cells: nextCells });
  };

  const handleDuplicateCell = (cellId: string) => {
    const idx = notebook.cells.findIndex((c) => c.id === cellId);
    if (idx === -1) return;
    const original = notebook.cells[idx];
    const duplicate: NotebookCell = {
      ...original,
      id: generateCellId(),
      execution_count: null,
      outputs: [...(original.outputs || [])],
    };
    const nextCells = [...notebook.cells];
    nextCells.splice(idx + 1, 0, duplicate);
    serializeAndNotify({ ...notebook, cells: nextCells });
  };

  const handleClearCellOutputs = (cellId: string) => {
    const nextCells = notebook.cells.map((c) =>
      c.id === cellId ? { ...c, outputs: [], execution_count: null, executionDurationMs: undefined } : c
    );
    serializeAndNotify({ ...notebook, cells: nextCells });
  };

  // Exports
  const generatePythonScript = useMemo(() => {
    return notebook.cells
      .map((c) => {
        const src = Array.isArray(c.source) ? c.source.join("") : c.source || "";
        if (c.cell_type === "markdown") {
          return `\n# %% [markdown]\n"""\n${src}\n"""\n`;
        }
        return `\n# %%\n${src}\n`;
      })
      .join("\n");
  }, [notebook]);

  const generateMarkdownExport = useMemo(() => {
    return notebook.cells
      .map((c) => {
        const src = Array.isArray(c.source) ? c.source.join("") : c.source || "";
        if (c.cell_type === "markdown") return src;
        return `\`\`\`python\n${src}\n\`\`\``;
      })
      .join("\n\n");
  }, [notebook]);

  const handleDownloadFile = (ext: "ipynb" | "py" | "md") => {
    let fileData = "";
    let mime = "application/json";
    if (ext === "ipynb") {
      fileData = JSON.stringify(notebook, null, 2);
    } else if (ext === "py") {
      fileData = generatePythonScript;
      mime = "text/x-python";
    } else if (ext === "md") {
      fileData = generateMarkdownExport;
      mime = "text/markdown";
    }

    const blob = new Blob([fileData], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename.replace(/\.ipynb$/, "")}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  const activeKernelSpec = AVAILABLE_KERNELS.find((k) => k.id === activeKernel) || AVAILABLE_KERNELS[0];

  return (
    <div
      className={`h-full flex flex-col overflow-hidden font-sans select-none relative ${
        isDark ? "bg-[#09090b] text-neutral-200" : "bg-neutral-50 text-neutral-800"
      }`}
    >
      {/* 1. Main Jupyter Top Toolbar */}
      <div
        className={`px-3 py-2 border-b flex flex-wrap items-center justify-between gap-2 shrink-0 z-20 ${
          isDark ? "bg-[#0f0f12] border-neutral-800 shadow-md" : "bg-white border-neutral-200 shadow-xs"
        }`}
      >
        {/* Left Side: Kernel Controls & Status */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Kernel Selector Button */}
          <div className="relative">
            <button
              onClick={() => setShowKernelMenu(!showKernelMenu)}
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all ${
                isDark
                  ? "bg-[#141418] border-neutral-700 hover:border-neutral-500 text-neutral-200"
                  : "bg-white border-slate-300 hover:border-slate-400 text-slate-800 shadow-xs"
              }`}
              title="Select Active Kernel Engine"
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  kernelStatus === "busy"
                    ? "bg-amber-400 animate-ping"
                    : kernelStatus === "error"
                    ? "bg-rose-500"
                    : kernelStatus === "initializing"
                    ? "bg-blue-400 animate-pulse"
                    : "bg-emerald-500"
                }`}
              />
              <span className="truncate max-w-[160px] sm:max-w-[200px]">{activeKernelSpec.displayName}</span>
              <ChevronDown className="w-3.5 h-3.5 opacity-60" />
            </button>

            {/* Kernel Dropdown Menu */}
            {showKernelMenu && (
              <div
                className={`absolute top-full left-0 mt-1.5 w-80 rounded-xl border p-1.5 shadow-2xl z-50 text-xs ${
                  isDark
                    ? "bg-[#121216] border-neutral-700 text-neutral-200"
                    : "bg-white border-slate-200 text-slate-900 shadow-xl"
                }`}
              >
                <div
                  className={`px-2.5 py-1.5 font-bold uppercase tracking-wider text-[10px] ${
                    isDark ? "text-neutral-400" : "text-slate-500"
                  }`}
                >
                  Select Execution Kernel
                </div>
                {AVAILABLE_KERNELS.map((k) => {
                  const isActive = activeKernel === k.id;
                  return (
                    <button
                      key={k.id}
                      onClick={() => handleSwitchKernel(k.id)}
                      className={`w-full text-left p-2.5 rounded-lg flex flex-col gap-1 cursor-pointer transition-all ${
                        isActive
                          ? isDark
                            ? "bg-blue-600/20 text-blue-300 font-semibold border border-blue-500/40"
                            : "bg-blue-50 text-blue-900 font-semibold border border-blue-200"
                          : isDark
                          ? "hover:bg-white/5 text-neutral-300 border border-transparent"
                          : "hover:bg-slate-100 text-slate-700 border border-transparent"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`font-bold text-xs ${
                            isActive
                              ? isDark
                                ? "text-blue-300"
                                : "text-blue-700"
                              : isDark
                              ? "text-neutral-100"
                              : "text-slate-900"
                          }`}
                        >
                          {k.displayName}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-sans font-medium ${
                            isActive
                              ? isDark
                                ? "bg-blue-500/30 text-blue-200 border border-blue-400/30"
                                : "bg-blue-100 text-blue-800 border border-blue-200"
                              : isDark
                              ? "bg-neutral-800 text-neutral-400 border border-neutral-700"
                              : "bg-slate-100 text-slate-600 border border-slate-200"
                          }`}
                        >
                          {k.badge}
                        </span>
                      </div>
                      <span
                        className={`text-[11px] leading-snug ${
                          isActive
                            ? isDark
                              ? "text-blue-200/80"
                              : "text-blue-800/80"
                            : isDark
                            ? "text-neutral-400"
                            : "text-slate-600"
                        }`}
                      >
                        {k.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Kernel Status Text */}
          {kernelStatusMsg && (
            <span
              className={`text-[11px] font-mono px-2 py-1 rounded hidden md:inline ${
                isDark
                  ? "bg-neutral-800/60 border border-neutral-700/50 text-neutral-400"
                  : "bg-slate-100 border border-slate-200 text-slate-600 font-medium"
              }`}
            >
              {kernelStatusMsg}
            </span>
          )}

          <div className="h-4 w-px bg-neutral-700/50 mx-1 hidden sm:block" />

          {/* Run All Cells */}
          <button
            onClick={handleRunAll}
            disabled={kernelStatus === "busy"}
            className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs flex items-center gap-1.5 cursor-pointer transition-all shadow-xs disabled:opacity-50"
            title="Run All Cells in Order"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span className="hidden sm:inline">Run All</span>
          </button>

          {/* Restart Kernel */}
          <button
            onClick={handleRestartKernel}
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-all ${
              isDark
                ? "bg-[#141418] border-neutral-700/80 hover:border-neutral-500 text-neutral-300"
                : "bg-white border-slate-300 hover:bg-slate-50 text-slate-700 shadow-xs"
            }`}
            title="Restart Kernel (Clears in-memory variables)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Restart</span>
          </button>

          {/* Clear Outputs */}
          <button
            onClick={handleClearAllOutputs}
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-all ${
              isDark
                ? "bg-[#141418] border-neutral-700/80 hover:border-neutral-500 text-neutral-300"
                : "bg-white border-slate-300 hover:bg-slate-50 text-slate-700 shadow-xs"
            }`}
            title="Clear all cell outputs"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Clear</span>
          </button>

          {/* Add Code Cell */}
          <button
            onClick={() => handleInsertCellBelow(notebook.cells.length - 1, "code")}
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-all ${
              isDark
                ? "bg-blue-600/15 border-blue-500/30 hover:border-blue-500 text-blue-400"
                : "bg-blue-50/80 border-blue-200 hover:bg-blue-100 hover:border-blue-300 text-blue-700 shadow-xs"
            }`}
            title="Add Code Cell to Bottom"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Code</span>
          </button>

          {/* Add Markdown Cell */}
          <button
            onClick={() => handleInsertCellBelow(notebook.cells.length - 1, "markdown")}
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-all ${
              isDark
                ? "bg-emerald-600/15 border-emerald-500/30 hover:border-emerald-500 text-emerald-400"
                : "bg-emerald-50/80 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300 text-emerald-700 shadow-xs"
            }`}
            title="Add Markdown Cell to Bottom"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Text</span>
          </button>
        </div>

        {/* Right Side: View Mode, TOC, Variables & Export */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Table of Contents Trigger */}
          <button
            onClick={() => {
              setIsTocOpen((prev) => {
                const next = !prev;
                if (next) setIsVariablesOpen(false);
                return next;
              });
            }}
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-all ${
              isTocOpen
                ? isDark
                  ? "bg-blue-600/25 text-blue-300 border-blue-500/50 shadow-xs"
                  : "bg-blue-50 text-blue-700 border-blue-300 shadow-xs font-semibold"
                : isDark
                ? "bg-[#141418] border-neutral-700/80 text-neutral-300 hover:border-neutral-500 hover:text-white"
                : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-xs"
            }`}
            title="Toggle Outline / Table of Contents"
          >
            <List className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">TOC</span>
          </button>

          {/* Variables Inspector Trigger */}
          <button
            onClick={() => {
              setIsVariablesOpen((prev) => {
                const next = !prev;
                if (next) setIsTocOpen(false);
                return next;
              });
            }}
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-all ${
              isVariablesOpen
                ? isDark
                  ? "bg-purple-600/25 text-purple-300 border-purple-500/50 shadow-xs"
                  : "bg-purple-50 text-purple-700 border-purple-300 shadow-xs font-semibold"
                : isDark
                ? "bg-[#141418] border-neutral-700/80 text-neutral-300 hover:border-neutral-500 hover:text-white"
                : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-xs"
            }`}
            title="Toggle Live Variable Inspector"
          >
            <Database className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Variables</span>
            {variables.length > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  isVariablesOpen
                    ? isDark
                      ? "bg-purple-500/30 text-purple-200"
                      : "bg-purple-200 text-purple-800"
                    : isDark
                    ? "bg-neutral-800 text-neutral-300"
                    : "bg-slate-200 text-slate-700"
                }`}
              >
                {variables.length}
              </span>
            )}
          </button>

          {/* View Modes (Notebook / Split / Raw) */}
          <div
            className={`flex items-center p-0.5 rounded-lg border ${
              isDark ? "bg-[#141418] border-neutral-700" : "bg-slate-100 border-slate-300 shadow-xs"
            }`}
          >
            <button
              onClick={() => setViewMode("notebook")}
              className={`p-1.5 rounded-md text-xs cursor-pointer transition-all ${
                viewMode === "notebook"
                  ? isDark
                    ? "bg-neutral-800 text-blue-400 font-semibold shadow-xs"
                    : "bg-white text-blue-600 font-semibold shadow-xs border border-slate-200/60"
                  : isDark
                  ? "text-neutral-400 hover:text-neutral-200"
                  : "text-slate-500 hover:text-slate-900"
              }`}
              title="Interactive Notebook View"
            >
              <FileCode className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode("split")}
              className={`p-1.5 rounded-md text-xs cursor-pointer transition-all ${
                viewMode === "split"
                  ? isDark
                    ? "bg-neutral-800 text-blue-400 font-semibold shadow-xs"
                    : "bg-white text-blue-600 font-semibold shadow-xs border border-slate-200/60"
                  : isDark
                  ? "text-neutral-400 hover:text-neutral-200"
                  : "text-slate-500 hover:text-slate-900"
              }`}
              title="Split View (Notebook + Code Script)"
            >
              <Columns2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode("raw")}
              className={`p-1.5 rounded-md text-xs cursor-pointer transition-all ${
                viewMode === "raw"
                  ? isDark
                    ? "bg-neutral-800 text-blue-400 font-semibold shadow-xs"
                    : "bg-white text-blue-600 font-semibold shadow-xs border border-slate-200/60"
                  : isDark
                  ? "text-neutral-400 hover:text-neutral-200"
                  : "text-slate-500 hover:text-slate-900"
              }`}
              title="Raw JSON Editor"
            >
              <Code className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Save Button */}
          {isDirty && onSave && (
            <button
              onClick={() => onSave()}
              className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs flex items-center gap-1.5 cursor-pointer transition-all shadow-xs"
              title="Save Notebook Changes (Ctrl+S)"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save</span>
            </button>
          )}

          {/* Export Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 cursor-pointer transition-colors ${
                isDark
                  ? "border-neutral-800 hover:bg-white/10 text-neutral-300"
                  : "border-slate-300 hover:bg-slate-100 text-slate-700 shadow-xs"
              }`}
              title="Export Notebook"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export</span>
            </button>

            {showExportMenu && (
              <div
                className={`absolute top-full right-0 mt-1.5 w-56 rounded-xl border p-1.5 shadow-2xl z-50 text-xs ${
                  isDark
                    ? "bg-[#121216] border-neutral-700 text-neutral-200"
                    : "bg-white border-slate-200 text-slate-800 shadow-xl"
                }`}
              >
                <div
                  className={`px-2.5 py-1 font-bold uppercase tracking-wider text-[10px] ${
                    isDark ? "text-neutral-400" : "text-slate-500"
                  }`}
                >
                  Export Notebook
                </div>
                <button
                  onClick={() => handleDownloadFile("ipynb")}
                  className={`w-full text-left px-2.5 py-2 rounded-lg flex items-center justify-between cursor-pointer transition-colors ${
                    isDark
                      ? "hover:bg-blue-600 hover:text-white"
                      : "hover:bg-blue-50 text-slate-800 hover:text-blue-700"
                  }`}
                >
                  <span className="font-medium">Download .ipynb</span>
                  <span className="text-[10px] opacity-60">Jupyter</span>
                </button>
                <button
                  onClick={() => handleDownloadFile("py")}
                  className={`w-full text-left px-2.5 py-2 rounded-lg flex items-center justify-between cursor-pointer transition-colors ${
                    isDark
                      ? "hover:bg-blue-600 hover:text-white"
                      : "hover:bg-blue-50 text-slate-800 hover:text-blue-700"
                  }`}
                >
                  <span className="font-medium">Export Python (.py)</span>
                  <span className="text-[10px] opacity-60">Script</span>
                </button>
                <button
                  onClick={() => handleDownloadFile("md")}
                  className={`w-full text-left px-2.5 py-2 rounded-lg flex items-center justify-between cursor-pointer transition-colors ${
                    isDark
                      ? "hover:bg-blue-600 hover:text-white"
                      : "hover:bg-blue-50 text-slate-800 hover:text-blue-700"
                  }`}
                >
                  <span className="font-medium">Export Markdown (.md)</span>
                  <span className="text-[10px] opacity-60">Doc</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Main Body Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left / Primary: Interactive Notebook Cells */}
        <div
          ref={containerRef}
          className={`flex-1 overflow-y-auto p-4 sm:p-6 transition-all ${
            viewMode === "split" ? "w-1/2 border-r border-neutral-800" : "w-full"
          } ${viewMode === "raw" ? "hidden" : "block"}`}
        >
          <div className="max-w-4xl mx-auto space-y-4">
            {notebook.cells.length === 0 ? (
              <div
                className={`flex flex-col items-center justify-center p-12 text-center my-8 rounded-2xl border-2 border-dashed transition-all ${
                  isDark
                    ? "bg-[#0f0f13]/60 border-neutral-800 text-neutral-300"
                    : "bg-white border-slate-200 text-slate-700 shadow-xs"
                }`}
              >
                <div className="w-14 h-14 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mb-4 text-orange-500">
                  <SiJupyter className="w-8 h-8" />
                </div>
                <h3 className="text-base font-bold tracking-tight mb-1">
                  Empty Jupyter Notebook
                </h3>
                <p className="text-xs opacity-70 max-w-sm mb-6 leading-relaxed">
                  Start coding by adding an interactive Python code cell or formatted Markdown documentation.
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleInsertCellBelow(-1, "code")}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center gap-2 cursor-pointer transition-all shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Code Cell</span>
                  </button>
                  <button
                    onClick={() => handleInsertCellBelow(-1, "markdown")}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-2 cursor-pointer transition-all shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Markdown Cell</span>
                  </button>
                </div>
              </div>
            ) : (
              notebook.cells.map((cell, idx) => (
                <React.Fragment key={cell.id}>
                  {cell.cell_type === "markdown" ? (
                    <NotebookMarkdownCell
                      cell={cell}
                      index={idx}
                      totalCells={notebook.cells.length}
                      isDark={isDark}
                      onUpdateSource={handleUpdateSource}
                      onDeleteCell={handleDeleteCell}
                      onMoveCell={handleMoveCell}
                      onInsertCellBelow={handleInsertCellBelow}
                      onChangeCellType={handleChangeCellType}
                      onDuplicateCell={handleDuplicateCell}
                    />
                  ) : (
                    <NotebookCodeCell
                      cell={cell}
                      index={idx}
                      totalCells={notebook.cells.length}
                      isDark={isDark}
                      language={activeKernelSpec.language}
                      onUpdateSource={handleUpdateSource}
                      onRunCell={handleRunCell}
                      onDeleteCell={handleDeleteCell}
                      onMoveCell={handleMoveCell}
                      onInsertCellBelow={handleInsertCellBelow}
                      onChangeCellType={handleChangeCellType}
                      onDuplicateCell={handleDuplicateCell}
                      onClearCellOutputs={handleClearCellOutputs}
                    />
                  )}
                </React.Fragment>
              ))
            )}

            {/* Bottom Spacing */}
            <div className="pb-16" />
          </div>
        </div>

        {/* Right Split: Script Preview */}
        {viewMode === "split" && (
          <div className="w-1/2 flex flex-col overflow-hidden">
            <div
              className={`px-3 py-1.5 border-b text-[11px] font-mono select-none flex items-center justify-between ${
                isDark ? "bg-[#111114] border-neutral-800 text-neutral-400" : "bg-neutral-100 border-neutral-200 text-neutral-600"
              }`}
            >
              <span>Exported Python Script Preview</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(generatePythonScript);
                  setCopiedExport(true);
                  setTimeout(() => setCopiedExport(false), 1500);
                }}
                className="hover:text-white cursor-pointer"
              >
                {copiedExport ? "Copied!" : "Copy .py"}
              </button>
            </div>
            <div className="flex-1">
              <Editor
                height="100%"
                language="python"
                value={generatePythonScript}
                theme={isDark ? "vs-dark" : "light"}
                options={{
                  readOnly: true,
                  fontSize: 12,
                  fontFamily: "'JetBrains Mono', monospace",
                  minimap: { enabled: false },
                  wordWrap: "on",
                }}
              />
            </div>
          </div>
        )}

        {/* Raw JSON Editor Mode */}
        {viewMode === "raw" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div
              className={`px-3 py-1.5 border-b text-[11px] font-mono select-none flex items-center justify-between ${
                isDark ? "bg-[#111114] border-neutral-800 text-neutral-400" : "bg-neutral-100 border-neutral-200 text-neutral-600"
              }`}
            >
              <span>Raw .ipynb JSON Structure</span>
              <span className="text-[10px] text-amber-400">Direct edits modify the notebook structure</span>
            </div>
            <div className="flex-1">
              <Editor
                height="100%"
                language="json"
                value={JSON.stringify(notebook, null, 2)}
                onChange={(val) => {
                  try {
                    if (val) {
                      const p = JSON.parse(val);
                      serializeAndNotify(p);
                    }
                  } catch {
                    // ignore syntax during typing
                  }
                }}
                theme={isDark ? "vs-dark" : "light"}
                options={{
                  fontSize: 12,
                  fontFamily: "'JetBrains Mono', monospace",
                  minimap: { enabled: true },
                  wordWrap: "on",
                  automaticLayout: true,
                }}
              />
            </div>
          </div>
        )}

        {/* Slide-over Panels: TOC and Variable Inspector */}
        <NotebookToc
          cells={notebook.cells}
          isDark={isDark}
          isOpen={isTocOpen}
          onClose={() => setIsTocOpen(false)}
          onSelectCell={(idx) => {
            setIsTocOpen(false);
            const targetEl = containerRef.current?.querySelectorAll(".group")[idx];
            if (targetEl) {
              targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
            }
          }}
        />

        <NotebookVariablesPanel
          variables={variables}
          isDark={isDark}
          isOpen={isVariablesOpen}
          onClose={() => setIsVariablesOpen(false)}
          onRefresh={() => kernelService.restartKernel()}
        />
      </div>
    </div>
  );
};
