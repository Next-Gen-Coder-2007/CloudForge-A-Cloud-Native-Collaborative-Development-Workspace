import React from "react";
import { Download, Film, Music } from "lucide-react";
import { useTheme } from "../../../context/ThemeContext";

interface MediaViewerProps {
  content: string;
  filename: string;
  size?: number;
}

export const MediaViewer: React.FC<MediaViewerProps> = ({ content, filename, size }) => {
  const { isDark } = useTheme();
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const isVideo = ["mp4", "webm", "ogg", "mov"].includes(ext);

  const mediaUrl = React.useMemo(() => {
    if (!content) return "";
    if (content.startsWith("data:") || content.startsWith("http")) return content;
    const mime = isVideo ? `video/${ext}` : `audio/${ext}`;
    return `data:${mime};base64,${content}`;
  }, [content, ext, isVideo]);

  const handleDownload = () => {
    if (!mediaUrl) return;
    const a = document.createElement("a");
    a.href = mediaUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
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
          {isVideo ? (
            <Film className="w-4 h-4 text-rose-400 shrink-0" />
          ) : (
            <Music className="w-4 h-4 text-emerald-400 shrink-0" />
          )}
          <span className="text-xs font-semibold truncate max-w-[140px] sm:max-w-[220px] font-mono">
            {filename}
          </span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
            isVideo
              ? isDark ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" : "bg-rose-50 text-rose-700 border border-rose-200"
              : isDark ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-emerald-50 text-emerald-700 border border-emerald-200"
          }`}>
            {isVideo ? "Video Media" : "Audio Track"}
          </span>
        </div>

        <button
          onClick={handleDownload}
          className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center gap-1 shadow-sm transition-all cursor-pointer"
        >
          <Download className="w-3 h-3" />
          <span className="hidden sm:inline">Download</span>
        </button>
      </div>

      {/* Media Player Body */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 overflow-auto">
        <div className={`max-w-3xl w-full p-8 rounded-2xl border shadow-2xl flex flex-col items-center justify-center ${
          isDark ? "bg-neutral-950 border-neutral-800" : "bg-neutral-50 border-neutral-200"
        }`}>
          {isVideo ? (
            <video
              src={mediaUrl}
              controls
              className="w-full rounded-xl max-h-[60vh] bg-black shadow-lg"
            />
          ) : (
            <div className="w-full flex flex-col items-center py-6">
              <div className="w-20 h-20 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mb-6">
                <Music className="w-10 h-10 text-emerald-400" />
              </div>
              <h3 className="font-semibold text-base mb-4 font-mono">{filename}</h3>
              <audio src={mediaUrl} controls className="w-full max-w-md" />
            </div>
          )}
        </div>
      </div>

      {/* Bottom Status Bar */}
      <div className={`h-6 px-3 border-t flex items-center justify-between text-[10px] font-mono shrink-0 ${
        isDark ? "bg-neutral-950 border-neutral-800 text-neutral-400" : "bg-neutral-50 border-neutral-200 text-neutral-500"
      }`}>
        <div>{size && <span>File Size: {Math.round(size / 1024)} KB</span>}</div>
        <div>HTML5 Media Engine</div>
      </div>
    </div>
  );
};
export default MediaViewer;
