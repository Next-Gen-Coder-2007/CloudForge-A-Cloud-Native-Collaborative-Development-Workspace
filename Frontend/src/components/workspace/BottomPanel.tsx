import React, { useState, useEffect } from "react";
import {
  Terminal as TerminalIcon,
  Cpu,
  X,
  Maximize2,
  Minimize2,
  CheckCircle,
  AlertTriangle,
  RotateCw,
  RefreshCw,
  Server,
} from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import { TerminalPanel } from "./TerminalPanel";
import { containerService } from "../../services/containerService";
import { type ContainerInfo, type DockerStatus } from "../../types/container";

interface BottomPanelProps {
  projectId: string;
  projectName?: string;
  isOpen: boolean;
  onClose: () => void;
  height: number;
  onHeightChange: (h: number) => void;
}

export type BottomPanelTab = "terminal" | "specs" | "quickrun";

export const BottomPanel: React.FC<BottomPanelProps> = ({
  projectId,
  projectName = "Project",
  isOpen,
  onClose,
  height,
  onHeightChange,
}) => {
  const { isDark } = useTheme();
  const [activeTab, setActiveTab] = useState<BottomPanelTab>("terminal");
  const [isMaximized, setIsMaximized] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Container & Docker diagnostics
  const [containerInfo, setContainerInfo] = useState<ContainerInfo | null>(null);
  const [dockerStatus, setDockerStatus] = useState<DockerStatus | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchDiagnostics = async () => {
    setIsRefreshing(true);
    try {
      const data = await containerService.getStatus(projectId);
      setDockerStatus(data.docker);
      setContainerInfo(data.container);
    } catch {
      // ignore
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchDiagnostics();
    }
  }, [isOpen, projectId]);

  // Drag resize handler
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const newHeight = Math.max(120, Math.min(window.innerHeight - 150, window.innerHeight - e.clientY));
      onHeightChange(newHeight);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.body.style.cursor = "row-resize";
      document.body.style.userSelect = "none";
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, onHeightChange]);

  if (!isOpen) return null;

  const currentHeight = isMaximized ? "calc(100vh - 120px)" : `${height}px`;

  return (
    <div
      style={{ height: currentHeight }}
      className={`relative w-full border-t flex flex-col shrink-0 z-20 transition-all duration-75 select-none font-sans ${
        isDark ? "bg-[#09090b] border-neutral-800" : "bg-white border-neutral-200"
      }`}
    >
      {/* Resizing Drag Handle (Top Edge) */}
      {!isMaximized && (
        <div
          onMouseDown={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          className="absolute -top-1 left-0 right-0 h-2 cursor-row-resize hover:bg-blue-500/40 z-30 transition-colors"
          title="Drag to resize terminal panel"
        />
      )}

      {/* Main Drawer Header */}
      <div
        className={`flex items-center justify-between px-3 h-8 border-b shrink-0 text-xs ${
          isDark ? "bg-black border-neutral-800 text-neutral-400" : "bg-neutral-100 border-neutral-200 text-neutral-600"
        }`}
      >
        {/* Left: Tab Selectors */}
        <div className="flex items-center gap-1 font-semibold">
          <button
            onClick={() => setActiveTab("terminal")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-colors cursor-pointer ${
              activeTab === "terminal"
                ? isDark
                  ? "bg-neutral-900 text-blue-400 shadow-xs"
                  : "bg-white text-blue-600 shadow-xs"
                : isDark
                ? "hover:text-white"
                : "hover:text-black"
            }`}
          >
            <TerminalIcon className="w-3.5 h-3.5" />
            <span>Terminal</span>
          </button>

          <button
            onClick={() => setActiveTab("specs")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-colors cursor-pointer ${
              activeTab === "specs"
                ? isDark
                  ? "bg-neutral-900 text-blue-400 shadow-xs"
                  : "bg-white text-blue-600 shadow-xs"
                : isDark
                ? "hover:text-white"
                : "hover:text-black"
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Container Specs & Diagnostics</span>
          </button>
        </div>

        {/* Right: Drawer Actions (Maximize, Minimize, Close) */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMaximized((prev) => !prev)}
            className={`p-1 rounded transition-colors cursor-pointer ${
              isDark ? "hover:bg-neutral-800 text-neutral-400 hover:text-white" : "hover:bg-neutral-200 text-neutral-600"
            }`}
            title={isMaximized ? "Restore Size" : "Maximize Panel"}
          >
            {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={onClose}
            className={`p-1 rounded transition-colors cursor-pointer ${
              isDark ? "hover:bg-neutral-800 hover:text-red-400" : "hover:bg-neutral-200 hover:text-red-600"
            }`}
            title="Close Panel (Ctrl+`)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 w-full overflow-hidden">
        {activeTab === "terminal" ? (
          <TerminalPanel projectId={projectId} projectName={projectName} />
        ) : (
          <div className="h-full overflow-y-auto p-4 space-y-4">
            {/* Header & Refresh */}
            <div className={`flex items-center justify-between pb-2 border-b ${isDark ? "border-neutral-800" : "border-neutral-200"}`}>
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-blue-500" />
                <h3 className={`font-semibold text-sm ${isDark ? "text-white" : "text-neutral-900"}`}>Project Execution Container Diagnostics</h3>
              </div>
              <button
                onClick={fetchDiagnostics}
                disabled={isRefreshing}
                className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded transition-colors cursor-pointer border ${
                  isDark
                    ? "bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border-neutral-700"
                    : "bg-neutral-100 hover:bg-neutral-200 text-neutral-700 border-neutral-300"
                }`}
              >
                <RefreshCw className={`w-3 h-3 ${isRefreshing ? "animate-spin text-blue-500" : ""}`} />
                <span>Refresh</span>
              </button>
            </div>

            {/* Docker Daemon Status Card */}
            <div
              className={`p-3 rounded-lg border text-xs space-y-2 ${
                dockerStatus?.available
                  ? isDark
                    ? "bg-emerald-950/20 border-emerald-800/40 text-neutral-300"
                    : "bg-emerald-50 border-emerald-200 text-neutral-800"
                  : isDark
                  ? "bg-amber-950/20 border-amber-800/40 text-neutral-300"
                  : "bg-amber-50 border-amber-200 text-neutral-800"
              }`}
            >
              <div className="flex items-center gap-2 font-semibold">
                {dockerStatus?.available ? (
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                )}
                <span>Docker Engine Status: {dockerStatus?.available ? "Online" : "Offline (Local Fallback)"}</span>
              </div>
              <p className="text-[11px] opacity-80">
                {dockerStatus?.available
                  ? `Connected to Docker v${dockerStatus.version || "29.x"} (${dockerStatus.os || "Linux/Windows"}). Total active containers: ${
                      dockerStatus.containersRunning || 0
                    }.`
                  : dockerStatus?.error ||
                    "Docker daemon is not running on host. Commands will execute in the dedicated local workspace folder."}
              </p>
            </div>

            {/* Container Specs Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
              <div className={`p-3 rounded-lg border ${isDark ? "bg-neutral-900 border-neutral-800" : "bg-neutral-50 border-neutral-200 shadow-2xs"}`}>
                <div className={`${isDark ? "text-neutral-400" : "text-neutral-600"} font-semibold mb-1`}>Container Name</div>
                <div className="font-mono text-blue-500 font-medium">{containerInfo?.name || `cloudforge-ws-${projectId}`}</div>
              </div>

              <div className={`p-3 rounded-lg border ${isDark ? "bg-neutral-900 border-neutral-800" : "bg-neutral-50 border-neutral-200 shadow-2xs"}`}>
                <div className={`${isDark ? "text-neutral-400" : "text-neutral-600"} font-semibold mb-1`}>Runtime & Base Image</div>
                <div className="font-mono text-emerald-500 font-medium">{containerInfo?.runtime?.image || "node:20-bookworm-slim"}</div>
              </div>

              <div className={`p-3 rounded-lg border ${isDark ? "bg-neutral-900 border-neutral-800" : "bg-neutral-50 border-neutral-200 shadow-2xs"}`}>
                <div className={`${isDark ? "text-neutral-400" : "text-neutral-600"} font-semibold mb-1`}>Memory & CPU Quotas</div>
                <div className="font-mono text-purple-500 font-medium">{containerInfo?.memoryLimit || "1536 MB"} RAM | {containerInfo?.cpuLimit || "1.5 Cores"}</div>
              </div>

              <div className={`p-3 rounded-lg border ${isDark ? "bg-neutral-900 border-neutral-800" : "bg-neutral-50 border-neutral-200 shadow-2xs"}`}>
                <div className={`${isDark ? "text-neutral-400" : "text-neutral-600"} font-semibold mb-1`}>In-Container Path</div>
                <div className="font-mono text-amber-600 dark:text-amber-400 font-medium">/workspace</div>
              </div>

              <div className={`p-3 rounded-lg border sm:col-span-2 ${isDark ? "bg-neutral-900 border-neutral-800" : "bg-neutral-50 border-neutral-200 shadow-2xs"}`}>
                <div className={`${isDark ? "text-neutral-400" : "text-neutral-600"} font-semibold mb-1`}>Host Persistent Storage Location</div>
                <div className="font-mono text-[11px] break-all opacity-80">{containerInfo?.workspaceDir || "Backend/storage/workspaces/..."}</div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="pt-2 flex flex-wrap gap-2">
              <button
                onClick={async () => {
                  if (confirm("Are you sure you want to rebuild this project's container from scratch?")) {
                    await containerService.rebuildContainer(projectId);
                    await fetchDiagnostics();
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/30 text-xs font-semibold cursor-pointer transition-colors"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Rebuild Fresh Container</span>
              </button>

              <button
                onClick={async () => {
                  const res = await containerService.syncFiles(projectId);
                  alert(res.message);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-500/30 text-xs font-semibold cursor-pointer transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Re-Sync All Project Files</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BottomPanel;
