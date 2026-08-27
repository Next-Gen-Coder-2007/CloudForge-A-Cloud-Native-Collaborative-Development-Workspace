import React, { useState } from "react";
import {
  Search,
  Database,
  RefreshCw,
  X,
  Copy,
  Check,
  Layers,
} from "lucide-react";
import { type KernelVariable } from "../../../../types/notebook";

interface NotebookVariablesPanelProps {
  variables: KernelVariable[];
  isDark: boolean;
  isOpen: boolean;
  onClose: () => void;
  onRefresh?: () => void;
}

function getTypeBadgeStyle(type: string, isDark: boolean): { bg: string; text: string; border: string } {
  const t = (type || "").toLowerCase();
  if (t.includes("dataframe") || t.includes("series") || t.includes("table")) {
    return isDark
      ? { bg: "bg-emerald-500/15", text: "text-emerald-400", border: "border-emerald-500/30" }
      : { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" };
  }
  if (t.includes("ndarray") || t.includes("array") || t.includes("tensor")) {
    return isDark
      ? { bg: "bg-blue-500/15", text: "text-blue-400", border: "border-blue-500/30" }
      : { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" };
  }
  if (t.includes("int") || t.includes("float") || t.includes("complex") || t.includes("number")) {
    return isDark
      ? { bg: "bg-cyan-500/15", text: "text-cyan-400", border: "border-cyan-500/30" }
      : { bg: "bg-cyan-50", text: "text-cyan-700", border: "border-cyan-200" };
  }
  if (t.includes("str") || t.includes("string") || t.includes("char")) {
    return isDark
      ? { bg: "bg-amber-500/15", text: "text-amber-400", border: "border-amber-500/30" }
      : { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" };
  }
  if (t.includes("dict") || t.includes("list") || t.includes("set") || t.includes("tuple")) {
    return isDark
      ? { bg: "bg-purple-500/15", text: "text-purple-400", border: "border-purple-500/30" }
      : { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" };
  }
  return isDark
    ? { bg: "bg-neutral-800", text: "text-neutral-300", border: "border-neutral-700" }
    : { bg: "bg-slate-100", text: "text-slate-700", border: "border-slate-200" };
}

export const NotebookVariablesPanel: React.FC<NotebookVariablesPanelProps> = ({
  variables,
  isDark,
  isOpen,
  onClose,
  onRefresh,
}) => {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [copiedVarName, setCopiedVarName] = useState<string | null>(null);

  if (!isOpen) return null;

  const filtered = variables.filter((v) => {
    const matchesSearch =
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      v.type.toLowerCase().includes(search.toLowerCase()) ||
      v.valuePreview.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;
    if (filterType === "all") return true;
    if (filterType === "data")
      return v.type.toLowerCase().includes("dataframe") || v.type.toLowerCase().includes("array");
    if (filterType === "number")
      return v.type.toLowerCase().includes("int") || v.type.toLowerCase().includes("float");
    if (filterType === "collection")
      return (
        v.type.toLowerCase().includes("dict") ||
        v.type.toLowerCase().includes("list") ||
        v.type.toLowerCase().includes("set") ||
        v.type.toLowerCase().includes("tuple")
      );
    return true;
  });

  const handleCopyValue = (varName: string, val: string) => {
    navigator.clipboard.writeText(val);
    setCopiedVarName(varName);
    setTimeout(() => setCopiedVarName(null), 1500);
  };

  return (
    <div
      className={`absolute inset-y-0 right-0 w-80 sm:w-96 z-30 shadow-2xl border-l flex flex-col font-sans transition-all animate-in slide-in-from-right duration-200 ${
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
          <div className="w-6 h-6 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-600">
            <Database className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="text-xs font-bold tracking-tight">Kernel Variables</h3>
            <span className="text-[10px] opacity-60 font-sans">
              {variables.length} active in memory
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {onRefresh && (
            <button
              onClick={onRefresh}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                isDark
                  ? "hover:bg-white/10 text-neutral-400 hover:text-white"
                  : "hover:bg-slate-200 text-slate-600 hover:text-slate-900"
              }`}
              title="Refresh variables"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              isDark
                ? "hover:bg-white/10 text-neutral-400 hover:text-white"
                : "hover:bg-slate-200 text-slate-600 hover:text-slate-900"
            }`}
            title="Close panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Search & Filter Bar */}
      <div className={`p-3 border-b space-y-2 ${isDark ? "border-neutral-800/80 bg-[#0e0e11]" : "border-slate-200 bg-slate-50/50"}`}>
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs transition-all ${
            isDark
              ? "bg-[#141418] border-neutral-700 text-neutral-200 focus-within:border-purple-500"
              : "bg-white border-slate-300 text-slate-800 focus-within:border-purple-500 focus-within:ring-2 focus-within:ring-purple-500/10 shadow-xs"
          }`}
        >
          <Search className="w-3.5 h-3.5 opacity-40 shrink-0" />
          <input
            type="text"
            placeholder="Search name, type, or value..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent border-none outline-hidden text-xs placeholder:opacity-50 font-sans"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="p-0.5 opacity-60 hover:opacity-100 cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 text-[10px] overflow-x-auto pb-0.5 no-scrollbar">
          {[
            { id: "all", label: "All" },
            { id: "data", label: "Data / Arrays" },
            { id: "number", label: "Numbers" },
            { id: "collection", label: "Collections" },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilterType(f.id)}
              className={`px-2 py-0.5 rounded-md font-medium whitespace-nowrap cursor-pointer transition-colors ${
                filterType === f.id
                  ? isDark
                    ? "bg-purple-600/30 text-purple-200 border border-purple-500/40"
                    : "bg-purple-100 text-purple-800 border border-purple-200 font-semibold"
                  : isDark
                  ? "bg-neutral-800/40 hover:bg-neutral-800 text-neutral-400 border border-transparent"
                  : "bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 shadow-xs"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Variables List Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {filtered.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center p-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 ${
              isDark ? "bg-neutral-800/60 text-neutral-400" : "bg-slate-100 text-slate-500"
            }`}>
              <Database className="w-6 h-6 opacity-60" />
            </div>
            <p className="text-xs font-semibold mb-1">
              {variables.length === 0 ? "No Active Variables" : "No Matching Variables"}
            </p>
            <p className="text-[11px] opacity-60 max-w-[220px] leading-relaxed">
              {variables.length === 0
                ? "Run Python code cells (e.g. x = 42, df = ...) to inspect variables in memory."
                : "Try adjusting your search query or filter."}
            </p>
          </div>
        ) : (
          filtered.map((v, i) => {
            const badgeStyle = getTypeBadgeStyle(v.type, isDark);
            const isCopied = copiedVarName === v.name;

            return (
              <div
                key={i}
                className={`p-3 rounded-xl border transition-all text-xs ${
                  isDark
                    ? "bg-[#131317] border-neutral-800/90 hover:border-neutral-700"
                    : "bg-white border-slate-200/90 hover:border-slate-300 shadow-xs hover:shadow-sm"
                }`}
              >
                {/* Header: Name + Type Badge */}
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span
                    className={`font-bold font-mono text-xs truncate select-text ${
                      isDark ? "text-blue-400" : "text-blue-600"
                    }`}
                    title={v.name}
                  >
                    {v.name}
                  </span>

                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border shrink-0 ${badgeStyle.bg} ${badgeStyle.text} ${badgeStyle.border}`}
                  >
                    {v.type}
                  </span>
                </div>

                {/* Size / Shape info if present */}
                {v.sizeOrShape && (
                  <div className="text-[10px] opacity-60 font-sans mb-1.5 flex items-center gap-1">
                    <Layers className="w-3 h-3 opacity-70" />
                    <span>{v.sizeOrShape}</span>
                  </div>
                )}

                {/* Value Preview Card */}
                <div className="relative group/val mt-1">
                  <div
                    className={`p-2 rounded-lg text-[11px] font-mono whitespace-pre-wrap break-all max-h-24 overflow-y-auto leading-relaxed select-text border ${
                      isDark
                        ? "bg-[#09090b] text-neutral-300 border-neutral-800/60"
                        : "bg-slate-50 text-slate-800 border-slate-200/70"
                    }`}
                  >
                    {v.valuePreview}
                  </div>

                  <button
                    onClick={() => handleCopyValue(v.name, v.valuePreview)}
                    className={`absolute top-1.5 right-1.5 p-1 rounded-md opacity-0 group-hover/val:opacity-100 transition-opacity cursor-pointer border ${
                      isDark
                        ? "bg-neutral-800/90 border-neutral-700 text-neutral-300 hover:text-white"
                        : "bg-white/95 border-slate-200 text-slate-700 hover:text-slate-900 shadow-xs"
                    }`}
                    title="Copy value"
                  >
                    {isCopied ? (
                      <Check className="w-3 h-3 text-emerald-500" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
