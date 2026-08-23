import React, { useState, useRef, useMemo, useEffect, useCallback } from "react";
import Editor, { type OnMount, type Monaco } from "@monaco-editor/react";
import {
  X,
  Save,
  Copy,
  Check,
  Search,
  Code,
  ChevronRight,
  WrapText,
  ZoomIn,
  ZoomOut,
  Sparkles,
  Map,
  Layers,
  AlertCircle,
  AlertTriangle,
  Zap,
} from "lucide-react";
import { FileIcon } from "./FileIcon";
import { type EditorTab } from "../../types/workspace";
import { formatCode } from "./editor/codeFormatter";
import { useTheme } from "../../context/ThemeContext";

import { MarkdownViewer } from "./viewers/MarkdownViewer";
import { MermaidViewer } from "./viewers/MermaidViewer";
import { LatexViewer } from "./viewers/LatexViewer";
import { PdfViewer } from "./viewers/PdfViewer";
import { ImageViewer } from "./viewers/ImageViewer";
import { SpreadsheetViewer } from "./viewers/SpreadsheetViewer";
import { DocxViewer } from "./viewers/DocxViewer";
import { PptxViewer } from "./viewers/PptxViewer";
import { MediaViewer } from "./viewers/MediaViewer";

interface CodeEditorProps {
  tabs: EditorTab[];
  activeTabId: string | null;
  onSelectTab: (fileId: string) => void;
  onCloseTab: (fileId: string) => void;
  onContentChange: (fileId: string, newContent: string) => void;
  onSaveFile: (fileId: string, isSilent?: boolean) => Promise<void>;
  projectName: string;
}

const SUPPORTED_LANGUAGES = [
  { id: "typescript", label: "TypeScript (ts/tsx)" },
  { id: "javascript", label: "JavaScript (js/jsx)" },
  { id: "html", label: "HTML (html)" },
  { id: "css", label: "CSS (css/scss)" },
  { id: "json", label: "JSON (json)" },
  { id: "python", label: "Python (py)" },
  { id: "sql", label: "SQL (sql)" },
  { id: "markdown", label: "Markdown (md)" },
  { id: "yaml", label: "YAML (yml)" },
  { id: "shell", label: "Shell / Bash (sh)" },
  { id: "cpp", label: "C / C++" },
  { id: "rust", label: "Rust (rs)" },
  { id: "go", label: "Go (go)" },
  { id: "java", label: "Java (java)" },
];

