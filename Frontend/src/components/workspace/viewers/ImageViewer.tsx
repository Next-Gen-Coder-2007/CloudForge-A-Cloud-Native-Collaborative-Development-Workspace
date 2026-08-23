import React, { useState, useRef } from "react";
import {
  Image as ImageIcon,
  ZoomIn,
  ZoomOut,
  RotateCw,
  FlipHorizontal,
  Download,
  Copy,
  Check,
  Info,
} from "lucide-react";
import { useTheme } from "../../../context/ThemeContext";

interface ImageViewerProps {
  content: string;
  filename: string;
  size?: number;
}

export const ImageViewer: React.FC<ImageViewerProps> = ({ content, filename, size }) => {
  const { isDark } = useTheme();
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const [copied, setCopied] = useState(false);

  // Drag & Pan state
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Normalize image data URL
  const imageUrl = React.useMemo(() => {
    if (!content) return "";
    if (content.startsWith("data:image/") || content.startsWith("http")) {
      return content;
    }
    const ext = filename.split(".").pop()?.toLowerCase() || "png";
    const mime = ext === "svg" ? "image/svg+xml" : `image/${ext}`;
    return `data:${mime};base64,${content}`;
  }, [content, filename]);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setDimensions({ width: img.naturalWidth, height: img.naturalHeight });
  };

  // Mouse Drag to Pan
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch Drag to Pan
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - pan.x,
        y: e.touches[0].clientY - pan.y,
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    setPan({
      x: e.touches[0].clientX - dragStart.x,
      y: e.touches[0].clientY - dragStart.y,
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.15 : -0.15;
    setZoom((z) => Math.min(8, Math.max(0.1, +(z + delta).toFixed(2))));
  };

  const handleResetPan = () => {
    setPan({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
  };

  const handleDownload = () => {
    if (!imageUrl) return;
    const a = document.createElement("a");
    a.href = imageUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleCopy = async () => {
    try {
      if (imgRef.current && navigator.clipboard) {
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        await navigator.clipboard.write([
          new ClipboardItem({
            [blob.type]: blob,
          }),
        ]);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // Fallback copy url
      navigator.clipboard.writeText(imageUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      className={`h-full flex flex-col select-none overflow-hidden font-sans ${
        isDark ? "bg-black text-neutral-200" : "bg-neutral-100 text-neutral-800"
      }`}
    >
      {/* Top Toolbar */}
      <div
        className={`h-10 px-3 border-b flex items-center justify-between shrink-0 ${
          isDark ? "bg-neutral-950 border-neutral-800 text-neutral-200" : "bg-white border-neutral-200 text-neutral-800"
        }`}
      >
        <div className="flex items-center gap-2">
          <ImageIcon className={`w-4 h-4 shrink-0 ${isDark ? "text-neutral-400" : "text-neutral-600"}`} />
          <span className="text-xs font-semibold truncate max-w-[140px] sm:max-w-[220px] font-mono">
            {filename}
          </span>
          {dimensions && (
            <span
              className={`text-[10px] px-2 py-0.5 rounded-md font-mono ${
                isDark
                  ? "bg-neutral-900 text-neutral-400 border border-neutral-800"
                  : "bg-neutral-100 text-neutral-600 border border-neutral-200"
              }`}
            >
              {dimensions.width} × {dimensions.height} px
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* Zoom controls */}
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setZoom((z) => Math.max(0.2, z - 0.2))}
              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                isDark
                  ? "border-neutral-800 hover:bg-neutral-900 text-neutral-300"
                  : "border-neutral-200 hover:bg-neutral-100 text-neutral-700"
              }`}
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleResetPan}
              className={`p-1.5 rounded-lg border transition-colors cursor-pointer text-xs font-mono font-bold px-2 ${
                isDark
                  ? "border-neutral-800 hover:bg-neutral-900 text-neutral-300"
                  : "border-neutral-200 hover:bg-neutral-100 text-neutral-700"
              }`}
              title="Reset Zoom & Pan (Double Click Canvas)"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              onClick={() => setZoom((z) => Math.min(8, z + 0.2))}
              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                isDark
                  ? "border-neutral-800 hover:bg-neutral-900 text-neutral-300"
                  : "border-neutral-200 hover:bg-neutral-100 text-neutral-700"
              }`}
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Rotate & Flip */}
          <button
            onClick={() => setRotation((r) => (r + 90) % 360)}
            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
              isDark
                ? "border-neutral-800 hover:bg-neutral-900 text-neutral-300"
                : "border-neutral-200 hover:bg-neutral-100 text-neutral-700"
            }`}
            title="Rotate 90°"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setFlipped((f) => !f)}
            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
              flipped
                ? isDark
                  ? "bg-neutral-800 border-neutral-700 text-white font-bold"
                  : "bg-neutral-200 border-neutral-300 text-black font-bold"
                : isDark
                ? "border-neutral-800 hover:bg-neutral-900 text-neutral-300"
                : "border-neutral-200 hover:bg-neutral-100 text-neutral-700"
            }`}
            title="Flip Horizontal"
          >
            <FlipHorizontal className="w-3.5 h-3.5" />
          </button>

          {/* Copy Image */}
          <button
            onClick={handleCopy}
            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
              isDark
                ? "border-neutral-800 hover:bg-neutral-900 text-neutral-300"
                : "border-neutral-200 hover:bg-neutral-100 text-neutral-700"
            }`}
            title="Copy image"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          {/* Download */}
          <button
            onClick={handleDownload}
            className={`px-2.5 py-1 rounded-lg font-semibold text-xs flex items-center gap-1 shadow-xs transition-all cursor-pointer ${
              isDark
                ? "bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700"
                : "bg-neutral-900 hover:bg-neutral-800 text-white border border-neutral-800"
            }`}
          >
            <Download className="w-3 h-3" />
            <span className="hidden sm:inline">Download</span>
          </button>
        </div>
      </div>

      {/* Main Image Canvas View with Drag & Pan */}
      <div
        ref={containerRef}
        style={{
          cursor: isDragging ? "grabbing" : "grab",
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
        onDoubleClick={handleResetPan}
        className={`flex-1 overflow-hidden flex items-center justify-center p-8 relative select-none transition-colors ${
          isDark ? "bg-black" : "bg-neutral-100"
        }`}
      >
        {imageUrl ? (
          <img
            ref={imgRef}
            src={imageUrl}
            alt={filename}
            onLoad={handleImageLoad}
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg) scaleX(${
                flipped ? -1 : 1
              })`,
              transformOrigin: "center center",
              transition: isDragging ? "none" : "transform 0.12s ease-out",
            }}
            className={`max-w-none rounded select-none pointer-events-none ${
              isDark ? "shadow-2xl shadow-black/80" : "shadow-xl shadow-neutral-300/60"
            }`}
            draggable={false}
          />
        ) : (
          <div className="text-center opacity-60">
            <Info className={`w-8 h-8 mx-auto mb-2 ${isDark ? "text-neutral-500" : "text-neutral-400"}`} />
            <p className="text-xs">No image preview available</p>
          </div>
        )}
      </div>

      {/* Bottom Status Bar */}
      <div
        className={`h-6 px-3 border-t flex items-center justify-between text-[10px] font-mono shrink-0 ${
          isDark
            ? "bg-neutral-950 border-neutral-800 text-neutral-400"
            : "bg-white border-neutral-200 text-neutral-500"
        }`}
      >
        <div className="flex items-center gap-3">
          {dimensions && <span>Dimensions: {dimensions.width} × {dimensions.height}</span>}
          <span>Zoom: {Math.round(zoom * 100)}%</span>
          <span>Pan: ({Math.round(pan.x)}, {Math.round(pan.y)})</span>
          <span>Rotation: {rotation}°</span>
          {size && <span>File Size: {Math.round(size / 1024)} KB</span>}
        </div>
        <div className="flex items-center gap-2 text-neutral-500 hidden sm:flex">
          <span>Click & Drag to Pan • Scroll to Zoom • Double Click to Reset</span>
        </div>
      </div>
    </div>
  );
};
export default ImageViewer;
