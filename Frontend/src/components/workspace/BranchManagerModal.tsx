import React, { useState } from "react";
import {
  X,
  GitBranch,
  Plus,
  GitMerge,
  RotateCw,
  Check,
  Sparkles,
} from "lucide-react";
import { vcsService } from "../../services/vcsService";
import type { GitCommit, WorkspaceFile } from "../../types/workspace";
import { useTheme } from "../../context/ThemeContext";

interface BranchManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  currentBranch: string;
  branches: string[];
  onBranchSwitched: (newBranch: string, branches: string[], files: WorkspaceFile[]) => void;
  onMergeComplete: (mergeCommit: GitCommit, files: WorkspaceFile[]) => void;
}

export const BranchManagerModal: React.FC<BranchManagerModalProps> = ({
  isOpen,
  onClose,
  projectId,
  currentBranch,
  branches,
  onBranchSwitched,
  onMergeComplete,
}) => {
  const { isDark } = useTheme();
  const [activeTab, setActiveTab] = useState<"switch" | "create" | "merge">("switch");
  const [newBranchName, setNewBranchName] = useState("");
  const [mergeSourceBranch, setMergeSourceBranch] = useState(
    branches.find((b) => b !== currentBranch) || ""
  );
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSwitch = async (branchName: string) => {
    if (branchName === currentBranch) return;
    try {
      setIsLoading(true);
      const res = await vcsService.switchBranch(projectId, branchName);
      onBranchSwitched(res.currentBranch, res.branches, res.files);
      onClose();
    } catch (err: any) {
      alert(err.message || "Failed to switch branch");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newBranchName.trim().replace(/\s+/g, "-");
    if (!cleanName) return;

    try {
      setIsLoading(true);
      const res = await vcsService.switchBranch(projectId, cleanName, true);
      onBranchSwitched(res.currentBranch, res.branches, res.files);
      setNewBranchName("");
      onClose();
    } catch (err: any) {
      alert(err.message || "Failed to create branch");
    } finally {
      setIsLoading(false);
    }
  };

  const handleMerge = async () => {
    if (!mergeSourceBranch || mergeSourceBranch === currentBranch) return;
    try {
      setIsLoading(true);
      const res = await vcsService.mergeBranches(projectId, mergeSourceBranch, currentBranch);
      onMergeComplete(res.mergeCommit, res.files);
      onClose();
    } catch (err: any) {
      alert(err.message || "Failed to merge branches");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs select-none">
      <div className={`rounded-2xl border shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150 font-sans transition-colors duration-150 ${
        isDark ? "bg-neutral-950 border-neutral-800 text-white" : "bg-white border-neutral-200 text-black"
      }`}>
        {/* Header */}
        <div className={`p-4 border-b flex items-center justify-between ${
          isDark ? "bg-neutral-950 border-neutral-800" : "bg-neutral-50 border-neutral-200"
        }`}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-600 font-bold text-white flex items-center justify-center text-xs shadow-md shadow-blue-500/20">
              <GitBranch className="w-4 h-4" />
            </div>
            <div>
              <h3 className={`font-bold text-sm ${isDark ? "text-white" : "text-black"}`}>
                Branch Manager
              </h3>
              <p className={`text-[11px] ${isDark ? "text-neutral-400" : "text-neutral-500"}`}>
                Current branch: <strong className="text-blue-500">{currentBranch}</strong>
              </p>
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

        {/* Tab Buttons */}
        <div className={`grid grid-cols-3 border-b p-1 text-xs font-semibold ${
          isDark ? "bg-black border-neutral-800" : "bg-neutral-100 border-neutral-200"
        }`}>
          <button
            onClick={() => setActiveTab("switch")}
            className={`py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === "switch"
                ? isDark
                  ? "bg-neutral-900 text-blue-400 shadow-2xs font-bold"
                  : "bg-white text-blue-600 shadow-2xs font-bold"
                : isDark
                ? "text-neutral-400 hover:text-white"
                : "text-neutral-600 hover:text-black"
            }`}
          >
            <GitBranch className="w-3.5 h-3.5" />
            <span>Switch ({branches.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("create")}
            className={`py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === "create"
                ? isDark
                  ? "bg-neutral-900 text-blue-400 shadow-2xs font-bold"
                  : "bg-white text-blue-600 shadow-2xs font-bold"
                : isDark
                ? "text-neutral-400 hover:text-white"
                : "text-neutral-600 hover:text-black"
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Branch</span>
          </button>

          <button
            onClick={() => setActiveTab("merge")}
            className={`py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === "merge"
                ? isDark
                  ? "bg-neutral-900 text-blue-400 shadow-2xs font-bold"
                  : "bg-white text-blue-600 shadow-2xs font-bold"
                : isDark
                ? "text-neutral-400 hover:text-white"
                : "text-neutral-600 hover:text-black"
            }`}
          >
            <GitMerge className="w-3.5 h-3.5" />
            <span>Merge</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-4">
          {/* TAB 1: Switch Branch */}
          {activeTab === "switch" && (
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {branches.map((b) => {
                const isCurrent = b === currentBranch;
                return (
                  <button
                    key={b}
                    onClick={() => handleSwitch(b)}
                    disabled={isLoading || isCurrent}
                    className={`w-full p-2.5 rounded-xl border text-left text-xs font-medium flex items-center justify-between transition-all cursor-pointer ${
                      isCurrent
                        ? isDark
                          ? "bg-blue-500/15 border-blue-500/40 text-blue-300 font-bold"
                          : "bg-blue-50 border-blue-200 text-blue-900 font-bold"
                        : isDark
                        ? "border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900 text-neutral-300"
                        : "border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50 text-neutral-700"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <GitBranch className={`w-3.5 h-3.5 ${isCurrent ? "text-blue-500" : isDark ? "text-neutral-500" : "text-neutral-400"}`} />
                      {b}
                    </span>
                    {isCurrent ? (
                      <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        isDark ? "bg-neutral-900 text-blue-400 border-blue-500/30" : "bg-white text-blue-700 border-blue-200"
                      }`}>
                        <Check className="w-3 h-3" /> ACTIVE
                      </span>
                    ) : (
                      <span className={`text-[11px] ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>Switch</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* TAB 2: Create Branch */}
          {activeTab === "create" && (
            <form onSubmit={handleCreateBranch} className="space-y-3">
              <div>
                <label className={`block text-xs font-medium mb-1 ${isDark ? "text-neutral-300" : "text-neutral-700"}`}>
                  New Branch Name:
                </label>
                <input
                  type="text"
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  placeholder="e.g. feature/login or bugfix/header"
                  autoFocus
                  className={`w-full px-3 py-2 border rounded-xl text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 ${
                    isDark
                      ? "bg-black border-neutral-700 text-white placeholder-neutral-500"
                      : "bg-white border-neutral-300 text-black placeholder-neutral-400"
                  }`}
                />
                <span className={`text-[10px] mt-1 block ${isDark ? "text-neutral-400" : "text-neutral-500"}`}>
                  Creates a new branch branched from current HEAD snapshot of <strong>{currentBranch}</strong>.
                </span>
              </div>

              <button
                type="submit"
                disabled={isLoading || !newBranchName.trim()}
                className="w-full py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 shadow-sm cursor-pointer"
              >
                {isLoading ? (
                  <RotateCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Plus className="w-3.5 h-3.5" />
                )}
                <span>Create & Switch to Branch</span>
              </button>
            </form>
          )}

          {/* TAB 3: Merge Branch */}
          {activeTab === "merge" && (
            <div className="space-y-3">
              <div className={`p-3 rounded-xl border text-xs leading-relaxed ${
                isDark
                  ? "bg-blue-500/10 border-blue-500/20 text-blue-300"
                  : "bg-blue-50 border-blue-100 text-blue-900"
              }`}>
                Merge changes from another branch directly into <strong>{currentBranch}</strong>.
              </div>

              <div>
                <label className={`block text-xs font-medium mb-1 ${isDark ? "text-neutral-300" : "text-neutral-700"}`}>
                  Source Branch to Merge:
                </label>
                <select
                  value={mergeSourceBranch}
                  onChange={(e) => setMergeSourceBranch(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-xl text-xs outline-none focus:border-blue-500 ${
                    isDark
                      ? "bg-black border-neutral-700 text-white"
                      : "bg-white border-neutral-300 text-black"
                  }`}
                >
                  {branches
                    .filter((b) => b !== currentBranch)
                    .map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                </select>
              </div>

              <button
                onClick={handleMerge}
                disabled={isLoading || !mergeSourceBranch}
                className="w-full py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 shadow-sm cursor-pointer"
              >
                {isLoading ? (
                  <RotateCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                <span>Merge '{mergeSourceBranch}' into '{currentBranch}'</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
