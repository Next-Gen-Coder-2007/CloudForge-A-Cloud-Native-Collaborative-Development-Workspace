import React, { useState, useEffect } from "react";
import {
  GitCompare,
  ArrowRight,
  X,
  RotateCw,
  FileCode,
  Layers,
} from "lucide-react";
import { DiffEditor } from "@monaco-editor/react";
import { FileIcon } from "./FileIcon";
import { useTheme } from "../../context/ThemeContext";
import { vcsService } from "../../services/vcsService";
import type { CommitComparisonResult, CommitComparisonFile } from "../../types/workspace";

interface CommitCompareModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  branches: string[];
  initialBase?: string;
  initialHead?: string;
}

export const CommitCompareModal: React.FC<CommitCompareModalProps> = ({
  isOpen,
  onClose,
  projectId,
  branches,
  initialBase = "main",
  initialHead,
}) => {
  const { isDark } = useTheme();
  const [base, setBase] = useState(initialBase);
  const [head, setHead] = useState(initialHead || branches.find((b) => b !== initialBase) || "main");
  const [isLoading, setIsLoading] = useState(false);
  const [comparison, setComparison] = useState<CommitComparisonResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<CommitComparisonFile | null>(null);

  const runCompare = async (baseTarget: string, headTarget: string) => {
    if (!baseTarget || !headTarget) return;
    try {
      setIsLoading(true);
      const res = await vcsService.compareSnapshots(projectId, baseTarget, headTarget);
      setComparison(res);
      if (res.files.length > 0) {
        setSelectedFile(res.files[0]);
      } else {
        setSelectedFile(null);
      }
    } catch (err: any) {
      console.error("Failed to compare snapshots", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      const b = initialBase || "main";
      const h = initialHead || branches.find((br) => br !== b) || b;
      setBase(b);
      setHead(h);
      runCompare(b, h);
    }
  }, [isOpen, projectId, initialBase, initialHead]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-xs select-none">
      <div className={`w-full max-w-6xl h-[92vh] rounded-2xl border shadow-2xl overflow-hidden flex flex-col font-sans transition-colors duration-150 ${
        isDark ? "bg-neutral-950 border-neutral-800 text-white" : "bg-white border-neutral-200 text-black"
      }`}>
        {/* Header Toolbar */}
        <div className={`px-4 py-3 border-b flex flex-wrap items-center justify-between gap-3 shrink-0 ${
          isDark ? "bg-neutral-900 border-neutral-800" : "bg-neutral-50 border-neutral-200"
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-600 font-bold text-white flex items-center justify-center text-xs shadow-md shadow-blue-500/20">
              <GitCompare className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm">Compare Branches & Commits</h3>
              <p className={`text-[11px] ${isDark ? "text-neutral-400" : "text-neutral-500"}`}>
                Inspect differences across branch heads or commit snapshots
              </p>
            </div>
          </div>

          {/* Selectors */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs">
              <span className={`text-[11px] font-semibold ${isDark ? "text-neutral-400" : "text-neutral-500"}`}>Base:</span>
              <select
                value={base}
                onChange={(e) => {
                  setBase(e.target.value);
                  runCompare(e.target.value, head);
                }}
                className={`px-2.5 py-1 rounded-lg border text-xs outline-none ${
                  isDark ? "bg-black border-neutral-700 text-white" : "bg-white border-neutral-300 text-black"
                }`}
              >
                {branches.map((b) => (
                  <option key={`base-${b}`} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            <ArrowRight className="w-3.5 h-3.5 opacity-60" />

            <div className="flex items-center gap-1.5 text-xs">
              <span className={`text-[11px] font-semibold ${isDark ? "text-neutral-400" : "text-neutral-500"}`}>Compare (Head):</span>
              <select
                value={head}
                onChange={(e) => {
                  setHead(e.target.value);
                  runCompare(base, e.target.value);
                }}
                className={`px-2.5 py-1 rounded-lg border text-xs outline-none ${
                  isDark ? "bg-black border-neutral-700 text-white" : "bg-white border-neutral-300 text-black"
                }`}
              >
                {branches.map((b) => (
                  <option key={`head-${b}`} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => runCompare(base, head)}
              disabled={isLoading}
              className={`p-1.5 rounded-lg border cursor-pointer ${
                isDark ? "border-neutral-700 hover:bg-neutral-800" : "border-neutral-300 hover:bg-neutral-200"
              }`}
              title="Refresh comparison"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            </button>

            <button
              onClick={onClose}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ml-2 ${
                isDark ? "text-neutral-400 hover:text-white hover:bg-neutral-800" : "text-neutral-500 hover:text-black hover:bg-neutral-200"
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Stats Strip */}
        {comparison && (
          <div className={`px-4 py-2 border-b flex items-center justify-between text-xs font-mono shrink-0 ${
            isDark ? "bg-black border-neutral-800" : "bg-neutral-50/50 border-neutral-200"
          }`}>
            <div className="flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-blue-400" />
              <span>
                {comparison.stats.filesChanged} {comparison.stats.filesChanged === 1 ? "file" : "files"} changed
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-emerald-400 font-bold">+{comparison.stats.additions} additions</span>
              <span className="text-rose-400 font-bold">-{comparison.stats.deletions} deletions</span>
            </div>
          </div>
        )}

        {/* Body Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* File list */}
          <div className={`w-64 border-r flex flex-col shrink-0 ${
            isDark ? "bg-black/60 border-neutral-800" : "bg-neutral-50/50 border-neutral-200"
          }`}>
            <div className={`p-2.5 border-b text-[11px] font-bold uppercase tracking-wider ${
              isDark ? "text-neutral-400 border-neutral-800" : "text-neutral-500 border-neutral-200"
            }`}>
              Changed Files ({comparison?.files.length || 0})
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {!comparison || comparison.files.length === 0 ? (
                <div className={`p-6 text-center italic text-xs ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>
                  Branches are identical.
                </div>
              ) : (
                comparison.files.map((file) => {
                  const isSelected = selectedFile?.path === file.path;
                  return (
                    <button
                      key={file.path}
                      onClick={() => setSelectedFile(file)}
                      className={`w-full p-2 rounded-xl text-left text-xs flex items-center justify-between transition-all cursor-pointer ${
                        isSelected
                          ? isDark
                            ? "bg-blue-500/20 border border-blue-500/40 text-blue-300 font-semibold"
                            : "bg-blue-50 border border-blue-200 text-blue-900 font-semibold"
                          : isDark
                          ? "hover:bg-neutral-900 text-neutral-300 border border-transparent"
                          : "hover:bg-neutral-100 text-neutral-700 border border-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileIcon name={file.path.split("/").pop() || file.path} type="file" className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate font-mono text-[11px]">{file.path}</span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 font-mono text-[10px]">
                        {file.additions > 0 && <span className="text-emerald-400">+{file.additions}</span>}
                        {file.deletions > 0 && <span className="text-rose-400">-{file.deletions}</span>}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Monaco Diff Viewer */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {selectedFile ? (
              <DiffEditor
                height="100%"
                language={selectedFile.language || "typescript"}
                original={selectedFile.originalContent || ""}
                modified={selectedFile.modifiedContent || ""}
                theme={isDark ? "vs-dark" : "vs"}
                options={{
                  readOnly: true,
                  fontSize: 12,
                  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                }}
              />
            ) : (
              <div className={`flex-1 flex items-center justify-center italic text-xs ${
                isDark ? "text-neutral-500" : "text-neutral-400"
              }`}>
                No file selected for comparison.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
