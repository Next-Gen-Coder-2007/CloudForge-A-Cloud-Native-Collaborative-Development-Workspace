import React, { useState, useEffect } from "react";
import {
  Archive,
  Plus,
  Play,
  Trash2,
  X,
  RotateCw,
  Clock,
  User,
  GitBranch,
} from "lucide-react";
import { FileIcon } from "./FileIcon";
import { useTheme } from "../../context/ThemeContext";
import { vcsService } from "../../services/vcsService";
import type { GitStash, WorkspaceFile } from "../../types/workspace";

interface StashModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  currentBranch: string;
  hasDirtyFiles: boolean;
  onStashSaved: (files: WorkspaceFile[]) => void;
  onStashApplied: (files: WorkspaceFile[]) => void;
}

export const StashModal: React.FC<StashModalProps> = ({
  isOpen,
  onClose,
  projectId,
  currentBranch,
  hasDirtyFiles,
  onStashSaved,
  onStashApplied,
}) => {
  const { isDark } = useTheme();
  const [stashes, setStashes] = useState<GitStash[]>([]);
  const [selectedStash, setSelectedStash] = useState<GitStash | null>(null);
  const [stashMessage, setStashMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"list" | "create">("list");

  const loadStashes = async () => {
    try {
      setIsLoading(true);
      const data = await vcsService.getStashes(projectId);
      setStashes(data);
      if (data.length > 0 && !selectedStash) {
        setSelectedStash(data[0]);
      }
    } catch (err: any) {
      console.error("Failed to load stashes", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadStashes();
      if (hasDirtyFiles) {
        setActiveTab("create");
      } else {
        setActiveTab("list");
      }
    }
  }, [isOpen, projectId, hasDirtyFiles]);

  if (!isOpen) return null;

  const handleSaveStash = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      const res = await vcsService.saveStash(projectId, stashMessage.trim() || undefined);
      setStashMessage("");
      onStashSaved(res.files);
      await loadStashes();
      setActiveTab("list");
    } catch (err: any) {
      alert(err.message || "Failed to stash changes");
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyStash = async (stashId: string) => {
    try {
      setIsLoading(true);
      const res = await vcsService.applyStash(projectId, stashId);
      onStashApplied(res.files);
      onClose();
    } catch (err: any) {
      alert(err.message || "Failed to apply stash");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePopStash = async (stashId: string) => {
    try {
      setIsLoading(true);
      const res = await vcsService.popStash(projectId, stashId);
      onStashApplied(res.files);
      await loadStashes();
      onClose();
    } catch (err: any) {
      alert(err.message || "Failed to pop stash");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDropStash = async (stashId: string) => {
    if (!window.confirm("Are you sure you want to delete this stash?")) return;
    try {
      setIsLoading(true);
      await vcsService.dropStash(projectId, stashId);
      setStashes((prev) => prev.filter((s) => s._id !== stashId));
      if (selectedStash?._id === stashId) {
        setSelectedStash(null);
      }
    } catch (err: any) {
      alert(err.message || "Failed to drop stash");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs select-none">
      <div className={`w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col font-sans transition-colors duration-150 ${
        isDark ? "bg-neutral-950 border-neutral-800 text-white" : "bg-white border-neutral-200 text-black"
      }`}>
        {/* Header */}
        <div className={`p-4 border-b flex items-center justify-between ${
          isDark ? "bg-neutral-950 border-neutral-800" : "bg-neutral-50 border-neutral-200"
        }`}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-600 font-bold text-white flex items-center justify-center text-xs shadow-md shadow-purple-500/20">
              <Archive className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm">Git Stash & Workspace Shelving</h3>
              <p className={`text-[11px] ${isDark ? "text-neutral-400" : "text-neutral-500"}`}>
                Temporarily shelve dirty changes to switch tasks cleanly
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
        <div className={`grid grid-cols-2 border-b p-1 text-xs font-semibold ${
          isDark ? "bg-black border-neutral-800" : "bg-neutral-100 border-neutral-200"
        }`}>
          <button
            onClick={() => setActiveTab("list")}
            className={`py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === "list"
                ? isDark
                  ? "bg-neutral-900 text-purple-400 shadow-2xs font-bold"
                  : "bg-white text-purple-600 shadow-2xs font-bold"
                : isDark
                ? "text-neutral-400 hover:text-white"
                : "text-neutral-600 hover:text-black"
            }`}
          >
            <Archive className="w-3.5 h-3.5" />
            <span>Saved Stashes ({stashes.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("create")}
            className={`py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === "create"
                ? isDark
                  ? "bg-neutral-900 text-purple-400 shadow-2xs font-bold"
                  : "bg-white text-purple-600 shadow-2xs font-bold"
                : isDark
                ? "text-neutral-400 hover:text-white"
                : "text-neutral-600 hover:text-black"
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Stash Current Work</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-4 flex-1 overflow-y-auto max-h-[60vh]">
          {activeTab === "create" ? (
            <form onSubmit={handleSaveStash} className="space-y-3">
              <div>
                <label className={`block text-xs font-medium mb-1 ${isDark ? "text-neutral-300" : "text-neutral-700"}`}>
                  Stash Description (Optional):
                </label>
                <input
                  type="text"
                  value={stashMessage}
                  onChange={(e) => setStashMessage(e.target.value)}
                  placeholder={`e.g. WIP on feature/auth before branch switch...`}
                  autoFocus
                  className={`w-full px-3 py-2 border rounded-xl text-xs outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 ${
                    isDark
                      ? "bg-black border-neutral-700 text-white placeholder-neutral-500"
                      : "bg-white border-neutral-300 text-black placeholder-neutral-400"
                  }`}
                />
                <span className={`text-[10px] mt-1 block ${isDark ? "text-neutral-400" : "text-neutral-500"}`}>
                  Saves all uncommitted modifications on <strong>{currentBranch}</strong> and restores your workspace to clean branch HEAD snapshot.
                </span>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 shadow-sm cursor-pointer"
              >
                {isLoading ? (
                  <RotateCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Archive className="w-3.5 h-3.5" />
                )}
                <span>Stash Changes & Clean Workspace</span>
              </button>
            </form>
          ) : (
            <div className="space-y-2">
              {stashes.length === 0 ? (
                <div className={`p-8 text-center italic ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>
                  <Archive className="w-8 h-8 opacity-40 mx-auto mb-2" />
                  <p className="text-xs">No stashed changes saved yet.</p>
                </div>
              ) : (
                stashes.map((stash, idx) => (
                  <div
                    key={stash._id}
                    className={`p-3 rounded-xl border transition-all ${
                      isDark
                        ? "bg-black border-neutral-800 hover:border-purple-500/40"
                        : "bg-white border-neutral-200 hover:border-purple-300"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div>
                        <span className="font-bold text-xs font-mono text-purple-400 mr-2">
                          stash@&#123;{idx}&#125;
                        </span>
                        <span className={`font-semibold text-xs ${isDark ? "text-white" : "text-black"}`}>
                          {stash.message}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleApplyStash(stash._id)}
                          disabled={isLoading}
                          className={`px-2 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 border transition-all cursor-pointer ${
                            isDark
                              ? "bg-purple-500/15 border-purple-500/30 text-purple-300 hover:bg-purple-500/25"
                              : "bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100"
                          }`}
                          title="Apply stash without deleting it"
                        >
                          <Play className="w-3 h-3" />
                          <span>Apply</span>
                        </button>

                        <button
                          onClick={() => handlePopStash(stash._id)}
                          disabled={isLoading}
                          className="px-2 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 bg-purple-600 hover:bg-purple-700 text-white shadow-xs transition-all cursor-pointer"
                          title="Apply stash and remove from stash list"
                        >
                          <span>Pop</span>
                        </button>

                        <button
                          onClick={() => handleDropStash(stash._id)}
                          disabled={isLoading}
                          className={`p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/20 transition-colors cursor-pointer`}
                          title="Delete stash"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className={`flex items-center gap-3 text-[10px] ${isDark ? "text-neutral-400" : "text-neutral-500"}`}>
                      <span className="flex items-center gap-1">
                        <GitBranch className="w-3 h-3" />
                        {stash.branch}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(stash.createdAt).toLocaleString()}
                      </span>
                      <span>•</span>
                      <span>{stash.filesSnapshot?.length || 0} files</span>
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
