import React, { useState, useEffect, useMemo, useRef } from "react";
import { marked } from "marked";
import katex from "katex";
import mermaid from "mermaid";
import Editor from "@monaco-editor/react";
import {
  Columns2,
  Eye,
  Code,
  Copy,
  Check,
  Save,
  List,
  FileText,
  Clock,
} from "lucide-react";
import { useTheme } from "../../../context/ThemeContext";

interface MarkdownViewerProps {
  content: string;
  filename: string;
  isDirty?: boolean;
  onContentChange: (newContent: string) => void;
  onSave?: () => Promise<void>;
}

mermaid.initialize({
  startOnLoad: false,
  theme: "dark",
  securityLevel: "loose",
  fontFamily: "inherit",
});

export const MarkdownViewer: React.FC<MarkdownViewerProps> = ({
  content,
  filename,
  isDirty = false,
  onContentChange,
  onSave,
}) => {
  const { isDark } = useTheme();
  const [viewMode, setViewMode] = useState<"split" | "preview" | "editor">("split");
  const [copied, setCopied] = useState(false);
  const [showToc, setShowToc] = useState(false);
  const [renderedHtml, setRenderedHtml] = useState<string>("");
  const previewContainerRef = useRef<HTMLDivElement>(null);

  // Configure marked options
  marked.setOptions({
    gfm: true,
    breaks: true,
  });

  // Extract Table of Contents
  const toc = useMemo(() => {
    const lines = content.split("\n");
    const headers: { level: number; text: string; id: string }[] = [];
    lines.forEach((line) => {
      const match = line.match(/^(#{1,6})\s+(.+)$/);
      if (match) {
        const level = match[1].length;
        const text = match[2].trim().replace(/[#*`_~]/g, "");
        const id = text.toLowerCase().replace(/[^a-z0-9]+/g, "-");
        headers.push({ level, text, id });
      }
    });
    return headers;
  }, [content]);

  // Statistics
  const stats = useMemo(() => {
    const words = content.trim() ? content.trim().split(/\s+/).length : 0;
    const chars = content.length;
    const readTimeMinutes = Math.max(1, Math.ceil(words / 200));
    return { words, chars, readTimeMinutes };
  }, [content]);

  // Process and render Markdown with KaTeX and Mermaid
  useEffect(() => {
    let isCancelled = false;

    const processMarkdown = async () => {
      try {
        // 1. Process Math expressions ($$...$$ and $...$)
        let processedText = content;

        // Block math $$...$$
        processedText = processedText.replace(/\$\$([\s\S]*?)\$\$/g, (_, math) => {
          try {
            return `<div class="katex-block my-4 p-3 rounded-lg overflow-x-auto text-center ${
              isDark ? "bg-neutral-900/60" : "bg-neutral-100"
            }">${katex.renderToString(math.trim(), { displayMode: true, throwOnError: false })}</div>`;
          } catch (e: any) {
            return `<pre class="text-rose-400 text-xs">${e.message}</pre>`;
          }
        });

        // Inline math $...$
        processedText = processedText.replace(/\$([^\$\n]+?)\$/g, (_, math) => {
          try {
            return katex.renderToString(math.trim(), { displayMode: false, throwOnError: false });
          } catch (e: any) {
            return `<span class="text-rose-400">${math}</span>`;
          }
        });

        // 2. Render Markdown to HTML via marked
        const rawHtml = await marked.parse(processedText);

        if (isCancelled) return;
        setRenderedHtml(rawHtml);
      } catch (err) {
        console.error("Markdown processing error:", err);
      }
    };

    processMarkdown();

    return () => {
      isCancelled = true;
    };
  }, [content, isDark]);

  // Render dynamic Mermaid diagrams inside preview
  useEffect(() => {
    if (!previewContainerRef.current) return;

    const renderMermaidBlocks = async () => {
      const codeBlocks = previewContainerRef.current?.querySelectorAll("pre code.language-mermaid");
      if (!codeBlocks || codeBlocks.length === 0) return;

      mermaid.initialize({
        startOnLoad: false,
        theme: isDark ? "dark" : "default",
        themeVariables: {
          darkMode: isDark,
          background: isDark ? "#000000" : "#ffffff",
          primaryColor: "#3b82f6",
          primaryTextColor: isDark ? "#ffffff" : "#000000",
          lineColor: isDark ? "#60a5fa" : "#2563eb",
        },
      });

      for (let i = 0; i < codeBlocks.length; i++) {
        const block = codeBlocks[i];
        const rawCode = block.textContent || "";
        const parentPre = block.parentElement;
        if (!parentPre) continue;

        try {
          const uniqueId = `mermaid-md-${Date.now()}-${i}`;
          const { svg } = await mermaid.render(uniqueId, rawCode.trim());
          const wrapper = document.createElement("div");
          wrapper.className = `mermaid-rendered-container my-4 p-4 rounded-xl border flex justify-center overflow-x-auto shadow-sm transition-all ${
            isDark ? "bg-neutral-900/60 border-neutral-800" : "bg-neutral-50 border-neutral-200"
          }`;
          wrapper.innerHTML = svg;
          parentPre.replaceWith(wrapper);
        } catch (err: any) {
          const errorWrapper = document.createElement("div");
          errorWrapper.className = `p-3 rounded-lg border text-xs my-2 ${
            isDark ? "bg-rose-950/20 border-rose-800 text-rose-300" : "bg-rose-50 border-rose-200 text-rose-700"
          }`;
          errorWrapper.textContent = `Mermaid syntax error: ${err.message || "Invalid syntax"}`;
          parentPre.replaceWith(errorWrapper);
        }
      }
    };

    const timeout = setTimeout(renderMermaidBlocks, 100);
    return () => clearTimeout(timeout);
  }, [renderedHtml, isDark]);

  const handleCopyRaw = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleScrollToHeader = (id: string) => {
    if (!previewContainerRef.current) return;
    const elements = previewContainerRef.current.querySelectorAll("h1, h2, h3, h4, h5, h6");
    for (let el of Array.from(elements)) {
      const elText = el.textContent?.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      if (elText === id) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        break;
      }
    }
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
          <FileText className="w-4 h-4 text-blue-500 shrink-0" />
          <span className="text-xs font-semibold truncate max-w-[140px] sm:max-w-[220px] font-mono">
            {filename}
          </span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
            isDark ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" : "bg-blue-50 text-blue-700 border border-blue-200"
          }`}>
            Markdown + Math + Mermaid
          </span>
        </div>

        <div className="flex items-center gap-1.5">
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
              title="Split View (Editor + Live Preview)"
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
              title="Preview Only"
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
              title="Editor Only"
            >
              <Code className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Source</span>
            </button>
          </div>

          {/* Table of Contents Toggle */}
          {toc.length > 0 && (
            <button
              onClick={() => setShowToc((v) => !v)}
              className={`p-1.5 rounded-lg border transition-colors cursor-pointer flex items-center gap-1 text-xs ${
                showToc
                  ? "bg-blue-600/20 border-blue-500/40 text-blue-400 font-bold"
                  : isDark ? "border-neutral-800 hover:bg-neutral-900" : "border-neutral-200 hover:bg-neutral-100"
              }`}
              title="Table of Contents"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Copy Button */}
          <button
            onClick={handleCopyRaw}
            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
              isDark ? "border-neutral-800 hover:bg-neutral-900" : "border-neutral-200 hover:bg-neutral-100"
            }`}
            title="Copy Markdown content"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          {/* Save Button */}
          {isDirty && onSave && (
            <button
              onClick={onSave}
              className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center gap-1 shadow-sm transition-all cursor-pointer"
            >
              <Save className="w-3 h-3" />
              <span>Save</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Workspace Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Table of Contents Sidebar */}
        {showToc && (
          <div className={`w-56 border-r overflow-y-auto p-3 text-xs shrink-0 transition-all ${
            isDark ? "bg-neutral-950/80 border-neutral-800" : "bg-neutral-50/90 border-neutral-200"
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold uppercase tracking-wider text-[10px] opacity-60">Table of Contents</span>
            </div>
            <div className="space-y-1">
              {toc.map((h, i) => (
                <button
                  key={i}
                  onClick={() => handleScrollToHeader(h.id)}
                  style={{ paddingLeft: `${(h.level - 1) * 12}px` }}
                  className={`w-full text-left py-1 truncate rounded hover:text-blue-400 transition-colors cursor-pointer block ${
                    h.level === 1 ? "font-bold text-xs" : h.level === 2 ? "font-medium text-[11px]" : "opacity-75 text-[11px]"
                  }`}
                >
                  {h.text}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Code Editor Pane */}
        {(viewMode === "split" || viewMode === "editor") && (
          <div className={`h-full ${viewMode === "split" ? "w-1/2 border-r" : "w-full"} ${
            isDark ? "border-neutral-800" : "border-neutral-200"
          }`}>
            <Editor
              height="100%"
              language="markdown"
              value={content}
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

        {/* Rendered Preview Pane */}
        {(viewMode === "split" || viewMode === "preview") && (
          <div
            ref={previewContainerRef}
            className={`h-full overflow-y-auto p-6 select-text ${
              viewMode === "split" ? "w-1/2" : "w-full"
            } ${isDark ? "bg-black text-neutral-200" : "bg-white text-neutral-800"}`}
          >
            <div
              className={`prose max-w-4xl mx-auto ${
                isDark ? "prose-invert" : ""
              } prose-headings:font-bold prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-p:leading-relaxed prose-pre:p-0 prose-pre:bg-transparent prose-table:border prose-th:p-2 prose-td:p-2 prose-img:rounded-xl prose-hr:border-neutral-800`}
              dangerouslySetInnerHTML={{ __html: renderedHtml }}
            />
          </div>
        )}
      </div>

      {/* Bottom Status Bar */}
      <div className={`h-6 px-3 border-t flex items-center justify-between text-[10px] font-mono shrink-0 ${
        isDark ? "bg-neutral-950 border-neutral-800 text-neutral-400" : "bg-neutral-50 border-neutral-200 text-neutral-500"
      }`}>
        <div className="flex items-center gap-3">
          <span>{stats.words} words</span>
          <span>{stats.chars} characters</span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            ~{stats.readTimeMinutes} min read
          </span>
          <span>{toc.length} sections</span>
        </div>
        <div className="flex items-center gap-2">
          <span>Mode: {viewMode.toUpperCase()}</span>
          <span>UTF-8</span>
        </div>
      </div>
    </div>
  );
};
export default MarkdownViewer;
