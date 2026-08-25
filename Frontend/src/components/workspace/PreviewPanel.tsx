import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  RefreshCw,
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Play,
  Square,
  RotateCw,
  Smartphone,
  Tablet,
  Monitor,
  Sparkles,
  Plus,
  X,
  Lock,
  Terminal,
  Trash2,
} from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import { previewService } from "../../services/previewService";
import {
  type DetectedFramework,
  type ActivePort,
  type ViewportMode,
} from "../../types/preview";
import { type WorkspaceFile } from "../../types/workspace";

interface PreviewPanelProps {
  projectId: string;
  projectName?: string;
  files?: WorkspaceFile[];
  onClose?: () => void;
}

interface ConsoleLog {
  id: string;
  type: "log" | "info" | "warn" | "error";
  message: string;
  timestamp: string;
}

type PreviewEngineMode = "auto" | "live_virtual" | "container_proxy";

export const PreviewPanel: React.FC<PreviewPanelProps> = ({
  projectId,
  projectName = "CloudForge App",
  files = [],
  onClose,
}) => {
  const { isDark } = useTheme();

  // State
  const [framework, setFramework] = useState<DetectedFramework | null>(null);
  const [activePorts, setActivePorts] = useState<ActivePort[]>([]);
  const [selectedPort, setSelectedPort] = useState<number>(5173);
  const [currentPath, setCurrentPath] = useState<string>("/");
  const [inputUrl, setInputUrl] = useState<string>("/");
  const [viewportMode, setViewportMode] = useState<ViewportMode>("desktop");
  const [isRotated, setIsRotated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isServerStarting, setIsServerStarting] = useState<boolean>(false);
  const [customCommand, setCustomCommand] = useState<string>("");
  const [customPortInput, setCustomPortInput] = useState<string>("");
  const [showAddPort, setShowAddPort] = useState<boolean>(false);
  const [iframeKey, setIframeKey] = useState<number>(1);

  // Engine mode & Developer Console
  const [engineMode, setEngineMode] = useState<PreviewEngineMode>("auto");
  const [consoleLogs, setConsoleLogs] = useState<ConsoleLog[]>([]);
  const [isConsoleOpen, setIsConsoleOpen] = useState<boolean>(false);

  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Fetch framework & active listening ports
  const fetchPreviewData = useCallback(async () => {
    try {
      const data = await previewService.getPreviewInfo(projectId);
      if (data.framework) {
        setFramework(data.framework);
        if (!customCommand) {
          setCustomCommand(data.framework.startCommand);
        }
      }
      if (data.activePorts && data.activePorts.length > 0) {
        setActivePorts(data.activePorts);
        const primary = data.activePorts.find((p) => p.isPrimary) || data.activePorts[0];
        if (!selectedPort || !data.activePorts.some((p) => p.port === selectedPort)) {
          setSelectedPort(primary.port);
        }
      }
    } catch (err) {
      console.warn("Failed to fetch preview info:", err);
    }
  }, [projectId, selectedPort, customCommand]);

  useEffect(() => {
    fetchPreviewData();
    const interval = setInterval(fetchPreviewData, 6000);
    return () => clearInterval(interval);
  }, [fetchPreviewData]);

  // Listen to postMessage console logs from inside preview iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === "CLOUDFORGE_CONSOLE_LOG") {
        const newLog: ConsoleLog = {
          id: Math.random().toString(36).substring(7),
          type: event.data.level || "log",
          message: event.data.message || "",
          timestamp: new Date().toLocaleTimeString(),
        };
        setConsoleLogs((prev) => [...prev.slice(-100), newLog]);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const isCurrentPortActive = activePorts.some((p) => p.port === selectedPort && p.status === "active");

  // Determine active rendering engine
  const activeEngine = useMemo(() => {
    if (engineMode === "live_virtual") return "live_virtual";
    if (engineMode === "container_proxy") return "container_proxy";
    return isCurrentPortActive ? "container_proxy" : "live_virtual";
  }, [engineMode, isCurrentPortActive]);

  // Construct Realistic Cloud Domain URL
  const cloudDomainUrl = useMemo(() => {
    const shortId = projectId.toString().substring(0, 8);
    const cleanSubpath = currentPath.startsWith("/") ? currentPath : `/${currentPath}`;
    return `https://${selectedPort}-${shortId}.preview.cloudforge.dev${cleanSubpath === "/" ? "" : cleanSubpath}`;
  }, [projectId, selectedPort, currentPath]);

  // Real backend proxy URL
  const rawProxyUrl = previewService.getPreviewUrl(projectId, selectedPort, currentPath);

  // Generate in-browser virtual live document from workspace files
  const virtualLiveHtml = useMemo(() => {
    if (activeEngine !== "live_virtual") return "";

    const htmlFile = files.find((f) => f.name.toLowerCase() === "index.html" || f.name.endsWith(".html"));
    const cssFiles = files.filter((f) => f.name.endsWith(".css") && f.content);
    const jsFiles = files.filter(
      (f) => (f.name.endsWith(".js") || f.name.endsWith(".ts") || f.name.endsWith(".jsx") || f.name.endsWith(".tsx")) && f.content
    );

    const compiledCss = cssFiles.map((c) => `<style>\n/* ${c.name} */\n${c.content}\n</style>`).join("\n");

    // Console logger bridge script
    const consoleBridge = `
      <script>
        (function() {
          const sendLog = (level, args) => {
            try {
              const msg = Array.from(args).map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
              window.parent.postMessage({ type: 'CLOUDFORGE_CONSOLE_LOG', level, message: msg }, '*');
            } catch(e){}
          };
          const origLog = console.log, origWarn = console.warn, origError = console.error, origInfo = console.info;
          console.log = (...args) => { origLog.apply(console, args); sendLog('log', args); };
          console.warn = (...args) => { origWarn.apply(console, args); sendLog('warn', args); };
          console.error = (...args) => { origError.apply(console, args); sendLog('error', args); };
          console.info = (...args) => { origInfo.apply(console, args); sendLog('info', args); };
          window.onerror = (msg, url, line) => { sendLog('error', [msg + ' at line ' + line]); };
        })();
      </script>
    `;

    if (htmlFile && htmlFile.content) {
      let content = htmlFile.content;
      // Inject console bridge & CSS
      if (content.includes("<head>")) {
        content = content.replace("<head>", `<head>\n${consoleBridge}\n${compiledCss}\n<script src="https://cdn.tailwindcss.com"></script>`);
      } else {
        content = `${consoleBridge}\n${compiledCss}\n${content}`;
      }
      return content;
    }

    // React / JS App fallback renderer
    const reactAppFile = jsFiles.find((f) => f.name.includes("App.") || f.name.includes("main.") || f.name.includes("index."));
    const appCode = reactAppFile?.content || "document.body.innerHTML = '<h1 style=\"font-family:sans-serif;text-align:center;padding:4rem;\">⚡ CloudForge Live App Ready</h1>';";

    return `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>${projectName}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
          ${consoleBridge}
          ${compiledCss}
          <style>
            body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #ffffff; color: #0f172a; }
          </style>
        </head>
        <body>
          <div id="root"></div>
          <script type="text/babel">
            try {
              ${appCode}
            } catch(err) {
              console.error(err);
              document.getElementById('root').innerHTML = '<div style="padding:2rem;color:#ef4444;font-family:monospace;"><h3>Runtime Error</h3><p>' + err.message + '</p></div>';
            }
          </script>
        </body>
      </html>
    `;
  }, [activeEngine, files, projectName]);

  // Handle navigate
  const handleNavigate = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    let formatted = inputUrl.trim();
    if (!formatted.startsWith("/")) {
      formatted = "/" + formatted;
    }
    setCurrentPath(formatted);
    setIframeKey((prev) => prev + 1);
  };

  // Reload iframe
  const handleRefresh = () => {
    setIsLoading(true);
    setIframeKey((prev) => prev + 1);
    fetchPreviewData();
  };

  // Start Dev Server
  const handleStartServer = async () => {
    setIsServerStarting(true);
    try {
      await previewService.startDevServer(projectId, customCommand, selectedPort);
      await fetchPreviewData();
      setEngineMode("container_proxy");
      setIframeKey((prev) => prev + 1);
    } catch (err: any) {
      alert(err.message || "Failed to start dev server");
    } finally {
      setIsServerStarting(false);
    }
  };

  // Stop Dev Server
  const handleStopServer = async () => {
    setIsServerStarting(true);
    try {
      await previewService.stopDevServer(projectId, selectedPort);
      await fetchPreviewData();
    } catch (err: any) {
      alert(err.message || "Failed to stop dev server");
    } finally {
      setIsServerStarting(false);
    }
  };

  // Add custom port tab
  const handleAddCustomPort = (e: React.FormEvent) => {
    e.preventDefault();
    const p = parseInt(customPortInput, 10);
    if (!isNaN(p) && p >= 1024 && p <= 65535) {
      if (!activePorts.some((item) => item.port === p)) {
        setActivePorts([
          ...activePorts,
          {
            port: p,
            isPrimary: false,
            framework: "Custom Port",
            url: previewService.getPreviewUrl(projectId, p),
            containerIp: "127.0.0.1",
            status: "active",
          },
        ]);
      }
      setSelectedPort(p);
      setShowAddPort(false);
      setCustomPortInput("");
      setIframeKey((prev) => prev + 1);
    }
  };

  // Determine viewport width & frame styling
  const getViewportDimensions = () => {
    if (viewportMode === "mobile") {
      return {
        width: isRotated ? "852px" : "393px",
        height: isRotated ? "393px" : "852px",
        deviceLabel: isRotated ? "iPhone 15 (Landscape) • 852 × 393" : "iPhone 15 Pro • 393 × 852",
      };
    }
    if (viewportMode === "tablet") {
      return {
        width: isRotated ? "1180px" : "820px",
        height: isRotated ? "820px" : "1180px",
        deviceLabel: isRotated ? "iPad Air (Landscape) • 1180 × 820" : "iPad Air • 820 × 1180",
      };
    }
    return {
      width: "100%",
      height: "100%",
      deviceLabel: "Responsive Desktop • 100%",
    };
  };

  const currentDimensions = getViewportDimensions();

  const getFrameworkBadgeColor = () => {
    if (!framework) return "bg-blue-500/10 text-blue-500 border-blue-500/30";
    switch (framework.category) {
      case "frontend":
        return isDark ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/30" : "bg-cyan-50 text-cyan-700 border-cyan-200";
      case "fullstack":
        return isDark ? "bg-purple-500/10 text-purple-400 border-purple-500/30" : "bg-purple-50 text-purple-700 border-purple-200";
      case "backend":
        return isDark ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "data-app":
        return isDark ? "bg-amber-500/10 text-amber-400 border-amber-500/30" : "bg-amber-50 text-amber-700 border-amber-200";
      default:
        return isDark ? "bg-blue-500/10 text-blue-400 border-blue-500/30" : "bg-blue-50 text-blue-700 border-blue-200";
    }
  };

  return (
    <div
      className={`h-full w-full flex flex-col select-none transition-colors duration-150 font-sans ${
        isDark ? "bg-[#09090b] text-neutral-200" : "bg-neutral-50 text-neutral-800"
      }`}
    >
      {/* 1. Realistic Browser Window Chrome Header (Mac / Modern Web Style) */}
      <div
        className={`flex items-center justify-between gap-2 px-3 py-1.5 border-b shrink-0 text-xs ${
          isDark ? "bg-black border-neutral-800" : "bg-white border-neutral-200"
        }`}
      >
        {/* Left: Window Traffic Light Dots & Framework Badge */}
        <div className="flex items-center gap-2.5">
          {/* Mac Traffic Lights */}
          <div className="hidden sm:flex items-center gap-1.5 pr-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f56] inline-block shadow-2xs" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e] inline-block shadow-2xs" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#27c93f] inline-block shadow-2xs" />
          </div>

          {/* Framework Pill */}
          <div
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${getFrameworkBadgeColor()}`}
            title={framework?.description || "Auto-detected web runtime"}
          >
            <Sparkles className="w-3 h-3" />
            <span>{framework?.name || "Web Application"}</span>
          </div>

          {/* Engine Selector (Instant Virtual vs Cloud Container) */}
          <div className={`hidden md:flex items-center p-0.5 rounded-md border text-[11px] ${
            isDark ? "bg-neutral-900 border-neutral-800" : "bg-neutral-100 border-neutral-200"
          }`}>
            <button
              onClick={() => {
                setEngineMode("auto");
                setIframeKey((k) => k + 1);
              }}
              className={`px-2 py-0.5 rounded font-medium transition-colors cursor-pointer ${
                engineMode === "auto"
                  ? "bg-blue-600 text-white shadow-2xs"
                  : isDark ? "text-neutral-400 hover:text-white" : "text-neutral-600 hover:text-black"
              }`}
              title="Auto: uses container when server is active, instant live preview otherwise"
            >
              Auto Engine
            </button>
            <button
              onClick={() => {
                setEngineMode("live_virtual");
                setIframeKey((k) => k + 1);
              }}
              className={`px-2 py-0.5 rounded font-medium transition-colors cursor-pointer ${
                engineMode === "live_virtual"
                  ? "bg-blue-600 text-white shadow-2xs"
                  : isDark ? "text-neutral-400 hover:text-white" : "text-neutral-600 hover:text-black"
              }`}
              title="Instant Reactive HTML/React compiler directly from workspace files"
            >
              ⚡ Instant Live
            </button>
            <button
              onClick={() => {
                setEngineMode("container_proxy");
                setIframeKey((k) => k + 1);
              }}
              className={`px-2 py-0.5 rounded font-medium transition-colors cursor-pointer ${
                engineMode === "container_proxy"
                  ? "bg-blue-600 text-white shadow-2xs"
                  : isDark ? "text-neutral-400 hover:text-white" : "text-neutral-600 hover:text-black"
              }`}
              title="Reverse proxy directly to in-container backend server"
            >
              ☁️ Cloud Container
            </button>
          </div>
        </div>

        {/* Right: Ports, Server Actions, and Close */}
        <div className="flex items-center gap-2">
          {/* Active Ports Switcher */}
          <div className={`flex items-center gap-1 p-0.5 rounded-lg border ${
            isDark ? "bg-neutral-900/60 border-neutral-800" : "bg-neutral-100 border-neutral-200"
          }`}>
            {activePorts.map((p) => {
              const isSelected = p.port === selectedPort;
              return (
                <button
                  key={p.port}
                  onClick={() => {
                    setSelectedPort(p.port);
                    setIframeKey((k) => k + 1);
                  }}
                  className={`flex items-center gap-1 px-2 py-0.8 rounded text-[11px] font-mono font-medium transition-all cursor-pointer ${
                    isSelected
                      ? "bg-blue-600 text-white shadow-xs"
                      : isDark
                      ? "text-neutral-400 hover:text-white hover:bg-neutral-800"
                      : "text-neutral-600 hover:text-black hover:bg-neutral-200"
                  }`}
                  title={`Preview port :${p.port}`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      p.status === "active" ? "bg-emerald-400 animate-pulse" : isDark ? "bg-neutral-500" : "bg-neutral-400"
                    }`}
                  />
                  <span>:{p.port}</span>
                </button>
              );
            })}

            {/* Custom Port Form */}
            {!showAddPort ? (
              <button
                onClick={() => setShowAddPort(true)}
                className={`p-1 rounded transition-colors cursor-pointer ${
                  isDark ? "text-neutral-400 hover:text-white" : "text-neutral-600 hover:text-black"
                }`}
                title="Add custom preview port"
              >
                <Plus className="w-3 h-3" />
              </button>
            ) : (
              <form onSubmit={handleAddCustomPort} className="flex items-center gap-1 px-1">
                <input
                  type="number"
                  placeholder="Port"
                  value={customPortInput}
                  onChange={(e) => setCustomPortInput(e.target.value)}
                  className={`w-14 px-1 py-0.5 text-[10px] rounded font-mono focus:outline-none focus:border-blue-500 border ${
                    isDark ? "bg-black border-neutral-700 text-white" : "bg-white border-neutral-300 text-black"
                  }`}
                  autoFocus
                />
                <button type="submit" className="text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded cursor-pointer">
                  OK
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddPort(false)}
                  className="text-[10px] text-neutral-400 hover:text-red-500 px-1 cursor-pointer"
                >
                  ✕
                </button>
              </form>
            )}
          </div>

          {/* Dev Server Start / Stop */}
          {!isCurrentPortActive ? (
            <button
              onClick={handleStartServer}
              disabled={isServerStarting}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
              title={`Execute: ${customCommand || framework?.startCommand}`}
            >
              <Play className="w-3 h-3 fill-current" />
              <span>{isServerStarting ? "Starting..." : "Start Server"}</span>
            </button>
          ) : (
            <button
              onClick={handleStopServer}
              disabled={isServerStarting}
              className="flex items-center gap-1 px-2 py-1 rounded bg-red-600/80 hover:bg-red-600 text-white text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-50"
              title="Stop In-Container Server"
            >
              <Square className="w-3 h-3 fill-current" />
              <span>Stop</span>
            </button>
          )}

          {onClose && (
            <button
              onClick={onClose}
              className={`p-1.5 rounded transition-colors cursor-pointer ${
                isDark ? "hover:bg-neutral-800 text-neutral-400 hover:text-red-400" : "hover:bg-neutral-200 text-neutral-600 hover:text-red-600"
              }`}
              title="Close Preview Panel"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Realistic Cloud Address Bar (HTTPS, Lock Icon, Cloud Preview Domain) */}
      <div
        className={`flex items-center justify-between gap-2 px-3 py-1.5 border-b shrink-0 text-xs ${
          isDark ? "bg-neutral-950 border-neutral-800" : "bg-neutral-100 border-neutral-200"
        }`}
      >
        {/* Navigation Buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              try {
                iframeRef.current?.contentWindow?.history.back();
              } catch {}
            }}
            className={`p-1 rounded transition-colors cursor-pointer ${
              isDark ? "hover:bg-neutral-800 text-neutral-400" : "hover:bg-neutral-200 text-neutral-600"
            }`}
            title="Back"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => {
              try {
                iframeRef.current?.contentWindow?.history.forward();
              } catch {}
            }}
            className={`p-1 rounded transition-colors cursor-pointer ${
              isDark ? "hover:bg-neutral-800 text-neutral-400" : "hover:bg-neutral-200 text-neutral-600"
            }`}
            title="Forward"
          >
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleRefresh}
            className={`p-1 rounded transition-colors cursor-pointer ${
              isDark ? "hover:bg-neutral-800 text-neutral-400" : "hover:bg-neutral-200 text-neutral-600"
            }`}
            title="Reload Preview"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-blue-400" : ""}`} />
          </button>
        </div>

        {/* Realistic HTTPS Cloud URL Input Form */}
        <form onSubmit={handleNavigate} className="flex-1 max-w-xl flex items-center">
          <div
            title={`Active Cloud Sandbox URL: ${cloudDomainUrl}`}
            className={`w-full flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-mono transition-colors ${
              isDark
                ? "bg-black border-neutral-800 text-neutral-300 focus-within:border-blue-500"
                : "bg-white border-neutral-300 text-neutral-800 focus-within:border-blue-600 shadow-2xs"
            }`}
          >
            <Lock className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span className="text-neutral-500 select-none hidden sm:inline">
              https://{selectedPort}-{projectId.substring(0, 6)}.preview.cloudforge.dev
            </span>
            <input
              type="text"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              placeholder="/"
              className="w-full bg-transparent focus:outline-none text-xs font-mono"
            />
          </div>
        </form>

        {/* Viewport Selector, Zoom & Console Toggles */}
        <div className="flex items-center gap-1">
          {/* Desktop */}
          <button
            onClick={() => setViewportMode("desktop")}
            className={`p-1.5 rounded transition-colors cursor-pointer ${
              viewportMode === "desktop"
                ? isDark
                  ? "bg-neutral-800 text-blue-400 font-bold"
                  : "bg-white text-blue-600 font-bold shadow-xs"
                : isDark
                ? "text-neutral-400 hover:bg-neutral-800"
                : "text-neutral-600 hover:bg-neutral-200"
            }`}
            title="Desktop View (100%)"
          >
            <Monitor className="w-3.5 h-3.5" />
          </button>

          {/* Tablet */}
          <button
            onClick={() => setViewportMode("tablet")}
            className={`p-1.5 rounded transition-colors cursor-pointer ${
              viewportMode === "tablet"
                ? isDark
                  ? "bg-neutral-800 text-blue-400 font-bold"
                  : "bg-white text-blue-600 font-bold shadow-xs"
                : isDark
                ? "text-neutral-400 hover:bg-neutral-800"
                : "text-neutral-600 hover:bg-neutral-200"
            }`}
            title="Tablet View (iPad Air • 820px)"
          >
            <Tablet className="w-3.5 h-3.5" />
          </button>

          {/* Mobile */}
          <button
            onClick={() => setViewportMode("mobile")}
            className={`p-1.5 rounded transition-colors cursor-pointer ${
              viewportMode === "mobile"
                ? isDark
                  ? "bg-neutral-800 text-blue-400 font-bold"
                  : "bg-white text-blue-600 font-bold shadow-xs"
                : isDark
                ? "text-neutral-400 hover:bg-neutral-800"
                : "text-neutral-600 hover:bg-neutral-200"
            }`}
            title="Mobile View (iPhone 15 Pro • 393px)"
          >
            <Smartphone className="w-3.5 h-3.5" />
          </button>

          {/* Orientation Rotate */}
          {viewportMode !== "desktop" && (
            <button
              onClick={() => setIsRotated((prev) => !prev)}
              className={`p-1.5 rounded transition-colors cursor-pointer ${
                isRotated
                  ? "text-blue-500 bg-blue-500/15"
                  : isDark
                  ? "text-neutral-400 hover:bg-neutral-800"
                  : "text-neutral-600 hover:bg-neutral-200"
              }`}
              title="Rotate Screen Orientation"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
          )}

          {/* In-Preview Developer Console Button */}
          <button
            onClick={() => setIsConsoleOpen((prev) => !prev)}
            className={`flex items-center gap-1 px-1.5 py-1 rounded transition-colors cursor-pointer text-[11px] ${
              isConsoleOpen
                ? "bg-blue-600 text-white"
                : isDark
                ? "text-neutral-400 hover:bg-neutral-800"
                : "text-neutral-600 hover:bg-neutral-200"
            }`}
            title="Toggle Developer Logs Console"
          >
            <Terminal className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Logs</span>
            {consoleLogs.length > 0 && (
              <span className="px-1 bg-neutral-700/80 rounded-full text-[9px] text-white">
                {consoleLogs.length}
              </span>
            )}
          </button>

          {/* Open in External Browser Window */}
          <a
            href={activeEngine === "container_proxy" ? rawProxyUrl : "#"}
            onClick={(e) => {
              if (activeEngine === "live_virtual") {
                e.preventDefault();
                const win = window.open("", "_blank");
                if (win) {
                  win.document.write(virtualLiveHtml);
                  win.document.close();
                }
              }
            }}
            target="_blank"
            rel="noopener noreferrer"
            className={`p-1.5 rounded transition-colors cursor-pointer ${
              isDark ? "hover:bg-neutral-800 text-neutral-400 hover:text-white" : "hover:bg-neutral-200 text-neutral-600 hover:text-black"
            }`}
            title="Open Live Preview in New Window"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* 3. Main Viewport & Interactive Live Application Canvas */}
      <div className={`flex-1 w-full overflow-hidden flex flex-col items-center justify-center p-2 transition-colors relative ${
        isDark ? "bg-[#09090b]" : "bg-neutral-100/90"
      }`}>
        {/* Device Dimension Bar */}
        {viewportMode !== "desktop" && (
          <div className="text-[10px] text-neutral-500 font-mono mb-1.5 select-none">
            {currentDimensions.deviceLabel}
          </div>
        )}

        <div
          style={{
            width: currentDimensions.width,
            height: viewportMode === "desktop" ? "100%" : currentDimensions.height,
          }}
          className={`transition-all duration-200 flex flex-col relative overflow-hidden ${
            viewportMode !== "desktop"
              ? `rounded-2xl border-4 ${isDark ? "border-neutral-800" : "border-neutral-300"} shadow-2xl bg-white max-h-[96%]`
              : "w-full h-full"
          }`}
        >
          {/* Iframe View: Renders Live Virtual Compiled HTML or Container Proxy */}
          <iframe
            key={`${iframeKey}-${activeEngine}`}
            ref={iframeRef}
            src={activeEngine === "container_proxy" ? rawProxyUrl : undefined}
            srcDoc={activeEngine === "live_virtual" ? virtualLiveHtml : undefined}
            onLoad={() => setIsLoading(false)}
            title={`${projectName} Preview`}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads"
            className="w-full h-full border-0 bg-white"
          />
        </div>

        {/* 4. In-Preview Live Developer Console Drawer */}
        {isConsoleOpen && (
          <div
            className={`absolute bottom-0 left-0 right-0 h-44 border-t z-30 flex flex-col text-xs font-mono shadow-2xl ${
              isDark ? "bg-black border-neutral-800 text-neutral-300" : "bg-white border-neutral-200 text-neutral-800"
            }`}
          >
            <div className={`flex items-center justify-between px-3 py-1 border-b ${isDark ? "border-neutral-800" : "border-neutral-200"}`}>
              <div className="flex items-center gap-2 font-semibold">
                <Terminal className="w-3.5 h-3.5 text-blue-500" />
                <span>Developer Console Logs</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setConsoleLogs([])}
                  className={`p-1 rounded transition-colors cursor-pointer ${isDark ? "hover:bg-neutral-800" : "hover:bg-neutral-100"}`}
                  title="Clear Console"
                >
                  <Trash2 className="w-3 h-3 text-neutral-400" />
                </button>
                <button
                  onClick={() => setIsConsoleOpen(false)}
                  className={`p-1 rounded transition-colors cursor-pointer ${isDark ? "hover:bg-neutral-800" : "hover:bg-neutral-100"}`}
                  title="Close Console"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {consoleLogs.length === 0 ? (
                <div className="text-neutral-500 italic text-[11px] p-2 text-center">
                  No console logs recorded yet.
                </div>
              ) : (
                consoleLogs.map((log) => (
                  <div
                    key={log.id}
                    className={`px-2 py-0.5 rounded text-[11px] flex items-start gap-2 ${
                      log.type === "error"
                        ? "bg-red-500/10 text-red-400 border border-red-500/20"
                        : log.type === "warn"
                        ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        : isDark
                        ? "text-neutral-300 hover:bg-neutral-900"
                        : "text-neutral-800 hover:bg-neutral-50"
                    }`}
                  >
                    <span className="opacity-40 select-none text-[10px]">{log.timestamp}</span>
                    <span className="font-semibold uppercase text-[9px] opacity-70">[{log.type}]</span>
                    <span className="break-all">{log.message}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PreviewPanel;
