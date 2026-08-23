import React, { useState, useEffect, useMemo } from "react";
import katex from "katex";
import Editor from "@monaco-editor/react";
import {
  Columns2,
  Eye,
  Code,
  Copy,
  Check,
  Save,
  Sigma,
  ChevronDown,
  Printer,
  Download,
  ChevronLeft,
  ChevronRight,
  Layers,
  Presentation,
  Sparkles,
} from "lucide-react";
import { useTheme } from "../../../context/ThemeContext";

interface LatexViewerProps {
  content: string;
  filename: string;
  isDirty?: boolean;
  onContentChange: (newContent: string) => void;
  onSave?: () => Promise<void>;
}

interface BeamerSlide {
  number: number;
  title: string;
  html: string;
}

const MATH_SNIPPETS = [
  { label: "Fraction", code: "\\frac{a}{b}" },
  { label: "Square Root", code: "\\sqrt{x^2 + y^2}" },
  { label: "Summation", code: "\\sum_{i=1}^{n} x_i" },
  { label: "Integral", code: "\\int_{0}^{\\infty} e^{-x^2} \\, dx = \\frac{\\sqrt{\\pi}}{2}" },
  { label: "Limit", code: "\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1" },
  { label: "Matrix (2x2)", code: "\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}" },
  { label: "Cases / Piecewise", code: "f(x) = \\begin{cases} x^2 & \\text{if } x \\ge 0 \\\\ -x & \\text{if } x < 0 \\end{cases}" },
  { label: "Greek Letters", code: "\\alpha, \\beta, \\gamma, \\theta, \\lambda, \\mu, \\pi, \\sigma, \\omega, \\Delta, \\Omega" },
  { label: "Euler's Identity", code: "e^{i\\pi} + 1 = 0" },
  { label: "Quadratic Formula", code: "x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}" },
  { label: "tcolorbox Block", code: "\\begin{tcolorbox}[colback=bloodred, text=white, title=Important Note]\nContent inside styled box\n\\end{tcolorbox}" },
  { label: "Beamer Frame", code: "\\begin{frame}{Slide Title}\n\\begin{block}{Section Block}\nKey concept description.\n\\end{block}\n\\end{frame}" },
];

const STARTER_TEX = `\\documentclass[a4paper,11pt]{article}
\\title{CloudForge Technical & Scientific Report}
\\author{CloudForge Distributed Engineering Team}
\\date{\\today}

\\begin{document}

\\maketitle

\\begin{abstract}
This report outlines the theoretical foundation and mathematical formulations powering the CloudForge Cloud-Native Collaborative Development Workspace. We present deterministic performance metrics, state transitions, and distributed synchronization properties.
\\end{abstract}

\\section{1. Introduction}
CloudForge provides modern cloud workspaces with multi-modal file viewers, native version control, and real-time collaboration.

\\begin{tcolorbox}[colback=lightgray, colframe=darkgray, title=Key Focus]
The platform guarantees data integrity and reliable patient care by maintaining a highly structured and optimized matching process.
\\end{tcolorbox}

\\section{2. Mathematical Foundations}
The objective loss function for neural network optimization with $L_2$ regularization is defined as:

\\begin{equation}
\\mathcal{L}(\\theta) = \\frac{1}{N} \\sum_{i=1}^{N} \\left( y_i - f(x_i; \\theta) \\right)^2 + \\lambda \\|\\theta\\|_2^2
\\end{equation}

Where the gradient descent step is evaluated as:

\\begin{equation}
\\theta_{t+1} = \\theta_t - \\eta \\nabla_\\theta \\mathcal{L}(\\theta_t)
\\end{equation}

\\newpage

\\section{3. Distributed Topology & Flow}
The system coordinates cluster consensus through vectorized state machine transitions:

\\[
P = \\begin{pmatrix}
p_{11} & p_{12} & \\dots & p_{1k} \\\\
p_{21} & p_{22} & \\dots & p_{2k} \\\\
\\vdots & \\vdots & \\ddots & \\vdots \\\\
p_{k1} & p_{k2} & \\dots & p_{kk}
\\end{pmatrix}
\\]

\\section{4. Conclusion}
The computational performance verifies deterministic time complexity $\\mathcal{O}(n \\log n)$ with minimal synchronization latency.

\\end{document}
`;

