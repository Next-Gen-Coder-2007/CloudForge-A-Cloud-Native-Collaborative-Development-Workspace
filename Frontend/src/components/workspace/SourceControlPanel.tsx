import React, { useState } from "react";
import {
  GitBranch,
  Check,
  Plus,
  Minus,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  Archive,
  GitCompare,
  Trash2,
  FileText,
} from "lucide-react";
import { FileIcon } from "./FileIcon";
import { type WorkspaceFile } from "../../types/workspace";
import { type Project } from "../../types/project";
import { useTheme } from "../../context/ThemeContext";

interface SourceControlPanelProps {
  project: Project;
  changedFiles: {
    file: WorkspaceFile;
    status: "modified" | "added" | "deleted";
    staged: boolean;
  }[];
  currentBranch: string;
  branches: string[];
  onCommit: (message: string, stagedOnly: boolean) => Promise<void>;
  onStageFile: (fileId: string) => void;
  onUnstageFile: (fileId: string) => void;
  onStageAll: () => void;
  onUnstageAll: () => void;
  onDiscardChange: (fileId: string) => void;
  onDiscardAll: () => void;
  onInspectDiff: (file: WorkspaceFile) => void;
  onOpenBranchManager: () => void;
  onOpenStashModal: () => void;
  onOpenCompareModal: () => void;
  onOpenFileBlame?: (filePath: string, fileName: string) => void;
}

const COMMIT_PREFIXES = [
  { label: "feat", prefix: "feat: " },
  { label: "fix", prefix: "fix: " },
  { label: "docs", prefix: "docs: " },
  { label: "refactor", prefix: "refactor: " },
  { label: "chore", prefix: "chore: " },
];

