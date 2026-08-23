import React, { useState, useEffect, useRef } from "react";
import mermaid from "mermaid";
import Editor from "@monaco-editor/react";
import {
  Columns2,
  Eye,
  Code,
  Download,
  Copy,
  Check,
  ZoomIn,
  ZoomOut,
  Sparkles,
  AlertTriangle,
  Save,
  Layers,
} from "lucide-react";
import { useTheme } from "../../../context/ThemeContext";

interface MermaidViewerProps {
  content: string;
  filename: string;
  isDirty?: boolean;
  onContentChange: (newContent: string) => void;
  onSave?: () => Promise<void>;
}

const STARTER_TEMPLATES = [
  {
    name: "Flowchart Architecture",
    code: `flowchart TD
    Client[Web & Mobile Client] -->|HTTPS / WSS| APIGateway[CloudForge API Gateway]
    APIGateway --> AuthSvc[Authentication Service]
    APIGateway --> WorkspaceSvc[Workspace & File Engine]
    APIGateway --> VCSSvc[Native VCS Engine]
    WorkspaceSvc --> MongoDB[(MongoDB Database)]
    VCSSvc --> Snapshots[(VCS Snapshots)]`,
  },
  {
    name: "Sequence Diagram",
    code: `sequenceDiagram
    autonumber
    actor User
    participant Frontend as CloudForge IDE
    participant API as API Server
    participant DB as MongoDB
    User->>Frontend: Upload file / code edit
    Frontend->>API: POST /api/projects/:id/files
    API->>DB: Save document snapshot
    DB-->>API: 201 Created
    API-->>Frontend: Synchronized file & VCS tree
    Frontend-->>User: Visual feedback & live preview`,
  },
  {
    name: "Class Diagram",
    code: `classDiagram
    class Project {
        +String name
        +String description
        +ObjectId owner
        +String currentBranch
        +List~String~ branches
        +createFile()
        +commitChanges()
    }
    class ProjectFile {
        +ObjectId projectId
        +String name
        +String path
        +String content
        +String language
        +Number size
    }
    class ProjectCommit {
        +String sha
        +String message
        +String branch
        +List changes
    }
    Project "1" *-- "*" ProjectFile : contains
    Project "1" *-- "*" ProjectCommit : tracks`,
  },
  {
    name: "State Machine",
    code: `stateDiagram-v2
    [*] --> Idle
    Idle --> Editing : User modifies code
    Editing --> Dirty : Unsaved changes detected
    Dirty --> Saving : Ctrl+S / Auto-Save
    Saving --> Committed : VCS Commit
    Committed --> Idle : Head synchronized`,
  },
  {
    name: "Git Branching Graph",
    code: `gitGraph
    commit id: "Initial Commit"
    commit id: "feat: setup project"
    branch feature/file-upload
    checkout feature/file-upload
    commit id: "feat: add upload modal"
    commit id: "feat: add preview renderers"
    checkout main
    merge feature/file-upload id: "merge: file upload engine"
    commit id: "release: v1.0.0"`,
  },
];