function getMonacoLanguage(langOrExt: string, filename?: string): string {
  const ext = (filename ? filename.split(".").pop() : "")?.toLowerCase() || "";
  const lang = (langOrExt || ext || "").toLowerCase().trim();

  if (["tsx", "jsx"].includes(lang) || ["tsx", "jsx"].includes(ext)) return "typescript";
  if (["typescript", "ts"].includes(lang) || ext === "ts") return "typescript";
  if (["javascript", "js", "mjs", "cjs"].includes(lang) || ["js", "mjs", "cjs"].includes(ext)) return "javascript";
  if (["html", "htm", "svg", "vue"].includes(lang) || ["html", "htm", "svg", "vue"].includes(ext)) return "html";
  if (["css", "scss", "sass", "less"].includes(lang) || ["css", "scss", "sass", "less"].includes(ext)) return "css";
  if (["json"].includes(lang) || ext === "json") return "json";
  if (["python", "py"].includes(lang) || ext === "py") return "python";
  if (["sql"].includes(lang) || ext === "sql") return "sql";
  if (["markdown", "md"].includes(lang) || ext === "md") return "markdown";
  if (["yaml", "yml"].includes(lang) || ["yaml", "yml"].includes(ext)) return "yaml";
  if (["shell", "bash", "sh", "zsh"].includes(lang) || ["sh", "bash", "zsh"].includes(ext)) return "shell";
  if (["c", "cpp", "h", "hpp"].includes(lang) || ["c", "cpp", "h", "hpp"].includes(ext)) return "cpp";
  if (["rust", "rs"].includes(lang) || ext === "rs") return "rust";
  if (["go"].includes(lang) || ext === "go") return "go";
  if (["java"].includes(lang) || ext === "java") return "java";
  return "javascript";
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onContentChange,
  onSaveFile,
  projectName,
}) => {
  const activeTab = tabs.find((t) => t.fileId === activeTabId);
  const { isDark } = useTheme();

  const [fontSize, setFontSize] = useState<number>(() => {
    return parseInt(localStorage.getItem("cf_editor_font_size") || "13", 10);
  });
  const [wordWrap, setWordWrap] = useState<boolean>(() => {
    return localStorage.getItem("cf_editor_word_wrap") === "true";
  });
  const [showMinimap, setShowMinimap] = useState<boolean>(() => {
    return localStorage.getItem("cf_editor_minimap") !== "false";
  });
  const [autoSave, setAutoSave] = useState<boolean>(() => {
    return localStorage.getItem("cf_editor_auto_save") === "true";
  });

  // UI / Action states
  const [copied, setCopied] = useState(false);
  const [formattedFeedback, setFormattedFeedback] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [customLanguage, setCustomLanguage] = useState<string | null>(null);

  // Position & Diagnostic state
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const [diagnosticsCount, setDiagnosticsCount] = useState({ errors: 0, warnings: 0 });

  // Monaco Editor Reference
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<Monaco | null>(null);

  useEffect(() => {
    localStorage.setItem("cf_editor_font_size", fontSize.toString());
  }, [fontSize]);

  useEffect(() => {
    localStorage.setItem("cf_editor_word_wrap", wordWrap.toString());
  }, [wordWrap]);

  useEffect(() => {
    localStorage.setItem("cf_editor_minimap", showMinimap.toString());
  }, [showMinimap]);

  useEffect(() => {
    localStorage.setItem("cf_editor_auto_save", autoSave.toString());
  }, [autoSave]);

  // Auto-Save Effect (debounced 1200ms) - completely silent background saving
  useEffect(() => {
    if (!autoSave || !activeTab || !activeTab.isDirty) return;

    const timer = setTimeout(() => {
      onSaveFile(activeTab.fileId, true);
    }, 1200);

    return () => clearTimeout(timer);
  }, [autoSave, activeTab?.isDirty, activeTab?.content, activeTab?.fileId, onSaveFile]);

  // Determine active language
  const activeLanguage = useMemo(() => {
    if (customLanguage) return customLanguage;
    if (!activeTab) return "javascript";
    return getMonacoLanguage(activeTab.language, activeTab.name);
  }, [activeTab, customLanguage]);

  // Specialized file preview types
  const activeExt = (activeTab ? activeTab.name.split(".").pop() || "" : "").toLowerCase();
  const lowerName = (activeTab?.name || "").toLowerCase();

  const isMarkdown = activeExt === "md" || activeExt === "markdown" || lowerName.startsWith("readme");
  const isMermaid = activeExt === "mermaid" || activeExt === "mmd";
  const isLatex = ["tex", "latex", "bib", "sty", "cls"].includes(activeExt);
  const isPdf = activeExt === "pdf";
  const isImage = ["png", "jpg", "jpeg", "gif", "webp", "svg", "ico", "bmp", "avif"].includes(activeExt);
  const isSpreadsheet = ["xlsx", "xls", "csv", "tsv"].includes(activeExt);
  const isDocx = ["docx", "doc"].includes(activeExt);
  const isPptx = ["pptx", "ppt", "ppsx"].includes(activeExt);
  const isMedia = ["mp3", "wav", "ogg", "mp4", "webm", "mov"].includes(activeExt);

  const isSpecializedViewer = isMarkdown || isMermaid || isLatex || isPdf || isImage || isSpreadsheet || isDocx || isPptx || isMedia;

  // Reset custom language when tab changes
  useEffect(() => {
    setCustomLanguage(null);
  }, [activeTabId]);

  // Define Custom Monaco Themes & Configure JSX/TSX Compiler & Diagnostic Rules
  const handleEditorWillMount = (monaco: Monaco) => {
    // 1. Configure TypeScript & JavaScript compiler options for JSX / React / TSX
    const tsDefaults = monaco.languages.typescript.typescriptDefaults;
    const jsDefaults = monaco.languages.typescript.javascriptDefaults;

    const compilerOpts = {
      target: monaco.languages.typescript.ScriptTarget.ESNext,
      allowNonTsExtensions: true,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      module: monaco.languages.typescript.ModuleKind.CommonJS,
      noEmit: true,
      esModuleInterop: true,
      jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
      reactNamespace: "React",
      allowJs: true,
      allowSyntheticDefaultImports: true,
      isolatedModules: true,
    };

    tsDefaults.setCompilerOptions(compilerOpts);
    jsDefaults.setCompilerOptions(compilerOpts);

    // 2. Ignore missing sandbox module import errors & JS-in-TS type annotation codes
    const diagnosticsOptions = {
      noSemanticValidation: false,
      noSyntaxValidation: false,
      diagnosticCodesToIgnore: [
        2307, // Cannot find module '...' or its corresponding type declarations
        2686, // 'React' refers to a UMD global, but the current file is a module
        7016, // Could not find a declaration file for module
        2792, // Cannot find module '...'
        2304, // Cannot find name '...'
        17004, // Cannot use JSX unless '--jsx' flag is provided
        2604, // JSX element type does not have any construct or call signatures
        7026, // JSX element implicitly has type 'any'
        2749, // 'React' refers to a value, but is being used as a type here
        2552, // Cannot find name '...'
        2580, // Cannot find name 'require' / 'module'
        2584, // Cannot find name 'console'
        8006, // 'interface' declarations can only be used in TypeScript files
        8008, // Type annotations can only be used in TypeScript files
        8010, // Type aliases can only be used in TypeScript files
        8011, // Type arguments can only be used in TypeScript files
        8012, // Enum declarations can only be used in TypeScript files
        8013, // Const enum declarations can only be used in TypeScript files
      ],
    };

    tsDefaults.setDiagnosticsOptions(diagnosticsOptions);
    jsDefaults.setDiagnosticsOptions(diagnosticsOptions);

    // 3. Register global React and JSX IntrinsicElements extra library
    tsDefaults.addExtraLib(
      `
      declare namespace JSX {
        interface IntrinsicElements {
          [elemName: string]: any;
        }
      }
      declare module "react" {
        export = React;
      }
      declare module "react/jsx-runtime" {
        export const jsx: any;
        export const jsxs: any;
        export const Fragment: any;
      }
      declare namespace React {
        export type FC<P = {}> = (props: P) => any;
        export type ReactNode = any;
        export type ReactElement = any;
        export type ComponentType<P = {}> = any;
        export type CSSProperties = { [key: string]: any };
        export type ChangeEvent<T = any> = { target: { value: string; checked?: boolean; files?: any; name?: string } };
        export type MouseEvent<T = any> = { clientX: number; clientY: number; stopPropagation: () => void; preventDefault: () => void };
        export type KeyboardEvent<T = any> = { key: string; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; altKey: boolean; preventDefault: () => void };
        export type FormEvent<T = any> = { preventDefault: () => void };
        export function useState<T>(initialState: T | (() => T)): [T, (newState: T | ((prev: T) => T)) => void];
        export function useEffect(effect: () => void | (() => void), deps?: any[]): void;
        export function useRef<T>(initialValue?: T): { current: T };
        export function useMemo<T>(factory: () => T, deps: any[] | undefined): T;
        export function useCallback<T extends Function>(callback: T, deps: any[]): T;
        export function useContext<T>(context: any): T;
        export const createElement: any;
        export const Fragment: any;
      }
      declare const React: typeof React;
      `,
      "ts:react.d.ts"
    );

    // 4. Define Pitch Black & Pure White themes with CloudForge Blue accents
    monaco.editor.defineTheme("cloudforge-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "keyword", foreground: "60a5fa", fontStyle: "normal" },
        { token: "string", foreground: "4ade80" },
        { token: "number", foreground: "38bdf8" },
        { token: "comment", foreground: "737373", fontStyle: "italic" },
        { token: "type", foreground: "38bdf8" },
        { token: "function", foreground: "38bdf8" },
        { token: "tag", foreground: "60a5fa" },
        { token: "attribute.name", foreground: "38bdf8" },
        { token: "delimiter", foreground: "a3a3a3" },
      ],
      colors: {
        "editor.background": "#000000",
        "editor.foreground": "#ffffff",
        "editorGutter.background": "#050505",
        "editorLineNumber.foreground": "#525252",
        "editorLineNumber.activeForeground": "#60a5fa",
        "editor.lineHighlightBackground": "#111111",
        "editor.lineHighlightBorder": "#00000000",
        "editor.selectionBackground": "#3b82f640",
        "editor.inactiveSelectionBackground": "#3b82f620",
        "editorCursor.foreground": "#60a5fa",
        "editorBracketMatch.background": "#3b82f630",
        "editorBracketMatch.border": "#60a5fa",
        "scrollbarSlider.background": "#26262680",
        "scrollbarSlider.hoverBackground": "#404040a0",
        "scrollbarSlider.activeBackground": "#525252",
      },
    });

    monaco.editor.defineTheme("cloudforge-light", {
      base: "vs",
      inherit: true,
      rules: [
        { token: "keyword", foreground: "2563eb", fontStyle: "normal" },
        { token: "string", foreground: "16a34a" },
        { token: "number", foreground: "0284c7" },
        { token: "comment", foreground: "737373", fontStyle: "italic" },
        { token: "type", foreground: "0284c7" },
        { token: "function", foreground: "0284c7" },
        { token: "tag", foreground: "2563eb" },
        { token: "attribute.name", foreground: "0284c7" },
        { token: "delimiter", foreground: "525252" },
      ],
      colors: {
        "editor.background": "#ffffff",
        "editor.foreground": "#000000",
        "editorGutter.background": "#fafafa",
        "editorLineNumber.foreground": "#a3a3a3",
        "editorLineNumber.activeForeground": "#2563eb",
        "editor.lineHighlightBackground": "#f5f5f5",
        "editor.lineHighlightBorder": "#00000000",
        "editor.selectionBackground": "#bfdbfe70",
        "editor.inactiveSelectionBackground": "#bfdbfe30",
        "editorCursor.foreground": "#000000",
        "editorBracketMatch.background": "#bfdbfe50",
        "editorBracketMatch.border": "#2563eb",
        "scrollbarSlider.background": "#d4d4d480",
        "scrollbarSlider.hoverBackground": "#a3a3a3a0",
        "scrollbarSlider.activeBackground": "#737373",
      },
    });
  };

  // On Monaco Editor Mount
  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Track Cursor Position
    editor.onDidChangeCursorPosition((e) => {
      setCursorPos({
        line: e.position.lineNumber,
        col: e.position.column,
      });
    });

    // Track Diagnostics (Errors / Warnings)
    const updateMarkers = () => {
      const model = editor.getModel();
      if (model) {
        const markers = monaco.editor.getModelMarkers({ resource: model.uri });
        const errors = markers.filter((m: { severity: number }) => m.severity === monaco.MarkerSeverity.Error).length;
        const warnings = markers.filter((m: { severity: number }) => m.severity === monaco.MarkerSeverity.Warning).length;
        setDiagnosticsCount({ errors, warnings });
      }
    };

    monaco.editor.onDidChangeMarkers(updateMarkers);
    updateMarkers();

    // Register Keybinding Ctrl+S -> Save
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      if (activeTab) {
        onSaveFile(activeTab.fileId);
      }
    });

    // Register Keybinding Alt+Shift+F -> Format Document
    editor.addCommand(monaco.KeyMod.Alt | monaco.KeyMod.Shift | monaco.KeyCode.KeyF, () => {
      handleAutoFormat();
    });
  };

  // Jump to next diagnostic error
  const jumpToNextDiagnostic = () => {
    if (!editorRef.current || !monacoRef.current) return;
    const model = editorRef.current.getModel();
    if (!model) return;
    const markers = monacoRef.current.editor.getModelMarkers({ resource: model.uri });
    if (markers.length === 0) return;

    const currentLine = cursorPos.line;
    const next = markers.find((m: { startLineNumber: number }) => m.startLineNumber > currentLine) || markers[0];
    if (next) {
      editorRef.current.setPosition({ lineNumber: next.startLineNumber, column: next.startColumn });
      editorRef.current.revealLineInCenter(next.startLineNumber);
      editorRef.current.focus();
    }
  };

  // Copy code handler
  const handleCopy = () => {
    if (!activeTab) return;
    navigator.clipboard.writeText(activeTab.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Auto-beautify format handler
  const handleAutoFormat = useCallback(() => {
    if (!activeTab) return;
    // Attempt Monaco's native format action first, with fallback to codeFormatter AST
    if (editorRef.current) {
      const formatAction = editorRef.current.getAction("editor.action.formatDocument");
      if (formatAction) {
        formatAction.run().catch(() => {
          const formatted = formatCode(activeTab.content, activeLanguage);
          onContentChange(activeTab.fileId, formatted);
        });
      } else {
        const formatted = formatCode(activeTab.content, activeLanguage);
        onContentChange(activeTab.fileId, formatted);
      }
    } else {
      const formatted = formatCode(activeTab.content, activeLanguage);
      onContentChange(activeTab.fileId, formatted);
    }
    setFormattedFeedback(true);
    setTimeout(() => setFormattedFeedback(false), 1500);
  }, [activeTab, activeLanguage, onContentChange]);

  // Find & Replace trigger
  const handleToggleFind = () => {
    if (editorRef.current) {
      editorRef.current.getAction("actions.find")?.run();
    }
  };

  // Breadcrumb segments
  const breadcrumbParts = useMemo(() => {
    if (!activeTab) return [projectName];
    const pathParts = activeTab.path.split("/").filter(Boolean);
    return [projectName, ...pathParts];
  }, [activeTab, projectName]);

  const rawLinesCount = activeTab ? activeTab.content.split("\n").length : 0;
  const charCount = activeTab ? activeTab.content.length : 0;

  const currentTheme = isDark ? "cloudforge-dark" : "cloudforge-light";
  const bg = isDark ? "#000000" : "#ffffff";
  const toolbarBg = isDark ? "#080808" : "#fafafa";
  const gutterBg = isDark ? "#050505" : "#fafafa";
  const borderColor = isDark ? "#1f1f1f" : "#e5e5e5";
  const textColor = isDark ? "#ffffff" : "#000000";
  const accentColor = isDark ? "#3b82f6" : "#2563eb";

  if (!activeTab) {
    return (
      <div
        style={{
          backgroundColor: bg,
          color: textColor,
        }}
        className="h-full flex flex-col items-center justify-center p-6 text-center select-none font-sans transition-colors duration-150"
      >
        <div
          style={{
            backgroundColor: isDark ? "rgba(59, 130, 246, 0.15)" : "rgba(37, 99, 235, 0.1)",
            color: accentColor,
            borderColor: borderColor,
          }}
          className="w-16 h-16 rounded-3xl border flex items-center justify-center mb-4 shadow-xl"
        >
          <Code className="w-8 h-8" />
        </div>

        <h3 className="text-base font-bold tracking-tight mb-1.5">
          CloudForge Monaco IDE
        </h3>
        <p className="text-xs opacity-60 max-w-sm leading-relaxed mb-6">
          Powered by VS Code's Monaco Editor engine • Intelligent IntelliSense • Real-time AST Diagnostics.
          Select a file from the explorer to begin coding.
        </p>

        {/* Shortcuts card on Empty State */}
        <div
          style={{
            backgroundColor: toolbarBg,
            borderColor: borderColor,
          }}
          className="flex flex-wrap items-center justify-center gap-3 text-xs font-mono px-5 py-2.5 rounded-2xl border shadow-sm opacity-80 mb-6"
        >
          <span><kbd className="font-semibold text-blue-400">Ctrl+S</kbd> Save</span>
          <span className="opacity-40">•</span>
          <span><kbd className="font-semibold text-blue-400">Ctrl+F</kbd> Find & Replace</span>
          <span className="opacity-40">•</span>
          <span><kbd className="font-semibold text-emerald-400">Ctrl+/</kbd> Comment</span>
          <span className="opacity-40">•</span>
          <span><kbd className="font-semibold text-blue-400">Alt+Shift+F</kbd> Format</span>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        backgroundColor: bg,
        color: textColor,
      }}
      className="h-full flex flex-col overflow-hidden select-none font-sans transition-colors duration-150 relative"
    >
      {/* Tab Bar */}
      <div
        style={{
          backgroundColor: toolbarBg,
          borderColor: borderColor,
        }}
        className="h-9.5 border-b flex items-center justify-between px-1 select-none shrink-0 relative z-30 overflow-visible"
      >
        <div className="flex items-center gap-1 overflow-x-auto min-w-0 flex-1 scrollbar-none h-full">
          {tabs.map((tab) => {
            const isActive = tab.fileId === activeTabId;
            return (
              <div
                key={tab.fileId}
                onClick={() => onSelectTab(tab.fileId)}
                style={{
                  backgroundColor: isActive ? bg : "transparent",
                  color: isActive ? textColor : "inherit",
                  borderColor: isActive ? accentColor : borderColor,
                }}
                className={`group h-8 px-3 flex items-center gap-2 text-xs cursor-pointer rounded-t-md border-r transition-all shrink-0 ${
                  isActive
                    ? "font-semibold border-t-2 shadow-xs opacity-100"
                    : "opacity-60 hover:opacity-100 hover:bg-white/5"
                }`}
              >
                <FileIcon
                  name={tab.name}
                  type="file"
                  className="w-3.5 h-3.5 shrink-0"
                />
                <span className="truncate max-w-[100px] sm:max-w-[140px] font-mono text-[11px]">
                  {tab.name}
                </span>

                <div className="flex items-center ml-1">
                  {tab.isDirty ? (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        onCloseTab(tab.fileId);
                      }}
                      style={{ backgroundColor: accentColor }}
                      className="w-2 h-2 rounded-full group-hover:hidden shadow-xs"
                      title="Unsaved changes"
                    />
                  ) : null}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onCloseTab(tab.fileId);
                    }}
                    className={`p-0.5 rounded hover:bg-white/20 opacity-60 hover:opacity-100 ${
                      tab.isDirty ? "hidden group-hover:block" : ""
                    }`}
                    title="Close tab"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Toolbar Controls (Always accessible for all files, with Monaco specific tools when editing code) */}
        <div className="flex items-center gap-1 shrink-0 px-2 relative z-40 overflow-visible">
          {/* Monaco-specific tools */}
          {!isSpecializedViewer && (
            <>
              {/* Diagnostic status badge on toolbar */}
              {(diagnosticsCount.errors > 0 || diagnosticsCount.warnings > 0) && (
                <button
                  onClick={jumpToNextDiagnostic}
                  className={`px-2 py-0.5 rounded flex items-center gap-1 text-[11px] font-bold transition-all cursor-pointer mr-1 ${
                    diagnosticsCount.errors > 0
                      ? "bg-rose-500/15 text-rose-400 border border-rose-500/30 hover:bg-rose-500/25"
                      : "bg-sky-500/15 text-sky-400 border border-sky-500/30 hover:bg-sky-500/25"
                  }`}
                  title="Click to jump to next error"
                >
                  {diagnosticsCount.errors > 0 ? (
                    <AlertCircle className="w-3 h-3 text-rose-500 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-3 h-3 text-sky-400 shrink-0" />
                  )}
                  <span>
                    {diagnosticsCount.errors > 0
                      ? `${diagnosticsCount.errors} error${diagnosticsCount.errors > 1 ? "s" : ""}`
                      : `${diagnosticsCount.warnings} warn`}
                  </span>
                </button>
              )}

              {/* Auto Format / Beautify */}
              <button
                onClick={handleAutoFormat}
                className={`p-1.5 rounded transition-colors cursor-pointer ${
                  isDark ? "hover:bg-neutral-800 text-neutral-300" : "hover:bg-neutral-200 text-neutral-700"
                }`}
                title="Auto-format code (Alt+Shift+F)"
              >
                {formattedFeedback ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                )}
              </button>

              {/* Find & Replace Toggle */}
              <button
                onClick={handleToggleFind}
                className={`p-1.5 rounded transition-colors cursor-pointer ${
                  isDark ? "hover:bg-neutral-800 text-neutral-300" : "hover:bg-neutral-200 text-neutral-700"
                }`}
                title="Find and Replace (Ctrl+F)"
              >
                <Search className="w-3.5 h-3.5" />
              </button>

              {/* Word Wrap Toggle */}
              <button
                onClick={() => setWordWrap((v) => !v)}
                className={`p-1.5 rounded transition-colors cursor-pointer ${
                  wordWrap
                    ? isDark
                      ? "bg-blue-600/30 text-blue-400 font-bold"
                      : "bg-blue-100 text-blue-800 font-bold"
                    : isDark
                    ? "hover:bg-neutral-800 text-neutral-400"
                    : "hover:bg-neutral-200 text-neutral-600"
                }`}
                title={wordWrap ? "Word Wrap: Enabled" : "Word Wrap: Disabled"}
              >
                <WrapText className="w-3.5 h-3.5" />
              </button>

              {/* Minimap Toggle */}
              <button
                onClick={() => setShowMinimap((v) => !v)}
                className={`p-1.5 rounded transition-colors cursor-pointer ${
                  showMinimap
                    ? isDark
                      ? "bg-blue-600/30 text-blue-400 font-bold"
                      : "bg-blue-100 text-blue-800 font-bold"
                    : isDark
                    ? "hover:bg-neutral-800 text-neutral-400"
                    : "hover:bg-neutral-200 text-neutral-600"
                }`}
                title={showMinimap ? "Hide Minimap" : "Show Minimap"}
              >
                <Map className="w-3.5 h-3.5" />
              </button>

              {/* Zoom Out */}
              <button
                onClick={() => setFontSize((s) => Math.max(10, s - 1))}
                className={`p-1.5 rounded transition-colors cursor-pointer ${
                  isDark ? "hover:bg-neutral-800 text-neutral-300" : "hover:bg-neutral-200 text-neutral-700"
                }`}
                title="Zoom Out (Smaller Font)"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>

              {/* Zoom In */}
              <button
                onClick={() => setFontSize((s) => Math.min(24, s + 1))}
                className={`p-1.5 rounded transition-colors cursor-pointer ${
                  isDark ? "hover:bg-neutral-800 text-neutral-300" : "hover:bg-neutral-200 text-neutral-700"
                }`}
                title="Zoom In (Larger Font)"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>

              {/* Copy Code */}
              <button
                onClick={handleCopy}
                className={`p-1.5 rounded transition-colors cursor-pointer ${
                  isDark ? "hover:bg-neutral-800 text-neutral-300" : "hover:bg-neutral-200 text-neutral-700"
                }`}
                title="Copy all code"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </>
          )}

          {/* Auto-Save Toggle (Available for ALL files: MD, Code, TeX, CSV, etc.) */}
          <button
            onClick={() => setAutoSave((v) => !v)}
            className={`px-2 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1.5 text-[11px] font-medium border ${
              autoSave
                ? isDark
                  ? "bg-blue-500/20 text-blue-400 border-blue-500/40 font-bold shadow-xs"
                  : "bg-blue-100 text-blue-800 border-blue-300 font-bold shadow-xs"
                : isDark
                ? "text-neutral-400 hover:text-white hover:bg-neutral-800 border-transparent"
                : "text-neutral-700 hover:text-black hover:bg-neutral-200 border-transparent"
            }`}
            title={
              autoSave
                ? "Auto-Save: Enabled (Changes save automatically after typing)"
                : "Auto-Save: Disabled (Click to enable automatic saving)"
            }
          >
            <Zap className={`w-3.5 h-3.5 ${autoSave ? (isDark ? "text-blue-400" : "text-blue-600") : ""}`} />
            <span className="inline">Auto-Save: {autoSave ? "ON" : "OFF"}</span>
          </button>

          {/* Save Button (Shown whenever active file has unsaved changes) */}
          {activeTab.isDirty && (
            <button
              onClick={() => onSaveFile(activeTab.fileId)}
              style={{ backgroundColor: accentColor }}
              className="px-2.5 py-1 rounded-md text-white font-semibold text-[11px] flex items-center gap-1.5 shadow-sm hover:brightness-110 active:scale-95 transition-all ml-1 cursor-pointer"
              title="Save changes (Ctrl+S)"
            >
              <Save className="w-3 h-3" />
              <span>Save</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Body: Render Specialized Previewers or Standard Monaco Code Editor */}
      {isMarkdown ? (
        <div className="flex-1 overflow-hidden">
          <MarkdownViewer
            content={activeTab.content}
            filename={activeTab.name}
            isDirty={activeTab.isDirty}
            onContentChange={(val) => onContentChange(activeTab.fileId, val)}
            onSave={() => onSaveFile(activeTab.fileId)}
          />
        </div>
      ) : isMermaid ? (
        <div className="flex-1 overflow-hidden">
          <MermaidViewer
            content={activeTab.content}
            filename={activeTab.name}
            isDirty={activeTab.isDirty}
            onContentChange={(val) => onContentChange(activeTab.fileId, val)}
            onSave={() => onSaveFile(activeTab.fileId)}
          />
        </div>
      ) : isLatex ? (
        <div className="flex-1 overflow-hidden">
          <LatexViewer
            content={activeTab.content}
            filename={activeTab.name}
            isDirty={activeTab.isDirty}
            onContentChange={(val) => onContentChange(activeTab.fileId, val)}
            onSave={() => onSaveFile(activeTab.fileId)}
          />
        </div>
      ) : isPdf ? (
        <div className="flex-1 overflow-hidden">
          <PdfViewer
            content={activeTab.content}
            filename={activeTab.name}
            size={activeTab.content ? Math.round((activeTab.content.length * 3) / 4) : 0}
          />
        </div>
      ) : isImage ? (
        <div className="flex-1 overflow-hidden">
          <ImageViewer
            content={activeTab.content}
            filename={activeTab.name}
            size={activeTab.content ? Math.round((activeTab.content.length * 3) / 4) : 0}
          />
        </div>
      ) : isSpreadsheet ? (
        <div className="flex-1 overflow-hidden">
          <SpreadsheetViewer
            content={activeTab.content}
            filename={activeTab.name}
            isDirty={activeTab.isDirty}
            onContentChange={(val) => onContentChange(activeTab.fileId, val)}
            onSave={() => onSaveFile(activeTab.fileId)}
          />
        </div>
      ) : isDocx ? (
        <div className="flex-1 overflow-hidden">
          <DocxViewer
            content={activeTab.content}
            filename={activeTab.name}
            size={activeTab.content ? Math.round((activeTab.content.length * 3) / 4) : 0}
          />
        </div>
      ) : isPptx ? (
        <div className="flex-1 overflow-hidden">
          <PptxViewer
            content={activeTab.content}
            filename={activeTab.name}
            size={activeTab.content ? Math.round((activeTab.content.length * 3) / 4) : 0}
          />
        </div>
      ) : isMedia ? (
        <div className="flex-1 overflow-hidden">
          <MediaViewer
            content={activeTab.content}
            filename={activeTab.name}
            size={activeTab.content ? Math.round((activeTab.content.length * 3) / 4) : 0}
          />
        </div>
      ) : (
        /* Standard Monaco Editor Layout */
        <>
          {/* Breadcrumb Path Bar */}
          <div
            style={{
              backgroundColor: gutterBg,
              borderColor: borderColor,
            }}
            className="h-6 px-3 border-b flex items-center justify-between text-[11px] font-mono opacity-80 shrink-0 relative z-20 overflow-visible"
          >
            <div className="flex items-center gap-1 truncate max-w-[65%] sm:max-w-[75%]">
              {breadcrumbParts.map((part, index) => (
                <React.Fragment key={index}>
                  {index > 0 && <ChevronRight className="w-3 h-3 opacity-40 shrink-0" />}
                  <span
                    className={`truncate ${
                      index === breadcrumbParts.length - 1
                        ? "font-bold text-inherit"
                        : "opacity-60 hidden sm:inline"
                    }`}
                  >
                    {part}
                  </span>
                </React.Fragment>
              ))}
            </div>

            {/* Language Override Selector */}
            <div className="relative flex items-center gap-2 shrink-0 overflow-visible">
              <button
                onClick={() => setShowLangMenu((v) => !v)}
                className="flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded hover:bg-white/10 opacity-75 hover:opacity-100 transition-colors cursor-pointer"
                title="Change Syntax Highlighting"
              >
                <Layers className="w-3 h-3 text-blue-400" />
                <span>{activeLanguage}</span>
              </button>

              {showLangMenu && (
                <>
                  <div
                    onClick={() => setShowLangMenu(false)}
                    className="fixed inset-0 z-40 bg-black/10"
                  />
                  <div
                    style={{
                      backgroundColor: toolbarBg,
                      borderColor: borderColor,
                      color: textColor,
                    }}
                    className="absolute right-0 top-full mt-1.5 w-48 rounded-xl border shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 max-h-72 overflow-y-auto"
                  >
                    <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider opacity-50 border-b border-white/10 mb-1">
                      Syntax Modes ({SUPPORTED_LANGUAGES.length})
                    </div>
                    {SUPPORTED_LANGUAGES.map((lang) => (
                      <button
                        key={lang.id}
                        onClick={() => {
                          setCustomLanguage(lang.id);
                          setShowLangMenu(false);
                        }}
                        className={`w-full px-3 py-1.5 text-left text-xs hover:bg-white/10 transition-colors cursor-pointer ${
                          activeLanguage === lang.id ? "font-bold bg-white/10 text-cyan-400" : "opacity-80"
                        }`}
                      >
                        {lang.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Editor Body with Microsoft Monaco Editor Engine */}
          <div className="flex-1 overflow-hidden relative">
            <Editor
              height="100%"
              path={activeTab.path.startsWith("/") ? activeTab.path : `/${activeTab.path}`}
              language={activeLanguage}
              value={activeTab.content}
              theme={currentTheme}
              beforeMount={handleEditorWillMount}
              onMount={handleEditorDidMount}
              onChange={(val) => onContentChange(activeTab.fileId, val || "")}
              options={{
                fontSize,
                fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Menlo, Monaco, Consolas, monospace",
                fontLigatures: true,
                lineHeight: Math.max(18, Math.round(fontSize * 1.6)),
                tabSize: 2,
                wordWrap: wordWrap ? "on" : "off",
                minimap: {
                  enabled: showMinimap,
                  renderCharacters: false,
                  side: "right",
                },
                scrollBeyondLastLine: false,
                smoothScrolling: true,
                cursorBlinking: "smooth",
                cursorSmoothCaretAnimation: "on",
                automaticLayout: true,
                renderLineHighlight: "all",
                renderWhitespace: "selection",
                bracketPairColorization: { enabled: true },
                guides: {
                  bracketPairs: true,
                  indentation: true,
                },
                padding: {
                  top: 12,
                  bottom: 12,
                },
                overviewRulerBorder: false,
                hideCursorInOverviewRuler: true,
                folding: true,
                showFoldingControls: "mouseover",
                lineNumbersMinChars: 3,
                glyphMargin: false,
              }}
            />
          </div>

          {/* Editor Status Bar with VS Code Error/Warning Counter */}
          <div
            style={{
              backgroundColor: bg,
              borderColor: borderColor,
              color: isDark ? "#a3a3a3" : "#525252",
            }}
            className="h-6 px-3 border-t flex items-center justify-between text-[10px] font-mono select-none shrink-0"
          >
            <div className="flex items-center gap-3">
              {/* Error/Warning Counter from Monaco */}
              <button
                onClick={jumpToNextDiagnostic}
                className={`flex items-center gap-1.5 font-semibold px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
                  diagnosticsCount.errors > 0
                    ? "text-rose-400 hover:bg-rose-500/10"
                    : diagnosticsCount.warnings > 0
                    ? "text-sky-400 hover:bg-sky-500/10"
                    : "text-emerald-400 hover:bg-emerald-500/10"
                }`}
                title="Click to jump to next diagnostic"
              >
                {diagnosticsCount.errors > 0 ? (
                  <>
                    <AlertCircle className="w-3 h-3 text-rose-500 shrink-0" />
                    <span>{diagnosticsCount.errors}</span>
                    {diagnosticsCount.warnings > 0 && (
                      <>
                        <AlertTriangle className="w-3 h-3 text-sky-400 shrink-0 ml-1" />
                        <span>{diagnosticsCount.warnings}</span>
                      </>
                    )}
                  </>
                ) : diagnosticsCount.warnings > 0 ? (
                  <>
                    <AlertTriangle className="w-3 h-3 text-sky-400 shrink-0" />
                    <span>{diagnosticsCount.warnings}</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                    <span>0 errors</span>
                  </>
                )}
              </button>

              {/* Auto-Save Status Bar Button */}
              <button
                onClick={() => setAutoSave((v) => !v)}
                className={`transition-colors cursor-pointer flex items-center gap-1 font-mono text-[11px] ${
                  isDark
                    ? "text-neutral-400 hover:text-blue-400"
                    : "text-neutral-700 hover:text-blue-600 font-semibold"
                }`}
                title="Click to toggle Auto-Save"
              >
                <Zap className={`w-3 h-3 ${autoSave ? (isDark ? "text-blue-400" : "text-blue-600") : "opacity-60"}`} />
                <span>Auto-Save: {autoSave ? "ON" : "OFF"}</span>
              </button>

              <span className="hidden sm:inline opacity-60">UTF-8</span>
              <span className="hidden md:inline opacity-60">{activeLanguage.toUpperCase()}</span>
            </div>

            <div className="flex items-center gap-3">
              <span>
                Ln <strong className="text-inherit">{cursorPos.line}</strong>, Col <strong className="text-inherit">{cursorPos.col}</strong>
              </span>
              <span className="opacity-60 hidden sm:inline">{rawLinesCount} lines</span>
              <span className="opacity-60 hidden lg:inline">{charCount} chars</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