export const SourceControlPanel: React.FC<SourceControlPanelProps> = ({
  changedFiles,
  currentBranch,
  onCommit,
  onStageFile,
  onUnstageFile,
  onStageAll,
  onUnstageAll,
  onDiscardChange,
  onDiscardAll,
  onInspectDiff,
  onOpenBranchManager,
  onOpenStashModal,
  onOpenCompareModal,
  onOpenFileBlame,
}) => {
  const { isDark } = useTheme();
  const [commitMessage, setCommitMessage] = useState("");
  const [isCommitting, setIsCommitting] = useState(false);
  const [isStagedCollapsed, setIsStagedCollapsed] = useState(false);
  const [isChangesCollapsed, setIsChangesCollapsed] = useState(false);

  const stagedChanges = changedFiles.filter((c) => c.staged);
  const unstagedChanges = changedFiles.filter((c) => !c.staged);

  const handleCommitSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!commitMessage.trim()) return;

    try {
      setIsCommitting(true);
      const stagedOnly = stagedChanges.length > 0;
      await onCommit(commitMessage.trim(), stagedOnly);
      setCommitMessage("");
    } finally {
      setIsCommitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleCommitSubmit();
    }
  };

  const handleApplyPrefix = (prefix: string) => {
    if (commitMessage.startsWith(prefix)) return;
    const cleanMsg = commitMessage.replace(/^[a-z]+:\s*/i, "");
    setCommitMessage(`${prefix}${cleanMsg}`);
  };

  return (
    <div className={`h-full flex flex-col select-none overflow-hidden text-xs font-sans transition-colors duration-150 ${
      isDark ? "bg-neutral-950 text-neutral-200" : "bg-neutral-50 text-neutral-800"
    }`}>
      {/* Compact Header Bar */}
      <div className={`px-2.5 py-2 border-b flex items-center justify-between gap-1.5 shrink-0 ${
        isDark ? "bg-neutral-950 border-neutral-800" : "bg-white border-neutral-200"
      }`}>
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span className={`font-bold text-[11px] uppercase tracking-wider truncate ${
            isDark ? "text-neutral-400" : "text-neutral-500"
          }`}>
            Source Control
          </span>
          {changedFiles.length > 0 && (
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold shrink-0 ${
              isDark ? "bg-blue-500/20 text-blue-400" : "bg-blue-100 text-blue-700"
            }`}>
              {changedFiles.length}
            </span>
          )}
        </div>

        {/* Compact Action Icons */}
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={onOpenCompareModal}
            className={`p-1 rounded-md transition-colors cursor-pointer ${
              isDark ? "hover:bg-neutral-800 text-neutral-400 hover:text-white" : "hover:bg-neutral-200 text-neutral-600 hover:text-black"
            }`}
            title="Compare Branches / Commits"
          >
            <GitCompare className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onOpenStashModal}
            className={`p-1 rounded-md transition-colors cursor-pointer ${
              isDark ? "hover:bg-neutral-800 text-purple-400 hover:text-purple-300" : "hover:bg-purple-100 text-purple-600"
            }`}
            title="Git Stash & Shelving"
          >
            <Archive className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onOpenBranchManager}
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[11px] font-semibold transition-all cursor-pointer max-w-[110px] ${
              isDark
                ? "bg-neutral-900 border-neutral-800 text-blue-400 hover:bg-neutral-800 hover:text-blue-300"
                : "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
            }`}
            title="Branch Manager"
          >
            <GitBranch className="w-3 h-3 shrink-0" />
            <span className="truncate">{currentBranch}</span>
          </button>
        </div>
      </div>

      {/* Compact Commit Form */}
      <div className={`p-2 border-b shrink-0 space-y-1.5 ${
        isDark ? "bg-black/70 border-neutral-800" : "bg-white border-neutral-200"
      }`}>
        {/* Quick Conventional Prefix Pills */}
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar">
          {COMMIT_PREFIXES.map(({ label, prefix }) => (
            <button
              key={label}
              type="button"
              onClick={() => handleApplyPrefix(prefix)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono border transition-all cursor-pointer shrink-0 ${
                commitMessage.startsWith(prefix)
                  ? "bg-blue-600 border-blue-600 text-white font-bold"
                  : isDark
                  ? "bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700"
                  : "bg-neutral-100 border-neutral-200 text-neutral-600 hover:text-black"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <form onSubmit={handleCommitSubmit} className="space-y-1.5">
          <textarea
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Commit message (Ctrl+Enter)..."
            rows={2}
            className={`w-full p-2 text-[11px] border rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none font-sans leading-tight ${
              isDark
                ? "bg-neutral-900 border-neutral-800 text-white placeholder-neutral-500"
                : "bg-neutral-50 border-neutral-300 text-black placeholder-neutral-400"
            }`}
          />

          <button
            type="submit"
            disabled={
              isCommitting ||
              !commitMessage.trim() ||
              changedFiles.length === 0
            }
            className="w-full py-1.5 px-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-semibold text-[11px] flex items-center justify-center gap-1 shadow-xs transition-all active:scale-98 cursor-pointer"
          >
            <Check className="w-3 h-3 shrink-0" />
            <span className="truncate">
              {stagedChanges.length > 0
                ? `Commit Staged (${stagedChanges.length})`
                : `Commit (${changedFiles.length})`}
            </span>
          </button>
        </form>
      </div>

      {/* Changes & Staging Lists (Optimized for Small Widths) */}
      <div className="flex-1 overflow-y-auto p-1.5 space-y-2">
        {/* Section 1: Staged Changes */}
        <div>
          <div
            onClick={() => setIsStagedCollapsed(!isStagedCollapsed)}
            className={`flex items-center justify-between px-1.5 py-1 text-[10px] font-bold uppercase tracking-wider cursor-pointer rounded-md transition-colors ${
              isDark ? "text-neutral-400 hover:text-white hover:bg-neutral-900" : "text-neutral-500 hover:text-black hover:bg-neutral-200/60"
            }`}
          >
            <div className="flex items-center gap-1 min-w-0">
              {isStagedCollapsed ? (
                <ChevronRight className="w-3 h-3 shrink-0" />
              ) : (
                <ChevronDown className="w-3 h-3 shrink-0" />
              )}
              <span className="truncate">Staged Changes</span>
              <span className={`ml-1 px-1 py-0.2 rounded-full text-[9px] font-mono ${
                isDark ? "bg-blue-500/20 text-blue-400" : "bg-blue-100 text-blue-700"
              }`}>
                {stagedChanges.length}
              </span>
            </div>

            {stagedChanges.length > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onUnstageAll();
                }}
                className={`p-0.5 rounded cursor-pointer ${isDark ? "hover:bg-neutral-800 text-neutral-400 hover:text-white" : "hover:bg-neutral-200 text-neutral-500 hover:text-black"}`}
                title="Unstage all"
              >
                <Minus className="w-3 h-3" />
              </button>
            )}
          </div>

          {!isStagedCollapsed && (
            <div className="mt-0.5 space-y-0.5">
              {stagedChanges.length === 0 ? (
                <div className={`px-2 py-1 text-[10px] italic ${isDark ? "text-neutral-600" : "text-neutral-400"}`}>
                  No staged files
                </div>
              ) : (
                stagedChanges.map(({ file, status }) => {
                  const parts = file.path.split("/");
                  const filename = parts.pop() || file.name;
                  const dir = parts.join("/");

                  return (
                    <div
                      key={file._id}
                      onClick={() => onInspectDiff(file)}
                      className={`group px-2 py-1 rounded-md flex items-center justify-between text-xs cursor-pointer transition-colors ${
                        isDark ? "hover:bg-neutral-900 text-neutral-200" : "hover:bg-neutral-200/70 text-neutral-800"
                      }`}
                    >
                      {/* Left: icon & compact file path */}
                      <div className="flex items-center gap-1.5 min-w-0 flex-1 pr-1">
                        <FileIcon name={filename} type="file" className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate text-[11px] font-mono font-medium">{filename}</span>
                        {dir && (
                          <span className={`text-[10px] truncate opacity-40 font-mono hidden sm:inline`}>
                            {dir}
                          </span>
                        )}
                      </div>

                      {/* Right: status badge & hover buttons */}
                      <div className="flex items-center gap-1 shrink-0">
                        <span
                          className={`text-[9px] font-mono font-bold w-4 h-4 rounded flex items-center justify-center ${
                            status === "added"
                              ? "bg-emerald-500/20 text-emerald-400"
                              : status === "deleted"
                              ? "bg-rose-500/20 text-rose-400"
                              : "bg-blue-500/20 text-blue-400"
                          }`}
                        >
                          {status === "added" ? "A" : status === "deleted" ? "D" : "M"}
                        </span>

                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          {onOpenFileBlame && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenFileBlame(file.path, file.name);
                              }}
                              className={`p-0.5 rounded cursor-pointer ${
                                isDark ? "hover:bg-neutral-800 text-neutral-400 hover:text-white" : "hover:bg-neutral-200 text-neutral-500 hover:text-black"
                              }`}
                              title="File Blame & History"
                            >
                              <FileText className="w-3 h-3 text-purple-400" />
                            </button>
                          )}

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onUnstageFile(file._id);
                            }}
                            className={`p-0.5 rounded cursor-pointer ${
                              isDark ? "hover:bg-neutral-800 text-neutral-400 hover:text-white" : "hover:bg-neutral-200 text-neutral-500 hover:text-black"
                            }`}
                            title="Unstage change"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Section 2: Working Tree Changes */}
        <div>
          <div
            onClick={() => setIsChangesCollapsed(!isChangesCollapsed)}
            className={`flex items-center justify-between px-1.5 py-1 text-[10px] font-bold uppercase tracking-wider cursor-pointer rounded-md transition-colors ${
              isDark ? "text-neutral-400 hover:text-white hover:bg-neutral-900" : "text-neutral-500 hover:text-black hover:bg-neutral-200/60"
            }`}
          >
            <div className="flex items-center gap-1 min-w-0">
              {isChangesCollapsed ? (
                <ChevronRight className="w-3 h-3 shrink-0" />
              ) : (
                <ChevronDown className="w-3 h-3 shrink-0" />
              )}
              <span className="truncate">Changes</span>
              <span className={`ml-1 px-1 py-0.2 rounded-full text-[9px] font-mono ${
                isDark ? "bg-neutral-800 text-neutral-300" : "bg-neutral-200 text-neutral-700"
              }`}>
                {unstagedChanges.length}
              </span>
            </div>

            {unstagedChanges.length > 0 && (
              <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={onDiscardAll}
                  className={`p-0.5 rounded cursor-pointer ${isDark ? "hover:bg-rose-500/20 text-neutral-400 hover:text-rose-400" : "hover:bg-rose-100 text-neutral-500 hover:text-rose-600"}`}
                  title="Discard all changes"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
                <button
                  onClick={onStageAll}
                  className={`p-0.5 rounded cursor-pointer ${isDark ? "hover:bg-neutral-800 text-neutral-400 hover:text-white" : "hover:bg-neutral-200 text-neutral-500 hover:text-black"}`}
                  title="Stage all changes"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          {!isChangesCollapsed && (
            <div className="mt-0.5 space-y-0.5">
              {unstagedChanges.length === 0 ? (
                <div className={`px-2 py-1 text-[10px] italic ${isDark ? "text-neutral-600" : "text-neutral-400"}`}>
                  Working tree clean
                </div>
              ) : (
                unstagedChanges.map(({ file, status }) => {
                  const parts = file.path.split("/");
                  const filename = parts.pop() || file.name;
                  const dir = parts.join("/");

                  return (
                    <div
                      key={file._id}
                      onClick={() => onInspectDiff(file)}
                      className={`group px-2 py-1 rounded-md flex items-center justify-between text-xs cursor-pointer transition-colors ${
                        isDark ? "hover:bg-neutral-900 text-neutral-200" : "hover:bg-neutral-200/70 text-neutral-800"
                      }`}
                    >
                      {/* Left: icon & compact file path */}
                      <div className="flex items-center gap-1.5 min-w-0 flex-1 pr-1">
                        <FileIcon name={filename} type="file" className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate text-[11px] font-mono font-medium">{filename}</span>
                        {dir && (
                          <span className={`text-[10px] truncate opacity-40 font-mono hidden sm:inline`}>
                            {dir}
                          </span>
                        )}
                      </div>

                      {/* Right: status badge & hover buttons */}
                      <div className="flex items-center gap-1 shrink-0">
                        <span
                          className={`text-[9px] font-mono font-bold w-4 h-4 rounded flex items-center justify-center ${
                            status === "added"
                              ? "bg-emerald-500/20 text-emerald-400"
                              : status === "deleted"
                              ? "bg-rose-500/20 text-rose-400"
                              : "bg-blue-500/20 text-blue-400"
                          }`}
                        >
                          {status === "added" ? "A" : status === "deleted" ? "D" : "M"}
                        </span>

                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          {onOpenFileBlame && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenFileBlame(file.path, file.name);
                              }}
                              className={`p-0.5 rounded cursor-pointer ${
                                isDark ? "hover:bg-neutral-800 text-neutral-400 hover:text-white" : "hover:bg-neutral-200 text-neutral-500 hover:text-black"
                              }`}
                              title="File Blame & History"
                            >
                              <FileText className="w-3 h-3 text-purple-400" />
                            </button>
                          )}

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDiscardChange(file._id);
                            }}
                            className="p-0.5 rounded hover:bg-rose-500/20 text-neutral-400 hover:text-rose-400 cursor-pointer"
                            title="Discard changes"
                          >
                            <RotateCcw className="w-3 h-3" />
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onStageFile(file._id);
                            }}
                            className={`p-0.5 rounded cursor-pointer ${
                              isDark ? "hover:bg-neutral-800 text-neutral-400 hover:text-white" : "hover:bg-neutral-200 text-neutral-500 hover:text-black"
                            }`}
                            title="Stage change"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