export const MermaidViewer: React.FC<MermaidViewerProps> = ({
  content,
  filename,
  isDirty = false,
  onContentChange,
  onSave,
}) => {
  const { isDark } = useTheme();
  const [viewMode, setViewMode] = useState<"split" | "preview" | "editor">("split");
  const [zoom, setZoom] = useState(1);
  const [copiedSvg, setCopiedSvg] = useState(false);
  const [svgHtml, setSvgHtml] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const diagramContainerRef = useRef<HTMLDivElement>(null);

  const defaultContent = content || STARTER_TEMPLATES[0].code;

  useEffect(() => {
    let isCancelled = false;

    const renderDiagram = async () => {
      try {
        setErrorMessage(null);
        mermaid.initialize({
          startOnLoad: false,
          theme: isDark ? "dark" : "default",
          themeVariables: {
            darkMode: isDark,
            background: isDark ? "#000000" : "#ffffff",
            primaryColor: "#3b82f6",
            primaryTextColor: isDark ? "#ffffff" : "#000000",
            primaryBorderColor: isDark ? "#60a5fa" : "#2563eb",
            lineColor: isDark ? "#60a5fa" : "#2563eb",
          },
        });

        const targetCode = (content || defaultContent).trim();
        const id = `mermaid-canvas-${Date.now()}`;
        const { svg } = await mermaid.render(id, targetCode);

        if (!isCancelled) {
          setSvgHtml(svg);
        }
      } catch (err: any) {
        if (!isCancelled) {
          setErrorMessage(err.message || "Failed to render Mermaid diagram");
        }
      }
    };

    renderDiagram();

    return () => {
      isCancelled = true;
    };
  }, [content, isDark, defaultContent]);

  const [isExportingPng, setIsExportingPng] = useState(false);

  const handleExportSvg = () => {
    if (!svgHtml) return;
    const svgElement = diagramContainerRef.current?.querySelector("svg");
    let finalSvg = svgHtml;

    if (svgElement) {
      const clone = svgElement.cloneNode(true) as SVGSVGElement;
      clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
      const serializer = new XMLSerializer();
      finalSvg = serializer.serializeToString(clone);
    }

    const blob = new Blob([finalSvg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename.replace(/\.[^/.]+$/, "")}-diagram.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleExportPng = async () => {
    if (!svgHtml) return;
    setIsExportingPng(true);

    try {
      const svgElement = diagramContainerRef.current?.querySelector("svg");
      let svgData = svgHtml;

      let width = 1200;
      let height = 800;

      if (svgElement) {
        const viewBoxAttr = svgElement.getAttribute("viewBox");
        const bbox = svgElement.getBBox?.();
        const rect = svgElement.getBoundingClientRect();

        if (viewBoxAttr) {
          const parts = viewBoxAttr.split(/[\s,]+/).map(parseFloat);
          if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
            width = Math.ceil(parts[2]);
            height = Math.ceil(parts[3]);
          }
        } else if (bbox && bbox.width > 0 && bbox.height > 0) {
          width = Math.ceil(bbox.width);
          height = Math.ceil(bbox.height);
        } else if (rect && rect.width > 0 && rect.height > 0) {
          width = Math.ceil(rect.width / (zoom || 1));
          height = Math.ceil(rect.height / (zoom || 1));
        }

        const clone = svgElement.cloneNode(true) as SVGSVGElement;
        clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
        clone.setAttribute("width", width.toString());
        clone.setAttribute("height", height.toString());
        if (!clone.getAttribute("viewBox")) {
          clone.setAttribute("viewBox", `0 0 ${width} ${height}`);
        }

        clone.style.maxWidth = "none";
        clone.style.width = `${width}px`;
        clone.style.height = `${height}px`;

        const serializer = new XMLSerializer();
        svgData = serializer.serializeToString(clone);
      } else {
        const parser = new DOMParser();
        const doc = parser.parseFromString(svgData, "image/svg+xml");
        const docSvg = doc.querySelector("svg");
        if (docSvg) {
          const viewBoxAttr = docSvg.getAttribute("viewBox");
          if (viewBoxAttr) {
            const parts = viewBoxAttr.split(/[\s,]+/).map(parseFloat);
            if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
              width = Math.ceil(parts[2]);
              height = Math.ceil(parts[3]);
            }
          }
          docSvg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
          docSvg.setAttribute("width", width.toString());
          docSvg.setAttribute("height", height.toString());
          const serializer = new XMLSerializer();
          svgData = serializer.serializeToString(docSvg);
        }
      }

      const encodedSvg = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgData)}`;
      const img = new Image();
      const scale = 2; // Retina 2x resolution
      const canvasWidth = Math.max(100, width * scale);
      const canvasHeight = Math.max(100, height * scale);

      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          try {
            const canvas = document.createElement("canvas");
            canvas.width = canvasWidth;
            canvas.height = canvasHeight;
            const ctx = canvas.getContext("2d");
            if (!ctx) {
              reject(new Error("Could not create canvas 2d context"));
              return;
            }

            // Fill background matching active workspace theme
            ctx.fillStyle = isDark ? "#0a0a0a" : "#ffffff";
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);

            // Draw diagram
            ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);

            canvas.toBlob((blob) => {
              if (blob) {
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `${filename.replace(/\.[^/.]+$/, "")}-diagram.png`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(() => URL.revokeObjectURL(url), 1000);
                resolve();
              } else {
                const dataUrl = canvas.toDataURL("image/png");
                const a = document.createElement("a");
                a.href = dataUrl;
                a.download = `${filename.replace(/\.[^/.]+$/, "")}-diagram.png`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                resolve();
              }
            }, "image/png");
          } catch (e) {
            reject(e);
          }
        };
        img.onerror = (e) => reject(e);
        img.src = encodedSvg;
      });
    } catch (err) {
      console.error("Failed to export Mermaid diagram to PNG:", err);
    } finally {
      setIsExportingPng(false);
    }
  };

  const handleCopySvg = () => {
    if (!svgHtml) return;
    navigator.clipboard.writeText(svgHtml);
    setCopiedSvg(true);
    setTimeout(() => setCopiedSvg(false), 2000);
  };

  return (
    <div className={`h-full flex flex-col overflow-hidden select-none font-sans ${
      isDark ? "bg-black text-neutral-200" : "bg-white text-neutral-800"
    }`}>
      {/* Top Toolbar */}
      <div className={`h-10 px-3 border-b flex items-center justify-between shrink-0 ${
        isDark ? "bg-neutral-950 border-neutral-800" : "bg-neutral-50/80 border-neutral-200"
      }`}>
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-400 shrink-0" />
          <span className="text-xs font-semibold truncate max-w-[140px] sm:max-w-[220px] font-mono">
            {filename}
          </span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
            isDark ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" : "bg-cyan-50 text-cyan-700 border border-cyan-200"
          }`}>
            Mermaid Diagram
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Templates Library */}
          <div className="relative">
            <button
              onClick={() => setShowTemplates((v) => !v)}
              className={`px-2 py-1 rounded-lg border text-xs flex items-center gap-1 font-semibold transition-colors cursor-pointer ${
                isDark ? "border-neutral-800 hover:bg-neutral-900 text-neutral-300" : "border-neutral-200 hover:bg-neutral-100 text-neutral-700"
              }`}
              title="Insert starter diagram templates"
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden md:inline">Templates</span>
            </button>

            {showTemplates && (
              <>
                <div onClick={() => setShowTemplates(false)} className="fixed inset-0 z-40" />
                <div className={`absolute right-0 top-full mt-1.5 w-64 rounded-xl border shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 ${
                  isDark ? "bg-neutral-900 border-neutral-800 text-neutral-200" : "bg-white border-neutral-200 text-neutral-800"
                }`}>
                  <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider opacity-50 border-b border-white/10 mb-1">
                    Insert Starter Template
                  </div>
                  {STARTER_TEMPLATES.map((t, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        onContentChange(t.code);
                        setShowTemplates(false);
                      }}
                      className="w-full px-3 py-1.5 text-left text-xs hover:bg-cyan-500/10 hover:text-cyan-400 transition-colors cursor-pointer"
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* View Mode Toggle */}
          <div className={`flex items-center p-0.5 rounded-lg border ${
            isDark ? "bg-neutral-900 border-neutral-800" : "bg-neutral-200/60 border-neutral-300"
          }`}>
            <button
              onClick={() => setViewMode("split")}
              className={`px-2 py-1 rounded text-xs flex items-center gap-1 font-semibold transition-colors cursor-pointer ${
                viewMode === "split"
                  ? isDark ? "bg-neutral-800 text-white shadow-xs" : "bg-white text-black shadow-xs"
                  : "opacity-60 hover:opacity-100"
              }`}
              title="Split View"
            >
              <Columns2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Split</span>
            </button>
            <button
              onClick={() => setViewMode("preview")}
              className={`px-2 py-1 rounded text-xs flex items-center gap-1 font-semibold transition-colors cursor-pointer ${
                viewMode === "preview"
                  ? isDark ? "bg-neutral-800 text-white shadow-xs" : "bg-white text-black shadow-xs"
                  : "opacity-60 hover:opacity-100"
              }`}
              title="Diagram Preview"
            >
              <Eye className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Preview</span>
            </button>
            <button
              onClick={() => setViewMode("editor")}
              className={`px-2 py-1 rounded text-xs flex items-center gap-1 font-semibold transition-colors cursor-pointer ${
                viewMode === "editor"
                  ? isDark ? "bg-neutral-800 text-white shadow-xs" : "bg-white text-black shadow-xs"
                  : "opacity-60 hover:opacity-100"
              }`}
              title="Mermaid Code"
            >
              <Code className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Source</span>
            </button>
          </div>

          {/* Zoom controls (active in preview/split) */}
          {(viewMode === "split" || viewMode === "preview") && (
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => setZoom((z) => Math.max(0.3, z - 0.15))}
                className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                  isDark ? "border-neutral-800 hover:bg-neutral-900" : "border-neutral-200 hover:bg-neutral-100"
                }`}
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setZoom(1)}
                className={`p-1.5 rounded-lg border transition-colors cursor-pointer text-xs font-mono font-bold px-2 ${
                  isDark ? "border-neutral-800 hover:bg-neutral-900" : "border-neutral-200 hover:bg-neutral-100"
                }`}
                title="Reset Zoom"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                onClick={() => setZoom((z) => Math.min(3, z + 0.15))}
                className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                  isDark ? "border-neutral-800 hover:bg-neutral-900" : "border-neutral-200 hover:bg-neutral-100"
                }`}
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Export / Copy Options */}
          <button
            onClick={handleCopySvg}
            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
              isDark ? "border-neutral-800 hover:bg-neutral-900" : "border-neutral-200 hover:bg-neutral-100"
            }`}
            title="Copy SVG XML"
          >
            {copiedSvg ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={handleExportSvg}
            className={`p-1.5 rounded-lg border transition-colors cursor-pointer flex items-center gap-1 text-xs ${
              isDark ? "border-neutral-800 hover:bg-neutral-900" : "border-neutral-200 hover:bg-neutral-100"
            }`}
            title="Download as SVG Vector"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">SVG</span>
          </button>

          <button
            onClick={handleExportPng}
            disabled={isExportingPng}
            className={`p-1.5 rounded-lg border transition-colors cursor-pointer flex items-center gap-1 text-xs ${
              isExportingPng
                ? "opacity-60 cursor-wait"
                : isDark
                ? "border-neutral-800 hover:bg-neutral-900"
                : "border-neutral-200 hover:bg-neutral-100"
            }`}
            title="Export as High-Resolution PNG Image"
          >
            {isExportingPng ? (
              <div className="w-3.5 h-3.5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5 text-cyan-400" />
            )}
            <span className="hidden lg:inline">PNG</span>
          </button>

          {/* Save Button */}
          {isDirty && onSave && (
            <button
              onClick={onSave}
              className="px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs flex items-center gap-1 shadow-sm transition-all cursor-pointer"
            >
              <Save className="w-3 h-3" />
              <span>Save</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Editor Side */}
        {(viewMode === "split" || viewMode === "editor") && (
          <div className={`h-full ${viewMode === "split" ? "w-1/2 border-r" : "w-full"} ${
            isDark ? "border-neutral-800" : "border-neutral-200"
          }`}>
            <Editor
              height="100%"
              language="markdown"
              value={content || defaultContent}
              theme={isDark ? "vs-dark" : "light"}
              onChange={(val) => onContentChange(val || "")}
              options={{
                fontSize: 13,
                fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
                lineHeight: 22,
                wordWrap: "on",
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                lineNumbersMinChars: 3,
                padding: { top: 12, bottom: 12 },
              }}
            />
          </div>
        )}

        {/* Diagram Render Side */}
        {(viewMode === "split" || viewMode === "preview") && (
          <div
            ref={diagramContainerRef}
            className={`h-full overflow-auto flex items-center justify-center p-8 relative ${
              viewMode === "split" ? "w-1/2" : "w-full"
            } ${isDark ? "bg-neutral-950" : "bg-neutral-50"}`}
          >
            {errorMessage ? (
              <div className="max-w-md p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs">
                <div className="flex items-center gap-2 font-bold mb-1 text-rose-400">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Mermaid Syntax Error</span>
                </div>
                <p className="font-mono text-[11px] opacity-90">{errorMessage}</p>
              </div>
            ) : (
              <div
                style={{
                  transform: `scale(${zoom})`,
                  transformOrigin: "center center",
                  transition: "transform 0.15s ease",
                }}
                className="flex items-center justify-center min-w-fit select-text"
                dangerouslySetInnerHTML={{ __html: svgHtml }}
              />
            )}
          </div>
        )}
      </div>

      {/* Bottom Status Bar */}
      <div className={`h-6 px-3 border-t flex items-center justify-between text-[10px] font-mono shrink-0 ${
        isDark ? "bg-neutral-950 border-neutral-800 text-neutral-400" : "bg-neutral-50 border-neutral-200 text-neutral-500"
      }`}>
        <div className="flex items-center gap-3">
          <span>Engine: Mermaid v11</span>
          <span>Zoom: {Math.round(zoom * 100)}%</span>
        </div>
        <div className="flex items-center gap-2">
          <span>Interactive SVG</span>
          <span>UTF-8</span>
        </div>
      </div>
    </div>
  );
};
export default MermaidViewer;
