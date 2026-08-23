import React from "react";
import {
  GitCommit as GitCommitIcon,
  GitBranch,
  Calendar,
  X,
} from "lucide-react";
import { FileIcon } from "./FileIcon";
import { type GitCommit } from "../../types/workspace";
import { useTheme } from "../../context/ThemeContext";

interface CommitDetailsModalProps {
  commit: GitCommit | null;
  onClose: () => void;
}

export const CommitDetailsModal: React.FC<CommitDetailsModalProps> = ({
  commit,
  onClose,
}) => {
  const { isDark } = useTheme();
  if (!commit) return null;

  const totalAdditions =
    commit.stats?.additions ??
    commit.changes?.reduce((sum, c) => sum + (c.additions || 0), 0) ??
    0;
  const totalDeletions =
    commit.stats?.deletions ??
    commit.changes?.reduce((sum, c) => sum + (c.deletions || 0), 0) ??
    0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in">
      <div className={`w-full max-w-3xl max-h-[90vh] border rounded-2xl shadow-2xl overflow-hidden flex flex-col transition-colors duration-150 ${
        isDark ? "bg-neutral-950 border-neutral-800 text-white" : "bg-white border-neutral-200 text-black"
      }`}>
        <div className={`p-4 sm:p-6 border-b flex items-start justify-between gap-3 ${
          isDark ? "border-neutral-800 bg-neutral-950" : "border-neutral-200 bg-neutral-50"
        }`}>
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-blue-500/20 font-bold">
              <GitCommitIcon className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h2 className={`text-base sm:text-lg font-bold break-words ${isDark ? "text-white" : "text-black"}`}>
                {commit.message}
              </h2>
              <div className={`flex flex-wrap items-center gap-2 sm:gap-3 mt-1.5 text-[11px] sm:text-xs font-mono ${
                isDark ? "text-neutral-400" : "text-neutral-500"
              }`}>
                <span className={`px-2 py-0.5 rounded font-bold border ${
                  isDark ? "bg-blue-500/20 text-blue-300 border-blue-500/30" : "bg-blue-50 text-blue-700 border-blue-100"
                }`}>
                  {commit.sha?.slice(0, 8) || "commit"}
                </span>
                <span className={`flex items-center gap-1 ${isDark ? "text-neutral-300" : "text-neutral-700"}`}>
                  <GitBranch className="w-3.5 h-3.5 text-blue-500" />
                  {commit.branch || "main"}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {new Date(commit.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className={`p-1 rounded-lg transition-colors cursor-pointer ${
              isDark ? "text-neutral-400 hover:text-white hover:bg-neutral-800" : "text-neutral-500 hover:text-black hover:bg-neutral-200"
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className={`px-4 sm:px-6 py-3 border-b flex items-center justify-between text-xs font-mono ${
          isDark ? "bg-black border-neutral-800" : "bg-neutral-50/70 border-neutral-200"
        }`}>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">
              {commit.author?.name?.charAt(0) || "U"}
            </div>
            <span className={`font-semibold ${isDark ? "text-neutral-200" : "text-neutral-800"}`}>
              {commit.author?.name || "Author"}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-emerald-500 font-bold">+{totalAdditions}</span>
            <span className="text-rose-400 font-bold">-{totalDeletions}</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
          <h3 className={`text-xs font-bold uppercase tracking-wider ${isDark ? "text-neutral-400" : "text-neutral-500"}`}>
            Changed Files ({commit.changes?.length || 0})
          </h3>

          <div className="space-y-2">
            {commit.changes && commit.changes.length > 0 ? (
              commit.changes.map((change, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                    isDark ? "bg-black border-neutral-800 text-white" : "bg-neutral-50 border-neutral-200 text-black"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileIcon name={change.path} type="file" className="w-4 h-4 shrink-0" />
                    <span className="font-mono text-[11px] truncate">{change.path}</span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 font-mono text-[10px]">
                    <span className="text-emerald-500 font-bold">+{change.additions || 0}</span>
                    <span className="text-rose-400 font-bold">-{change.deletions || 0}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className={`text-xs italic ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>No file changes recorded for this commit.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
