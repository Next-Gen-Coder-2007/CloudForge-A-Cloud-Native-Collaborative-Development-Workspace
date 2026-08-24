import React, { useState, useEffect } from "react";
import {
  X,
  GitBranch,
  Plus,
  GitMerge,
  RotateCw,
  Check,
  Sparkles,
  Tag,
  Trash2,
  Edit2,
} from "lucide-react";
import { vcsService } from "../../services/vcsService";
import type { GitCommit, GitTag, WorkspaceFile } from "../../types/workspace";
import { useTheme } from "../../context/ThemeContext";

interface BranchManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  currentBranch: string;
  branches: string[];
  onBranchSwitched: (newBranch: string, branches: string[], files: WorkspaceFile[]) => void;
  onMergeComplete: (mergeCommit: GitCommit, files: WorkspaceFile[]) => void;
  onConflictDetected?: (conflictData: any) => void;
}

export const BranchManagerModal: React.FC<BranchManagerModalProps> = ({
  isOpen,
  onClose,
  projectId,
  currentBranch,
  branches,
  onBranchSwitched,
  onMergeComplete,
  onConflictDetected,
}) => {
  const { isDark } = useTheme();
  const [activeTab, setActiveTab] = useState<"switch" | "create" | "merge" | "tags">("switch");
  const [newBranchName, setNewBranchName] = useState("");
  const [mergeSourceBranch, setMergeSourceBranch] = useState(
    branches.find((b) => b !== currentBranch) || ""
  );
  const [isLoading, setIsLoading] = useState(false);

  // Renaming state
  const [renamingBranch, setRenamingBranch] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Tags state
  const [tags, setTags] = useState<GitTag[]>([]);
  const [newTagName, setNewTagName] = useState("");
  const [newTagMessage, setNewTagMessage] = useState("");
  const [commits, setCommits] = useState<GitCommit[]>([]);
  const [selectedCommitSha, setSelectedCommitSha] = useState("");

  const loadTagsAndCommits = async () => {
    try {
      const [tagList, commitList] = await Promise.all([
        vcsService.getTags(projectId),
        vcsService.getCommits(projectId),
      ]);
      setTags(tagList);
      setCommits(commitList);
      if (commitList.length > 0 && !selectedCommitSha) {
        setSelectedCommitSha(commitList[0].sha);
      }
    } catch (err: any) {
      console.error("Failed to load tags", err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadTagsAndCommits();
    }
  }, [isOpen, projectId]);

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

  const handleDeleteBranch = async (e: React.MouseEvent, bName: string) => {
    e.stopPropagation();
    if (!window.confirm(`Delete branch '${bName}'? All its commits will be deleted.`)) return;

    try {
      setIsLoading(true);
      const res = await vcsService.deleteBranch(projectId, bName);
      onBranchSwitched(currentBranch, res.branches, []);
    } catch (err: any) {
      alert(err.message || "Failed to delete branch");
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartRename = (e: React.MouseEvent, bName: string) => {
    e.stopPropagation();
    setRenamingBranch(bName);
    setRenameValue(bName);
  };

  const handleSaveRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renamingBranch || !renameValue.trim()) return;

    try {
      setIsLoading(true);
      const res = await vcsService.renameBranch(projectId, renamingBranch, renameValue.trim());
      setRenamingBranch(null);
      onBranchSwitched(res.currentBranch, res.branches, []);
    } catch (err: any) {
      alert(err.message || "Failed to rename branch");
    } finally {
      setIsLoading(false);
    }
  };

  const handleMerge = async () => {
    if (!mergeSourceBranch || mergeSourceBranch === currentBranch) return;
    try {
      setIsLoading(true);
      const res = await vcsService.mergeBranches(projectId, mergeSourceBranch, currentBranch);

      if (res.hasConflicts) {
        onClose();
        if (onConflictDetected) {
          onConflictDetected(res);
        }
        return;
      }

      if (res.mergeCommit && res.files) {
        onMergeComplete(res.mergeCommit, res.files);
        onClose();
      }
    } catch (err: any) {
      alert(err.message || "Failed to merge branches");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagName.trim() || !selectedCommitSha) return;

    try {
      setIsLoading(true);
      await vcsService.createTag(projectId, newTagName.trim(), selectedCommitSha, newTagMessage.trim());
      setNewTagName("");
      setNewTagMessage("");
      await loadTagsAndCommits();
    } catch (err: any) {
      alert(err.message || "Failed to create release tag");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteTag = async (name: string) => {
    if (!window.confirm(`Delete tag '${name}'?`)) return;
    try {
      setIsLoading(true);
      await vcsService.deleteTag(projectId, name);
      setTags((prev) => prev.filter((t) => t.name !== name));
    } catch (err: any) {
      alert(err.message || "Failed to delete tag");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs select-none">
      <div className={`rounded-2xl border shadow-2xl w-full max-w-lg overflow-hidden flex flex-col font-sans transition-colors duration-150 ${
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
                Branch & Release Hub
              </h3>
              <p className={`text-[11px] ${isDark ? "text-neutral-400" : "text-neutral-500"}`}>
                Current branch: <strong className="text-blue-500">{currentBranch}</strong>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              isDark ? "text-neutral-400 hover:text-white hover:bg-neutral-800" : "text-neutral-500 hover:text-black hover:bg-neutral-200"
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Buttons */}
        <div className={`grid grid-cols-4 border-b p-1 text-xs font-semibold ${
          isDark ? "bg-black border-neutral-800" : "bg-neutral-100 border-neutral-200"
        }`}>
          <button
            onClick={() => setActiveTab("switch")}
            className={`py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer ${
              activeTab === "switch"
                ? isDark
                  ? "bg-neutral-900 text-blue-400 font-bold shadow-2xs"
                  : "bg-white text-blue-600 font-bold shadow-2xs"
                : isDark
                ? "text-neutral-400 hover:text-white"
                : "text-neutral-600 hover:text-black"
            }`}
          >
            <GitBranch className="w-3.5 h-3.5" />
            <span>Branches</span>
          </button>

          <button
            onClick={() => setActiveTab("create")}
            className={`py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer ${
              activeTab === "create"
                ? isDark
                  ? "bg-neutral-900 text-blue-400 font-bold shadow-2xs"
                  : "bg-white text-blue-600 font-bold shadow-2xs"
                : isDark
                ? "text-neutral-400 hover:text-white"
                : "text-neutral-600 hover:text-black"
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New</span>
          </button>

          <button
            onClick={() => setActiveTab("merge")}
            className={`py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer ${
              activeTab === "merge"
                ? isDark
                  ? "bg-neutral-900 text-blue-400 font-bold shadow-2xs"
                  : "bg-white text-blue-600 font-bold shadow-2xs"
                : isDark
                ? "text-neutral-400 hover:text-white"
                : "text-neutral-600 hover:text-black"
            }`}
          >
            <GitMerge className="w-3.5 h-3.5" />
            <span>3-Way Merge</span>
          </button>

          <button
            onClick={() => setActiveTab("tags")}
            className={`py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer ${
              activeTab === "tags"
                ? isDark
                  ? "bg-neutral-900 text-blue-400 font-bold shadow-2xs"
                  : "bg-white text-blue-600 font-bold shadow-2xs"
                : isDark
                ? "text-neutral-400 hover:text-white"
                : "text-neutral-600 hover:text-black"
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            <span>Tags ({tags.length})</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-4 max-h-80 overflow-y-auto">
          {/* TAB 1: Branches List */}
          {activeTab === "switch" && (
            <div className="space-y-1.5">
              {branches.map((b) => {
                const isCurrent = b === currentBranch;
                return (
                  <div
                    key={b}
                    onClick={() => handleSwitch(b)}
                    className={`w-full p-2.5 rounded-xl border text-xs font-medium flex items-center justify-between transition-all cursor-pointer ${
                      isCurrent
                        ? isDark
                          ? "bg-blue-500/15 border-blue-500/40 text-blue-300 font-bold"
                          : "bg-blue-50 border-blue-200 text-blue-900 font-bold"
                        : isDark
                        ? "border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900 text-neutral-300"
                        : "border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50 text-neutral-700"
                    }`}
                  >
                    {renamingBranch === b ? (
                      <form onSubmit={handleSaveRename} onClick={(e) => e.stopPropagation()} className="flex items-center gap-1.5 flex-1 mr-2">
                        <input
                          type="text"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          autoFocus
                          className="px-2 py-0.5 rounded border text-xs bg-black text-white outline-none flex-1"
                        />
                        <button type="submit" className="px-2 py-0.5 rounded bg-blue-600 text-white text-[10px]">
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setRenamingBranch(null)}
                          className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 text-[10px]"
                        >
                          Cancel
                        </button>
                      </form>
                    ) : (
                      <span className="flex items-center gap-2">
                        <GitBranch className={`w-3.5 h-3.5 ${isCurrent ? "text-blue-500" : isDark ? "text-neutral-500" : "text-neutral-400"}`} />
                        <span>{b}</span>
                      </span>
                    )}

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isCurrent ? (
                        <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          isDark ? "bg-neutral-900 text-blue-400 border-blue-500/30" : "bg-white text-blue-700 border-blue-200"
                        }`}>
                          <Check className="w-3 h-3" /> ACTIVE
                        </span>
                      ) : (
                        <>
                          <button
                            onClick={(e) => handleStartRename(e, b)}
                            className="p-1 rounded text-neutral-400 hover:text-blue-400 transition-colors"
                            title="Rename branch"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          {b !== "main" && (
                            <button
                              onClick={(e) => handleDeleteBranch(e, b)}
                              className="p-1 rounded text-neutral-400 hover:text-rose-400 transition-colors"
                              title="Delete branch"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
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
                  placeholder="e.g. feature/auth-gateway or bugfix/diff-view"
                  autoFocus
                  className={`w-full px-3 py-2 border rounded-xl text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 ${
                    isDark
                      ? "bg-black border-neutral-700 text-white placeholder-neutral-500"
                      : "bg-white border-neutral-300 text-black placeholder-neutral-400"
                  }`}
                />
                <span className={`text-[10px] mt-1 block ${isDark ? "text-neutral-400" : "text-neutral-500"}`}>
                  Branches from HEAD snapshot of <strong>{currentBranch}</strong>.
                </span>
              </div>

              <button
                type="submit"
                disabled={isLoading || !newBranchName.trim()}
                className="w-full py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 shadow-sm cursor-pointer"
              >
                {isLoading ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                <span>Create & Switch to Branch</span>
              </button>
            </form>
          )}

          {/* TAB 3: 3-Way Merge */}
          {activeTab === "merge" && (
            <div className="space-y-3">
              <div className={`p-3 rounded-xl border text-xs leading-relaxed ${
                isDark
                  ? "bg-blue-500/10 border-blue-500/20 text-blue-300"
                  : "bg-blue-50 border-blue-100 text-blue-900"
              }`}>
                Performs an intelligent <strong>3-Way Merge</strong>. If conflicts are found, you will be guided to resolve them interactively.
              </div>

              <div>
                <label className={`block text-xs font-medium mb-1 ${isDark ? "text-neutral-300" : "text-neutral-700"}`}>
                  Source Branch to Merge Into <strong>{currentBranch}</strong>:
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
                className="w-full py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 shadow-sm cursor-pointer"
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

          {/* TAB 4: Tags & Releases */}
          {activeTab === "tags" && (
            <div className="space-y-4">
              {/* Create Tag */}
              <form onSubmit={handleCreateTag} className="space-y-2 p-3 rounded-xl border bg-black/30 border-neutral-800">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-semibold mb-1 opacity-70">Tag Name:</label>
                    <input
                      type="text"
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      placeholder="e.g. v1.0.0"
                      className="w-full px-2 py-1 rounded-lg border text-xs bg-black text-white border-neutral-700"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold mb-1 opacity-70">At Commit:</label>
                    <select
                      value={selectedCommitSha}
                      onChange={(e) => setSelectedCommitSha(e.target.value)}
                      className="w-full px-2 py-1 rounded-lg border text-xs bg-black text-white border-neutral-700"
                    >
                      {commits.map((c) => (
                        <option key={c.sha} value={c.sha}>
                          {c.sha.substring(0, 7)} - {c.message.substring(0, 20)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <input
                    type="text"
                    value={newTagMessage}
                    onChange={(e) => setNewTagMessage(e.target.value)}
                    placeholder="Release notes or annotation (optional)..."
                    className="w-full px-2 py-1 rounded-lg border text-xs bg-black text-white border-neutral-700"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !newTagName.trim()}
                  className="w-full py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center justify-center gap-1"
                >
                  <Tag className="w-3 h-3" />
                  <span>Create Release Tag</span>
                </button>
              </form>

              {/* Tag List */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-bold uppercase tracking-wider opacity-60">Existing Tags ({tags.length})</div>
                {tags.length === 0 ? (
                  <div className="p-4 text-center italic text-xs opacity-50">No tags created yet.</div>
                ) : (
                  tags.map((t) => (
                    <div
                      key={t._id || t.name}
                      className="p-2.5 rounded-xl border flex items-center justify-between text-xs bg-black border-neutral-800"
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <Tag className="w-3.5 h-3.5 text-blue-400" />
                          <span className="font-bold text-blue-300 font-mono">{t.name}</span>
                          <span className="text-[10px] opacity-60 font-mono px-1.5 py-0.2 rounded bg-neutral-800">
                            {t.sha.substring(0, 7)}
                          </span>
                        </div>
                        {t.message && <p className="text-[11px] opacity-70 mt-0.5">{t.message}</p>}
                      </div>

                      <button
                        onClick={() => handleDeleteTag(t.name)}
                        className="p-1 rounded text-rose-400 hover:bg-rose-500/20 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
