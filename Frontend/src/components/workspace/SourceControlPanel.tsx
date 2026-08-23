import React, { useState } from "react";
import {
  GitBranch,
  Check,
  Plus,
  Minus,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  GitMerge,
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
  onInspectDiff: (file: WorkspaceFile) => void;
  onOpenBranchManager: () => void;
}

export const SourceControlPanel: React.FC<SourceControlPanelProps> = ({
  changedFiles,
  currentBranch,
  onCommit,
  onStageFile,
  onUnstageFile,
  onStageAll,
  onUnstageAll,
  onDiscardChange,
  onInspectDiff,
  onOpenBranchManager,
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

  return (
    <div className={`h-full flex flex-col select-none overflow-hidden text-xs font-sans transition-colors duration-150 ${
      isDark ? "bg-neutral-950 text-white" : "bg-neutral-50/70 text-black"
    }`}>
      {/* Top Header */}
      <div className={`p-3 border-b flex items-center justify-between shrink-0 ${
        isDark ? "bg-neutral-950 border-neutral-800" : "bg-white border-neutral-200"
      }`}>
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`font-bold text-xs uppercase tracking-wider ${isDark ? "text-neutral-400" : "text-neutral-500"}`}>
            Source Control
          </span>
        </div>

        <button
          onClick={onOpenBranchManager}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
            isDark
              ? "bg-neutral-900 border-neutral-800 text-blue-400 hover:bg-neutral-800"
              : "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
          }`}
          title="Manage Branches"
        >
          <GitBranch className="w-3.5 h-3.5" />
          <span className="truncate max-w-[90px]">{currentBranch}</span>
          <GitMerge className="w-3 h-3 opacity-60 ml-0.5" />
        </button>
      </div>

      {/* Commit Input Box */}
      <div className={`p-3 border-b shrink-0 ${
        isDark ? "bg-black border-neutral-800" : "bg-white border-neutral-200"
      }`}>
        <form onSubmit={handleCommitSubmit} className="space-y-2">
          <textarea
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message (Ctrl+Enter to commit)..."
            rows={3}
            className={`w-full p-2 text-xs border rounded-xl outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none font-sans ${
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
            className="w-full py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-98 cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" />
            <span>
              Commit to <strong>{currentBranch}</strong>
            </span>
          </button>
        </form>
      </div>

      {/* Changes & Staging File Lists */}
      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {/* Section 1: Staged Changes */}
        <div>
          <div
            onClick={() => setIsStagedCollapsed(!isStagedCollapsed)}
            className={`flex items-center justify-between px-2 py-1 text-[11px] font-bold uppercase tracking-wider cursor-pointer rounded-lg ${
              isDark ? "text-neutral-400 hover:text-white hover:bg-neutral-900" : "text-neutral-500 hover:text-black hover:bg-neutral-200"
            }`}
          >
            <div className="flex items-center gap-1">
              {isStagedCollapsed ? (
                <ChevronRight className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
              <span>Staged Changes</span>
              <span className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] ${
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
                title="Unstage all files"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {!isStagedCollapsed && (
            <div className="mt-1 space-y-0.5">
              {stagedChanges.length === 0 ? (
                <div className={`px-3 py-1.5 text-[11px] italic ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>
                  No staged changes
                </div>
              ) : (
                stagedChanges.map(({ file, status }) => (
                  <div
                    key={file._id}
                    onClick={() => onInspectDiff(file)}
                    className={`group px-2.5 py-1.5 rounded-lg flex items-center justify-between text-xs cursor-pointer transition-colors ${
                      isDark ? "hover:bg-neutral-900 text-neutral-200" : "hover:bg-neutral-200/70 text-neutral-800"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileIcon name={file.name} type="file" className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate font-mono text-[11px]">{file.path}</span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded ${
                          status === "added"
                            ? "bg-emerald-500/20 text-emerald-400"
                            : status === "deleted"
                            ? "bg-rose-500/20 text-rose-400"
                            : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                        }`}
                      >
                        {status === "added" ? "A" : status === "deleted" ? "D" : "M"}
                      </span>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onUnstageFile(file._id);
                        }}
                        className={`p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer ${
                          isDark ? "hover:bg-neutral-800 text-neutral-400 hover:text-white" : "hover:bg-neutral-200 text-neutral-500 hover:text-black"
                        }`}
                        title="Unstage change"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Section 2: Working Tree Changes */}
        <div>
          <div
            onClick={() => setIsChangesCollapsed(!isChangesCollapsed)}
            className={`flex items-center justify-between px-2 py-1 text-[11px] font-bold uppercase tracking-wider cursor-pointer rounded-lg ${
              isDark ? "text-neutral-400 hover:text-white hover:bg-neutral-900" : "text-neutral-500 hover:text-black hover:bg-neutral-200"
            }`}
          >
            <div className="flex items-center gap-1">
              {isChangesCollapsed ? (
                <ChevronRight className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
              <span>Changes</span>
              <span className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] ${
                isDark ? "bg-neutral-800 text-neutral-300" : "bg-neutral-200 text-neutral-700"
              }`}>
                {unstagedChanges.length}
              </span>
            </div>

            {unstagedChanges.length > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onStageAll();
                }}
                className={`p-0.5 rounded cursor-pointer ${isDark ? "hover:bg-neutral-800 text-neutral-400 hover:text-white" : "hover:bg-neutral-200 text-neutral-500 hover:text-black"}`}
                title="Stage all changes"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {!isChangesCollapsed && (
            <div className="mt-1 space-y-0.5">
              {unstagedChanges.length === 0 ? (
                <div className={`px-3 py-1.5 text-[11px] italic ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>
                  Working tree clean
                </div>
              ) : (
                unstagedChanges.map(({ file, status }) => (
                  <div
                    key={file._id}
                    onClick={() => onInspectDiff(file)}
                    className={`group px-2.5 py-1.5 rounded-lg flex items-center justify-between text-xs cursor-pointer transition-colors ${
                      isDark ? "hover:bg-neutral-900 text-neutral-200" : "hover:bg-neutral-200/70 text-neutral-800"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileIcon name={file.name} type="file" className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate font-mono text-[11px]">{file.path}</span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <span
                        className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded ${
                          status === "added"
                            ? "bg-emerald-500/20 text-emerald-400"
                            : status === "deleted"
                            ? "bg-rose-500/20 text-rose-400"
                            : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                        }`}
                      >
                        {status === "added" ? "A" : status === "deleted" ? "D" : "M"}
                      </span>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDiscardChange(file._id);
                        }}
                        className="p-1 rounded hover:bg-rose-500/20 text-neutral-400 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        title="Discard changes"
                      >
                        <RotateCcw className="w-3 h-3" />
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onStageFile(file._id);
                        }}
                        className={`p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer ${
                          isDark ? "hover:bg-neutral-800 text-neutral-400 hover:text-white" : "hover:bg-neutral-200 text-neutral-500 hover:text-black"
                        }`}
                        title="Stage change"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
