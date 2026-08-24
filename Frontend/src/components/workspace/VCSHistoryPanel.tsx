import React, { useState, useMemo } from "react";
import {
  History,
  GitCommit as GitCommitIcon,
  RotateCcw,
  GitBranch,
  Search,
  Tag,
  GitPullRequest,
  Sparkles,
  Layers,
  List,
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
  onCherryPickComplete?: (files: WorkspaceFile[], newCommit: GitCommit) => void;
  onRevertComplete?: (files: WorkspaceFile[], newCommit: GitCommit) => void;
}

export const VCSHistoryPanel: React.FC<VCSHistoryPanelProps> = ({
  projectId,
  commits,
  currentBranch,
  onCommitSelected,
  onRollbackComplete,
  onCherryPickComplete,
  onRevertComplete,
}) => {
  const { isDark } = useTheme();
  const [viewMode, setViewMode] = useState<"timeline" | "dag">("timeline");
  const [searchQuery, setSearchQuery] = useState("");
  const [isProcessingSha, setIsProcessingSha] = useState<string | null>(null);

  const filteredCommits = useMemo(() => {
    if (!searchQuery.trim()) return commits;
    const q = searchQuery.toLowerCase();
    return commits.filter(
      (c) =>
        c.message.toLowerCase().includes(q) ||
        c.sha.toLowerCase().includes(q) ||
        c.author?.name?.toLowerCase().includes(q) ||
        c.tags?.some((t) => t.toLowerCase().includes(q))
    );
  }, [commits, searchQuery]);

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
      setIsProcessingSha(commit.sha);
      const res = await vcsService.rollbackCommit(projectId, commit.sha);
      onRollbackComplete(res.files, res.newCommit);
    } catch (err: any) {
      alert(err.message || "Failed to rollback commit");
    } finally {
      setIsProcessingSha(null);
    }
  };

  const handleCherryPick = async (e: React.MouseEvent, commit: GitCommit) => {
    e.stopPropagation();
    if (!window.confirm(`Cherry-pick commit ${commit.sha.substring(0, 7)} onto current branch '${currentBranch}'?`)) {
      return;
    }

    try {
      setIsProcessingSha(commit.sha);
      const res = await vcsService.cherryPickCommit(projectId, commit.sha, currentBranch);
      if (onCherryPickComplete) {
        onCherryPickComplete(res.files, res.cherryPickCommit);
      }
    } catch (err: any) {
      alert(err.message || "Failed to cherry-pick commit");
    } finally {
      setIsProcessingSha(null);
    }
  };

  const handleRevert = async (e: React.MouseEvent, commit: GitCommit) => {
    e.stopPropagation();
    if (!window.confirm(`Revert the changes introduced in commit ${commit.sha.substring(0, 7)}?`)) {
      return;
    }

    try {
      setIsProcessingSha(commit.sha);
      const res = await vcsService.revertCommit(projectId, commit.sha, currentBranch);
      if (onRevertComplete) {
        onRevertComplete(res.files, res.revertedCommit);
      }
    } catch (err: any) {
      alert(err.message || "Failed to revert commit");
    } finally {
      setIsProcessingSha(null);
    }
  };

  return (
    <div className={`h-full flex flex-col select-none overflow-hidden text-xs font-sans transition-colors duration-150 ${
      isDark ? "bg-neutral-950 text-neutral-200" : "bg-neutral-50 text-neutral-800"
    }`}>
      {/* Header */}
      <div className={`px-2.5 py-2 border-b flex items-center justify-between gap-1.5 shrink-0 ${
        isDark ? "bg-neutral-950 border-neutral-800" : "bg-white border-neutral-200"
      }`}>
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <History className="w-3.5 h-3.5 text-blue-500 shrink-0" />
          <span className={`font-bold text-[11px] uppercase tracking-wider truncate ${
            isDark ? "text-neutral-400" : "text-neutral-500"
          }`}>
            History
          </span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold shrink-0 ${
            isDark ? "bg-blue-500/20 text-blue-400" : "bg-blue-100 text-blue-700"
          }`}>
            {commits.length}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* View mode toggle */}
          <div className={`flex items-center p-0.5 rounded-md border text-[10px] ${
            isDark ? "bg-black border-neutral-800" : "bg-neutral-200/60 border-neutral-300"
          }`}>
            <button
              onClick={() => setViewMode("timeline")}
              className={`p-1 rounded transition-all cursor-pointer ${
                viewMode === "timeline"
                  ? isDark
                    ? "bg-neutral-800 text-blue-400 shadow-xs"
                    : "bg-white text-blue-600 shadow-xs"
                  : "opacity-60 hover:opacity-100"
              }`}
              title="Timeline View"
            >
              <List className="w-3 h-3" />
            </button>
            <button
              onClick={() => setViewMode("dag")}
              className={`p-1 rounded transition-all cursor-pointer ${
                viewMode === "dag"
                  ? isDark
                    ? "bg-neutral-800 text-blue-400 shadow-xs"
                    : "bg-white text-blue-600 shadow-xs"
                  : "opacity-60 hover:opacity-100"
              }`}
              title="Visual DAG Graph View"
            >
              <Layers className="w-3 h-3" />
            </button>
          </div>

          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border font-semibold flex items-center gap-1 max-w-[90px] truncate ${
            isDark
              ? "bg-blue-500/15 text-blue-400 border-blue-500/30"
              : "bg-blue-50 text-blue-700 border-blue-200"
          }`}>
            <GitBranch className="w-3 h-3 shrink-0" />
            <span className="truncate">{currentBranch}</span>
          </span>
        </div>
      </div>

      {/* Mini Search Filter */}
      <div className={`p-1.5 border-b shrink-0 ${isDark ? "bg-black/60 border-neutral-800" : "bg-white border-neutral-200"}`}>
        <div className="relative">
          <Search className="w-3 h-3 absolute left-2 top-2 opacity-40" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter commits..."
            className={`w-full pl-6 pr-2 py-1 text-[11px] rounded-md border outline-none ${
              isDark
                ? "bg-neutral-900 border-neutral-800 text-white placeholder-neutral-500 focus:border-blue-500"
                : "bg-neutral-50 border-neutral-300 text-black placeholder-neutral-400 focus:border-blue-500"
            }`}
          />
        </div>
      </div>

      {/* Commit List / DAG Graph */}
      <div className="flex-1 overflow-y-auto p-1.5 space-y-1.5">
        {filteredCommits.length === 0 ? (
          <div className={`p-6 text-center italic ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>
            <GitCommitIcon className="w-6 h-6 opacity-30 mx-auto mb-1" />
            <p className="text-[11px]">No commits found</p>
          </div>
        ) : viewMode === "dag" ? (
          /* Compact Visual DAG Graph */
          <div className="space-y-1">
            {filteredCommits.map((commit, idx) => {
              const isHead = idx === 0;
              const hasMergeParent = !!commit.mergeParentSha;
              return (
                <div
                  key={commit.sha || commit._id}
                  onClick={() => onCommitSelected(commit)}
                  className={`relative p-2 rounded-lg border flex items-center gap-2 transition-all cursor-pointer ${
                    isDark
                      ? "bg-black border-neutral-800 hover:border-blue-500/40 hover:bg-neutral-900"
                      : "bg-white border-neutral-200 hover:border-blue-300 hover:shadow-xs"
                  }`}
                >
                  {/* Visual Node */}
                  <div className="relative flex flex-col items-center justify-center w-5 shrink-0">
                    <div
                      className={`w-3 h-3 rounded-full border-2 ${
                        isHead
                          ? "bg-blue-600 border-white ring-1 ring-blue-400"
                          : hasMergeParent
                          ? "bg-purple-600 border-purple-300"
                          : commit.isCherryPick
                          ? "bg-amber-500 border-amber-300"
                          : commit.isRevert
                          ? "bg-rose-500 border-rose-300"
                          : isDark
                          ? "bg-neutral-700 border-neutral-500"
                          : "bg-neutral-300 border-neutral-400"
                      }`}
                    />
                    {idx < filteredCommits.length - 1 && (
                      <div className={`w-0.5 h-6 ${isDark ? "bg-neutral-800" : "bg-neutral-300"} absolute top-3`} />
                    )}
                  </div>

                  {/* Commit summary */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className={`font-semibold text-[11px] truncate ${isDark ? "text-white" : "text-black"}`}>
                        {commit.message}
                      </span>
                      <span className="text-[9px] font-mono font-bold px-1 py-0.2 rounded bg-blue-500/15 text-blue-400 shrink-0">
                        {commit.sha.substring(0, 7)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-[10px] opacity-50 mt-0.5">
                      <span className="truncate max-w-[80px]">{commit.author?.name || "Dev"}</span>
                      <span>•</span>
                      <span>{new Date(commit.createdAt).toLocaleDateString()}</span>
                      {hasMergeParent && (
                        <span className="text-purple-400 font-bold ml-auto flex items-center gap-0.5 text-[9px]">
                          <GitPullRequest className="w-2.5 h-2.5" /> MERGE
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Compact Timeline View */
          <div className={`relative border-l-2 ml-2 space-y-1.5 pl-2.5 py-0.5 ${
            isDark ? "border-neutral-800" : "border-neutral-200"
          }`}>
            {filteredCommits.map((commit, idx) => {
              const isHead = idx === 0;
              const shortSha = commit.sha.substring(0, 7);
              const isBusy = isProcessingSha === commit.sha;

              return (
                <div
                  key={commit.sha || commit._id}
                  onClick={() => onCommitSelected(commit)}
                  className={`group relative border rounded-lg p-2 transition-all cursor-pointer ${
                    isDark
                      ? "bg-black border-neutral-800 hover:border-blue-500/50 hover:bg-neutral-900/80"
                      : "bg-white border-neutral-200 hover:border-blue-300 hover:shadow-xs"
                  }`}
                >
                  {/* Timeline dot */}
                  <div
                    className={`absolute -left-[15px] top-3 w-2.5 h-2.5 rounded-full border flex items-center justify-center ${
                      isHead
                        ? "bg-blue-600 ring-1 ring-blue-400 border-black"
                        : commit.isMergeCommit
                        ? "bg-purple-600 border-black"
                        : commit.isCherryPick
                        ? "bg-amber-500 border-black"
                        : commit.isRevert
                        ? "bg-rose-500 border-black"
                        : isDark
                        ? "bg-neutral-700 border-black"
                        : "bg-neutral-400 border-white"
                    }`}
                  />

                  {/* Header: Message & Hash */}
                  <div className="flex items-start justify-between gap-1.5 mb-1">
                    <div className="min-w-0 flex-1">
                      <span className={`font-semibold text-[11px] leading-snug line-clamp-2 ${
                        isDark ? "text-neutral-100" : "text-neutral-900"
                      }`}>
                        {commit.message}
                      </span>

                      {/* Tag badges */}
                      {commit.tags && commit.tags.length > 0 && (
                        <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                          {commit.tags.map((t) => (
                            <span key={t} className="text-[9px] font-mono font-bold px-1 py-0.2 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-0.5">
                              <Tag className="w-2 h-2" />
                              <span className="truncate max-w-[70px]">{t}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <span className={`text-[9px] font-mono px-1 py-0.2 rounded border shrink-0 font-bold ${
                      isDark
                        ? "bg-blue-500/15 text-blue-300 border-blue-500/30"
                        : "bg-blue-50 text-blue-700 border-blue-100"
                    }`}>
                      {shortSha}
                    </span>
                  </div>

                  {/* Author & Time */}
                  <div className={`flex items-center justify-between text-[10px] ${isDark ? "text-neutral-400" : "text-neutral-500"}`}>
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="truncate max-w-[80px]">{commit.author?.name || "Dev"}</span>
                      <span>•</span>
                      <span>{new Date(commit.createdAt).toLocaleDateString()}</span>
                    </div>

                    {commit.stats && (
                      <span className="font-mono text-[9px] shrink-0">
                        <span className="text-emerald-500 font-semibold">+{commit.stats.additions || 0}</span>{" "}
                        <span className="text-rose-400 font-semibold">-{commit.stats.deletions || 0}</span>
                      </span>
                    )}
                  </div>

                  {/* Hover Actions Footer */}
                  <div className="flex items-center justify-end gap-1 pt-1.5 mt-1 border-t border-neutral-800/40 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => handleCherryPick(e, commit)}
                      disabled={isBusy}
                      className={`px-1.5 py-0.5 rounded text-[9px] font-medium transition-colors flex items-center gap-0.5 cursor-pointer ${
                        isDark
                          ? "bg-neutral-800 hover:bg-amber-600 text-neutral-300 hover:text-white"
                          : "bg-neutral-100 hover:bg-amber-100 text-neutral-600 hover:text-amber-800"
                      }`}
                      title="Cherry-pick onto current branch"
                    >
                      <Sparkles className="w-2.5 h-2.5" />
                      <span>Pick</span>
                    </button>

                    <button
                      onClick={(e) => handleRevert(e, commit)}
                      disabled={isBusy}
                      className={`px-1.5 py-0.5 rounded text-[9px] font-medium transition-colors flex items-center gap-0.5 cursor-pointer ${
                        isDark
                          ? "bg-neutral-800 hover:bg-rose-600 text-neutral-300 hover:text-white"
                          : "bg-neutral-100 hover:bg-rose-100 text-neutral-600 hover:text-rose-800"
                      }`}
                      title="Revert this commit"
                    >
                      <RotateCcw className="w-2.5 h-2.5" />
                      <span>Revert</span>
                    </button>

                    {!isHead && (
                      <button
                        onClick={(e) => handleRollback(e, commit)}
                        disabled={isBusy}
                        className={`px-1.5 py-0.5 rounded text-[9px] font-medium transition-colors flex items-center gap-0.5 cursor-pointer ${
                          isDark
                            ? "bg-neutral-800 hover:bg-blue-600 text-neutral-300 hover:text-white"
                            : "bg-neutral-100 hover:bg-blue-50 text-neutral-600 hover:text-blue-700"
                        }`}
                        title="Time travel rollback to this commit"
                      >
                        <RotateCcw className="w-2.5 h-2.5" />
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
