import React, { useState } from "react";
import { Copy, Check, ChevronDown, ChevronRight, X, AlertTriangle, Image as ImageIcon, Eye } from "lucide-react";
import { type NotebookOutput } from "../../../../types/notebook";
import { ansiToHtml } from "./ansiParser";
import katex from "katex";

interface NotebookCellOutputProps {
  outputs: NotebookOutput[];
  isDark: boolean;
  onClearOutputs?: () => void;
}

export const NotebookCellOutput: React.FC<NotebookCellOutputProps> = ({
  outputs,
  isDark,
  onClearOutputs,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showRawOutput, setShowRawOutput] = useState(false);

  if (!outputs || outputs.length === 0) {
    return null;
  }

  const handleCopy = () => {
    let text = "";
    outputs.forEach((out) => {
      if (out.output_type === "stream") {
        text += Array.isArray(out.text) ? out.text.join("") : out.text;
      } else if (out.output_type === "execute_result" || out.output_type === "display_data") {
        if (out.data["text/plain"]) {
          text += Array.isArray(out.data["text/plain"])
            ? out.data["text/plain"].join("")
            : String(out.data["text/plain"]);
        }
      } else if (out.output_type === "error") {
        text += `${out.ename}: ${out.evalue}\n` + (out.traceback ? out.traceback.join("\n") : "");
      }
    });

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={`mt-2 rounded-lg border text-xs font-mono transition-all overflow-hidden ${
        isDark ? "bg-[#0a0a0c] border-neutral-800" : "bg-neutral-50 border-neutral-200"
      }`}
    >
      {/* Output Header Bar */}
      <div
        className={`px-3 py-1.5 flex items-center justify-between border-b select-none text-[11px] ${
          isDark ? "bg-[#111114] border-neutral-800/80 text-neutral-400" : "bg-neutral-100 border-neutral-200 text-neutral-600"
        }`}
      >
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex items-center gap-1 hover:text-blue-400 font-semibold cursor-pointer transition-colors"
            title={isCollapsed ? "Expand Output" : "Collapse Output"}
          >
            {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            <span>Output ({outputs.length} {outputs.length === 1 ? "item" : "items"})</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowRawOutput(!showRawOutput)}
            className={`px-1.5 py-0.5 rounded transition-colors text-[10px] cursor-pointer ${
              showRawOutput
                ? "bg-blue-500/20 text-blue-400 font-semibold"
                : "hover:bg-white/10 hover:text-white"
            }`}
            title="Toggle raw data output"
          >
            <Eye className="w-3 h-3 inline mr-1" />
            {showRawOutput ? "Rendered" : "Raw JSON"}
          </button>

          <button
            onClick={handleCopy}
            className="p-1 rounded hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
            title="Copy Output"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          </button>

          {onClearOutputs && (
            <button
              onClick={onClearOutputs}
              className="p-1 rounded hover:bg-rose-500/20 hover:text-rose-400 transition-colors cursor-pointer"
              title="Clear Cell Output"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Output Content */}
      {!isCollapsed && (
        <div className="p-3.5 max-h-[500px] overflow-y-auto space-y-3">
          {showRawOutput ? (
            <pre className="text-[11px] overflow-x-auto whitespace-pre-wrap opacity-80">
              {JSON.stringify(outputs, null, 2)}
            </pre>
          ) : (
            outputs.map((out, idx) => (
              <SingleOutputItem key={idx} output={out} isDark={isDark} />
            ))
          )}
        </div>
      )}
    </div>
  );
};

const SingleOutputItem: React.FC<{ output: NotebookOutput; isDark: boolean }> = ({ output, isDark }) => {
  // 1. Stream Output (stdout / stderr)
  if (output.output_type === "stream") {
    const rawText = Array.isArray(output.text) ? output.text.join("") : output.text;
    const isError = output.name === "stderr";
    const html = ansiToHtml(rawText);

    return (
      <div
        className={`whitespace-pre-wrap leading-relaxed break-words font-mono text-[12px] p-2 rounded-md ${
          isError
            ? isDark
              ? "bg-rose-950/20 text-rose-300 border border-rose-900/30"
              : "bg-rose-50 text-rose-800 border border-rose-200"
            : isDark
            ? "text-neutral-200"
            : "text-neutral-800"
        }`}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  // 2. Error Output
  if (output.output_type === "error") {
    const tb = output.traceback && output.traceback.length > 0
      ? output.traceback.join("\n")
      : `${output.ename}: ${output.evalue}`;
    const html = ansiToHtml(tb);

    return (
      <div
        className={`p-3 rounded-lg border text-[12px] font-mono whitespace-pre-wrap leading-relaxed overflow-x-auto ${
          isDark
            ? "bg-rose-950/30 border-rose-900/50 text-rose-200"
            : "bg-rose-50 border-rose-200 text-rose-900"
        }`}
      >
        <div className="flex items-center gap-1.5 font-bold text-rose-400 mb-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{output.ename || "Error"}: {output.evalue}</span>
        </div>
        <div dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    );
  }

  // 3. Execute Result or Display Data
  if (output.output_type === "execute_result" || output.output_type === "display_data") {
    const data = output.data || {};

    // PNG / JPEG Image Output (Matplotlib / Seaborn)
    if (data["image/png"] || data["image/jpeg"]) {
      const mime = data["image/png"] ? "image/png" : "image/jpeg";
      const b64 = (data["image/png"] || data["image/jpeg"] || "") as string;
      const src = b64.startsWith("data:") ? b64 : `data:${mime};base64,${b64}`;

      return (
        <div
          className={`flex flex-col items-center justify-center p-3 rounded-lg border overflow-hidden ${
            isDark ? "bg-black/40 border-neutral-800/80" : "bg-white border-slate-200 shadow-xs"
          }`}
        >
          <div className="text-[10px] text-neutral-400 self-start mb-1.5 flex items-center gap-1 font-sans">
            <ImageIcon className="w-3 h-3 text-blue-500" />
            <span className="font-medium">Matplotlib Plot</span>
          </div>
          <img
            src={src}
            alt="Notebook Plot Output"
            className="max-w-full h-auto rounded shadow-sm border border-neutral-800/20 object-contain hover:scale-[1.01] transition-transform"
          />
        </div>
      );
    }

    // SVG Output
    if (data["image/svg+xml"]) {
      const svgContent = Array.isArray(data["image/svg+xml"])
        ? data["image/svg+xml"].join("")
        : data["image/svg+xml"];

      return (
        <div
          className={`p-3 rounded-lg border overflow-x-auto flex justify-center ${
            isDark ? "bg-black/40 border-neutral-800/80" : "bg-white border-slate-200 shadow-xs"
          }`}
        >
          <div dangerouslySetInnerHTML={{ __html: svgContent }} />
        </div>
      );
    }

    // HTML Output (Pandas DataFrames, Tables, styled widgets)
    if (data["text/html"]) {
      const htmlContent = Array.isArray(data["text/html"])
        ? data["text/html"].join("")
        : data["text/html"];

      return (
        <div
          className={`p-3 rounded-lg border overflow-x-auto text-[12px] font-sans notebook-dataframe-table ${
            isDark ? "bg-[#141418] border-neutral-800 text-neutral-200" : "bg-white border-slate-200 text-slate-900 shadow-xs"
          }`}
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
      );
    }

    // LaTeX Math Output
    if (data["text/latex"]) {
      const latex = Array.isArray(data["text/latex"])
        ? data["text/latex"].join("")
        : data["text/latex"];
      try {
        const mathHtml = katex.renderToString(latex.replace(/^\$\$|\$\$$/g, "").trim(), {
          displayMode: true,
          throwOnError: false,
        });
        return (
          <div
            className={`p-3 rounded-lg border my-2 overflow-x-auto text-center ${
              isDark ? "bg-neutral-900/60 border-neutral-800" : "bg-white border-slate-200 shadow-xs"
            }`}
            dangerouslySetInnerHTML={{ __html: mathHtml }}
          />
        );
      } catch {
        // fallback to text
      }
    }

    // JSON Data View
    if (data["application/json"]) {
      return (
        <div
          className={`p-3 rounded-lg border text-[11px] overflow-x-auto ${
            isDark ? "bg-[#121216] border-neutral-800 text-cyan-300" : "bg-white border-slate-200 text-slate-800 shadow-xs"
          }`}
        >
          <pre>{JSON.stringify(data["application/json"], null, 2)}</pre>
        </div>
      );
    }

    // Plain Text Representation
    if (data["text/plain"]) {
      const text = Array.isArray(data["text/plain"])
        ? data["text/plain"].join("")
        : String(data["text/plain"]);
      const html = ansiToHtml(text);

      return (
        <div
          className={`whitespace-pre-wrap leading-relaxed break-words font-mono text-[12px] p-2 rounded-md ${
            isDark ? "text-neutral-200 bg-neutral-900/40" : "text-slate-800 bg-white border border-slate-200/80"
          }`}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    }
  }

  return (
    <pre className="text-xs text-neutral-400 p-2 overflow-x-auto">
      {JSON.stringify(output, null, 2)}
    </pre>
  );
};
