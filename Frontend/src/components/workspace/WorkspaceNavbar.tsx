import {
  ArrowLeft,
  CheckCircle2,
  RefreshCw,
  Download,
  FolderGit2,
  FileCode2,
  PanelLeft,
  Sun,
  Moon,
} from "lucide-react";
import { type Project } from "../../types/project";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../../context/ThemeContext";

interface WorkspaceNavbarProps {
  project: Project;
  isDirty: boolean;
  isSaving: boolean;
  filesCount: number;
  commitsCount: number;
  onDownloadZip: () => void;
  onToggleMobileSidebar?: () => void;
  isMobileSidebarOpen?: boolean;
}

export const WorkspaceNavbar: React.FC<WorkspaceNavbarProps> = ({
  project,
  isDirty,
  isSaving,
  filesCount,
  commitsCount,
  onDownloadZip,
  onToggleMobileSidebar,
  isMobileSidebarOpen,
}) => {
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();

  return (
    <header
      className={`h-13 sm:h-14 border-b px-2.5 sm:px-4 flex items-center justify-between select-none shadow-2xs z-30 font-sans transition-colors duration-150 ${
        isDark
          ? "bg-black border-neutral-800 text-white"
          : "bg-white border-neutral-200 text-black"
      }`}
    >
      <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
        <button
          onClick={onToggleMobileSidebar}
          className={`md:hidden p-1.5 rounded-lg border transition-colors ${
            isMobileSidebarOpen
              ? "bg-blue-500/20 border-blue-500/30 text-blue-400"
              : isDark
              ? "bg-neutral-900 border-neutral-800 text-neutral-300 hover:bg-neutral-800"
              : "bg-neutral-100 border-neutral-200 text-neutral-700 hover:bg-neutral-200"
          }`}
          title="Toggle Sidebar & Files"
          aria-label="Toggle Sidebar"
        >
          <PanelLeft className="w-4 h-4" />
        </button>

        <button
          onClick={() => navigate("/projects")}
          className={`p-1.5 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-semibold cursor-pointer ${
            isDark
              ? "text-neutral-400 hover:text-white hover:bg-neutral-900"
              : "text-neutral-500 hover:text-black hover:bg-neutral-100"
          }`}
          title="Back to Projects"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden md:inline">Projects</span>
        </button>

        <div className={`h-4 w-px hidden sm:block ${isDark ? "bg-neutral-800" : "bg-neutral-200"}`} />

        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-blue-600 font-extrabold text-white flex items-center justify-center text-xs shrink-0 shadow-md shadow-blue-500/20">
            CF
          </div>
          <div className="min-w-0">
            <h1 className={`font-bold text-xs sm:text-sm truncate max-w-[140px] xs:max-w-[180px] sm:max-w-[240px] md:max-w-[320px] ${
              isDark ? "text-white" : "text-black"
            }`}>
              {project.name}
            </h1>
          </div>
        </div>

        <div className="hidden lg:flex items-center gap-2 pl-2">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-medium ${
            isDark
              ? "bg-neutral-900 border-neutral-800 text-neutral-300"
              : "bg-neutral-100 border-neutral-200 text-neutral-700"
          }`}>
            <FileCode2 className="w-3 h-3 opacity-70" />
            {filesCount} {filesCount === 1 ? "file" : "files"}
          </span>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-medium ${
            isDark
              ? "bg-blue-500/15 border-blue-500/30 text-blue-400"
              : "bg-blue-50 border-blue-200 text-blue-700"
          }`}>
            <FolderGit2 className="w-3 h-3 text-blue-500" />
            {commitsCount} {commitsCount === 1 ? "commit" : "commits"}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1 sm:gap-2 text-[11px] sm:text-xs font-medium">
        {isSaving ? (
          <span className="flex items-center gap-1 text-blue-400 animate-pulse bg-blue-500/10 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md border border-blue-500/30">
            <RefreshCw className="w-3 h-3 sm:w-3.5 sm:h-3.5 animate-spin" />
            <span className="hidden sm:inline">Saving...</span>
          </span>
        ) : isDirty ? (
          <span className="flex items-center gap-1 text-blue-400 bg-blue-500/10 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md border border-blue-500/30">
            <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-blue-400 animate-pulse"></span>
            <span className="hidden sm:inline">Unsaved</span>
            <span className="sm:hidden">Unsaved</span>
          </span>
        ) : (
          <span className="hidden sm:flex items-center gap-1.5 text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/30 text-[11px]">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            Saved
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Instant Dark / Light Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg border flex items-center gap-1.5 text-xs font-semibold transition-colors cursor-pointer ${
            isDark
              ? "bg-neutral-900 border-neutral-800 text-blue-400 hover:bg-neutral-800"
              : "bg-neutral-100 border-neutral-200 text-blue-600 hover:bg-neutral-200"
          }`}
          title={isDark ? "Switch to Pure Light Mode" : "Switch to Pure Dark Mode"}
        >
          {isDark ? (
            <>
              <Sun className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden md:inline text-[11px]">Light</span>
            </>
          ) : (
            <>
              <Moon className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden md:inline text-[11px]">Dark</span>
            </>
          )}
        </button>

        <button
          onClick={onDownloadZip}
          className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border cursor-pointer shadow-2xs ${
            isDark
              ? "bg-neutral-900 hover:bg-neutral-800 text-white border-neutral-800"
              : "bg-neutral-100 hover:bg-neutral-200 text-black border-neutral-200"
          }`}
          title="Download workspace files as ZIP"
        >
          <Download className="w-3.5 h-3.5 opacity-70" />
          <span className="hidden sm:inline">Export ZIP</span>
        </button>
      </div>
    </header>
  );
};

export default WorkspaceNavbar;
