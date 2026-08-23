import React, { useState, useEffect, useMemo } from "react";
import mammoth from "mammoth";
import {
  FileText,
  Download,
  Copy,
  Check,
  ZoomIn,
  ZoomOut,
  Printer,
  Clock,
} from "lucide-react";
import { useTheme } from "../../../context/ThemeContext";

interface DocxViewerProps {
  content: string;
  filename: string;
  size?: number;
}

export const DocxViewer: React.FC<DocxViewerProps> = ({ content, filename, size }) => {
  const { isDark } = useTheme();
  const [htmlContent, setHtmlContent] = useState<string>("");
  const [rawText, setRawText] = useState<string>("");
  const [zoom, setZoom] = useState(100);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  // Convert Base64 data URL to ArrayBuffer and parse with mammoth
  useEffect(() => {
    let isCancelled = false;

    const parseDocx = async () => {
      try {
        setLoading(true);
        let base64 = content;
        if (content.startsWith("data:")) {
          base64 = content.split(",")[1] || "";
        }

        const binaryString = window.atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        const arrayBuffer = bytes.buffer;
        const result = await mammoth.convertToHtml({ arrayBuffer });
        const textResult = await mammoth.extractRawText({ arrayBuffer });

        if (!isCancelled) {
          setHtmlContent(result.value);
          setRawText(textResult.value);
        }
      } catch (err) {
        console.error("Failed to parse Word docx:", err);
        if (!isCancelled) {
          setHtmlContent("<p>Unable to preview Word document.</p>");
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    parseDocx();

    return () => {
      isCancelled = true;
    };
  }, [content]);

  // Statistics
  const stats = useMemo(() => {
    const words = rawText.trim() ? rawText.trim().split(/\s+/).length : 0;
    const chars = rawText.length;
    const readTimeMinutes = Math.max(1, Math.ceil(words / 200));
    return { words, chars, readTimeMinutes };
  }, [rawText]);

  const handleDownload = () => {
    let docUrl = content;
    if (!docUrl.startsWith("data:")) {
      docUrl = `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${content}`;
    }
    const a = document.createElement("a");
    a.href = docUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(rawText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    let iframe = document.getElementById("cloudforge-print-frame") as HTMLIFrameElement;
    if (!iframe) {
      iframe = document.createElement("iframe");
      iframe.id = "cloudforge-print-frame";
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
      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${filename}</title>
            <style>
              @page { margin: 20mm; }
              body {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                line-height: 1.6;
                color: #111;
                background: #fff;
                padding: 10px;
              }
              h1, h2, h3, h4 { color: #111; margin-top: 18px; margin-bottom: 8px; }
              p { margin: 8px 0; }
              table { border-collapse: collapse; width: 100%; margin: 16px 0; }
              td, th { border: 1px solid #ccc; padding: 6px 10px; text-align: left; }
              img { max-width: 100%; height: auto; }
            </style>
          </head>
          <body>${htmlContent}</body>
        </html>
      `);
      doc.close();
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      }, 200);
    }
  };

  return (
    <div className={`h-full flex flex-col select-none overflow-hidden font-sans ${
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
            Word Document Reader
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Zoom controls */}
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setZoom((z) => Math.max(70, z - 10))}
              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                isDark ? "border-neutral-800 hover:bg-neutral-900" : "border-neutral-200 hover:bg-neutral-100"
              }`}
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoom(100)}
              className={`p-1.5 rounded-lg border transition-colors cursor-pointer text-xs font-mono font-bold px-2 ${
                isDark ? "border-neutral-800 hover:bg-neutral-900" : "border-neutral-200 hover:bg-neutral-100"
              }`}
              title="Reset Zoom"
            >
              {zoom}%
            </button>
            <button
              onClick={() => setZoom((z) => Math.min(150, z + 10))}
              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                isDark ? "border-neutral-800 hover:bg-neutral-900" : "border-neutral-200 hover:bg-neutral-100"
              }`}
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Print */}
          <button
            onClick={handlePrint}
            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
              isDark ? "border-neutral-800 hover:bg-neutral-900" : "border-neutral-200 hover:bg-neutral-100"
            }`}
            title="Print document"
          >
            <Printer className="w-3.5 h-3.5" />
          </button>

          {/* Copy document text */}
          <button
            onClick={handleCopy}
            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
              isDark ? "border-neutral-800 hover:bg-neutral-900" : "border-neutral-200 hover:bg-neutral-100"
            }`}
            title="Copy document text"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          {/* Download DOCX */}
          <button
            onClick={handleDownload}
            className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center gap-1 shadow-sm transition-all cursor-pointer"
          >
            <Download className="w-3 h-3" />
            <span className="hidden sm:inline">Download</span>
          </button>
        </div>
      </div>

      {/* Main Document Paper Reader */}
      <div className={`flex-1 overflow-y-auto p-6 sm:p-12 select-text ${
        isDark ? "bg-neutral-950" : "bg-neutral-100"
      }`}>
        <div
          style={{
            zoom: `${zoom}%`,
            transition: "zoom 0.15s ease",
          }}
          className={`max-w-4xl mx-auto p-8 sm:p-16 rounded-2xl shadow-xl border ${
            isDark
              ? "bg-black border-neutral-800 text-neutral-200 shadow-neutral-900/50"
              : "bg-white border-neutral-200 text-neutral-900 shadow-neutral-300/40"
          }`}
        >
          {loading ? (
            <div className="py-12 text-center text-xs opacity-60">
              Loading Word document...
            </div>
          ) : (
            <div
              className={`prose max-w-none ${isDark ? "prose-invert" : ""} prose-headings:font-bold prose-p:leading-relaxed prose-table:border prose-th:p-2 prose-td:p-2`}
              dangerouslySetInnerHTML={{ __html: htmlContent }}
            />
          )}
        </div>
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
          {size && <span>Size: {Math.round(size / 1024)} KB</span>}
        </div>
        <div className="flex items-center gap-2">
          <span>Mammoth Docx Engine</span>
          <span>Word Processing</span>
        </div>
      </div>
    </div>
  );
};
export default DocxViewer;
