import React, { useState, useEffect, useRef } from "react";
import { marked } from "marked";
import katex from "katex";
import {
  Play,
  Edit2,
  Trash2,
  ArrowUp,
  ArrowDown,
  Copy,
  Plus,
  Bold,
  Italic,
  Heading,
  Code,
  Sigma,
  List,
  CheckSquare,
} from "lucide-react";
import { type NotebookCell, type CellType } from "../../../../types/notebook";

interface NotebookMarkdownCellProps {
  cell: NotebookCell;
  index: number;
  totalCells: number;
  isDark: boolean;
  onUpdateSource: (cellId: string, newSource: string) => void;
  onDeleteCell: (cellId: string) => void;
  onMoveCell: (index: number, direction: "up" | "down") => void;
  onInsertCellBelow: (index: number, type: CellType) => void;
  onChangeCellType: (cellId: string, newType: CellType) => void;
  onDuplicateCell: (cellId: string) => void;
}

export const NotebookMarkdownCell: React.FC<NotebookMarkdownCellProps> = ({
  cell,
  index,
  totalCells,
  isDark,
  onUpdateSource,
  onDeleteCell,
  onMoveCell,
  onInsertCellBelow,
  onChangeCellType,
  onDuplicateCell,
}) => {
  const rawSource = Array.isArray(cell.source) ? cell.source.join("") : cell.source || "";
  const [isEditing, setIsEditing] = useState(() => Boolean(cell.isEditingMarkdown || !rawSource.trim()));
  const [sourceVal, setSourceVal] = useState(rawSource);
  const [renderedHtml, setRenderedHtml] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setSourceVal(Array.isArray(cell.source) ? cell.source.join("") : cell.source || "");
  }, [cell.source]);

  // Render Markdown + KaTeX safely using placeholders
  useEffect(() => {
    if (!sourceVal.trim()) {
      setRenderedHtml('<p class="text-neutral-400 italic text-xs">Empty markdown cell. Double-click or click Edit to add content.</p>');
      return;
    }

    const mathBlocks: string[] = [];
    const mathInlines: string[] = [];
    let text = sourceVal;

    // 1. Extract block math $$...$$
    text = text.replace(/\$\$([\s\S]*?)\$\$/g, (_, math) => {
      const idx = mathBlocks.length;
      try {
        const rendered = `<div class="katex-block my-3 p-2.5 rounded-lg text-center overflow-x-auto ${
          isDark ? "bg-neutral-900/60" : "bg-neutral-100"
        }">${katex.renderToString(math.trim(), { displayMode: true, throwOnError: false })}</div>`;
        mathBlocks.push(rendered);
      } catch {
        mathBlocks.push(`<pre class="text-rose-400 text-xs">${math}</pre>`);
      }
      return `\n\n___KATEX_BLOCK_${idx}___\n\n`;
    });

    // 2. Extract inline math $...$
    text = text.replace(/\$([^\$\n]+?)\$/g, (_, math) => {
      const idx = mathInlines.length;
      try {
        const rendered = katex.renderToString(math.trim(), { displayMode: false, throwOnError: false });
        mathInlines.push(rendered);
      } catch {
        mathInlines.push(`$${math}$`);
      }
      return `___KATEX_INLINE_${idx}___`;
    });

    // 3. Parse Markdown to HTML
    try {
      let parsed = marked.parse(text, { gfm: true, breaks: true }) as string;

      // 4. Restore math blocks and inlines
      mathBlocks.forEach((rendered, i) => {
        parsed = parsed.replace(new RegExp(`(<p>)?___KATEX_BLOCK_${i}___(<\/p>)?`, "g"), rendered);
      });

      mathInlines.forEach((rendered, i) => {
        parsed = parsed.replace(new RegExp(`___KATEX_INLINE_${i}___`, "g"), rendered);
      });

      setRenderedHtml(parsed);
    } catch {
      setRenderedHtml(`<p>${sourceVal}</p>`);
    }
  }, [sourceVal, isDark]);

  const handleFinishEditing = () => {
    onUpdateSource(cell.id, sourceVal);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.key === "Enter" && (e.shiftKey || e.ctrlKey)) || e.key === "Escape") {
      e.preventDefault();
      handleFinishEditing();
    }
  };

  const insertMarkdownSnippet = (before: string, after: string = "") => {
    if (!textareaRef.current) return;
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const current = sourceVal;
    const selected = current.substring(start, end) || "text";
    const next = current.substring(0, start) + before + selected + after + current.substring(end);
    setSourceVal(next);
    onUpdateSource(cell.id, next);

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(start + before.length, start + before.length + selected.length);
      }
    }, 10);
  };

  return (
    <div
      className={`group relative rounded-xl border transition-all duration-150 mb-3 shadow-xs ${
        isDark
          ? isEditing
            ? "bg-[#0c0c0e] border-blue-500/50 shadow-blue-500/5"
            : "bg-[#09090b] border-neutral-800/80 hover:border-neutral-700"
          : isEditing
          ? "bg-white border-blue-500 shadow-blue-500/5"
          : "bg-white border-neutral-200 hover:border-neutral-300"
      }`}
    >
      {/* Cell Left Gutter & Top Action Bar */}
      <div
        className={`flex items-center justify-between px-3 py-1.5 border-b rounded-t-xl text-[11px] select-none ${
          isDark ? "bg-[#111114] border-neutral-800 text-neutral-400" : "bg-neutral-50 border-neutral-200 text-neutral-600"
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold text-blue-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />
            Markdown Cell
          </span>
          <span className="opacity-40">•</span>
          <span className="text-[10px] opacity-60">#{index + 1}</span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1">
          {isEditing ? (
            <button
              onClick={handleFinishEditing}
              className="px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium flex items-center gap-1 text-[11px] cursor-pointer transition-colors shadow-xs"
              title="Render Markdown (Shift+Enter)"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>Render</span>
            </button>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="p-1 rounded hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
              title="Edit Markdown cell"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Type Selector */}
          <select
            value={cell.cell_type}
            onChange={(e) => onChangeCellType(cell.id, e.target.value as CellType)}
            className={`text-[10px] px-1.5 py-0.5 rounded border bg-transparent font-medium cursor-pointer ${
              isDark ? "border-neutral-700 text-neutral-300" : "border-neutral-300 text-neutral-700"
            }`}
          >
            <option value="markdown">Markdown</option>
            <option value="code">Code</option>
            <option value="raw">Raw</option>
          </select>

          {/* Move Up/Down */}
          <button
            disabled={index === 0}
            onClick={() => onMoveCell(index, "up")}
            className="p-1 rounded hover:bg-white/10 disabled:opacity-30 transition-colors cursor-pointer"
            title="Move cell up"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
          <button
            disabled={index === totalCells - 1}
            onClick={() => onMoveCell(index, "down")}
            className="p-1 rounded hover:bg-white/10 disabled:opacity-30 transition-colors cursor-pointer"
            title="Move cell down"
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>

          {/* Duplicate */}
          <button
            onClick={() => onDuplicateCell(cell.id)}
            className="p-1 rounded hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
            title="Duplicate cell"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>

          {/* Delete */}
          <button
            onClick={() => onDeleteCell(cell.id)}
            className="p-1 rounded hover:bg-rose-500/20 hover:text-rose-400 transition-colors cursor-pointer"
            title="Delete cell"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-3">
        {isEditing ? (
          <div>
            {/* Formatting Toolbar */}
            <div
              className={`flex items-center gap-1 mb-2 p-1 rounded-lg border text-xs ${
                isDark ? "bg-[#141418] border-neutral-800 text-neutral-300" : "bg-neutral-100 border-neutral-200 text-neutral-700"
              }`}
            >
              <button
                type="button"
                onClick={() => insertMarkdownSnippet("**", "**")}
                className="p-1 rounded hover:bg-white/10 cursor-pointer"
                title="Bold"
              >
                <Bold className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => insertMarkdownSnippet("*", "*")}
                className="p-1 rounded hover:bg-white/10 cursor-pointer"
                title="Italic"
              >
                <Italic className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => insertMarkdownSnippet("### ")}
                className="p-1 rounded hover:bg-white/10 cursor-pointer"
                title="Heading 3"
              >
                <Heading className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => insertMarkdownSnippet("`", "`")}
                className="p-1 rounded hover:bg-white/10 cursor-pointer"
                title="Inline Code"
              >
                <Code className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => insertMarkdownSnippet("$$ ", " $$")}
                className="p-1 rounded hover:bg-white/10 cursor-pointer text-emerald-400 font-semibold"
                title="LaTeX Math Formula ($$...$$)"
              >
                <Sigma className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => insertMarkdownSnippet("- ")}
                className="p-1 rounded hover:bg-white/10 cursor-pointer"
                title="Bullet List"
              >
                <List className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => insertMarkdownSnippet("- [ ] ")}
                className="p-1 rounded hover:bg-white/10 cursor-pointer"
                title="Task Checklist"
              >
                <CheckSquare className="w-3.5 h-3.5" />
              </button>

              <span className="text-[10px] opacity-40 ml-auto mr-2 font-mono">
                Press Shift+Enter to render
              </span>
            </div>

            <textarea
              ref={textareaRef}
              autoFocus
              value={sourceVal}
              onChange={(e) => {
                setSourceVal(e.target.value);
                onUpdateSource(cell.id, e.target.value);
              }}
              onKeyDown={handleKeyDown}
              rows={Math.max(4, sourceVal.split("\n").length + 1)}
              placeholder="Type Markdown or LaTeX ($$...$$ or $...$)..."
              className={`w-full p-3 rounded-lg font-mono text-xs leading-relaxed focus:outline-hidden focus:ring-1 focus:ring-blue-500 resize-y border ${
                isDark
                  ? "bg-[#09090b] border-neutral-800 text-neutral-200 placeholder-neutral-600"
                  : "bg-white border-neutral-300 text-neutral-900 placeholder-neutral-400"
              }`}
            />
          </div>
        ) : (
          <div
            onDoubleClick={() => setIsEditing(true)}
            className={`prose prose-sm max-w-none cursor-pointer select-text transition-colors p-1 leading-relaxed font-sans ${
              isDark ? "prose-invert text-neutral-200" : "prose-slate text-slate-800"
            }`}
            title="Double click to edit"
            dangerouslySetInnerHTML={{ __html: renderedHtml }}
          />
        )}
      </div>

      {/* Floating Add Cell Gutter on Hover */}
      <div
        className={`absolute -bottom-3 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex items-center gap-1 backdrop-blur-md px-2 py-0.5 rounded-full border text-[10px] ${
          isDark
            ? "bg-[#141418]/90 border-neutral-700 text-neutral-200 shadow-lg"
            : "bg-white/95 border-slate-300 text-slate-700 shadow-md"
        }`}
      >
        <button
          onClick={() => onInsertCellBelow(index, "code")}
          className={`flex items-center gap-1 px-1.5 py-0.5 rounded font-medium cursor-pointer transition-colors ${
            isDark ? "hover:bg-blue-600 text-blue-400 hover:text-white" : "hover:bg-blue-600 text-blue-600 hover:text-white"
          }`}
        >
          <Plus className="w-3 h-3" />
          <span>Code</span>
        </button>
        <span className="opacity-30">|</span>
        <button
          onClick={() => onInsertCellBelow(index, "markdown")}
          className={`flex items-center gap-1 px-1.5 py-0.5 rounded font-medium cursor-pointer transition-colors ${
            isDark ? "hover:bg-emerald-600 text-emerald-400 hover:text-white" : "hover:bg-emerald-600 text-emerald-600 hover:text-white"
          }`}
        >
          <Plus className="w-3 h-3" />
          <span>Markdown</span>
        </button>
      </div>
    </div>
  );
};
