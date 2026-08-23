import React, { useState, useMemo } from "react";
import { DiffEditor, type Monaco } from "@monaco-editor/react";
import { X, Columns, Rows, Check, Layers, ZoomIn, ZoomOut } from "lucide-react";
import { FileIcon } from "./FileIcon";
import { useTheme } from "../../context/ThemeContext";

interface DiffViewerProps {
  filename: string;
  filepath: string;
  originalContent?: string;
  modifiedContent?: string;
  patch?: string;
  onClose: () => void;
  onStageChange?: () => void;
}

function getMonacoLanguage(filename?: string): string {
  const ext = (filename ? filename.split(".").pop() : "")?.toLowerCase() || "";
  if (["tsx", "jsx", "typescript", "ts"].includes(ext)) return "typescript";
  if (["javascript", "js", "mjs", "cjs"].includes(ext)) return "javascript";
  if (["html", "htm", "svg", "vue"].includes(ext)) return "html";
  if (["css", "scss", "sass", "less"].includes(ext)) return "css";
  if (["json"].includes(ext)) return "json";
  if (["python", "py"].includes(ext)) return "python";
  if (["sql"].includes(ext)) return "sql";
  if (["markdown", "md"].includes(ext)) return "markdown";
  if (["yaml", "yml"].includes(ext)) return "yaml";
  if (["shell", "bash", "sh", "zsh"].includes(ext)) return "shell";
  if (["c", "cpp", "h", "hpp"].includes(ext)) return "cpp";
  if (["rust", "rs"].includes(ext)) return "rust";
  if (["go"].includes(ext)) return "go";
  if (["java"].includes(ext)) return "java";
  return "typescript";
}

