import React, { useState } from "react";
import Editor from "@monaco-editor/react";
import {
  AlertTriangle,
  CheckCircle2,
  X,
  ArrowRight,
  Sparkles,
  Check,
  FileCode,
} from "lucide-react";
import { FileIcon } from "./FileIcon";
import { useTheme } from "../../context/ThemeContext";
import type { ConflictFile } from "../../types/workspace";

interface ConflictResolverModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceBranch: string;
  targetBranch: string;
  conflictFiles: ConflictFile[];
  onFinalizeMerge: (resolvedFiles: { path: string; name: string; content: string; language: string }[]) => Promise<void>;
}

export const ConflictResolverModal: React.FC<ConflictResolverModalProps> = ({
  isOpen,
  onClose,
  sourceBranch,
  targetBranch,
  conflictFiles: initialConflictFiles,
  onFinalizeMerge,
}) => {
  const { isDark } = useTheme();
  const [files, setFiles] = useState<ConflictFile[]>(() =>
    initialConflictFiles.map((f) => ({
      ...f,
      resolvedContent: f.currentContent || f.conflictedContent,
      isResolved: false,
    }))
  );
  const [selectedFileIdx, setSelectedFileIdx] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || files.length === 0) return null;

  const currentFile = files[selectedFileIdx] || files[0];
  const allResolved = files.every((f) => f.isResolved);

  const handleUpdateContent = (newContent: string) => {
    setFiles((prev) =>
      prev.map((f, idx) =>
        idx === selectedFileIdx
          ? { ...f, resolvedContent: newContent }
          : f
      )
    );
  };

  const handleAcceptCurrent = () => {
    handleUpdateContent(currentFile.currentContent);
  };

  const handleAcceptIncoming = () => {
    handleUpdateContent(currentFile.incomingContent);
  };

  const handleAcceptBoth = () => {
    const combined = `${currentFile.currentContent}\n\n// --- Merged from ${sourceBranch} ---\n${currentFile.incomingContent}`;
    handleUpdateContent(combined);
  };

  const handleToggleResolved = () => {
    setFiles((prev) =>
      prev.map((f, idx) =>
        idx === selectedFileIdx ? { ...f, isResolved: !f.isResolved } : f
      )
    );
  };

  const handleCompleteMerge = async () => {
    if (!allResolved) {
      if (!window.confirm("Some files are not marked as resolved yet. Proceed with current contents?")) {
        return;
      }
    }

    try {
      setIsSubmitting(true);
      const payload = files.map((f) => ({
        path: f.path,
        name: f.name,
        content: f.resolvedContent || f.currentContent || "",
        language: f.language || "plaintext",
      }));
      await onFinalizeMerge(payload);
      onClose();
    } catch (err: any) {
      alert(err.message || "Failed to finalize merge resolution");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-xs select-none">
      <div className={`w-full max-w-6xl h-[92vh] rounded-2xl border shadow-2xl overflow-hidden flex flex-col font-sans transition-colors duration-150 ${
        isDark ? "bg-neutral-950 border-neutral-800 text-white" : "bg-white border-neutral-200 text-black"
      }`}>
        {/* Header */}
        <div className={`px-4 py-3 border-b flex items-center justify-between shrink-0 ${
          isDark ? "bg-neutral-900/90 border-neutral-800" : "bg-neutral-50 border-neutral-200"
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm">3-Way Merge Conflict Resolver</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  {files.filter((f) => !f.isResolved).length} unresolved
                </span>
              </div>
              <p className={`text-[11px] flex items-center gap-1.5 mt-0.5 ${isDark ? "text-neutral-400" : "text-neutral-500"}`}>
                <span>Merging</span>
                <span className="font-mono font-semibold text-blue-400">{sourceBranch}</span>
                <ArrowRight className="w-3 h-3" />
                <span className="font-mono font-semibold text-emerald-400">{targetBranch}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCompleteMerge}
              disabled={isSubmitting}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-md transition-all cursor-pointer ${
                allResolved
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : "bg-blue-600 hover:bg-blue-700 text-white"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isSubmitting ? "Finalizing Merge..." : "Complete & Finalize Merge"}</span>
            </button>
            <button
              onClick={onClose}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                isDark ? "text-neutral-400 hover:text-white hover:bg-neutral-800" : "text-neutral-500 hover:text-black hover:bg-neutral-200"
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Workspace Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Conflicted Files List */}
          <div className={`w-64 border-r flex flex-col shrink-0 ${
            isDark ? "bg-black/60 border-neutral-800" : "bg-neutral-50/50 border-neutral-200"
          }`}>
            <div className={`p-2.5 border-b text-[11px] font-bold uppercase tracking-wider ${
              isDark ? "text-neutral-400 border-neutral-800" : "text-neutral-500 border-neutral-200"
            }`}>
              Conflicted Files ({files.length})
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {files.map((file, idx) => {
                const isSelected = idx === selectedFileIdx;
                return (
                  <button
                    key={file.path}
                    onClick={() => setSelectedFileIdx(idx)}
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
                      <FileIcon name={file.name} type="file" className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate font-mono text-[11px]">{file.path}</span>
                    </div>

                    {file.isResolved ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: 3-Way Resolution Area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Resolution Action Toolbar */}
            <div className={`p-2.5 border-b flex flex-wrap items-center justify-between gap-2 shrink-0 ${
              isDark ? "bg-neutral-900/60 border-neutral-800" : "bg-white border-neutral-200"
            }`}>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-semibold text-blue-400 flex items-center gap-1.5">
                  <FileCode className="w-3.5 h-3.5" />
                  {currentFile.path}
                </span>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap text-xs">
                <button
                  onClick={handleAcceptCurrent}
                  className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                    isDark
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
                      : "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                  }`}
                  title={`Accept Current version from ${targetBranch}`}
                >
                  <span>Accept Current ({targetBranch})</span>
                </button>

                <button
                  onClick={handleAcceptIncoming}
                  className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                    isDark
                      ? "bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20"
                      : "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                  }`}
                  title={`Accept Incoming version from ${sourceBranch}`}
                >
                  <span>Accept Incoming ({sourceBranch})</span>
                </button>

                <button
                  onClick={handleAcceptBoth}
                  className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                    isDark
                      ? "bg-purple-500/10 border-purple-500/30 text-purple-400 hover:bg-purple-500/20"
                      : "bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100"
                  }`}
                  title="Combine both Current and Incoming blocks"
                >
                  <span>Accept Both</span>
                </button>

                <button
                  onClick={handleToggleResolved}
                  className={`px-3 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 shadow-sm transition-all cursor-pointer ${
                    currentFile.isResolved
                      ? "bg-emerald-600 text-white"
                      : isDark
                      ? "bg-neutral-800 hover:bg-neutral-700 text-neutral-200"
                      : "bg-neutral-200 hover:bg-neutral-300 text-neutral-800"
                  }`}
                >
                  {currentFile.isResolved ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Resolved</span>
                    </>
                  ) : (
                    <span>Mark as Resolved</span>
                  )}
                </button>
              </div>
            </div>

            {/* Split Views: Top = Incoming vs Current Reference, Bottom = Interactive Resolution Editor */}
            <div className="flex-1 grid grid-rows-2 overflow-hidden">
              {/* Top Reference: Current vs Incoming comparison */}
              <div className="grid grid-cols-2 border-b overflow-hidden">
                {/* Current Reference */}
                <div className={`border-r flex flex-col overflow-hidden ${
                  isDark ? "bg-black/80 border-neutral-800" : "bg-neutral-50/70 border-neutral-200"
                }`}>
                  <div className={`px-3 py-1.5 border-b text-[10px] font-bold uppercase tracking-wider flex items-center justify-between ${
                    isDark ? "text-emerald-400 bg-emerald-500/10 border-neutral-800" : "text-emerald-700 bg-emerald-50 border-neutral-200"
                  }`}>
                    <span>Current Branch ({targetBranch})</span>
                  </div>
                  <div className="flex-1 overflow-auto p-2 font-mono text-xs whitespace-pre select-text">
                    {currentFile.currentContent || "(Empty or deleted)"}
                  </div>
                </div>

                {/* Incoming Reference */}
                <div className={`flex flex-col overflow-hidden ${
                  isDark ? "bg-black/80" : "bg-neutral-50/70"
                }`}>
                  <div className={`px-3 py-1.5 border-b text-[10px] font-bold uppercase tracking-wider flex items-center justify-between ${
                    isDark ? "text-blue-400 bg-blue-500/10 border-neutral-800" : "text-blue-700 bg-blue-50 border-neutral-200"
                  }`}>
                    <span>Incoming Branch ({sourceBranch})</span>
                  </div>
                  <div className="flex-1 overflow-auto p-2 font-mono text-xs whitespace-pre select-text">
                    {currentFile.incomingContent || "(Empty or deleted)"}
                  </div>
                </div>
              </div>

              {/* Bottom: Interactive Output Editor */}
              <div className="flex flex-col overflow-hidden">
                <div className={`px-3 py-1.5 border-b text-[10px] font-bold uppercase tracking-wider flex items-center justify-between ${
                  isDark ? "bg-neutral-900 text-neutral-300 border-neutral-800" : "bg-neutral-100 text-neutral-700 border-neutral-200"
                }`}>
                  <span>Resolved Result (Editable)</span>
                  <span className="text-[10px] opacity-60">Edit directly or use the quick buttons above</span>
                </div>
                <div className="flex-1 overflow-hidden">
                  <Editor
                    height="100%"
                    language={currentFile.language || "javascript"}
                    value={currentFile.resolvedContent || ""}
                    onChange={(val) => handleUpdateContent(val || "")}
                    theme={isDark ? "vs-dark" : "vs"}
                    options={{
                      fontSize: 12,
                      minimap: { enabled: false },
                      scrollBeyondLastLine: false,
                      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
