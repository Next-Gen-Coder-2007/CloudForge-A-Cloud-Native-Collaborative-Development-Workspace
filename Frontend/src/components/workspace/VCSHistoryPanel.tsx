import React, { useState } from "react";
import {
  History,
  GitCommit as GitCommitIcon,
  RotateCcw,
  Clock,
  User,
  GitBranch,
} from "lucide-react";
import type { GitCommit, WorkspaceFile } from "../../types/workspace";
import { vcsService } from "../../services/vcsService";
import { useTheme } from "../../context/ThemeContext";

interface VCSHistoryPanelProps {
  projectId: string;
  commits: GitCommit[];
  currentBranch: string;
  onCommitSelected: (commit: GitCommit) => void;
  onRollbackComplete: (files: WorkspaceFile[], newCommit: GitCommit) => void;
}

export const VCSHistoryPanel: React.FC<VCSHistoryPanelProps> = ({
  projectId,
  commits,
  currentBranch,
  onCommitSelected,
  onRollbackComplete,
}) => {
  const { isDark } = useTheme();
  const [isRollingBack, setIsRollingBack] = useState<string | null>(null);

  const handleRollback = async (e: React.MouseEvent, commit: GitCommit) => {
    e.stopPropagation();
    const shortSha = commit.sha.substring(0, 7);
    if (
      !window.confirm(
        `Time Travel Rollback: Revert your entire workspace files to commit ${shortSha} ("${commit.message}")?`
      )
    ) {
      return;
    }

    try {
      setIsRollingBack(commit.sha);
      const res = await vcsService.rollbackCommit(projectId, commit.sha);
      onRollbackComplete(res.files, res.newCommit);
    } catch (err: any) {
      alert(err.message || "Failed to rollback commit");
    } finally {
      setIsRollingBack(null);
    }
  };

  return (
    <div className={`h-full flex flex-col select-none overflow-hidden font-sans transition-colors duration-150 ${
      isDark ? "bg-neutral-950 text-white" : "bg-white text-black"
    }`}>
      {/* Panel Header */}
      <div className={`p-3 border-b flex items-center justify-between shrink-0 ${
        isDark ? "bg-neutral-950 border-neutral-800" : "bg-neutral-50/70 border-neutral-200"
      }`}>
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-blue-500" />
          <span className={`font-bold text-xs uppercase tracking-wider ${isDark ? "text-white" : "text-black"}`}>
            Commit History & Timeline
          </span>
        </div>
        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md border font-semibold flex items-center gap-1 ${
          isDark
            ? "bg-blue-500/15 text-blue-400 border-blue-500/30"
            : "bg-blue-50 text-blue-700 border-blue-200"
        }`}>
          <GitBranch className="w-3 h-3" />
          {currentBranch}
        </span>
      </div>

      {/* Commit List Timeline */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {commits.length === 0 ? (
          <div className={`p-6 text-center italic ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>
            <GitCommitIcon className="w-8 h-8 opacity-40 mx-auto mb-2" />
            <p className="text-xs">No commits on this branch yet.</p>
          </div>
        ) : (
          <div className={`relative border-l-2 ml-3 space-y-3 pl-3.5 py-1 ${
            isDark ? "border-neutral-800" : "border-neutral-200"
          }`}>
            {commits.map((commit, idx) => {
              const isHead = idx === 0;
              const shortSha = commit.sha.substring(0, 7);
              const isBusy = isRollingBack === commit.sha;

              return (
                <div
                  key={commit.sha || commit._id}
                  onClick={() => onCommitSelected(commit)}
                  className={`group relative border rounded-xl p-3 shadow-2xs transition-all cursor-pointer ${
                    isDark
                      ? "bg-black border-neutral-800 hover:border-blue-500/50 hover:bg-neutral-900"
                      : "bg-white border-neutral-200 hover:border-blue-300 hover:shadow-md"
                  }`}
                >
                  {/* Timeline dot */}
                  <div
                    className={`absolute -left-[21px] top-4 w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
                      isHead
                        ? "bg-blue-600 ring-2 ring-blue-400 border-black"
                        : isDark
                        ? "bg-neutral-700 border-black"
                        : "bg-neutral-400 border-white"
                    }`}
                  />

                  {/* Header: Message & Hash */}
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <span className={`font-bold text-xs leading-snug break-words ${
                      isDark ? "text-white" : "text-black"
                    }`}>
                      {commit.message}
                    </span>
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border shrink-0 ${
                      isDark
                        ? "bg-blue-500/20 text-blue-300 border-blue-500/30"
                        : "bg-blue-50 text-blue-700 border-blue-100"
                    }`}>
                      {shortSha}
                    </span>
                  </div>

                  {/* Author & Time */}
                  <div className={`flex items-center gap-3 text-[11px] mb-2 ${isDark ? "text-neutral-400" : "text-neutral-500"}`}>
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3 opacity-70" />
                      {commit.author?.name || "Developer"}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1 text-[10px]">
                      <Clock className="w-3 h-3 opacity-70" />
                      {new Date(commit.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Actions & Stats Footer */}
                  <div className={`flex items-center justify-between pt-2 border-t text-[10px] ${
                    isDark ? "border-neutral-800" : "border-neutral-100"
                  }`}>
                    <div className="flex items-center gap-2">
                      {commit.changes && commit.changes.length > 0 && (
                        <span className={isDark ? "text-neutral-400" : "text-neutral-500"}>
                          {commit.changes.length} {commit.changes.length === 1 ? "file" : "files"}
                        </span>
                      )}
                      {commit.stats ? (
                        <span className="font-mono">
                          <span className="text-emerald-500 font-semibold">
                            +{commit.stats.additions || 0}
                          </span>{" "}
                          <span className="text-rose-400 font-semibold">
                            -{commit.stats.deletions || 0}
                          </span>
                        </span>
                      ) : null}
                    </div>

                    {!isHead && (
                      <button
                        onClick={(e) => handleRollback(e, commit)}
                        disabled={isBusy}
                        className={`px-2 py-0.5 rounded font-medium transition-colors flex items-center gap-1 opacity-0 group-hover:opacity-100 cursor-pointer ${
                          isDark
                            ? "bg-neutral-800 hover:bg-blue-600 text-neutral-200 hover:text-white"
                            : "bg-neutral-100 hover:bg-blue-50 text-neutral-600 hover:text-blue-700"
                        }`}
                        title="Revert entire workspace to this commit"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Rollback</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