export const DiffViewer: React.FC<DiffViewerProps> = ({
  filename,
  filepath,
  originalContent = "",
  modifiedContent = "",
  onClose,
  onStageChange,
}) => {
  const { isDark } = useTheme();
  const [viewType, setViewType] = useState<"unified" | "split">("split");
  const [fontSize, setFontSize] = useState(13);

  const activeLanguage = useMemo(() => getMonacoLanguage(filename), [filename]);

  // Compute diff additions and deletions stats
  const { additions, deletions } = useMemo(() => {
    const oldLines = originalContent ? originalContent.split("\n") : [];
    const newLines = modifiedContent ? modifiedContent.split("\n") : [];

    const oldSet = new Set(oldLines);
    const newSet = new Set(newLines);

    let add = 0;
    let del = 0;

    newLines.forEach((l) => {
      if (!oldSet.has(l) && l.trim().length > 0) add++;
    });
    oldLines.forEach((l) => {
      if (!newSet.has(l) && l.trim().length > 0) del++;
    });

    if (add === 0 && del === 0 && originalContent !== modifiedContent) {
      if (newLines.length >= oldLines.length) {
        add = Math.max(1, newLines.length - oldLines.length);
      } else {
        del = Math.max(1, oldLines.length - newLines.length);
      }
    }

    return { additions: add, deletions: del };
  }, [originalContent, modifiedContent]);

  // Define Pitch Black & Pure White themes for Monaco Diff
  const handleEditorWillMount = (monaco: Monaco) => {
    monaco.editor.defineTheme("cloudforge-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "keyword", foreground: "60a5fa" },
        { token: "string", foreground: "4ade80" },
        { token: "number", foreground: "38bdf8" },
        { token: "comment", foreground: "737373", fontStyle: "italic" },
        { token: "type", foreground: "38bdf8" },
        { token: "function", foreground: "38bdf8" },
        { token: "tag", foreground: "60a5fa" },
        { token: "attribute.name", foreground: "38bdf8" },
      ],
      colors: {
        "editor.background": "#000000",
        "editor.foreground": "#ffffff",
        "editorGutter.background": "#050505",
        "editorLineNumber.foreground": "#525252",
        "editorLineNumber.activeForeground": "#60a5fa",
        "editor.lineHighlightBackground": "#111111",
        "diffEditor.insertedTextBackground": "#10b98125",
        "diffEditor.removedTextBackground": "#f43f5e25",
        "diffEditor.insertedLineBackground": "#10b98115",
        "diffEditor.removedLineBackground": "#f43f5e15",
        "diffEditorGutter.insertedLineBackground": "#10b98130",
        "diffEditorGutter.removedLineBackground": "#f43f5e30",
        "diffEditor.diagonalFill": "#1f1f1f",
        "scrollbarSlider.background": "#26262680",
        "scrollbarSlider.hoverBackground": "#404040a0",
        "scrollbarSlider.activeBackground": "#525252",
      },
    });

    monaco.editor.defineTheme("cloudforge-light", {
      base: "vs",
      inherit: true,
      rules: [
        { token: "keyword", foreground: "2563eb" },
        { token: "string", foreground: "16a34a" },
        { token: "number", foreground: "0284c7" },
        { token: "comment", foreground: "737373", fontStyle: "italic" },
        { token: "type", foreground: "0284c7" },
        { token: "function", foreground: "0284c7" },
        { token: "tag", foreground: "2563eb" },
        { token: "attribute.name", foreground: "0284c7" },
      ],
      colors: {
        "editor.background": "#ffffff",
        "editor.foreground": "#000000",
        "editorGutter.background": "#fafafa",
        "editorLineNumber.foreground": "#a3a3a3",
        "editorLineNumber.activeForeground": "#2563eb",
        "editor.lineHighlightBackground": "#f5f5f5",
        "diffEditor.insertedTextBackground": "#10b98120",
        "diffEditor.removedTextBackground": "#ef444420",
        "diffEditor.insertedLineBackground": "#10b98110",
        "diffEditor.removedLineBackground": "#ef444410",
        "diffEditorGutter.insertedLineBackground": "#10b98125",
        "diffEditorGutter.removedLineBackground": "#ef444425",
        "diffEditor.diagonalFill": "#f3f4f6",
        "scrollbarSlider.background": "#d4d4d480",
        "scrollbarSlider.hoverBackground": "#a3a3a3a0",
        "scrollbarSlider.activeBackground": "#737373",
      },
    });
  };

  const currentTheme = isDark ? "cloudforge-dark" : "cloudforge-light";
  const bg = isDark ? "#000000" : "#ffffff";
  const toolbarBg = isDark ? "#080808" : "#fafafa";
  const borderColor = isDark ? "#1f1f1f" : "#e5e5e5";
  const textColor = isDark ? "#ffffff" : "#000000";
  const accentColor = isDark ? "#3b82f6" : "#2563eb";

  return (
    <div
      style={{
        backgroundColor: bg,
        color: textColor,
      }}
      className="h-full flex flex-col select-none overflow-hidden font-sans transition-colors duration-150 relative"
    >
      {/* Header Toolbar */}
      <div
        style={{
          backgroundColor: toolbarBg,
          borderColor: borderColor,
        }}
        className="h-10 px-3 border-b flex items-center justify-between select-none shrink-0 relative z-30"
      >
        <div className="flex items-center gap-2 min-w-0">
          <FileIcon name={filename} type="file" className="w-4 h-4 shrink-0" />
          <span className="font-bold text-xs truncate">{filename}</span>
          <span className="text-[11px] opacity-60 truncate hidden md:inline font-mono">
            {filepath}
          </span>

          {/* Additions & Deletions Counter */}
          <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold ml-2">
            <span className="text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.2 rounded">
              +{additions}
            </span>
            <span className="text-rose-400 bg-rose-500/15 border border-rose-500/30 px-1.5 py-0.2 rounded">
              -{deletions}
            </span>
          </div>
        </div>

        {/* View Mode & Actions */}
        <div className="flex items-center gap-2">
          {/* Stage Changes Button */}
          {onStageChange && (
            <button
              onClick={onStageChange}
              style={{
                backgroundColor: isDark ? "rgba(59, 130, 246, 0.2)" : "rgba(37, 99, 235, 0.1)",
                borderColor: accentColor,
                color: accentColor,
              }}
              className="px-2.5 py-1 rounded-md border font-semibold text-[11px] flex items-center gap-1 shadow-2xs hover:brightness-110 active:scale-95 transition-all cursor-pointer"
              title="Stage this file for commit"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Stage Changes</span>
            </button>
          )}

          {/* Unified / Split Toggle */}
          <div
            style={{
              backgroundColor: isDark ? "#141414" : "#f0f0f0",
              borderColor: borderColor,
            }}
            className="flex items-center p-0.5 rounded-lg border"
          >
            <button
              onClick={() => setViewType("split")}
              style={{
                backgroundColor: viewType === "split" ? (isDark ? "#262626" : "#ffffff") : "transparent",
                color: viewType === "split" ? accentColor : "inherit",
              }}
              className={`px-2 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                viewType === "split" ? "font-bold shadow-xs" : "opacity-70 hover:opacity-100"
              }`}
              title="Side-by-Side (Split) View"
            >
              <Columns className="w-3.5 h-3.5" />
              <span>Split</span>
            </button>

            <button
              onClick={() => setViewType("unified")}
              style={{
                backgroundColor: viewType === "unified" ? (isDark ? "#262626" : "#ffffff") : "transparent",
                color: viewType === "unified" ? accentColor : "inherit",
              }}
              className={`px-2 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                viewType === "unified" ? "font-bold shadow-xs" : "opacity-70 hover:opacity-100"
              }`}
              title="Inline (Unified) View"
            >
              <Rows className="w-3.5 h-3.5" />
              <span>Unified</span>
            </button>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setFontSize((s) => Math.max(10, s - 1))}
              className="p-1.5 rounded hover:bg-white/10 opacity-60 hover:opacity-100 transition-colors cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setFontSize((s) => Math.min(24, s + 1))}
              className="p-1.5 rounded hover:bg-white/10 opacity-60 hover:opacity-100 transition-colors cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Close Diff Button */}
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-white/10 opacity-70 hover:opacity-100 transition-colors cursor-pointer"
            title="Close Diff Viewer (Return to Editor)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Monaco Diff Editor Body */}
      <div className="flex-1 overflow-hidden relative">
        <DiffEditor
          height="100%"
          language={activeLanguage}
          original={originalContent}
          modified={modifiedContent}
          theme={currentTheme}
          beforeMount={handleEditorWillMount}
          options={{
            readOnly: true,
            renderSideBySide: viewType === "split",
            fontSize,
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Menlo, Monaco, Consolas, monospace",
            fontLigatures: true,
            lineHeight: Math.max(18, Math.round(fontSize * 1.6)),
            automaticLayout: true,
            smoothScrolling: true,
            scrollBeyondLastLine: false,
            minimap: { enabled: false },
            renderWhitespace: "selection",
            renderIndicators: true,
            enableSplitViewResizing: true,
            originalEditable: false,
            padding: {
              top: 10,
              bottom: 10,
            },
            diffWordWrap: "off",
            glyphMargin: false,
          }}
        />
      </div>

      {/* Diff Status Bar */}
      <div
        style={{
          backgroundColor: bg,
          borderColor: borderColor,
          color: isDark ? "#a3a3a3" : "#525252",
        }}
        className="h-6 px-3 border-t flex items-center justify-between text-[10px] font-mono select-none shrink-0"
      >
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 font-semibold text-blue-400">
            <Layers className="w-3 h-3" />
            <span>DIFF COMPUTE: {viewType.toUpperCase()}</span>
          </span>
          <span className="opacity-60 hidden sm:inline">ORIGINAL (LAST COMMIT) ↔ WORKING COPY</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-emerald-400 font-semibold">+{additions} additions</span>
          <span className="text-rose-400 font-semibold">-{deletions} deletions</span>
          <span className="opacity-60 hidden md:inline">{activeLanguage.toUpperCase()}</span>
        </div>
      </div>
    </div>
  );
};
