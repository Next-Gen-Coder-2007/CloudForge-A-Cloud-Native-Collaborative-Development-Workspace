import React from "react";
import { Files, GitBranch, History, Search, KeyRound, Rocket, Settings, Cloud } from "lucide-react";
import { type ActivityBarTab } from "../../types/workspace";
import { useTheme } from "../../context/ThemeContext";

interface ActivityBarProps {
  activeTab: ActivityBarTab;
  onChangeTab: (tab: ActivityBarTab) => void;
  changedFilesCount: number;
  commitsCount?: number;
  envVariablesCount?: number;
  isSidebarOpen?: boolean;
}

export const ActivityBar: React.FC<ActivityBarProps> = ({
  activeTab,
  onChangeTab,
  changedFilesCount,
  commitsCount = 0,
  envVariablesCount = 0,
  isSidebarOpen = true,
}) => {
  const { isDark } = useTheme();

  const topItems: { id: ActivityBarTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    {
      id: "explorer",
      label: "Explorer (Files & Folders)",
      icon: <Files className="w-5 h-5" />,
    },
    {
      id: "sourceControl",
      label: "Source Control (Changes & Staging)",
      icon: <GitBranch className="w-5 h-5" />,
      badge: changedFilesCount > 0 ? changedFilesCount : undefined,
    },
    {
      id: "history",
      label: "Commit Timeline & Time Travel (Rollback)",
      icon: <History className="w-5 h-5" />,
      badge: commitsCount > 0 ? commitsCount : undefined,
    },
    {
      id: "search",
      label: "Search across Files",
      icon: <Search className="w-5 h-5" />,
    },
    {
      id: "env",
      label: "Environment Variables (.env)",
      icon: <KeyRound className="w-5 h-5" />,
      badge: envVariablesCount > 0 ? envVariablesCount : undefined,
    },
    {
      id: "deploy",
      label: "Cloud Deployments & Hosting (Coming Soon)",
      icon: <Rocket className="w-5 h-5" />,
    },
  ];

  return (
    <aside
      className={`w-12 border-r flex flex-col justify-between items-center py-2 shrink-0 select-none z-10 transition-colors duration-150 ${
        isDark ? "bg-black border-neutral-800" : "bg-white border-neutral-200"
      }`}
    >
      <div className="flex flex-col items-center gap-1 w-full">
        {topItems.map((item) => {
          const isActive = activeTab === item.id && isSidebarOpen;
          return (
            <button
              key={item.id}
              onClick={() => onChangeTab(item.id)}
              className={`relative w-10 h-10 flex items-center justify-center rounded-lg transition-all group cursor-pointer ${
                isActive
                  ? isDark
                    ? "text-blue-400 bg-blue-500/15 border-l-2 border-blue-500 rounded-l-none font-semibold shadow-xs"
                    : "text-blue-600 bg-blue-50 border-l-2 border-blue-600 rounded-l-none font-semibold shadow-xs"
                  : isDark
                  ? "text-neutral-400 hover:text-white hover:bg-neutral-900"
                  : "text-neutral-500 hover:text-black hover:bg-neutral-100"
              }`}
              title={isActive ? `${item.label} (Click to minimize)` : item.label}
            >
              {item.icon}

              {item.badge !== undefined && (
                <span className="absolute top-1 right-1 px-1.5 py-0.2 bg-blue-600 text-white font-bold text-[9px] rounded-full min-w-[15px] h-[15px] flex items-center justify-center shadow-xs">
                  {item.badge > 99 ? "99+" : item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col items-center gap-1 w-full">
        <button
          onClick={() => onChangeTab("settings")}
          className={`w-10 h-10 flex items-center justify-center rounded-lg transition-all cursor-pointer ${
            activeTab === "settings" && isSidebarOpen
              ? isDark
                ? "text-blue-400 bg-blue-500/15 border-l-2 border-blue-500 rounded-l-none font-semibold"
                : "text-blue-600 bg-blue-50 border-l-2 border-blue-600 rounded-l-none font-semibold"
              : isDark
              ? "text-neutral-400 hover:text-white hover:bg-neutral-900"
              : "text-neutral-500 hover:text-black hover:bg-neutral-100"
          }`}
          title={activeTab === "settings" && isSidebarOpen ? "Project Settings (Click to minimize)" : "Project Settings"}
        >
          <Settings className="w-5 h-5" />
        </button>

        <div
          className="w-10 h-10 flex items-center justify-center text-blue-500 cursor-default"
          title="CloudForge Native VCS: Active"
        >
          <Cloud className="w-4 h-4" />
        </div>
      </div>
    </aside>
  );
};

export default ActivityBar;
