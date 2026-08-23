import React, { useRef, useEffect, useCallback, useState } from "react";
import type { HighlightedLine } from "./syntaxTokenizer";
import type { EditorTheme } from "./themes";

interface MinimapProps {
  theme: EditorTheme;
  lines: HighlightedLine[];
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
  currentLine?: number;
  onScrollToRatio: (ratio: number) => void;
  errorLines?: number[];
}

export const Minimap: React.FC<MinimapProps> = ({
  theme,
  lines,
  scrollTop,
  scrollHeight,
  clientHeight,
  currentLine = 1,
  onScrollToRatio,
  errorLines = [],
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDraggingRef = useRef(false);
  const [hoverLine, setHoverLine] = useState<number | null>(null);

  const totalLines = lines.length;

  // Viewport calculation
  const maxScroll = Math.max(1, scrollHeight - clientHeight);
  const scrollRatio = Math.min(1, Math.max(0, scrollTop / maxScroll));
  const viewportHeightRatio = Math.min(1, clientHeight / Math.max(1, scrollHeight));

  // High-performance canvas rendering loop
  const renderMinimap = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || totalLines === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    // Set canvas dimensions with DPR for crisp Retina display
    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    // Compute line spacing
    const lineSpacing = Math.max(1.8, Math.min(4, height / Math.max(1, totalLines)));
    const charWidth = 1.6;
    const padLeft = 4;

    // Render mini code lines
    const maxVisibleLines = Math.min(totalLines, Math.ceil(height / lineSpacing));

    for (let i = 0; i < maxVisibleLines; i++) {
      const line = lines[i];
      if (!line) continue;

      const y = i * lineSpacing;
      let x = padLeft;

      for (let t = 0; t < line.tokens.length; t++) {
        const token = line.tokens[t];
        const tokenText = token.text;

        // Skip leading indentation or render as space
        if (!tokenText.trim()) {
          x += Math.min(24, tokenText.length * charWidth);
          continue;
        }

        const tokenWidth = Math.min(width - x - 8, Math.max(2, tokenText.length * charWidth));
        const color = theme.tokenColors[token.type] || theme.textColor;

        ctx.fillStyle = color;
        ctx.globalAlpha = 0.75;
        ctx.fillRect(x, y, tokenWidth, Math.max(1, lineSpacing - 0.8));
        x += tokenWidth + 1;

        if (x >= width - 8) break;
      }
    }

    // Render Current Line Marker
    if (currentLine > 0 && currentLine <= totalLines) {
      const curY = (currentLine - 1) * lineSpacing;
      ctx.fillStyle = theme.accentColor;
      ctx.globalAlpha = 0.5;
      ctx.fillRect(0, curY, width, Math.max(2, lineSpacing));
    }

    // Render Error / Diagnostic Markers on right edge
    ctx.globalAlpha = 1.0;
    ctx.fillStyle = "#ef4444";
    for (const errLine of errorLines) {
      if (errLine > 0 && errLine <= totalLines) {
        const errY = (errLine - 1) * lineSpacing;
        ctx.fillRect(width - 4, errY, 4, Math.max(2, lineSpacing));
      }
    }

    ctx.restore();
  }, [lines, theme, totalLines, currentLine, errorLines]);

  // Re-render when content or theme changes
  useEffect(() => {
    const frameId = requestAnimationFrame(renderMinimap);
    return () => cancelAnimationFrame(frameId);
  }, [renderMinimap]);

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
      requestAnimationFrame(renderMinimap);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [renderMinimap]);

  // Drag and Click Interaction (Smooth Scrubbing)
  const updateScrollFromClientY = (clientY: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clickY = clientY - rect.top;
    const ratio = Math.min(1, Math.max(0, clickY / rect.height));
    onScrollToRatio(ratio);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    isDraggingRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    updateScrollFromClientY(e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDraggingRef.current) {
      updateScrollFromClientY(e.clientY);
    }

    // Calculate hover line
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const clickY = e.clientY - rect.top;
      const ratio = Math.min(1, Math.max(0, clickY / rect.height));
      const lineNum = Math.min(totalLines, Math.max(1, Math.round(ratio * totalLines)));
      setHoverLine(lineNum);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    isDraggingRef.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch (_) {}
  };

  if (totalLines === 0) return null;

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={() => setHoverLine(null)}
      style={{
        backgroundColor: theme.gutterBg,
        borderColor: theme.borderColor,
      }}
      className="w-16 sm:w-20 h-full border-l shrink-0 relative select-none overflow-hidden cursor-pointer group touch-none"
      title="Minimap (Click or drag to scroll)"
    >
      {/* High-speed HTML5 2D Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
      />

      {/* VS Code Draggable Viewport Slider */}
      <div
        style={{
          top: `${scrollRatio * (100 - viewportHeightRatio * 100)}%`,
          height: `${Math.max(10, viewportHeightRatio * 100)}%`,
          backgroundColor: theme.isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(37, 99, 235, 0.12)",
          borderColor: theme.accentColor,
        }}
        className="absolute left-0 right-0 border-y border-blue-500/40 shadow-xs group-hover:bg-white/15 transition-colors pointer-events-none rounded-xs"
      />

      {/* Line number tooltip on hover */}
      {hoverLine && (
        <div
          style={{
            backgroundColor: theme.isDark ? "#000000" : "#ffffff",
            borderColor: theme.borderColor,
            color: theme.textColor,
          }}
          className="absolute right-1 top-1 px-1.5 py-0.5 rounded text-[9px] font-mono border shadow-md pointer-events-none z-20 opacity-80"
        >
          Ln {hoverLine}
        </div>
      )}
    </div>
  );
};
