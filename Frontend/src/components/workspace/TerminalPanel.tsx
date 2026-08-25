import React, { useEffect, useRef, useState, useCallback } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import {
  Terminal as TerminalIcon,
  Play,
  Square,
  RotateCw,
  RefreshCw,
  Plus,
  X,
  Trash2,
  AlertTriangle,
  ChevronDown,
  Sparkles,
} from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import { containerService } from "../../services/containerService";
import { type ContainerInfo, type DockerStatus, type TerminalTab } from "../../types/container";

interface TerminalPanelProps {
  projectId: string;
  projectName?: string;
  onClose?: () => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export const TerminalPanel: React.FC<TerminalPanelProps> = ({
  projectId,
}) => {
  const { isDark } = useTheme();

  // Tabs state
  const [tabs, setTabs] = useState<TerminalTab[]>([
    { id: "tab-1", name: "Terminal 1", type: "shell", createdAt: new Date(), status: "connecting" },
  ]);
  const [activeTabId, setActiveTabId] = useState<string>("tab-1");

  // Container & Docker status
  const [containerInfo, setContainerInfo] = useState<ContainerInfo | null>(null);
  const [dockerStatus, setDockerStatus] = useState<DockerStatus | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [showQuickCommands, setShowQuickCommands] = useState(false);

  // Terminal DOM container & instance refs
  const terminalRef = useRef<HTMLDivElement>(null);
  const termInstanceRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Fetch container status
  const refreshStatus = useCallback(async () => {
    try {
      const data = await containerService.getStatus(projectId);
      setDockerStatus(data.docker);
      setContainerInfo(data.container);
    } catch (err) {
      console.warn("Failed to fetch container status:", err);
    }
  }, [projectId]);

  useEffect(() => {
    refreshStatus();
    const interval = setInterval(refreshStatus, 8000);
    return () => clearInterval(interval);
  }, [refreshStatus]);

  // Connect / Reconnect terminal WebSocket for active tab
  const connectTerminal = useCallback(() => {
    if (!terminalRef.current) return;

    // Clean up previous instance
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (termInstanceRef.current) {
      termInstanceRef.current.dispose();
      termInstanceRef.current = null;
    }

    // Theme-tailored xterm colors
    const termTheme = isDark
      ? {
          background: "#09090b",
          foreground: "#f4f4f5",
          cursor: "#3b82f6",
          selectionBackground: "rgba(59, 130, 246, 0.35)",
          black: "#18181b",
          red: "#ef4444",
          green: "#22c55e",
          yellow: "#eab308",
          blue: "#3b82f6",
          magenta: "#d946ef",
          cyan: "#06b6d4",
          white: "#f4f4f5",
          brightBlack: "#71717a",
          brightRed: "#f87171",
          brightGreen: "#4ade80",
          brightYellow: "#fde047",
          brightBlue: "#60a5fa",
          brightMagenta: "#e879f9",
          brightCyan: "#22d3ee",
          brightWhite: "#ffffff",
        }
      : {
          background: "#ffffff",
          foreground: "#0f172a",
          cursor: "#2563eb",
          selectionBackground: "rgba(37, 99, 235, 0.20)",
          black: "#0f172a",
          red: "#dc2626",
          green: "#16a34a",
          yellow: "#d97706",
          blue: "#2563eb",
          magenta: "#9333ea",
          cyan: "#0284c7",
          white: "#64748b",
          brightBlack: "#475569",
          brightRed: "#ef4444",
          brightGreen: "#10b981",
          brightYellow: "#f59e0b",
          brightBlue: "#3b82f6",
          brightMagenta: "#a855f7",
          brightCyan: "#06b6d4",
          brightWhite: "#0f172a",
        };

    // Initialize xterm
    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: "bar",
      fontSize: 13,
      lineHeight: 1.25,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Menlo, Monaco, Consolas, monospace",
      theme: termTheme,
      convertEol: true,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);

    term.open(terminalRef.current);
    fitAddon.fit();

    termInstanceRef.current = term;
    fitAddonRef.current = fitAddon;

    const cols = term.cols || 80;
    const rows = term.rows || 24;

    const wsUrl = containerService.getTerminalWsUrl(projectId, activeTabId, cols, rows);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setTabs((prev) =>
        prev.map((t) => (t.id === activeTabId ? { ...t, status: "connected" } : t))
      );
      fitAddon.fit();
      ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "output" && msg.data) {
          term.write(msg.data);
        } else if (msg.type === "ready") {
          if (msg.container) {
            setContainerInfo(msg.container);
          }
        } else if (msg.type === "container_status" && msg.container) {
          setContainerInfo(msg.container);
        }
      } catch {
        term.write(event.data);
      }
    };

    ws.onclose = () => {
      setTabs((prev) =>
        prev.map((t) => (t.id === activeTabId ? { ...t, status: "disconnected" } : t))
      );
    };

    ws.onerror = () => {
      setTabs((prev) =>
        prev.map((t) => (t.id === activeTabId ? { ...t, status: "error" } : t))
      );
    };

    // User typing in terminal -> send to WS
    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "input", data }));
      }
    });

    // Resize handling
    term.onResize(({ cols, rows }) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "resize", cols, rows }));
      }
    });
  }, [projectId, activeTabId, isDark]);

  useEffect(() => {
    connectTerminal();

    const handleResize = () => {
      if (fitAddonRef.current) {
        try {
          fitAddonRef.current.fit();
        } catch {
          // ignore
        }
      }
    };

    window.addEventListener("resize", handleResize);

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });

    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current);
    }

    return () => {
      window.removeEventListener("resize", handleResize);
      resizeObserver.disconnect();
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (termInstanceRef.current) {
        termInstanceRef.current.dispose();
      }
    };
  }, [connectTerminal]);

  // Tab operations
  const handleAddTab = () => {
    const nextNum = tabs.length + 1;
    const newTabId = `tab-${Date.now()}`;
    const newTab: TerminalTab = {
      id: newTabId,
      name: `Terminal ${nextNum}`,
      type: "shell",
      createdAt: new Date(),
      status: "connecting",
    };
    setTabs([...tabs, newTab]);
    setActiveTabId(newTabId);
  };

  const handleCloseTab = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tabs.length === 1) return; // Keep at least one tab
    const nextTabs = tabs.filter((t) => t.id !== tabId);
    setTabs(nextTabs);
    if (activeTabId === tabId) {
      setActiveTabId(nextTabs[nextTabs.length - 1].id);
    }
  };

  // Container Controls
  const handleStartContainer = async () => {
    setIsActionLoading(true);
    try {
      await containerService.startContainer(projectId);
      await refreshStatus();
      connectTerminal();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleStopContainer = async () => {
    setIsActionLoading(true);
    try {
      await containerService.stopContainer(projectId);
      await refreshStatus();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleRestartContainer = async () => {
    setIsActionLoading(true);
    try {
      await containerService.restartContainer(projectId);
      await refreshStatus();
      connectTerminal();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleSyncFiles = async () => {
    setIsActionLoading(true);
    try {
      const res = await containerService.syncFiles(projectId);
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "sync_files" }));
      }
      alert(res.message);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleClearTerminal = () => {
    if (termInstanceRef.current) {
      termInstanceRef.current.clear();
    }
  };

  const sendCommandToTerminal = (cmd: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "input", data: cmd + "\r" }));
      setShowQuickCommands(false);
    }
  };

  // Dynamically update live xterm theme when user toggles dark/light mode
  useEffect(() => {
    if (termInstanceRef.current) {
      termInstanceRef.current.options.theme = isDark
        ? {
            background: "#09090b",
            foreground: "#f4f4f5",
            cursor: "#3b82f6",
            selectionBackground: "rgba(59, 130, 246, 0.35)",
            black: "#18181b",
            red: "#ef4444",
            green: "#22c55e",
            yellow: "#eab308",
            blue: "#3b82f6",
            magenta: "#d946ef",
            cyan: "#06b6d4",
            white: "#f4f4f5",
            brightBlack: "#71717a",
            brightRed: "#f87171",
            brightGreen: "#4ade80",
            brightYellow: "#fde047",
            brightBlue: "#60a5fa",
            brightMagenta: "#e879f9",
            brightCyan: "#22d3ee",
            brightWhite: "#ffffff",
          }
        : {
            background: "#ffffff",
            foreground: "#0f172a",
            cursor: "#2563eb",
            selectionBackground: "rgba(37, 99, 235, 0.20)",
            black: "#0f172a",
            red: "#dc2626",
            green: "#16a34a",
            yellow: "#d97706",
            blue: "#2563eb",
            magenta: "#9333ea",
            cyan: "#0284c7",
            white: "#64748b",
            brightBlack: "#475569",
            brightRed: "#ef4444",
            brightGreen: "#10b981",
            brightYellow: "#f59e0b",
            brightBlue: "#3b82f6",
            brightMagenta: "#a855f7",
            brightCyan: "#06b6d4",
            brightWhite: "#0f172a",
          };
      fitAddonRef.current?.fit();
    }
  }, [isDark]);

  const isRunning = containerInfo?.status === "running";
  const isFallback = containerInfo?.status === "fallback_shell" || dockerStatus?.status === "offline";

  return (
    <div
      className={`h-full flex flex-col select-none transition-colors duration-150 font-sans ${
        isDark ? "bg-[#09090b] text-neutral-200" : "bg-neutral-50 text-neutral-800"
      }`}
    >
      {/* Top Header & Tabs Bar */}
      <div
        className={`flex items-center justify-between border-b px-2 h-9 shrink-0 text-xs ${
          isDark ? "bg-black border-neutral-800" : "bg-white border-neutral-200"
        }`}
      >
        {/* Left: Terminal Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            return (
              <div
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                className={`group flex items-center gap-1.5 px-2.5 py-1 rounded text-xs cursor-pointer transition-all ${
                  isActive
                    ? isDark
                      ? "bg-neutral-800 text-blue-400 font-semibold shadow-xs"
                      : "bg-blue-50 text-blue-700 border border-blue-200 font-semibold shadow-xs"
                    : isDark
                    ? "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200"
                    : "text-neutral-600 hover:bg-neutral-100 hover:text-black"
                }`}
              >
                <TerminalIcon className="w-3.5 h-3.5" />
                <span>{tab.name}</span>
                {tabs.length > 1 && (
                  <button
                    onClick={(e) => handleCloseTab(tab.id, e)}
                    className="opacity-0 group-hover:opacity-100 hover:text-red-500 rounded p-0.5"
                    title="Close Terminal Tab"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}

          <button
            onClick={handleAddTab}
            className={`p-1 rounded transition-colors cursor-pointer ${
              isDark ? "hover:bg-neutral-800 text-neutral-400" : "hover:bg-neutral-200 text-neutral-600"
            }`}
            title="Open New Terminal Tab"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Right: Container Status Pill & Toolbar Actions */}
        <div className="flex items-center gap-2">
          {/* Status Badge */}
          <div
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono border ${
              isFallback
                ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                : isRunning
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                : "bg-neutral-500/10 text-neutral-400 border-neutral-500/30"
            }`}
            title={
              isFallback
                ? "Docker daemon is offline. Running commands in local workspace storage."
                : `Container: ${containerInfo?.name || "cloudforge-ws"} (${containerInfo?.runtime?.displayName || "Node.js 20"})`
            }
          >
            {isFallback ? (
              <AlertTriangle className="w-3 h-3 text-amber-400" />
            ) : isRunning ? (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-neutral-400" />
            )}
            <span className="font-semibold hidden sm:inline">
              {isFallback
                ? "Host Workspace"
                : isRunning
                ? `${containerInfo?.runtime?.displayName || "Container Running"}`
                : "Container Stopped"}
            </span>
          </div>

          {/* Quick Commands Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowQuickCommands((prev) => !prev)}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] transition-colors cursor-pointer border ${
                isDark
                  ? "bg-neutral-900 border-neutral-700 hover:bg-neutral-800 text-neutral-300"
                  : "bg-neutral-100 border-neutral-300 hover:bg-neutral-200 text-neutral-700"
              }`}
              title="Run quick developer commands"
            >
              <Sparkles className="w-3 h-3 text-blue-400" />
              <span>Quick Scripts</span>
              <ChevronDown className="w-3 h-3 opacity-70" />
            </button>

            {showQuickCommands && (
              <div
                className={`absolute right-0 mt-1 w-52 rounded-lg shadow-xl border z-50 py-1 text-xs ${
                  isDark ? "bg-neutral-900 border-neutral-700" : "bg-white border-neutral-200"
                }`}
              >
                <div className="px-2 py-1 font-semibold text-[10px] uppercase tracking-wider text-neutral-400 border-b border-neutral-800">
                  Node & JS Commands
                </div>
                <button
                  onClick={() => sendCommandToTerminal("npm install")}
                  className="w-full text-left px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between"
                >
                  <span>npm install</span>
                  <span className="text-[10px] opacity-60">Install deps</span>
                </button>
                <button
                  onClick={() => sendCommandToTerminal("npm run dev")}
                  className="w-full text-left px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between"
                >
                  <span>npm run dev</span>
                  <span className="text-[10px] opacity-60">Start dev server</span>
                </button>
                <button
                  onClick={() => sendCommandToTerminal("npm run build")}
                  className="w-full text-left px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between"
                >
                  <span>npm run build</span>
                  <span className="text-[10px] opacity-60">Production build</span>
                </button>

                <div className="px-2 py-1 font-semibold text-[10px] uppercase tracking-wider text-neutral-400 border-t border-b border-neutral-800 mt-1">
                  Python Commands
                </div>
                <button
                  onClick={() => sendCommandToTerminal("python main.py")}
                  className="w-full text-left px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between"
                >
                  <span>python main.py</span>
                  <span className="text-[10px] opacity-60">Execute</span>
                </button>
                <button
                  onClick={() => sendCommandToTerminal("pip install -r requirements.txt")}
                  className="w-full text-left px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between"
                >
                  <span>pip install</span>
                  <span className="text-[10px] opacity-60">Requirements</span>
                </button>

                <div className="px-2 py-1 font-semibold text-[10px] uppercase tracking-wider text-neutral-400 border-t border-b border-neutral-800 mt-1">
                  System
                </div>
                <button
                  onClick={() => sendCommandToTerminal("ls -la")}
                  className="w-full text-left px-3 py-1.5 hover:bg-blue-600 hover:text-white"
                >
                  ls -la (List workspace)
                </button>
              </div>
            )}
          </div>

          {/* Start / Stop / Restart Container */}
          {!isRunning && !isFallback ? (
            <button
              onClick={handleStartContainer}
              disabled={isActionLoading}
              className="flex items-center gap-1 px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-50"
              title="Start Project Docker Container"
            >
              <Play className="w-3 h-3" />
              <span className="hidden md:inline">Start Container</span>
            </button>
          ) : isRunning ? (
            <button
              onClick={handleStopContainer}
              disabled={isActionLoading}
              className="flex items-center gap-1 px-2 py-1 rounded bg-red-600/80 hover:bg-red-600 text-white text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-50"
              title="Stop Container"
            >
              <Square className="w-3 h-3" />
              <span className="hidden md:inline">Stop</span>
            </button>
          ) : null}

          <button
            onClick={handleRestartContainer}
            disabled={isActionLoading}
            className={`p-1.5 rounded transition-colors cursor-pointer ${
              isDark ? "hover:bg-neutral-800 text-neutral-400 hover:text-white" : "hover:bg-neutral-200 text-neutral-600"
            }`}
            title="Restart Container / Shell Session"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isActionLoading ? "animate-spin text-blue-400" : ""}`} />
          </button>

          <button
            onClick={handleSyncFiles}
            disabled={isActionLoading}
            className={`p-1.5 rounded transition-colors cursor-pointer ${
              isDark ? "hover:bg-neutral-800 text-neutral-400 hover:text-white" : "hover:bg-neutral-200 text-neutral-600"
            }`}
            title="Force Re-Sync Source Files to Container Workspace"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleClearTerminal}
            className={`p-1.5 rounded transition-colors cursor-pointer ${
              isDark ? "hover:bg-neutral-800 text-neutral-400 hover:text-white" : "hover:bg-neutral-200 text-neutral-600"
            }`}
            title="Clear Terminal Buffer (Ctrl+L)"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Terminal Viewport */}
      <div className={`flex-1 w-full relative overflow-hidden p-1.5 transition-colors ${isDark ? "bg-[#09090b]" : "bg-white"}`}>
        <div ref={terminalRef} className="w-full h-full" />
      </div>
    </div>
  );
};

export default TerminalPanel;
