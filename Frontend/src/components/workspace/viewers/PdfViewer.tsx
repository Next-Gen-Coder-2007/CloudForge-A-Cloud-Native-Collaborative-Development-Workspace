import React, { useState, useEffect } from "react";
import {
  FileText,
  Download,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  Minimize2,
  ExternalLink,
  Info,
} from "lucide-react";
import { useTheme } from "../../../context/ThemeContext";

interface PdfViewerProps {
  content: string;
  filename: string;
  size?: number;
}

export const PdfViewer: React.FC<PdfViewerProps> = ({ content, filename, size }) => {
  const { isDark } = useTheme();
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string>("");
  const [hasError, setHasError] = useState(false);

  // Convert Base64 / Data URL to native Blob URL for 100% browser rendering support
  useEffect(() => {
    if (!content) {
      setBlobUrl("");
      return;
    }

    try {
      setHasError(false);
      let byteChars = "";

      if (content.startsWith("data:")) {
        const base64 = content.split(",")[1] || "";
        byteChars = window.atob(base64);
      } else {
        try {
          byteChars = window.atob(content);
        } catch {
          byteChars = content;
        }
      }

      const byteArray = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteArray[i] = byteChars.charCodeAt(i);
      }

      const blob = new Blob([byteArray], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      setBlobUrl(url);

      return () => {
        URL.revokeObjectURL(url);
      };
    } catch (err) {
      console.error("PDF Blob generation error:", err);
      setHasError(true);
      if (content.startsWith("data:")) {
        setBlobUrl(content);
      }
    }
  }, [content]);

  const handleDownload = () => {
    if (!blobUrl) return;
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleOpenInNewTab = () => {
    if (!blobUrl) return;
    window.open(blobUrl, "_blank");
  };

  return (
    <div className={`h-full flex flex-col select-none overflow-hidden font-sans ${
      isDark ? "bg-black text-neutral-200" : "bg-neutral-100 text-neutral-800"
    }`}>
      {/* Top Toolbar */}
      <div className={`h-10 px-3 border-b flex items-center justify-between shrink-0 ${
        isDark ? "bg-neutral-950 border-neutral-800" : "bg-white border-neutral-200"
      }`}>
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-rose-500 shrink-0" />
          <span className="text-xs font-semibold truncate max-w-[140px] sm:max-w-[220px] font-mono">
            {filename}
          </span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
            isDark ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" : "bg-rose-50 text-rose-700 border border-rose-200"
          }`}>
            PDF Document
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Zoom controls */}
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setZoom((z) => Math.max(50, z - 25))}
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
              onClick={() => setZoom((z) => Math.min(250, z + 25))}
              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                isDark ? "border-neutral-800 hover:bg-neutral-900" : "border-neutral-200 hover:bg-neutral-100"
              }`}
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Rotate */}
          <button
            onClick={() => setRotation((r) => (r + 90) % 360)}
            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
              isDark ? "border-neutral-800 hover:bg-neutral-900" : "border-neutral-200 hover:bg-neutral-100"
            }`}
            title="Rotate 90°"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>

          {/* Open in new tab */}
          <button
            onClick={handleOpenInNewTab}
            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
              isDark ? "border-neutral-800 hover:bg-neutral-900" : "border-neutral-200 hover:bg-neutral-100"
            }`}
            title="Open in new window"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={() => setIsFullscreen((f) => !f)}
            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
              isDark ? "border-neutral-800 hover:bg-neutral-900" : "border-neutral-200 hover:bg-neutral-100"
            }`}
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          {/* Download Button */}
          <button
            onClick={handleDownload}
            className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs flex items-center gap-1 shadow-sm transition-all cursor-pointer"
          >
            <Download className="w-3 h-3" />
            <span className="hidden sm:inline">Download</span>
          </button>
        </div>
      </div>

      {/* PDF View Container */}
      <div className={`flex-1 overflow-hidden relative flex items-center justify-center p-2 sm:p-4 ${
        isFullscreen ? "fixed inset-0 z-50 p-0" : ""
      } ${isDark ? "bg-neutral-950" : "bg-neutral-200/60"}`}>
        {blobUrl && !hasError ? (
          <div
            style={{
              transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
              transformOrigin: "center center",
              transition: "transform 0.15s ease",
            }}
            className="w-full h-full max-w-6xl rounded-xl overflow-hidden shadow-2xl border border-neutral-800 bg-neutral-900"
          >
            <iframe
              src={`${blobUrl}#toolbar=1&navpanes=1&scrollbar=1`}
              title={filename}
              className="w-full h-full border-0 bg-white"
            />
          </div>
        ) : (
          <div className="text-center p-8 opacity-60">
            <Info className="w-8 h-8 mx-auto mb-2 text-rose-400" />
            <p className="text-xs">No PDF content available or format invalid</p>
          </div>
        )}
      </div>

      {/* Bottom Status Bar */}
      <div className={`h-6 px-3 border-t flex items-center justify-between text-[10px] font-mono shrink-0 ${
        isDark ? "bg-neutral-950 border-neutral-800 text-neutral-400" : "bg-white border-neutral-200 text-neutral-500"
      }`}>
        <div className="flex items-center gap-3">
          <span>Zoom: {zoom}%</span>
          <span>Rotation: {rotation}°</span>
          {size && <span>Size: {Math.round(size / 1024)} KB</span>}
        </div>
        <div className="flex items-center gap-2">
          <span>PDF Reader</span>
          <span>Vector Standard</span>
        </div>
      </div>
    </div>
  );
};
export default PdfViewer;
