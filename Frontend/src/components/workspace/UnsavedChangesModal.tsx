import React from "react";
import { AlertCircle, Save, FileCode, Check } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";

interface CloseTabModalProps {
  isOpen: boolean;
  type: "close-tab";
  fileName: string;
  onSave: () => void;
  onDontSave: () => void;
  onCancel: () => void;
}

interface CommitUnsavedModalProps {
  isOpen: boolean;
  type: "commit";
  dirtyFileNames: string[];
  onSaveAllAndCommit: () => void;
  onCommitWithoutSaving: () => void;
  onCancel: () => void;
}

export type UnsavedChangesModalProps = CloseTabModalProps | CommitUnsavedModalProps;

export const UnsavedChangesModal: React.FC<UnsavedChangesModalProps> = (props) => {
  const { isDark } = useTheme();

  if (!props.isOpen) return null;

  if (props.type === "close-tab") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
        <div
          onClick={(e) => e.stopPropagation()}
          className={`w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden p-5 animate-in zoom-in-95 duration-150 ${
            isDark
              ? "bg-neutral-950 border-neutral-800 text-white"
              : "bg-white border-neutral-200 text-black"
          }`}
        >
          <div className="flex items-start gap-3.5 mb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold truncate">
                Save changes to "{props.fileName}"?
              </h3>
              <p className={`text-xs mt-1 leading-relaxed ${isDark ? "text-neutral-400" : "text-neutral-600"}`}>
                Your changes will be lost if you don't save them before closing this tab.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10 mt-4">
            <button
              onClick={props.onCancel}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer border ${
                isDark
                  ? "bg-neutral-900 hover:bg-neutral-800 border-neutral-800 text-neutral-300"
                  : "bg-neutral-100 hover:bg-neutral-200 border-neutral-200 text-neutral-700"
              }`}
            >
              Cancel
            </button>

            <button
              onClick={props.onDontSave}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer border ${
                isDark
                  ? "bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/30 text-rose-400"
                  : "bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-600"
              }`}
            >
              Don't Save
            </button>

            <button
              onClick={props.onSave}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer shadow-sm flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden p-5 animate-in zoom-in-95 duration-150 ${
          isDark
            ? "bg-neutral-950 border-neutral-800 text-white"
            : "bg-white border-neutral-200 text-black"
        }`}
      >
        <div className="flex items-start gap-3.5 mb-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
            <Save className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold">
              Unsaved changes before commit
            </h3>
            <p className={`text-xs mt-1 leading-relaxed ${isDark ? "text-neutral-400" : "text-neutral-600"}`}>
              You have {props.dirtyFileNames.length} unsaved file{props.dirtyFileNames.length > 1 ? "s" : ""}. Do you want to save all changes before creating this commit?
            </p>
          </div>
        </div>

        {/* Dirty files list */}
        <div
          className={`my-3 p-2.5 rounded-xl border max-h-32 overflow-y-auto space-y-1 ${
            isDark ? "bg-black/60 border-neutral-800" : "bg-neutral-50 border-neutral-200"
          }`}
        >
          {props.dirtyFileNames.map((name, i) => (
            <div key={i} className="flex items-center gap-2 text-xs font-mono opacity-80">
              <FileCode className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span className="truncate">{name}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10 mt-3">
          <button
            onClick={props.onCancel}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer border ${
              isDark
                ? "bg-neutral-900 hover:bg-neutral-800 border-neutral-800 text-neutral-300"
                : "bg-neutral-100 hover:bg-neutral-200 border-neutral-200 text-neutral-700"
            }`}
          >
            Cancel
          </button>

          <button
            onClick={props.onCommitWithoutSaving}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer border ${
              isDark
                ? "bg-neutral-900 hover:bg-neutral-800 border-neutral-800 text-neutral-300"
                : "bg-neutral-100 hover:bg-neutral-200 border-neutral-200 text-neutral-700"
            }`}
          >
            Don't Save
          </button>

          <button
            onClick={props.onSaveAllAndCommit}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer shadow-sm flex items-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Save & Commit</span>
          </button>
        </div>
      </div>
    </div>
  );
};
