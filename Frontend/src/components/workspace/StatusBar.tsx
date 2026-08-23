import React from "react";
import { GitBranch, Cloud } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";

interface StatusBarProps {
  currentBranch: string;
  changedFilesCount: number;
  activeLanguage?: string;
  cursorPos?: { line: number; col: number };
  onOpenSourceControl: () => void;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  currentBranch,
  changedFilesCount,
  activeLanguage = "TypeScript",
  cursorPos = { line: 1, col: 1 },
  onOpenSourceControl,
}) => {
  const { isDark } = useTheme();

  return (
    <footer className={`h-6 border-t flex items-center justify-between px-3 text-[11px] font-mono select-none shrink-0 z-10 font-sans transition-colors duration-150 ${
      isDark
        ? "bg-black border-neutral-800 text-neutral-400"
        : "bg-white border-neutral-200 text-neutral-600"
    }`}>
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenSourceControl}
          className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded transition-colors font-semibold cursor-pointer ${
            isDark
              ? "text-neutral-200 hover:bg-blue-500/20 hover:text-blue-300"
              : "text-neutral-800 hover:bg-blue-100 hover:text-blue-900"
          }`}
          title="Switch Branch / View CloudForge Source Control"
        >
          <GitBranch className="w-3 h-3 text-blue-500" />
          <span>{currentBranch}</span>
        </button>

        {changedFilesCount > 0 && (
          <button
            onClick={onOpenSourceControl}
            className={`flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold cursor-pointer ${
              isDark
                ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                : "bg-blue-100 text-blue-800"
            }`}
          >
            <span>{changedFilesCount} pending changes</span>
          </button>
        )}
      </div>

      <div className="flex items-center gap-3 font-mono">
        <span className={`hidden sm:inline ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>
          Ln {cursorPos.line}, Col {cursorPos.col}
        </span>
        <span className="hidden md:inline opacity-70">UTF-8</span>
        <span className="hidden sm:inline opacity-70">Spaces: 2</span>
        <span className={`font-semibold ${isDark ? "text-white" : "text-black"}`}>
          {activeLanguage}
        </span>

        <div
          className="flex items-center gap-1 text-blue-500 font-bold"
          title="CloudForge Native Version Control: Online"
        >
          <Cloud className="w-3 h-3" />
          <span className="hidden lg:inline">CloudForge VCS</span>
        </div>
      </div>
    </footer>
  );
};
