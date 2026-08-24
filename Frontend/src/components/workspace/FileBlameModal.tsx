import React, { useState, useEffect } from "react";
import {
  FileText,
  Clock,
  User,
  History,
  X,
  RotateCw,
  GitCommit as GitCommitIcon,
} from "lucide-react";
import { FileIcon } from "./FileIcon";
import { useTheme } from "../../context/ThemeContext";
import { vcsService } from "../../services/vcsService";
import type { FileBlameLine, FileHistoryEntry } from "../../types/workspace";

interface FileBlameModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  filePath: string;
  fileName: string;
}

export const FileBlameModal: React.FC<FileBlameModalProps> = ({
  isOpen,
  onClose,
  projectId,
  filePath,
  fileName,
}) => {
  const { isDark } = useTheme();
  const [activeTab, setActiveTab] = useState<"blame" | "history">("blame");
  const [blameLines, setBlameLines] = useState<FileBlameLine[]>([]);
  const [historyEntries, setHistoryEntries] = useState<FileHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && filePath) {
      loadData();
    }
  }, [isOpen, projectId, filePath]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [blameData, historyData] = await Promise.all([
        vcsService.getFileBlame(projectId, filePath),
        vcsService.getFileHistory(projectId, filePath),
      ]);
      setBlameLines(blameData);
      setHistoryEntries(historyData);
    } catch (err: any) {
      console.error("Failed to load file blame/history", err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-xs select-none">
      <div className={`w-full max-w-5xl h-[88vh] rounded-2xl border shadow-2xl overflow-hidden flex flex-col font-sans transition-colors duration-150 ${
        isDark ? "bg-neutral-950 border-neutral-800 text-white" : "bg-white border-neutral-200 text-black"
      }`}>
        {/* Header */}
        <div className={`px-4 py-3 border-b flex items-center justify-between shrink-0 ${
          isDark ? "bg-neutral-900 border-neutral-800" : "bg-neutral-50 border-neutral-200"
        }`}>
          <div className="flex items-center gap-2.5">
            <FileIcon name={fileName} type="file" className="w-5 h-5" />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm">{fileName}</h3>
                <span className={`text-xs font-mono px-2 py-0.5 rounded border ${
                  isDark ? "bg-neutral-800 text-neutral-300 border-neutral-700" : "bg-white text-neutral-600 border-neutral-200"
                }`}>
                  {filePath}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className={`flex items-center p-0.5 rounded-lg border text-xs font-semibold ${
              isDark ? "bg-black border-neutral-800" : "bg-neutral-200/60 border-neutral-300"
            }`}>
              <button
                onClick={() => setActiveTab("blame")}
                className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                  activeTab === "blame"
                    ? isDark
                      ? "bg-neutral-800 text-blue-400 font-bold"
                      : "bg-white text-blue-600 font-bold"
                    : "opacity-70 hover:opacity-100"
                }`}
              >
                Line-by-Line Blame
              </button>
              <button
                onClick={() => setActiveTab("history")}
                className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                  activeTab === "history"
                    ? isDark
                      ? "bg-neutral-800 text-blue-400 font-bold"
                      : "bg-white text-blue-600 font-bold"
                    : "opacity-70 hover:opacity-100"
                }`}
              >
                File Commit Evolution ({historyEntries.length})
              </button>
            </div>

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

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-3">
          {isLoading ? (
            <div className="h-full flex items-center justify-center gap-2 text-xs opacity-60">
              <RotateCw className="w-4 h-4 animate-spin" />
              <span>Analyzing file commit provenance...</span>
            </div>
          ) : activeTab === "blame" ? (
            <div className="font-mono text-xs divide-y divide-neutral-800/40">
              {blameLines.length === 0 ? (
                <div className={`p-8 text-center italic ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>
                  No commit history available for this file yet.
                </div>
              ) : (
                blameLines.map((line) => (
                  <div
                    key={line.lineNumber}
                    className={`flex items-center hover:bg-blue-500/5 transition-colors py-1 px-2 group ${
                      isDark ? "hover:bg-neutral-900" : "hover:bg-blue-50/50"
                    }`}
                  >
                    {/* Line number */}
                    <span className="w-10 text-right pr-3 opacity-40 select-none text-[11px]">
                      {line.lineNumber}
                    </span>

                    {/* Commit metadata gutter */}
                    <div className="w-72 flex items-center gap-2 shrink-0 select-none text-[11px] opacity-70 group-hover:opacity-100 pr-4">
                      <span className="px-1.5 py-0.2 rounded bg-blue-500/15 text-blue-400 font-bold border border-blue-500/20 text-[10px]">
                        {line.commitSha?.substring(0, 7)}
                      </span>
                      <span className="truncate max-w-[90px] font-sans font-medium">
                        {line.author}
                      </span>
                      <span className="opacity-50 text-[10px]">
                        {line.date ? new Date(line.date).toLocaleDateString() : ""}
                      </span>
                    </div>

                    {/* Code Content */}
                    <div className="flex-1 overflow-x-auto whitespace-pre font-mono text-[12px] select-text">
                      {line.content}
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-3 p-2">
              {historyEntries.length === 0 ? (
                <div className={`p-8 text-center italic text-xs ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>
                  No file revisions recorded.
                </div>
              ) : (
                historyEntries.map((entry) => (
                  <div
                    key={entry.commitSha}
                    className={`p-3 rounded-xl border transition-all ${
                      isDark ? "bg-black border-neutral-800" : "bg-neutral-50 border-neutral-200"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        <GitCommitIcon className="w-4 h-4 text-blue-500 shrink-0" />
                        <span className={`font-bold text-xs ${isDark ? "text-white" : "text-black"}`}>
                          {entry.message}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/20 font-bold">
                        {entry.commitSha.substring(0, 7)}
                      </span>
                    </div>

                    <div className={`flex items-center justify-between text-[11px] ${isDark ? "text-neutral-400" : "text-neutral-500"}`}>
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {entry.author.name}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(entry.createdAt).toLocaleString()}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 font-mono text-[10px]">
                        <span className="text-emerald-400 font-bold">+{entry.additions}</span>
                        <span className="text-rose-400 font-bold">-{entry.deletions}</span>
                      </div>
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
