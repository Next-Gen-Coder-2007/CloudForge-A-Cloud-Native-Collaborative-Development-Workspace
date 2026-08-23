import React, { useState, useEffect, useMemo } from "react";
import JSZip from "jszip";
import {
  Presentation,
  ChevronLeft,
  ChevronRight,
  Minimize2,
  Download,
  Layers,
  Play,
  FileText,
  Sparkles,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useTheme } from "../../../context/ThemeContext";

interface PptxRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  size?: number; // in pt
  color?: string; // hex
}

interface PptxParagraph {
  runs: PptxRun[];
  align?: "left" | "center" | "right" | "justify";
  isBullet?: boolean;
  level?: number;
}

interface PptxTableCell {
  paragraphs: PptxParagraph[];
  bgColor?: string;
}

interface PptxTableRow {
  cells: PptxTableCell[];
}

interface PptxShape {
  id: string;
  type: "text" | "picture" | "table" | "shape";
  leftPct?: number;
  topPct?: number;
  widthPct?: number;
  heightPct?: number;
  paragraphs?: PptxParagraph[];
  bgColor?: string;
  borderColor?: string;
  isTitle?: boolean;
  isSubtitle?: boolean;
  imageUrl?: string;
  tableRows?: PptxTableRow[];
}

interface PptxSlideData {
  number: number;
  title: string;
  shapes: PptxShape[];
  bgColor?: string;
  notes?: string;
}

interface PptxViewerProps {
  content: string;
  filename: string;
  size?: number;
}

// Helper to find all elements by localName (namespace-independent)
function findElementsByName(parent: Element | Document, name: string): Element[] {
  const result: Element[] = [];
  const walk = (node: Element) => {
    if (node.localName === name || node.tagName.endsWith(":" + name)) {
      result.push(node);
    }
    for (let i = 0; i < node.children.length; i++) {
      walk(node.children[i]);
    }
  };
  if (parent instanceof Document) {
    if (parent.documentElement) walk(parent.documentElement);
  } else {
    for (let i = 0; i < parent.children.length; i++) {
      walk(parent.children[i]);
    }
  }
  return result;
}

// Helper to extract hex color from color XML nodes
function extractColor(node: Element | undefined, defaultThemeDark = false): string | undefined {
  if (!node) return undefined;
  const srgb = findElementsByName(node, "srgbClr")[0];
  if (srgb) {
    const val = srgb.getAttribute("val");
    if (val) return `#${val}`;
  }

  const scheme = findElementsByName(node, "schemeClr")[0];
  if (scheme) {
    const val = scheme.getAttribute("val");
    const schemeMap: Record<string, string> = {
      accent1: "#3b82f6",
      accent2: "#ef4444",
      accent3: "#10b981",
      accent4: "#f59e0b",
      accent5: "#8b5cf6",
      accent6: "#ec4899",
      tx1: defaultThemeDark ? "#f8fafc" : "#0f172a",
      tx2: defaultThemeDark ? "#cbd5e1" : "#475569",
      bg1: defaultThemeDark ? "#0f172a" : "#ffffff",
      bg2: defaultThemeDark ? "#1e293b" : "#f1f5f9",
      hlink: "#3b82f6",
      folHlink: "#8b5cf6",
    };
    if (val && schemeMap[val]) return schemeMap[val];
  }
  return undefined;
}