export const LatexViewer: React.FC<LatexViewerProps> = ({
  content,
  filename,
  isDirty = false,
  onContentChange,
  onSave,
}) => {
  const { isDark } = useTheme();
  const [viewMode, setViewMode] = useState<"split" | "preview" | "editor">("split");
  const [copied, setCopied] = useState(false);
  const [showSymbols, setShowSymbols] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);

  // Beamer presentation state
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [showThumbnails, setShowThumbnails] = useState(true);

  const rawCode = content || STARTER_TEX;

  // Detect document type
  const isBeamer = useMemo(() => {
    return (
      rawCode.includes("\\documentclass{beamer}") ||
      rawCode.includes("documentclass[") && rawCode.includes("beamer") ||
      rawCode.includes("\\begin{frame}")
    );
  }, [rawCode]);

  // Color mapping helper
  const getColorStyle = (colorName: string) => {
    const map: Record<string, string> = {
      bloodred: "#b22222",
      medicalred: "#dc2626",
      darkgray: "#323232",
      darkslate: "#0f172a",
      softslate: "#334155",
      lightgray: isDark ? "#1e293b" : "#f1f5f9",
      lightbg: isDark ? "#0f172a" : "#f8fafc",
      lightpink: isDark ? "#450a0a" : "#fff0f0",
      accentblue: "#2563eb",
      successgreen: "#16a34a",
      codebg: isDark ? "#1e1e1e" : "#f8fafc",
      white: isDark ? "#0f172a" : "#ffffff",
      black: isDark ? "#ffffff" : "#000000",
    };
    return map[colorName.toLowerCase()] || colorName;
  };

  const renderFormula = (formula: string, displayMode = false) => {
    try {
      return katex.renderToString(formula.trim(), {
        displayMode,
        throwOnError: false,
      });
    } catch {
      return `<span class="text-rose-400 font-mono text-xs">${formula}</span>`;
    }
  };

  const processInline = (text: string) => {
    let out = text
      .replace(/\\textbf{([^}]+)}/g, "<strong>$1</strong>")
      .replace(/\\textit{([^}]+)}/g, "<em>$1</em>")
      .replace(/\\underline{([^}]+)}/g, "<u>$1</u>")
      .replace(/\\texttt{([^}]+)}/g, `<code class="px-1.5 py-0.5 rounded text-xs font-mono ${isDark ? "bg-neutral-800 text-cyan-300" : "bg-neutral-200 text-cyan-800"}">$1</code>`)
      .replace(/\\textcolor{([^}]+)}{([^}]+)}/g, (_, col, txt) => {
        const c = getColorStyle(col);
        return `<span style="color: ${c}">${txt}</span>`;
      })
      .replace(/\$([^\$]+)\$/g, (_, math) => renderFormula(math, false));
    return out;
  };

  // Parse TikZ Diagrams / Flowcharts into visual blocks
  const parseTikz = (tikzContent: string) => {
    const nodes: { id: string; label: string; style: string }[] = [];
    const nodeRegex = /\\node\s*\(([^)]+)\)\s*(?:at\s*\([^)]+\))?\s*(?:\[([^\]]*)\])?\s*{([^}]+)}/g;
    let match;
    while ((match = nodeRegex.exec(tikzContent)) !== null) {
      const id = match[1].trim();
      const style = (match[2] || "").trim();
      const rawLabel = match[3].replace(/\\\\/g, " ").trim();
      const label = processInline(rawLabel);
      nodes.push({ id, label, style });
    }

    if (nodes.length === 0) {
      return `<div class="p-4 my-4 rounded-xl border border-dashed text-center text-xs font-mono ${
        isDark ? "bg-neutral-900 border-neutral-700 text-neutral-400" : "bg-neutral-50 border-neutral-300 text-neutral-600"
      }">[TikZ System Architecture & Flowchart Diagram]</div>`;
    }

    return `
      <div class="my-6 p-4 rounded-2xl border ${
        isDark ? "bg-neutral-900/60 border-neutral-800" : "bg-neutral-50/80 border-neutral-200"
      }">
        <div class="text-[10px] font-bold uppercase tracking-widest mb-3 opacity-60 flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full bg-red-500"></span>
          <span>System Flow & Architecture Pipeline</span>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          ${nodes
            .map((n, idx) => {
              const isStartEnd = n.style.includes("startend") || n.style.includes("startstop");
              const isDecision = n.style.includes("decision");
              const isAlert = n.style.includes("red") || n.style.includes("bloodred");
              const isGreen = n.style.includes("green") || n.style.includes("success");
              const isBlue = n.style.includes("blue") || n.style.includes("accent");

              let bgClass = isDark ? "bg-neutral-800 border-neutral-700 text-neutral-200" : "bg-white border-neutral-200 text-neutral-800";
              if (isStartEnd || isAlert) bgClass = "bg-red-600/15 border-red-500/40 text-red-500 font-bold";
              else if (isDecision) bgClass = "bg-amber-500/15 border-amber-500/40 text-amber-500 font-semibold";
              else if (isGreen) bgClass = "bg-emerald-500/15 border-emerald-500/40 text-emerald-500 font-semibold";
              else if (isBlue) bgClass = "bg-blue-500/15 border-blue-500/40 text-blue-500 font-semibold";

              return `
                <div class="p-3 rounded-xl border text-xs flex items-center justify-between gap-2 shadow-xs transition-all ${bgClass}">
                  <span class="font-mono text-[10px] opacity-50 font-bold">#${idx + 1}</span>
                  <div class="flex-1 text-center font-medium">${n.label}</div>
                </div>
              `;
            })
            .join("")}
        </div>
      </div>
    `;
  };

  // Parser for general LaTeX blocks
  const parseLatexBlocks = (raw: string) => {
    let html = "";
    const lines = raw.split("\n");

    let docTitle = "";
    let docSubtitle = "";
    let docAuthor = "";
    let docDate = "";
    let docInstitute = "";

    let inEquation = false;
    let equationBuffer = "";
    let inTikz = false;
    let tikzBuffer = "";
    let inTcolorbox = false;
    let tcolorboxBuffer = "";
    let tcolorboxTitle = "";
    let tcolorboxBg = "";
    let inListing = false;
    let listingBuffer = "";

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();

      // Extract metadata
      if (line.startsWith("\\title[")) {
        docTitle = line.replace(/\\title\[[^\]]*\]{([^}]*)}/, "$1").replace(/\\textbf{([^}]*)}/g, "$1");
        continue;
      }
      if (line.startsWith("\\title{")) {
        docTitle = line.replace("\\title{", "").replace(/}$/, "").replace(/\\textbf{([^}]*)}/g, "$1");
        continue;
      }
      if (line.startsWith("\\subtitle{")) {
        docSubtitle = line.replace("\\subtitle{", "").replace(/}$/, "");
        continue;
      }
      if (line.startsWith("\\author")) {
        docAuthor = line.replace(/\\author(\[[^\]]*\])?{([^}]*)}/, "$2").replace(/\\textbf{([^}]*)}/g, "$1");
        continue;
      }
      if (line.startsWith("\\institute")) {
        docInstitute = line.replace(/\\institute(\[[^\]]*\])?{([^}]*)}/, "$2").replace(/\\\\/g, " - ");
        continue;
      }
      if (line.startsWith("\\date")) {
        docDate = line.replace(/\\date(\[[^\]]*\])?{([^}]*)}/, "$2");
        continue;
      }

      // \maketitle or \titlepage
      if (line.includes("\\maketitle") || line.includes("\\titlepage")) {
        html += `
          <div class="text-center py-8 border-b ${isDark ? "border-neutral-800" : "border-neutral-200"} mb-8">
            <h1 class="text-3xl font-extrabold tracking-tight mb-2 ${isDark ? "text-white" : "text-black"}">
              ${docTitle || filename.replace(/\.[^/.]+$/, "")}
            </h1>
            ${docSubtitle ? `<p class="text-base font-semibold text-red-500 mb-2">${docSubtitle}</p>` : ""}
            ${docAuthor ? `<p class="text-sm font-medium ${isDark ? "text-neutral-300" : "text-neutral-700"}">${docAuthor}</p>` : ""}
            ${docInstitute ? `<p class="text-xs ${isDark ? "text-neutral-400" : "text-neutral-500"} mt-1">${docInstitute}</p>` : ""}
            ${docDate ? `<p class="text-xs ${isDark ? "text-neutral-500" : "text-neutral-400"} mt-1">${docDate === "\\today" ? new Date().toLocaleDateString() : docDate}</p>` : ""}
          </div>
        `;
        continue;
      }

      // \tableofcontents
      if (line.includes("\\tableofcontents")) {
        html += `
          <div class="my-6 p-6 rounded-2xl border ${isDark ? "bg-neutral-900/50 border-neutral-800" : "bg-neutral-50 border-neutral-200"}">
            <h3 class="text-sm font-bold uppercase tracking-wider mb-4 text-red-500">Agenda & Presentation Roadmap</h3>
            <ul class="space-y-2 text-sm">
              <li class="flex items-center gap-2"><strong>1.</strong> Problem Statement & Healthcare Motivation</li>
              <li class="flex items-center gap-2"><strong>2.</strong> System Architecture & Process Pipeline</li>
              <li class="flex items-center gap-2"><strong>3.</strong> Database Design & DBMS Foundations</li>
              <li class="flex items-center gap-2"><strong>4.</strong> Query Optimization & Relational Algebra</li>
              <li class="flex items-center gap-2"><strong>5.</strong> Geospatial Engine & Biological Compatibility</li>
            </ul>
          </div>
        `;
        continue;
      }

      // TikZ Block
      if (line.includes("\\begin{tikzpicture}")) {
        inTikz = true;
        tikzBuffer = "";
        continue;
      }
      if (line.includes("\\end{tikzpicture}")) {
        inTikz = false;
        html += parseTikz(tikzBuffer);
        tikzBuffer = "";
        continue;
      }
      if (inTikz) {
        tikzBuffer += line + "\n";
        continue;
      }

      // tcolorbox Block
      if (line.includes("\\begin{tcolorbox}")) {
        inTcolorbox = true;
        tcolorboxBuffer = "";
        tcolorboxTitle = "";
        tcolorboxBg = "";

        const titleMatch = line.match(/title=([^,\]]+)/);
        if (titleMatch) tcolorboxTitle = titleMatch[1];
        const bgMatch = line.match(/colback=([^,\]]+)/);
        if (bgMatch) tcolorboxBg = bgMatch[1];
        continue;
      }
      if (line.includes("\\end{tcolorbox}")) {
        inTcolorbox = false;
        const bg = getColorStyle(tcolorboxBg || "lightgray");
        html += `
          <div style="background-color: ${bg};" class="my-5 p-5 rounded-2xl border shadow-sm ${
            tcolorboxBg === "bloodred" || tcolorboxBg === "medicalred"
              ? "text-white border-red-700"
              : isDark
              ? "border-neutral-700 text-neutral-200"
              : "border-neutral-300 text-neutral-900"
          }">
            ${tcolorboxTitle ? `<div class="font-bold text-sm mb-2 uppercase tracking-wide opacity-90">${processInline(tcolorboxTitle)}</div>` : ""}
            <div class="text-sm leading-relaxed">${processInline(tcolorboxBuffer)}</div>
          </div>
        `;
        tcolorboxBuffer = "";
        continue;
      }
      if (inTcolorbox) {
        tcolorboxBuffer += (tcolorboxBuffer ? " " : "") + line;
        continue;
      }

      // Beamer Blocks: \begin{block}, \begin{alertblock}, \begin{exampleblock}
      if (line.startsWith("\\begin{block}{") || line.startsWith("\\begin{alertblock}{") || line.startsWith("\\begin{exampleblock}{")) {
        const isAlert = line.startsWith("\\begin{alertblock}{");
        const isExample = line.startsWith("\\begin{exampleblock}{");
        const blockTitle = line.replace(/\\begin{(block|alertblock|exampleblock)}{([^}]*)}/, "$2");

        let borderClass = isAlert ? "border-amber-500 bg-amber-500/10 text-amber-500" : isExample ? "border-emerald-500 bg-emerald-500/10 text-emerald-500" : "border-blue-500 bg-blue-500/10 text-blue-500";

        html += `
          <div class="my-4 rounded-xl border-l-4 overflow-hidden border ${isDark ? "bg-neutral-900/60 border-neutral-800" : "bg-neutral-50/80 border-neutral-200"}">
            <div class="px-4 py-2 text-xs font-bold uppercase tracking-wider ${borderClass}">
              ${processInline(blockTitle)}
            </div>
            <div class="p-4 text-xs sm:text-sm leading-relaxed ${isDark ? "text-neutral-300" : "text-neutral-700"}">
        `;
        continue;
      }
      if (line.includes("\\end{block}") || line.includes("\\end{alertblock}") || line.includes("\\end{exampleblock}")) {
        html += `</div></div>`;
        continue;
      }

      // Beamer Columns
      if (line.includes("\\begin{columns}")) {
        html += `<div class="grid grid-cols-1 md:grid-cols-2 gap-4 my-4">`;
        continue;
      }
      if (line.includes("\\end{columns}")) {
        html += `</div>`;
        continue;
      }
      if (line.startsWith("\\begin{column}{")) {
        html += `<div class="flex flex-col">`;
        continue;
      }
      if (line.includes("\\end{column}")) {
        html += `</div>`;
        continue;
      }

      // Code Listings: \begin{lstlisting}
      if (line.includes("\\begin{lstlisting}")) {
        inListing = true;
        listingBuffer = "";
        continue;
      }
      if (line.includes("\\end{lstlisting}")) {
        inListing = false;
        html += `
          <div class="my-3 rounded-xl border p-3 font-mono text-xs overflow-x-auto ${
            isDark ? "bg-neutral-900 border-neutral-800 text-cyan-300" : "bg-neutral-900 border-neutral-800 text-emerald-400"
          }">
            <pre class="leading-relaxed">${listingBuffer}</pre>
          </div>
        `;
        listingBuffer = "";
        continue;
      }
      if (inListing) {
        listingBuffer += line + "\n";
        continue;
      }

      // Math Equations
      if (line.includes("\\begin{equation}") || line.includes("\\begin{align}") || line === "\\[") {
        inEquation = true;
        equationBuffer = "";
        continue;
      }
      if (line.includes("\\end{equation}") || line.includes("\\end{align}") || line === "\\]") {
        inEquation = false;
        html += `<div class="katex-display my-5 p-4 rounded-xl text-center overflow-x-auto ${
          isDark ? "bg-neutral-900/50 border border-neutral-800" : "bg-neutral-50 border border-neutral-200"
        }">${renderFormula(equationBuffer, true)}</div>`;
        equationBuffer = "";
        continue;
      }
      if (inEquation) {
        equationBuffer += (equationBuffer ? "\n" : "") + line;
        continue;
      }

      // Headings
      if (line.startsWith("\\section{") || line.startsWith("\\section*{")) {
        const title = line.replace(/\\section\*?{([^}]*)}/, "$1");
        html += `<h2 class="text-xl font-bold mt-7 mb-3 pb-1 border-b text-red-600 ${
          isDark ? "border-neutral-800" : "border-neutral-200"
        }">${processInline(title)}</h2>`;
        continue;
      }
      if (line.startsWith("\\subsection{") || line.startsWith("\\subsection*{")) {
        const title = line.replace(/\\subsection\*?{([^}]*)}/, "$1");
        html += `<h3 class="text-base font-semibold mt-5 mb-2 text-cyan-500">${processInline(title)}</h3>`;
        continue;
      }

      // Abstract
      if (line.includes("\\begin{abstract}")) {
        html += `<div class="p-4 my-5 rounded-xl border ${
          isDark ? "bg-neutral-900/40 border-neutral-800 text-neutral-300" : "bg-neutral-50 border-neutral-200 text-neutral-700"
        }"><p class="text-xs uppercase font-bold tracking-wider mb-1.5 opacity-60 text-center text-red-500">Abstract</p><p class="text-xs italic leading-relaxed text-center max-w-2xl mx-auto">`;
        continue;
      }
      if (line.includes("\\end{abstract}")) {
        html += `</p></div>`;
        continue;
      }

      // List Items
      if (line.startsWith("\\item")) {
        const itemText = line.replace(/\\item(\[[^\]]*\])?/, "").trim();
        html += `<li class="ml-4 my-1.5 text-xs sm:text-sm leading-relaxed">${processInline(itemText)}</li>`;
        continue;
      }

      // Table row parsing
      if (line.includes("&") && line.endsWith("\\\\")) {
        const cells = line.replace(/\\\\$/, "").split("&");
        html += `<div class="grid grid-flow-col auto-cols-fr gap-2 py-1.5 border-b text-xs ${
          isDark ? "border-neutral-800" : "border-neutral-200"
        }">
          ${cells.map((c) => `<div class="p-1">${processInline(c.trim())}</div>`).join("")}
        </div>`;
        continue;
      }

      // Skip wrapper directives
      if (
        line.startsWith("\\documentclass") ||
        line.startsWith("\\usepackage") ||
        line.startsWith("\\usetikzlibrary") ||
        line.startsWith("\\definecolor") ||
        line.startsWith("\\sectionfont") ||
        line.startsWith("\\subsectionfont") ||
        line.startsWith("\\tikzstyle") ||
        line.startsWith("\\usetheme") ||
        line.startsWith("\\usecolortheme") ||
        line.startsWith("\\setbeamercolor") ||
        line.startsWith("\\lstset") ||
        line.startsWith("\\renewcommand") ||
        line.startsWith("\\graphicspath") ||
        line.startsWith("\\begin{document}") ||
        line.startsWith("\\end{document}") ||
        line.startsWith("\\begin{itemize}") ||
        line.startsWith("\\end{itemize}") ||
        line.startsWith("\\begin{enumerate}") ||
        line.startsWith("\\end{enumerate}") ||
        line.startsWith("\\begin{center}") ||
        line.startsWith("\\end{center}") ||
        line.startsWith("\\begin{table}") ||
        line.startsWith("\\end{table}") ||
        line.startsWith("\\begin{tabular}") ||
        line.startsWith("\\end{tabular}") ||
        line.startsWith("\\toprule") ||
        line.startsWith("\\midrule") ||
        line.startsWith("\\bottomrule") ||
        line.startsWith("\\centering") ||
        line.startsWith("\\vspace") ||
        line.startsWith("\\hspace") ||
        line.startsWith("%")
      ) {
        continue;
      }

      // Normal paragraph
      if (line.length > 0) {
        html += `<p class="my-2.5 text-xs sm:text-sm leading-relaxed ${
          isDark ? "text-neutral-300" : "text-neutral-700"
        }">${processInline(line)}</p>`;
      }
    }

    return html;
  };

  // Beamer Slides Extraction
  const beamerSlides: BeamerSlide[] = useMemo(() => {
    if (!isBeamer) return [];

    const slides: BeamerSlide[] = [];
    const frameRegex = /\\begin{frame}(?:\[[^\]]*\])?(?:{([^}]*)})?([\s\S]*?)\\end{frame}/g;
    let match;
    let index = 1;

    while ((match = frameRegex.exec(rawCode)) !== null) {
      let frameTitle = match[1] || "";
      const frameBody = match[2];

      if (!frameTitle) {
        const titleMatch = frameBody.match(/\\frametitle{([^}]*)}/);
        if (titleMatch) frameTitle = titleMatch[1];
      }

      if (!frameTitle && (frameBody.includes("\\titlepage") || frameBody.includes("\\maketitle"))) {
        frameTitle = "Title Slide";
      } else if (!frameTitle) {
        frameTitle = `Slide ${index}`;
      }

      const parsedHtml = parseLatexBlocks(frameBody);
      slides.push({
        number: index,
        title: frameTitle.replace(/\\textbf{([^}]*)}/g, "$1"),
        html: parsedHtml,
      });
      index++;
    }

    return slides;
  }, [rawCode, isBeamer, isDark]);

  // A4 Document Pages Extraction (Splits on \newpage, \clearpage, or partitions logically)
  const a4Pages: string[] = useMemo(() => {
    if (isBeamer) return [];

    // Split on explicit page breaks
    const rawPages = rawCode.split(/\\newpage|\\clearpage|\\pagebreak/);
    const parsed = rawPages
      .map((p) => parseLatexBlocks(p))
      .filter((p) => p.trim().length > 0);

    return parsed.length > 0 ? parsed : [parseLatexBlocks(rawCode)];
  }, [rawCode, isBeamer, isDark]);

  // Keyboard Slide Navigation for Beamer mode
  useEffect(() => {
    if (!isBeamer || beamerSlides.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowRight" || e.key === "Space") {
        setCurrentSlideIndex((i) => Math.min(beamerSlides.length - 1, i + 1));
      } else if (e.key === "ArrowLeft") {
        setCurrentSlideIndex((i) => Math.max(0, i - 1));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isBeamer, beamerSlides.length]);

  const handleCopy = () => {
    navigator.clipboard.writeText(rawCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInsertSnippet = (code: string) => {
    const newContent = content ? `${content}\n\n${code}` : code;
    onContentChange(newContent);
    setShowSymbols(false);
  };

  // Direct In-Place Print & PDF Export (Zero blank tabs)
  const handlePrintPdf = () => {
    let iframe = document.getElementById("cloudforge-tex-print-frame") as HTMLIFrameElement;
    if (!iframe) {
      iframe = document.createElement("iframe");
      iframe.id = "cloudforge-tex-print-frame";
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      iframe.style.visibility = "hidden";
      document.body.appendChild(iframe);
    }

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (doc) {
      const printableContent = isBeamer
        ? beamerSlides.map((s) => `<div class="page beamer-slide">${s.html}</div>`).join("")
        : a4Pages.map((p, idx) => `<div class="page a4-page">${p}<div class="footer">Page ${idx + 1} of ${a4Pages.length}</div></div>`).join("");

      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${filename.replace(/\.[^/.]+$/, "")} - Typeset Document</title>
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">
            <style>
              @page {
                size: ${isBeamer ? "A4 landscape" : "A4 portrait"};
                margin: 15mm;
              }
              body {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                line-height: 1.5;
                color: #111;
                background: #fff;
                font-size: 10pt;
              }
              .page {
                page-break-after: always;
                min-height: 90vh;
                position: relative;
                padding: 10px;
              }
              .page:last-child {
                page-break-after: avoid;
              }
              .footer {
                position: absolute;
                bottom: 0;
                right: 0;
                font-size: 8pt;
                color: #777;
              }
              h1, h2, h3 { color: #b22222; }
              .katex-display { margin: 12pt 0; text-align: center; }
            </style>
          </head>
          <body>${printableContent}</body>
        </html>
      `);
      doc.close();
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      }, 300);
    }
  };

  const handleDownloadTex = () => {
    const text = rawCode;
    const blob = new Blob([text], { type: "text/x-tex;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const currentBeamerSlide = beamerSlides[currentSlideIndex];

  return (
    <div
      className={`h-full flex flex-col overflow-hidden select-none font-sans ${
        isDark ? "bg-black text-neutral-200" : "bg-neutral-100 text-neutral-800"
      }`}
    >
      {/* Top Toolbar */}
      <div
        className={`h-10 px-3 border-b flex items-center justify-between shrink-0 ${
          isDark ? "bg-neutral-950 border-neutral-800" : "bg-white border-neutral-200"
        }`}
      >
        <div className="flex items-center gap-2">
          {isBeamer ? (
            <Presentation className="w-4 h-4 text-red-500 shrink-0" />
          ) : (
            <Sigma className="w-4 h-4 text-emerald-400 shrink-0" />
          )}
          <span className="text-xs font-semibold truncate max-w-[140px] sm:max-w-[200px] font-mono">
            {filename}
          </span>
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
              isBeamer
                ? "bg-red-500/10 text-red-500 border border-red-500/20"
                : isDark
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                : "bg-emerald-50 text-emerald-700 border border-emerald-200"
            }`}
          >
            {isBeamer ? "Beamer Slides" : "A4 Paginated"}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Beamer Slide Navigation Controls */}
          {isBeamer && beamerSlides.length > 0 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentSlideIndex((i) => Math.max(0, i - 1))}
                disabled={currentSlideIndex === 0}
                className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                  currentSlideIndex === 0
                    ? "opacity-30 cursor-not-allowed border-transparent"
                    : isDark
                    ? "border-neutral-800 hover:bg-neutral-900"
                    : "border-neutral-200 hover:bg-neutral-100"
                }`}
                title="Previous Slide (Left Arrow)"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              <select
                value={currentSlideIndex}
                onChange={(e) => setCurrentSlideIndex(parseInt(e.target.value, 10))}
                className={`px-2 py-1 rounded-lg border text-xs font-mono font-bold outline-none cursor-pointer ${
                  isDark
                    ? "bg-neutral-900 border-neutral-800 text-red-400"
                    : "bg-neutral-50 border-neutral-200 text-red-700"
                }`}
              >
                {beamerSlides.map((_s, idx) => (
                  <option key={idx} value={idx}>
                    Slide {idx + 1} of {beamerSlides.length}
                  </option>
                ))}
              </select>

              <button
                onClick={() => setCurrentSlideIndex((i) => Math.min(beamerSlides.length - 1, i + 1))}
                disabled={currentSlideIndex === beamerSlides.length - 1}
                className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                  currentSlideIndex === beamerSlides.length - 1
                    ? "opacity-30 cursor-not-allowed border-transparent"
                    : isDark
                    ? "border-neutral-800 hover:bg-neutral-900"
                    : "border-neutral-200 hover:bg-neutral-100"
                }`}
                title="Next Slide (Right Arrow)"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>

              {/* Thumbnails Toggle */}
              <button
                onClick={() => setShowThumbnails((v) => !v)}
                className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                  showThumbnails
                    ? "bg-red-500/20 border-red-500/40 text-red-400 font-bold"
                    : isDark
                    ? "border-neutral-800 hover:bg-neutral-900"
                    : "border-neutral-200 hover:bg-neutral-100"
                }`}
                title="Toggle Slide Thumbnails Drawer"
              >
                <Layers className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Math Snippets / Symbols Palette */}
          <div className="relative">
            <button
              onClick={() => setShowSymbols((v) => !v)}
              className={`px-2 py-1 rounded-lg border text-xs flex items-center gap-1 font-semibold transition-colors cursor-pointer ${
                isDark
                  ? "border-neutral-800 hover:bg-neutral-900 text-neutral-300"
                  : "border-neutral-200 hover:bg-neutral-100 text-neutral-700"
              }`}
              title="Insert LaTeX Math & Layout Snippets"
            >
              <Sigma className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden md:inline">Palette</span>
              <ChevronDown className="w-3 h-3 opacity-60" />
            </button>

            {showSymbols && (
              <>
                <div onClick={() => setShowSymbols(false)} className="fixed inset-0 z-40" />
                <div
                  className={`absolute right-0 top-full mt-1.5 w-72 rounded-xl border shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 max-h-80 overflow-y-auto ${
                    isDark
                      ? "bg-neutral-900 border-neutral-800 text-neutral-200"
                      : "bg-white border-neutral-200 text-neutral-800"
                  }`}
                >
                  <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider opacity-50 border-b border-white/10 mb-1">
                    Insert Snippets
                  </div>
                  {MATH_SNIPPETS.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleInsertSnippet(item.code)}
                      className="w-full px-3 py-1.5 text-left text-xs hover:bg-emerald-500/10 hover:text-emerald-400 transition-colors cursor-pointer flex flex-col"
                    >
                      <span className="font-semibold">{item.label}</span>
                      <span className="font-mono text-[10px] opacity-60 truncate">{item.code}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* View Mode Toggle */}
          <div
            className={`flex items-center p-0.5 rounded-lg border ${
              isDark ? "bg-neutral-900 border-neutral-800" : "bg-neutral-200/60 border-neutral-300"
            }`}
          >
            <button
              onClick={() => setViewMode("split")}
              className={`px-2 py-1 rounded text-xs flex items-center gap-1 font-semibold transition-colors cursor-pointer ${
                viewMode === "split"
                  ? isDark
                    ? "bg-neutral-800 text-white shadow-xs"
                    : "bg-white text-black shadow-xs"
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
                  ? isDark
                    ? "bg-neutral-800 text-white shadow-xs"
                    : "bg-white text-black shadow-xs"
                  : "opacity-60 hover:opacity-100"
              }`}
              title="Typeset Document"
            >
              <Eye className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Document</span>
            </button>
            <button
              onClick={() => setViewMode("editor")}
              className={`px-2 py-1 rounded text-xs flex items-center gap-1 font-semibold transition-colors cursor-pointer ${
                viewMode === "editor"
                  ? isDark
                    ? "bg-neutral-800 text-white shadow-xs"
                    : "bg-white text-black shadow-xs"
                  : "opacity-60 hover:opacity-100"
              }`}
              title="LaTeX Source"
            >
              <Code className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Source</span>
            </button>
          </div>

          {/* Print / PDF Button */}
          <button
            onClick={handlePrintPdf}
            className={`p-1.5 rounded-lg border transition-colors cursor-pointer flex items-center gap-1 text-xs font-semibold ${
              isDark ? "border-neutral-800 hover:bg-neutral-900" : "border-neutral-200 hover:bg-neutral-100"
            }`}
            title="Print or Save as PDF"
          >
            <Printer className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden sm:inline">Print / PDF</span>
          </button>

          {/* Export / Download Menu */}
          <div className="relative">
            <button
              onClick={() => setShowDownloadMenu((v) => !v)}
              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1 shadow-sm transition-all cursor-pointer"
              title="Export options"
            >
              <Download className="w-3 h-3" />
              <span>Export</span>
              <ChevronDown className="w-3 h-3 opacity-60" />
            </button>

            {showDownloadMenu && (
              <>
                <div onClick={() => setShowDownloadMenu(false)} className="fixed inset-0 z-40" />
                <div
                  className={`absolute right-0 top-full mt-1.5 w-48 rounded-xl border shadow-2xl py-1 z-50 animate-in fade-in zoom-in-95 duration-100 ${
                    isDark ? "bg-neutral-900 border-neutral-800 text-neutral-200" : "bg-white border-neutral-200 text-neutral-800"
                  }`}
                >
                  <button
                    onClick={() => {
                      handlePrintPdf();
                      setShowDownloadMenu(false);
                    }}
                    className="w-full px-3 py-2 text-left text-xs hover:bg-emerald-500/10 hover:text-emerald-400 flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5 text-blue-400" />
                    <span>Save as PDF (Print)</span>
                  </button>
                  <button
                    onClick={() => {
                      handleDownloadTex();
                      setShowDownloadMenu(false);
                    }}
                    className="w-full px-3 py-2 text-left text-xs hover:bg-emerald-500/10 hover:text-emerald-400 flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Download .tex Source</span>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Copy Button */}
          <button
            onClick={handleCopy}
            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
              isDark ? "border-neutral-800 hover:bg-neutral-900" : "border-neutral-200 hover:bg-neutral-100"
            }`}
            title="Copy LaTeX content"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          {/* Save Button */}
          {isDirty && onSave && (
            <button
              onClick={onSave}
              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1 shadow-sm transition-all cursor-pointer"
            >
              <Save className="w-3 h-3" />
              <span>Save</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Workspace Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Code Editor Pane */}
        {(viewMode === "split" || viewMode === "editor") && (
          <div
            className={`h-full ${viewMode === "split" ? "w-1/2 border-r" : "w-full"} ${
              isDark ? "border-neutral-800" : "border-neutral-200"
            }`}
          >
            <Editor
              height="100%"
              language="latex"
              value={rawCode}
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

        {/* Typeset Document Preview */}
        {(viewMode === "split" || viewMode === "preview") && (
          <div
            className={`h-full overflow-hidden flex ${viewMode === "split" ? "w-1/2" : "w-full"} ${
              isDark ? "bg-black" : "bg-neutral-100"
            }`}
          >
            {/* Beamer Mode: Slide Deck Presentation */}
            {isBeamer ? (
              <div className="flex-1 flex overflow-hidden relative">
                {/* Thumbnails Drawer */}
                {showThumbnails && beamerSlides.length > 0 && (
                  <div
                    className={`w-44 sm:w-52 border-r flex flex-col p-2 gap-2 overflow-y-auto shrink-0 ${
                      isDark ? "bg-neutral-950 border-neutral-800" : "bg-white border-neutral-200"
                    }`}
                  >
                    <div className="flex items-center justify-between px-1 text-[11px] font-bold opacity-50 uppercase tracking-wider">
                      <span>Slides ({beamerSlides.length})</span>
                    </div>
                    {beamerSlides.map((s, idx) => (
                      <div
                        key={idx}
                        onClick={() => setCurrentSlideIndex(idx)}
                        className={`p-2 rounded-xl border transition-all cursor-pointer text-left flex flex-col gap-1 ${
                          currentSlideIndex === idx
                            ? "bg-red-500/15 border-red-500/50 shadow-md ring-1 ring-red-500/30"
                            : isDark
                            ? "bg-neutral-900/60 border-neutral-800 hover:bg-neutral-900"
                            : "bg-neutral-50 border-neutral-200 hover:bg-neutral-100"
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px] font-mono opacity-60">
                          <span className="font-bold">#{s.number}</span>
                        </div>
                        <p className="text-xs font-semibold truncate text-inherit">{s.title}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Presentation 16:9 Stage Canvas */}
                <div className="flex-1 overflow-auto flex items-center justify-center p-4 sm:p-8 relative">
                  {currentBeamerSlide ? (
                    <div
                      className={`w-full max-w-4xl aspect-[16/9] rounded-2xl border p-6 sm:p-10 flex flex-col justify-between shadow-2xl relative overflow-hidden transition-all select-text ${
                        isDark
                          ? "bg-neutral-900 text-neutral-100 border-neutral-800 shadow-black/80"
                          : "bg-white text-neutral-900 border-neutral-200 shadow-neutral-300/60"
                      }`}
                    >
                      {/* Slide Header */}
                      <div className="border-b pb-2 mb-3 flex items-center justify-between opacity-90 border-red-500/30">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-red-500 shrink-0" />
                          <h2 className="text-lg sm:text-xl font-bold tracking-tight text-red-600">
                            {currentBeamerSlide.title}
                          </h2>
                        </div>
                        <span className="text-[10px] font-mono font-bold opacity-60">
                          {currentBeamerSlide.number} / {beamerSlides.length}
                        </span>
                      </div>

                      {/* Slide Body */}
                      <div className="flex-1 overflow-y-auto pr-2 space-y-2">
                        <div dangerouslySetInnerHTML={{ __html: currentBeamerSlide.html }} />
                      </div>

                      {/* Slide Footer */}
                      <div className="border-t pt-2 mt-2 flex items-center justify-between text-[10px] font-mono opacity-50 border-neutral-700/30">
                        <span>{filename}</span>
                        <span>LaTeX Beamer Frame</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center p-8 opacity-40">
                      <Presentation className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p className="text-xs font-mono">No frames found in Beamer document.</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* A4 Paper Paginated Mode: Multiple A4 Paper Sheets */
              <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-8 select-text">
                {a4Pages.map((pageHtml, pIdx) => (
                  <div
                    key={pIdx}
                    className={`max-w-3xl min-h-[900px] mx-auto p-8 sm:p-12 rounded-2xl border flex flex-col justify-between transition-all ${
                      isDark
                        ? "bg-neutral-900 border-neutral-800 text-neutral-200 shadow-2xl shadow-black/80"
                        : "bg-white border-neutral-200 text-neutral-900 shadow-xl shadow-neutral-300/40"
                    }`}
                  >
                    {/* Running Header */}
                    <div className="border-b pb-2 mb-6 flex items-center justify-between text-[10px] font-mono opacity-40">
                      <span className="truncate max-w-[200px]">{filename}</span>
                      <span>A4 Document Page</span>
                    </div>

                    {/* Page Content */}
                    <div className="flex-1">
                      <div dangerouslySetInnerHTML={{ __html: pageHtml }} />
                    </div>

                    {/* Running Footer with Page Number */}
                    <div className="border-t pt-3 mt-8 flex items-center justify-between text-[10px] font-mono opacity-50">
                      <span>CloudForge Typesetting Engine</span>
                      <span className="font-bold">
                        Page {pIdx + 1} of {a4Pages.length}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Status Bar */}
      <div
        className={`h-6 px-3 border-t flex items-center justify-between text-[10px] font-mono shrink-0 ${
          isDark ? "bg-neutral-950 border-neutral-800 text-neutral-400" : "bg-neutral-50 border-neutral-200 text-neutral-500"
        }`}
      >
        <div className="flex items-center gap-3">
          <span>Engine: KaTeX + Beamer & A4 Typesetting</span>
          <span>
            {isBeamer
              ? `Beamer Presentation (${beamerSlides.length} Frames)`
              : `A4 Paginated (${a4Pages.length} Pages)`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span>LaTeX / TeX</span>
          <span>UTF-8</span>
        </div>
      </div>
    </div>
  );
};
export default LatexViewer;
