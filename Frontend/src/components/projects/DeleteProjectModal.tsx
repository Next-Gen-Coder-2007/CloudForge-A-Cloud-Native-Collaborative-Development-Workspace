import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Trash2, X, RotateCw } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";

interface DeleteProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName: string;
  onConfirmDelete: () => Promise<void>;
}

export const DeleteProjectModal: React.FC<DeleteProjectModalProps> = ({
  isOpen,
  onClose,
  projectName,
  onConfirmDelete,
}) => {
  const { isDark } = useTheme();
  const [confirmInput, setConfirmInput] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setConfirmInput("");
      setIsDeleting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isMatched = confirmInput.trim() === projectName.trim();

  const handleDelete = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isMatched || isDeleting) return;

    try {
      setIsDeleting(true);
      await onConfirmDelete();
    } finally {
      setIsDeleting(false);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs select-none animate-in fade-in">
      <div
        className={`w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden flex flex-col font-sans transition-colors duration-150 ${
          isDark
            ? "bg-neutral-950 border-neutral-800 text-white"
            : "bg-white border-neutral-200 text-black"
        }`}
      >
        {/* Header */}
        <div
          className={`p-4 border-b flex items-center justify-between shrink-0 ${
            isDark
              ? "bg-neutral-950 border-neutral-800"
              : "bg-neutral-50 border-neutral-200"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-rose-500/15 text-rose-500 border border-rose-500/30 flex items-center justify-center text-xs shadow-sm">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-rose-500">Delete Project</h3>
              <p
                className={`text-[11px] ${
                  isDark ? "text-neutral-400" : "text-neutral-500"
                }`}
              >
                Irreversible destructive action
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isDeleting}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              isDark
                ? "text-neutral-400 hover:text-white hover:bg-neutral-800"
                : "text-neutral-500 hover:text-black hover:bg-neutral-200"
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleDelete} className="p-5 space-y-4">
          <p
            className={`text-xs leading-relaxed ${
              isDark ? "text-neutral-300" : "text-neutral-600"
            }`}
          >
            This action <strong className="text-rose-400">cannot</strong> be undone. This will permanently delete the{" "}
            <strong className={isDark ? "text-white font-mono" : "text-black font-mono"}>
              {projectName}
            </strong>{" "}
            workspace, including all files, commit history, branches, and environment variables.
          </p>

          <div
            className={`p-3 rounded-xl border space-y-2 ${
              isDark
                ? "bg-neutral-900/60 border-neutral-800"
                : "bg-neutral-50 border-neutral-200"
            }`}
          >
            <label
              className={`block text-[11px] font-medium ${
                isDark ? "text-neutral-400" : "text-neutral-600"
              }`}
            >
              To confirm, type <strong className={isDark ? "text-white font-mono" : "text-black font-mono"}>{projectName}</strong> below:
            </label>
            <input
              type="text"
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder={projectName}
              disabled={isDeleting}
              autoFocus
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              className={`w-full px-3 py-2 text-xs font-mono font-semibold border rounded-lg outline-none transition-colors ${
                isDark
                  ? "bg-black border-neutral-700 text-white placeholder-neutral-600 focus:border-rose-500"
                  : "bg-white border-neutral-300 text-black placeholder-neutral-400 focus:border-rose-500"
              }`}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-neutral-800/40">
            <button
              type="button"
              onClick={onClose}
              disabled={isDeleting}
              className={`px-4 py-2 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                isDark
                  ? "border-neutral-800 text-neutral-300 hover:bg-neutral-900"
                  : "border-neutral-200 text-neutral-700 hover:bg-neutral-100"
              }`}
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={!isMatched || isDeleting}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-rose-600/20 transition-all cursor-pointer"
            >
              {isDeleting ? (
                <RotateCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Trash2 className="w-3.5 h-3.5" />
              )}
              <span>{isDeleting ? "Deleting..." : "Delete this project"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default DeleteProjectModal;