export const PptxViewer: React.FC<PptxViewerProps> = ({ content, filename, size }) => {
  const { isDark } = useTheme();
  const [slides, setSlides] = useState<PptxSlideData[]>([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showThumbnails, setShowThumbnails] = useState(true);
  const [aspectRatio, setAspectRatio] = useState<"16/9" | "4/3">("16/9");
  const [zoomScale, setZoomScale] = useState(1);

  // Parse PPTX presentation with OpenXML parsing
  useEffect(() => {
    let isCancelled = false;

    const parsePptx = async () => {
      if (!content) {
        setSlides([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const zip = new JSZip();
        let zipData: JSZip;

        if (content.startsWith("data:")) {
          const base64 = content.split(",")[1] || "";
          zipData = await zip.loadAsync(base64, { base64: true });
        } else {
          try {
            zipData = await zip.loadAsync(content, { base64: true });
          } catch {
            zipData = await zip.loadAsync(content);
          }
        }

        const parser = new DOMParser();

        // 1. Determine slide size from presentation.xml
        let slideWidthEMU = 12192000;
        let slideHeightEMU = 6858000;
        const presFile = zipData.file("ppt/presentation.xml");
        if (presFile) {
          const presXml = await presFile.async("text");
          const presDoc = parser.parseFromString(presXml, "application/xml");
          const sldSz = findElementsByName(presDoc, "sldSz")[0];
          if (sldSz) {
            const cx = parseInt(sldSz.getAttribute("cx") || "12192000", 10);
            const cy = parseInt(sldSz.getAttribute("cy") || "6858000", 10);
            if (cx > 0 && cy > 0) {
              slideWidthEMU = cx;
              slideHeightEMU = cy;
              const ratio = cx / cy;
              setAspectRatio(ratio < 1.5 ? "4/3" : "16/9");
            }
          }
        }

        // 2. Discover slides in numerical order
        const slideFiles: { name: string; num: number; file: JSZip.JSZipObject }[] = [];
        zipData.forEach((relativePath, file) => {
          const match = relativePath.match(/^ppt\/slides\/slide(\d+)\.xml$/i);
          if (match) {
            slideFiles.push({
              name: relativePath,
              num: parseInt(match[1], 10),
              file,
            });
          }
        });

        slideFiles.sort((a, b) => a.num - b.num);

        const parsedSlides: PptxSlideData[] = [];

        for (let i = 0; i < slideFiles.length; i++) {
          const item = slideFiles[i];
          const slideNum = item.num;
          const slideXml = await item.file.async("text");
          const doc = parser.parseFromString(slideXml, "application/xml");

          // Load relationships to map embedded media (ppt/slides/_rels/slideX.xml.rels)
          const relsMap: Record<string, string> = {};
          const relsFile = zipData.file(`ppt/slides/_rels/slide${slideNum}.xml.rels`);
          if (relsFile) {
            const relsXml = await relsFile.async("text");
            const relsDoc = parser.parseFromString(relsXml, "application/xml");
            const relationships = findElementsByName(relsDoc, "Relationship");
            for (const rel of relationships) {
              const id = rel.getAttribute("Id") || "";
              const target = rel.getAttribute("Target") || "";
              if (id && target) {
                const cleanTarget = target.startsWith("../")
                  ? `ppt/${target.replace("../", "")}`
                  : `ppt/slides/${target}`;
                relsMap[id] = cleanTarget;
              }
            }
          }

          const shapes: PptxShape[] = [];
          let slideTitle = `Slide ${i + 1}`;

          // Extract Background
          let slideBgColor: string | undefined;
          const bgEl = findElementsByName(doc, "bg")[0];
          if (bgEl) {
            slideBgColor = extractColor(bgEl, isDark);
          }

          // Recursive helper to process all shapes (including inside group shapes <p:grpSp>)
          const processShapeTree = async (container: Element | Document) => {
            // A. Normal shapes (<p:sp>)
            const spElements = findElementsByName(container, "sp");
            for (let s = 0; s < spElements.length; s++) {
              const sp = spElements[s];

              // Coordinate Transform
              let leftPct: number | undefined;
              let topPct: number | undefined;
              let widthPct: number | undefined;
              let heightPct: number | undefined;

              const xfrm = findElementsByName(sp, "xfrm")[0];
              if (xfrm) {
                const off = findElementsByName(xfrm, "off")[0];
                const ext = findElementsByName(xfrm, "ext")[0];
                if (off && ext) {
                  const x = parseInt(off.getAttribute("x") || "0", 10);
                  const y = parseInt(off.getAttribute("y") || "0", 10);
                  const cx = parseInt(ext.getAttribute("cx") || "0", 10);
                  const cy = parseInt(ext.getAttribute("cy") || "0", 10);

                  if (slideWidthEMU > 0 && slideHeightEMU > 0) {
                    leftPct = Math.max(0, Math.min(100, (x / slideWidthEMU) * 100));
                    topPct = Math.max(0, Math.min(100, (y / slideHeightEMU) * 100));
                    widthPct = Math.max(2, Math.min(100, (cx / slideWidthEMU) * 100));
                    heightPct = Math.max(2, Math.min(100, (cy / slideHeightEMU) * 100));
                  }
                }
              }

              // Shape Fill & Border
              const spPr = findElementsByName(sp, "spPr")[0];
              const bgColor = extractColor(spPr, isDark);

              // Title / Placeholder check
              const ph = findElementsByName(sp, "ph")[0];
              const phType = ph?.getAttribute("type");
              const isTitle = phType === "title" || phType === "ctrTitle";
              const isSubtitle = phType === "subTitle";

              // Text Body
              const txBody = findElementsByName(sp, "txBody")[0];
              const paragraphs: PptxParagraph[] = [];

              if (txBody) {
                const pEls = findElementsByName(txBody, "p");
                for (const pEl of pEls) {
                  const pPr = findElementsByName(pEl, "pPr")[0];
                  const alignAttr = pPr?.getAttribute("algn");
                  let align: PptxParagraph["align"] = "left";
                  if (alignAttr === "ctr") align = "center";
                  else if (alignAttr === "r") align = "right";
                  else if (alignAttr === "just") align = "justify";

                  const lvl = parseInt(pPr?.getAttribute("lvl") || "0", 10);
                  const buChar = findElementsByName(pEl, "buChar")[0];
                  const buNone = findElementsByName(pEl, "buNone")[0];
                  const isBullet = (Boolean(buChar) || lvl > 0) && !buNone;

                  const runs: PptxRun[] = [];
                  const rEls = findElementsByName(pEl, "r");

                  for (const rEl of rEls) {
                    const tEl = findElementsByName(rEl, "t")[0];
                    const text = tEl?.textContent || "";
                    if (!text) continue;

                    const rPr = findElementsByName(rEl, "rPr")[0];
                    let bold = false;
                    let italic = false;
                    let underline = false;
                    let sizePt: number | undefined;
                    let color: string | undefined;

                    if (rPr) {
                      bold = rPr.getAttribute("b") === "1" || rPr.getAttribute("b") === "true";
                      italic = rPr.getAttribute("i") === "1" || rPr.getAttribute("i") === "true";
                      underline = rPr.getAttribute("u") === "sng";
                      const sz = rPr.getAttribute("sz");
                      if (sz) sizePt = parseInt(sz, 10) / 100;
                      color = extractColor(rPr, isDark);
                    }

                    runs.push({ text, bold, italic, underline, size: sizePt, color });
                  }

                  if (runs.length === 0) {
                    const tEls = findElementsByName(pEl, "t");
                    const fullText = tEls.map((t) => t.textContent || "").join("");
                    if (fullText.trim()) {
                      runs.push({ text: fullText });
                    }
                  }

                  if (runs.length > 0) {
                    paragraphs.push({ runs, align, isBullet, level: lvl });
                  }
                }
              }

              const fullShapeText = paragraphs
                .map((p) => p.runs.map((r) => r.text).join(""))
                .join(" ")
                .trim();

              if (fullShapeText || bgColor) {
                if (isTitle && slideTitle === `Slide ${i + 1}` && fullShapeText) {
                  slideTitle = fullShapeText;
                }

                shapes.push({
                  id: `sp-${s}-${shapes.length}`,
                  type: "text",
                  leftPct,
                  topPct,
                  widthPct,
                  heightPct,
                  paragraphs,
                  bgColor,
                  isTitle,
                  isSubtitle,
                });
              }
            }

            // B. Picture elements (<p:pic>)
            const picElements = findElementsByName(container, "pic");
            for (let p = 0; p < picElements.length; p++) {
              const pic = picElements[p];

              let leftPct: number | undefined;
              let topPct: number | undefined;
              let widthPct: number | undefined;
              let heightPct: number | undefined;

              const xfrm = findElementsByName(pic, "xfrm")[0];
              if (xfrm) {
                const off = findElementsByName(xfrm, "off")[0];
                const ext = findElementsByName(xfrm, "ext")[0];
                if (off && ext) {
                  const x = parseInt(off.getAttribute("x") || "0", 10);
                  const y = parseInt(off.getAttribute("y") || "0", 10);
                  const cx = parseInt(ext.getAttribute("cx") || "0", 10);
                  const cy = parseInt(ext.getAttribute("cy") || "0", 10);

                  if (slideWidthEMU > 0 && slideHeightEMU > 0) {
                    leftPct = (x / slideWidthEMU) * 100;
                    topPct = (y / slideHeightEMU) * 100;
                    widthPct = (cx / slideWidthEMU) * 100;
                    heightPct = (cy / slideHeightEMU) * 100;
                  }
                }
              }

              const blip = findElementsByName(pic, "blip")[0];
              const embedId =
                blip?.getAttribute("r:embed") ||
                blip?.getAttribute("embed") ||
                blip?.getAttribute("r:link");

              let imageUrl: string | undefined;
              if (embedId && relsMap[embedId]) {
                const targetPath = relsMap[embedId];
                const mediaFile = zipData.file(targetPath);
                if (mediaFile) {
                  const ext = targetPath.split(".").pop()?.toLowerCase() || "png";
                  const mime =
                    ext === "svg"
                      ? "image/svg+xml"
                      : ext === "jpg" || ext === "jpeg"
                      ? "image/jpeg"
                      : "image/png";
                  const base64 = await mediaFile.async("base64");
                  imageUrl = `data:${mime};base64,${base64}`;
                }
              }

              if (imageUrl) {
                shapes.push({
                  id: `pic-${p}-${shapes.length}`,
                  type: "picture",
                  leftPct,
                  topPct,
                  widthPct,
                  heightPct,
                  imageUrl,
                });
              }
            }

            // C. Tables (<a:tbl>)
            const tblElements = findElementsByName(container, "tbl");
            for (let t = 0; t < tblElements.length; t++) {
              const tbl = tblElements[t];
              const trEls = findElementsByName(tbl, "tr");
              const tableRows: PptxTableRow[] = [];

              for (const tr of trEls) {
                const tcEls = findElementsByName(tr, "tc");
                const cells: PptxTableCell[] = [];

                for (const tc of tcEls) {
                  const pEls = findElementsByName(tc, "p");
                  const cellParagraphs: PptxParagraph[] = [];

                  for (const pEl of pEls) {
                    const rEls = findElementsByName(pEl, "r");
                    const runs: PptxRun[] = [];

                    for (const rEl of rEls) {
                      const text = findElementsByName(rEl, "t")[0]?.textContent || "";
                      if (text) {
                        runs.push({ text });
                      }
                    }

                    if (runs.length === 0) {
                      const text = findElementsByName(pEl, "t").map((el) => el.textContent || "").join("");
                      if (text) runs.push({ text });
                    }

                    if (runs.length > 0) {
                      cellParagraphs.push({ runs });
                    }
                  }

                  cells.push({ paragraphs: cellParagraphs });
                }

                if (cells.length > 0) {
                  tableRows.push({ cells });
                }
              }

              if (tableRows.length > 0) {
                shapes.push({
                  id: `tbl-${t}-${shapes.length}`,
                  type: "table",
                  tableRows,
                });
              }
            }
          };

          await processShapeTree(doc);

          // Fallback title selection
          if (slideTitle === `Slide ${i + 1}`) {
            const firstTitleShape = shapes.find(
              (s) => s.type === "text" && s.isTitle && s.paragraphs && s.paragraphs.length > 0
            );
            if (firstTitleShape && firstTitleShape.paragraphs) {
              const t = firstTitleShape.paragraphs[0]?.runs.map((r) => r.text).join(" ").trim();
              if (t) slideTitle = t;
            } else {
              const firstText = shapes.find((s) => s.type === "text" && s.paragraphs && s.paragraphs.length > 0);
              if (firstText && firstText.paragraphs && firstText.paragraphs[0]) {
                const candidate = firstText.paragraphs[0].runs.map((r) => r.text).join(" ").trim();
                if (candidate && candidate.length < 80) {
                  slideTitle = candidate;
                }
              }
            }
          }

          parsedSlides.push({
            number: i + 1,
            title: slideTitle,
            shapes,
            bgColor: slideBgColor,
          });
        }

        if (!isCancelled) {
          if (parsedSlides.length === 0) {
            setSlides([
              {
                number: 1,
                title: filename.replace(/\.[^/.]+$/, ""),
                shapes: [
                  {
                    id: "empty-1",
                    type: "text",
                    paragraphs: [
                      { runs: [{ text: "PowerPoint Presentation Loaded", bold: true, size: 24 }] },
                      { runs: [{ text: `File: ${filename}` }] },
                      { runs: [{ text: size ? `Size: ${Math.round(size / 1024)} KB` : "" }] },
                    ],
                  },
                ],
              },
            ]);
          } else {
            setSlides(parsedSlides);
          }
          setCurrentSlideIndex(0);
          setIsLoading(false);
        }
      } catch (err: any) {
        console.error("Failed to parse PPTX presentation:", err);
        if (!isCancelled) {
          setError("Failed to parse PowerPoint presentation structure. File may be encrypted or unsupported binary.");
          setIsLoading(false);
        }
      }
    };

    parsePptx();

    return () => {
      isCancelled = true;
    };
  }, [content, filename, size, isDark]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowRight" || e.key === "Space") {
        setCurrentSlideIndex((i) => Math.min(slides.length - 1, i + 1));
      } else if (e.key === "ArrowLeft") {
        setCurrentSlideIndex((i) => Math.max(0, i - 1));
      } else if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [slides.length, isFullscreen]);

  const currentSlide = slides[currentSlideIndex];

  const handleDownload = () => {
    if (!content) return;
    const a = document.createElement("a");
    a.href = content.startsWith("data:")
      ? content
      : `data:application/vnd.openxmlformats-officedocument.presentationml.presentation;base64,${content}`;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const hasAbsolutePositions = useMemo(() => {
    if (!currentSlide) return false;
    return currentSlide.shapes.some((s) => s.leftPct !== undefined && s.topPct !== undefined);
  }, [currentSlide]);

  return (
    <div
      className={`h-full flex flex-col select-none overflow-hidden font-sans ${
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
          <Presentation className="w-4 h-4 text-amber-500 shrink-0" />
          <span className="text-xs font-semibold truncate max-w-[140px] sm:max-w-[220px] font-mono">
            {filename}
          </span>
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
              isDark
                ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                : "bg-amber-50 text-amber-700 border border-amber-200"
            }`}
          >
            MS PowerPoint View
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Slide Navigation Controls */}
          {slides.length > 0 && (
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
                    ? "bg-neutral-900 border-neutral-800 text-amber-400"
                    : "bg-neutral-50 border-neutral-200 text-amber-700"
                }`}
              >
                {slides.map((_s, idx) => (
                  <option key={idx} value={idx}>
                    Slide {idx + 1} of {slides.length}
                  </option>
                ))}
              </select>

              <button
                onClick={() => setCurrentSlideIndex((i) => Math.min(slides.length - 1, i + 1))}
                disabled={currentSlideIndex === slides.length - 1}
                className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                  currentSlideIndex === slides.length - 1
                    ? "opacity-30 cursor-not-allowed border-transparent"
                    : isDark
                    ? "border-neutral-800 hover:bg-neutral-900"
                    : "border-neutral-200 hover:bg-neutral-100"
                }`}
                title="Next Slide (Right Arrow)"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Toggle Thumbnails */}
          <button
            onClick={() => setShowThumbnails((v) => !v)}
            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
              showThumbnails
                ? "bg-amber-500/20 border-amber-500/40 text-amber-400 font-bold"
                : isDark
                ? "border-neutral-800 hover:bg-neutral-900"
                : "border-neutral-200 hover:bg-neutral-100"
            }`}
            title="Toggle Slide Thumbnails Drawer"
          >
            <Layers className="w-3.5 h-3.5" />
          </button>

          {/* Zoom In/Out */}
          <div className="flex items-center gap-0.5 border rounded-lg p-0.5 border-neutral-700/40">
            <button
              onClick={() => setZoomScale((z) => Math.max(0.6, +(z - 0.1).toFixed(1)))}
              className="p-1 hover:opacity-100 opacity-60 rounded cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut className="w-3 h-3" />
            </button>
            <button
              onClick={() => setZoomScale(1)}
              className="text-[10px] font-mono font-bold px-1 cursor-pointer"
              title="Reset Zoom (100%)"
            >
              {Math.round(zoomScale * 100)}%
            </button>
            <button
              onClick={() => setZoomScale((z) => Math.min(1.5, +(z + 0.1).toFixed(1)))}
              className="p-1 hover:opacity-100 opacity-60 rounded cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn className="w-3 h-3" />
            </button>
          </div>

          {/* Fullscreen Presentation Mode */}
          <button
            onClick={() => setIsFullscreen((f) => !f)}
            className={`p-1.5 rounded-lg border transition-colors cursor-pointer flex items-center gap-1 text-xs font-semibold ${
              isDark ? "border-neutral-800 hover:bg-neutral-900" : "border-neutral-200 hover:bg-neutral-100"
            }`}
            title={isFullscreen ? "Exit Presentation (Esc)" : "Start Presentation Mode"}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 text-amber-400" />}
            <span className="hidden md:inline">{isFullscreen ? "Exit" : "Present"}</span>
          </button>

          {/* Download Presentation */}
          <button
            onClick={handleDownload}
            className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs flex items-center gap-1 shadow-sm transition-all cursor-pointer"
          >
            <Download className="w-3 h-3" />
            <span className="hidden sm:inline">Download</span>
          </button>
        </div>
      </div>

      {/* Main Slide Deck Area */}
      <div
        className={`flex-1 overflow-hidden flex relative ${
          isFullscreen ? "fixed inset-0 z-50 bg-black" : ""
        }`}
      >
        {/* Left Thumbnails Drawer */}
        {showThumbnails && !isFullscreen && slides.length > 0 && (
          <div
            className={`w-48 sm:w-56 border-r flex flex-col p-2 gap-2 overflow-y-auto shrink-0 ${
              isDark ? "bg-neutral-950 border-neutral-800" : "bg-neutral-50 border-neutral-200"
            }`}
          >
            <div className="flex items-center justify-between px-1 text-[11px] font-bold opacity-50 uppercase tracking-wider">
              <span>Slides ({slides.length})</span>
            </div>
            {slides.map((s, idx) => (
              <div
                key={idx}
                onClick={() => setCurrentSlideIndex(idx)}
                className={`p-2.5 rounded-xl border transition-all cursor-pointer text-left flex flex-col gap-1 ${
                  currentSlideIndex === idx
                    ? "bg-amber-500/15 border-amber-500/50 shadow-md ring-1 ring-amber-500/30"
                    : isDark
                    ? "bg-neutral-900/60 border-neutral-800 hover:bg-neutral-900"
                    : "bg-white border-neutral-200 hover:bg-neutral-100"
                }`}
              >
                <div className="flex items-center justify-between text-[10px] font-mono opacity-60">
                  <span className="font-bold">#{s.number}</span>
                  <span>{s.shapes.length} elements</span>
                </div>
                <p className="text-xs font-semibold truncate text-inherit">{s.title}</p>
              </div>
            ))}
          </div>
        )}

        {/* Slide Stage Canvas */}
        <div className="flex-1 overflow-auto flex items-center justify-center p-4 sm:p-8 relative">
          {isLoading ? (
            <div className="text-center p-8 flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-neutral-400 font-mono">Rendering PowerPoint presentation slides...</p>
            </div>
          ) : error ? (
            <div className="text-center p-8 max-w-md">
              <FileText className="w-12 h-12 text-amber-500 mx-auto mb-3 opacity-60" />
              <h3 className="text-sm font-bold mb-1">Presentation Ready</h3>
              <p className="text-xs text-neutral-400 mb-4">{error}</p>
              <button
                onClick={handleDownload}
                className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs shadow-sm cursor-pointer"
              >
                Download {filename}
              </button>
            </div>
          ) : currentSlide ? (
            <div
              style={{
                transform: `scale(${zoomScale})`,
                transformOrigin: "center center",
                transition: "transform 0.15s ease",
                backgroundColor: currentSlide.bgColor,
              }}
              className={`w-full max-w-5xl ${
                aspectRatio === "4/3" ? "aspect-[4/3]" : "aspect-[16/9]"
              } rounded-2xl border p-8 sm:p-12 shadow-2xl relative overflow-hidden transition-all duration-200 select-text ${
                isDark
                  ? "bg-neutral-900 text-neutral-100 border-neutral-800 shadow-black/80"
                  : "bg-white text-neutral-900 border-neutral-200 shadow-neutral-300/60"
              }`}
            >
              {/* Exact OpenXML Absolute Positioning */}
              {hasAbsolutePositions ? (
                <div className="relative w-full h-full">
                  {currentSlide.shapes.map((shape) => {
                    const style: React.CSSProperties = {
                      position: "absolute",
                      left: shape.leftPct !== undefined ? `${shape.leftPct}%` : undefined,
                      top: shape.topPct !== undefined ? `${shape.topPct}%` : undefined,
                      width: shape.widthPct !== undefined ? `${shape.widthPct}%` : undefined,
                      height: shape.heightPct !== undefined ? `${shape.heightPct}%` : undefined,
                      backgroundColor: shape.bgColor,
                    };

                    if (shape.type === "picture" && shape.imageUrl) {
                      return (
                        <div key={shape.id} style={style} className="flex items-center justify-center overflow-hidden">
                          <img
                            src={shape.imageUrl}
                            alt="Slide graphic"
                            className="max-w-full max-h-full object-contain rounded-lg"
                          />
                        </div>
                      );
                    }

                    if (shape.type === "table" && shape.tableRows) {
                      return (
                        <div key={shape.id} style={style} className="overflow-auto">
                          <table className="w-full border-collapse text-xs">
                            <tbody>
                              {shape.tableRows.map((row, rIdx) => (
                                <tr key={rIdx} className="border-b border-neutral-500/20">
                                  {row.cells.map((cell, cIdx) => (
                                    <td key={cIdx} className="p-2 border-r border-neutral-500/20">
                                      {cell.paragraphs.map((p, pIdx) => (
                                        <p key={pIdx}>
                                          {p.runs.map((r, rIdx2) => (
                                            <span
                                              key={rIdx2}
                                              style={{
                                                fontWeight: r.bold ? "bold" : "normal",
                                                fontStyle: r.italic ? "italic" : "normal",
                                                color: r.color,
                                              }}
                                            >
                                              {r.text}
                                            </span>
                                          ))}
                                        </p>
                                      ))}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
                    }

                    // Text shape
                    return (
                      <div
                        key={shape.id}
                        style={style}
                        className={`overflow-y-auto ${
                          shape.isTitle
                            ? "font-bold text-xl sm:text-2xl tracking-tight leading-tight"
                            : shape.isSubtitle
                            ? "font-semibold text-base opacity-80"
                            : "text-sm leading-relaxed"
                        }`}
                      >
                        {shape.paragraphs?.map((p, pIdx) => (
                          <div
                            key={pIdx}
                            style={{
                              textAlign: p.align || "left",
                              paddingLeft: p.level ? `${p.level * 16}px` : undefined,
                            }}
                            className={`my-1 ${p.isBullet ? "flex items-start gap-2" : ""}`}
                          >
                            {p.isBullet && (
                              <span className="text-amber-500 shrink-0 mt-0.5 font-bold">
                                {p.level === 1 ? "○" : p.level && p.level > 1 ? "–" : "•"}
                              </span>
                            )}
                            <div>
                              {p.runs.map((r, rIdx) => (
                                <span
                                  key={rIdx}
                                  style={{
                                    fontWeight: r.bold ? "bold" : "normal",
                                    fontStyle: r.italic ? "italic" : "normal",
                                    textDecoration: r.underline ? "underline" : "none",
                                    color: r.color,
                                    fontSize: r.size ? `${Math.min(36, r.size * 0.9)}pt` : undefined,
                                  }}
                                >
                                  {r.text}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Structured Slide View */
                <div className="flex flex-col justify-between h-full">
                  <div>
                    {/* Header */}
                    <div className="flex items-center justify-between border-b pb-3 mb-6 opacity-90 border-amber-500/30">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{currentSlide.title}</h1>
                      </div>
                      <span className="text-xs font-mono font-bold opacity-60">
                        {currentSlide.number} / {slides.length}
                      </span>
                    </div>

                    {/* Content Shapes */}
                    <div className="space-y-4 overflow-y-auto max-h-[60vh]">
                      {currentSlide.shapes.map((shape) => {
                        if (shape.type === "picture" && shape.imageUrl) {
                          return (
                            <div key={shape.id} className="flex justify-center my-3">
                              <img src={shape.imageUrl} alt="Slide media" className="max-h-64 object-contain rounded-xl shadow-md" />
                            </div>
                          );
                        }

                        if (shape.type === "table" && shape.tableRows) {
                          return (
                            <div key={shape.id} className="overflow-x-auto my-3">
                              <table className="w-full border-collapse text-xs border border-neutral-700/30 rounded-xl overflow-hidden">
                                <tbody>
                                  {shape.tableRows.map((row, rIdx) => (
                                    <tr key={rIdx} className="border-b border-neutral-700/20">
                                      {row.cells.map((cell, cIdx) => (
                                        <td key={cIdx} className="p-2.5 border-r border-neutral-700/20">
                                          {cell.paragraphs.map((p, pIdx) => (
                                            <p key={pIdx}>
                                              {p.runs.map((r, rIdx2) => (
                                                <span key={rIdx2} style={{ fontWeight: r.bold ? "bold" : "normal", color: r.color }}>
                                                  {r.text}
                                                </span>
                                              ))}
                                            </p>
                                          ))}
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          );
                        }

                        // Text shape
                        return (
                          <div key={shape.id} className="space-y-2">
                            {shape.paragraphs?.map((p, pIdx) => (
                              <div
                                key={pIdx}
                                style={{ paddingLeft: p.level ? `${p.level * 16}px` : undefined }}
                                className="flex items-start gap-2.5 text-sm sm:text-base leading-relaxed"
                              >
                                {p.isBullet && (
                                  <span className="text-amber-500 shrink-0 mt-1 font-bold">
                                    {p.level === 1 ? "○" : p.level && p.level > 1 ? "–" : "•"}
                                  </span>
                                )}
                                <div>
                                  {p.runs.map((r, rIdx) => (
                                    <span
                                      key={rIdx}
                                      style={{
                                        fontWeight: r.bold ? "bold" : "normal",
                                        fontStyle: r.italic ? "italic" : "normal",
                                        textDecoration: r.underline ? "underline" : "none",
                                        color: r.color,
                                        fontSize: r.size ? `${Math.min(32, r.size * 0.85)}pt` : undefined,
                                      }}
                                    >
                                      {r.text}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="border-t pt-2 mt-4 flex items-center justify-between text-[10px] font-mono opacity-50 border-neutral-700/30">
                    <span>{filename}</span>
                    <span>MS PowerPoint Slide Deck</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center p-8 opacity-40">
              <Presentation className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="text-xs font-mono">No slides found in presentation.</p>
            </div>
          )}
        </div>
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
          <span>Slides: {slides.length}</span>
          <span>Current: Slide {currentSlideIndex + 1}</span>
          <span>Aspect Ratio: {aspectRatio}</span>
          {size && <span>Size: {Math.round(size / 1024)} KB</span>}
        </div>
        <div className="flex items-center gap-2 text-neutral-500 hidden sm:flex">
          <span>Use Arrow Keys (← / →) or Space to Navigate Slides</span>
        </div>
      </div>
    </div>
  );
};
export default PptxViewer;
