import React, { useState, useRef } from "react";
import { createPortal } from "react-dom";
import JSZip from "jszip";
import {
  Upload,
  FolderUp,
  FileArchive,
  X,
  Trash2,
  Folder,
} from "lucide-react";
import { FileIcon } from "./FileIcon";
import { useTheme } from "../../context/ThemeContext";

interface UploadItem {
  id: string;
  name: string;
  path: string;
  content: string;
  size: number;
  type: "file" | "directory";
  isBinary: boolean;
  mimeType: string;
}

interface FileUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (items: { name: string; path: string; content: string; type: "file" | "directory" }[]) => Promise<void>;
  existingFolders: string[];
  initialTargetFolder?: string;
}

const BINARY_EXTENSIONS = new Set([
  "pdf",
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "svg",
  "ico",
  "bmp",
  "avif",
  "xlsx",
  "xls",
  "docx",
  "doc",
  "pptx",
  "ppt",
  "ppsx",
  "mp3",
  "wav",
  "ogg",
  "mp4",
  "webm",
  "zip",
  "tar",
  "gz",
  "woff",
  "woff2",
  "ttf",
  "eot",
]);

export const FileUploadModal: React.FC<FileUploadModalProps> = ({
  isOpen,
  onClose,
  onUpload,
  existingFolders = ["/"],
  initialTargetFolder = "/",
}) => {
  const { isDark } = useTheme();
  const [targetFolder, setTargetFolder] = useState<string>(initialTargetFolder || "/");
  const [itemsToUpload, setItemsToUpload] = useState<UploadItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const readFileContent = async (file: File): Promise<{ content: string; isBinary: boolean }> => {
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    const isBinary = BINARY_EXTENSIONS.has(ext);

    if (isBinary) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          resolve({
            content: reader.result as string,
            isBinary: true,
          });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    } else {
      const text = await file.text();
      return {
        content: text,
        isBinary: false,
      };
    }
  };

  const normalizeDestPath = (baseFolder: string, relativePath: string) => {
    const cleanBase = baseFolder.replace(/^\/+|\/+$/g, "");
    const cleanRel = relativePath.replace(/^\/+/, "");
    if (!cleanBase) {
      return `/${cleanRel}`;
    }
    return `/${cleanBase}/${cleanRel}`;
  };

  const handleFilesSelected = async (files: FileList | File[], baseRelativePath = "") => {
    setIsProcessing(true);
    try {
      const newItems: UploadItem[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        // If file has webkitRelativePath, use that, otherwise use baseRelativePath + file.name
        const relPath = file.webkitRelativePath || (baseRelativePath ? `${baseRelativePath}/${file.name}` : file.name);
        const fullDestPath = normalizeDestPath(targetFolder, relPath);

        const { content, isBinary } = await readFileContent(file);

        newItems.push({
          id: `${file.name}-${Date.now()}-${Math.random()}`,
          name: file.name,
          path: fullDestPath,
          content,
          size: file.size,
          type: "file",
          isBinary,
          mimeType: file.type || "application/octet-stream",
        });
      }

      setItemsToUpload((prev) => [...prev, ...newItems]);
    } catch (err) {
      console.error("Error processing files:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleZipSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      const zip = new JSZip();
      const zipContent = await zip.loadAsync(file);
      const newItems: UploadItem[] = [];

      for (const [relativePath, zipEntry] of Object.entries(zipContent.files)) {
        if (zipEntry.dir) {
          const dirDestPath = normalizeDestPath(targetFolder, relativePath.replace(/\/$/, ""));
          newItems.push({
            id: `dir-${relativePath}-${Date.now()}`,
            name: relativePath.split("/").filter(Boolean).pop() || "folder",
            path: dirDestPath,
            content: "",
            size: 0,
            type: "directory",
            isBinary: false,
            mimeType: "inode/directory",
          });
        } else {
          const filename = relativePath.split("/").pop() || "file";
          const ext = filename.split(".").pop()?.toLowerCase() || "";
          const isBinary = BINARY_EXTENSIONS.has(ext);

          let content = "";
          if (isBinary) {
            const base64 = await zipEntry.async("base64");
            const mime = ext === "pdf" ? "application/pdf" : ext === "png" ? "image/png" : "application/octet-stream";
            content = `data:${mime};base64,${base64}`;
          } else {
            content = await zipEntry.async("string");
          }

          const fileDestPath = normalizeDestPath(targetFolder, relativePath);
          newItems.push({
            id: `file-${relativePath}-${Date.now()}`,
            name: filename,
            path: fileDestPath,
            content,
            size: content.length,
            type: "file",
            isBinary,
            mimeType: isBinary ? "application/octet-stream" : "text/plain",
          });
        }
      }

      setItemsToUpload((prev) => [...prev, ...newItems]);
    } catch (err) {
      console.error("Failed to extract ZIP archive:", err);
    } finally {
      setIsProcessing(false);
      if (zipInputRef.current) zipInputRef.current.value = "";
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await handleFilesSelected(e.dataTransfer.files);
    }
  };

  const handleRemoveItem = (id: string) => {
    setItemsToUpload((prev) => prev.filter((i) => i.id !== id));
  };

  const handleClearAll = () => {
    setItemsToUpload([]);
  };

  const handleSubmit = async () => {
    if (itemsToUpload.length === 0) return;
    setIsSubmitting(true);
    try {
      const payload = itemsToUpload.map((i) => ({
        name: i.name,
        path: i.path,
        content: i.content,
        type: i.type,
      }));
      await onUpload(payload);
      setItemsToUpload([]);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      {/* Hidden inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={(e) => e.target.files && handleFilesSelected(e.target.files)}
        className="hidden"
      />
      <input
        ref={folderInputRef}
        type="file"
        // @ts-ignore
        webkitdirectory="true"
        directory="true"
        multiple
        onChange={(e) => e.target.files && handleFilesSelected(e.target.files)}
        className="hidden"
      />
      <input
        ref={zipInputRef}
        type="file"
        accept=".zip"
        onChange={handleZipSelected}
        className="hidden"
      />

      <div className={`w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-all duration-200 ${
        isDark
          ? "bg-neutral-950/95 backdrop-blur-xl border-neutral-800 text-neutral-200 shadow-black/80"
          : "bg-white/95 backdrop-blur-xl border-neutral-200 text-neutral-800 shadow-neutral-900/15"
      }`}>
        {/* Modal Header */}
        <div className={`px-6 py-4.5 border-b flex items-center justify-between shrink-0 ${
          isDark
            ? "bg-neutral-900/40 border-neutral-800/80"
            : "bg-neutral-50/80 border-neutral-200/80"
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 shrink-0">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight">Upload Files & Folders</h2>
              <p className={`text-xs ${isDark ? "text-neutral-400" : "text-neutral-500"}`}>
                Add code, documents, spreadsheets, slides, PDFs, or media to your workspace
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
              isDark
                ? "text-neutral-400 hover:text-white hover:bg-neutral-800"
                : "text-neutral-500 hover:text-black hover:bg-neutral-100"
            }`}
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {/* Target Folder Selector */}
          <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border transition-colors ${
            isDark
              ? "bg-neutral-900/50 border-neutral-800/80 text-neutral-200"
              : "bg-neutral-50 border-neutral-200/90 text-neutral-700"
          }`}>
            <div className="flex items-center gap-2.5 text-xs font-semibold">
              <div className={`p-1.5 rounded-lg ${isDark ? "bg-blue-500/15 text-blue-400" : "bg-blue-50 text-blue-600"}`}>
                <Folder className="w-4 h-4" />
              </div>
              <div>
                <span>Target Folder:</span>
                <span className={`block text-[11px] font-normal ${isDark ? "text-neutral-400" : "text-neutral-500"}`}>
                  Where uploaded files will be stored
                </span>
              </div>
            </div>
            <select
              value={targetFolder}
              onChange={(e) => setTargetFolder(e.target.value)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-semibold outline-none transition-all cursor-pointer ${
                isDark
                  ? "bg-neutral-900 border-neutral-700 text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  : "bg-white border-neutral-300 text-neutral-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              }`}
            >
              <option value="/">Workspace Root (/)</option>
              {existingFolders
                .filter((f) => f !== "/")
                .map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
            </select>
          </div>

          {/* Action Upload Tiles */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Pick Files */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className={`p-4 rounded-xl border flex flex-col items-center justify-center gap-2.5 text-center transition-all duration-200 group cursor-pointer ${
                isDark
                  ? "bg-neutral-900/40 border-neutral-800/90 hover:bg-blue-500/5 hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/5 text-neutral-300 hover:text-white"
                  : "bg-white border-neutral-200 hover:bg-blue-50/50 hover:border-blue-500 hover:shadow-lg hover:shadow-blue-500/10 text-neutral-700 hover:text-neutral-900"
              }`}
            >
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold">Select Files</p>
                <p className={`text-[10px] ${isDark ? "text-neutral-400" : "text-neutral-500"}`}>
                  PDF, Images, Code, Office
                </p>
              </div>
            </button>

            {/* Pick Folder */}
            <button
              onClick={() => folderInputRef.current?.click()}
              className={`p-4 rounded-xl border flex flex-col items-center justify-center gap-2.5 text-center transition-all duration-200 group cursor-pointer ${
                isDark
                  ? "bg-neutral-900/40 border-neutral-800/90 hover:bg-emerald-500/5 hover:border-emerald-500/50 hover:shadow-lg hover:shadow-emerald-500/5 text-neutral-300 hover:text-white"
                  : "bg-white border-neutral-200 hover:bg-emerald-50/50 hover:border-emerald-500 hover:shadow-lg hover:shadow-emerald-500/10 text-neutral-700 hover:text-neutral-900"
              }`}
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform">
                <FolderUp className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold">Upload Folder</p>
                <p className={`text-[10px] ${isDark ? "text-neutral-400" : "text-neutral-500"}`}>
                  Recursive directory tree
                </p>
              </div>
            </button>

            {/* Import ZIP */}
            <button
              onClick={() => zipInputRef.current?.click()}
              className={`p-4 rounded-xl border flex flex-col items-center justify-center gap-2.5 text-center transition-all duration-200 group cursor-pointer ${
                isDark
                  ? "bg-neutral-900/40 border-neutral-800/90 hover:bg-purple-500/5 hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/5 text-neutral-300 hover:text-white"
                  : "bg-white border-neutral-200 hover:bg-purple-50/50 hover:border-purple-500 hover:shadow-lg hover:shadow-purple-500/10 text-neutral-700 hover:text-neutral-900"
              }`}
            >
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-500 group-hover:scale-110 transition-transform">
                <FileArchive className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold">Import ZIP Archive</p>
                <p className={`text-[10px] ${isDark ? "text-neutral-400" : "text-neutral-500"}`}>
                  Extracts full file archive
                </p>
              </div>
            </button>
          </div>

          {/* Drag and Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all flex flex-col items-center justify-center gap-2.5 cursor-pointer ${
              isDragging
                ? "border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/10 scale-[1.01]"
                : isDark
                ? "border-neutral-800 bg-neutral-950/40 hover:border-neutral-700 hover:bg-neutral-900/30"
                : "border-neutral-300 bg-neutral-50/60 hover:border-neutral-400 hover:bg-neutral-50"
            }`}
          >
            <div className={`p-3 rounded-full ${isDragging ? "bg-blue-500/20 text-blue-400" : isDark ? "bg-neutral-900 text-neutral-400" : "bg-white text-neutral-500 shadow-xs"}`}>
              <Upload className={`w-6 h-6 ${isDragging ? "animate-bounce" : ""}`} />
            </div>
            <div>
              <p className="text-xs font-bold">
                {isDragging ? "Drop files now to add to workspace" : "Drag & Drop files or folders here"}
              </p>
              <p className={`text-[11px] mt-0.5 ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>
                Auto-detects documents, spreadsheets, slides, PDFs, media, and source code
              </p>
            </div>
          </div>

          {/* Queue List */}
          {itemsToUpload.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs px-1">
                <span className="font-bold flex items-center gap-1.5">
                  <span>Queued Items</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                    isDark ? "bg-blue-500/15 text-blue-400" : "bg-blue-50 text-blue-700"
                  }`}>
                    {itemsToUpload.length}
                  </span>
                </span>
                <button
                  onClick={handleClearAll}
                  className="text-rose-400 hover:text-rose-300 hover:underline text-[11px] font-semibold cursor-pointer"
                >
                  Clear all
                </button>
              </div>

              <div className={`max-h-48 overflow-y-auto rounded-xl border divide-y ${
                isDark
                  ? "bg-neutral-900/60 border-neutral-800 divide-neutral-800/80"
                  : "bg-white border-neutral-200 divide-neutral-100"
              }`}>
                {itemsToUpload.map((item) => (
                  <div key={item.id} className="p-2.5 flex items-center justify-between gap-2.5 text-xs">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <FileIcon name={item.name} type={item.type} className="w-4 h-4 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold truncate text-xs">{item.name}</p>
                        <p className={`text-[10px] font-mono truncate ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>
                          {item.path}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                        isDark ? "bg-neutral-800 text-neutral-400" : "bg-neutral-100 text-neutral-600"
                      }`}>
                        {formatBytes(item.size)}
                      </span>
                      <button
                        onClick={() => handleRemoveItem(item.id)}
                        className="p-1 text-neutral-400 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors cursor-pointer"
                        title="Remove from queue"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isProcessing && (
            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs flex items-center gap-2.5">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0" />
              <span>Processing and encoding files for CloudForge workspace...</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className={`px-6 py-4 border-t flex items-center justify-between shrink-0 ${
          isDark
            ? "bg-neutral-900/60 border-neutral-800/80"
            : "bg-neutral-50/90 border-neutral-200/80"
        }`}>
          <span className={`text-xs font-medium ${isDark ? "text-neutral-400" : "text-neutral-600"}`}>
            {itemsToUpload.length} item{itemsToUpload.length !== 1 ? "s" : ""} ready to upload
          </span>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className={`px-4 py-2 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                isDark
                  ? "border-neutral-800 text-neutral-300 hover:bg-neutral-900 hover:text-white"
                  : "border-neutral-300 text-neutral-800 hover:bg-neutral-100 hover:text-black"
              }`}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={itemsToUpload.length === 0 || isSubmitting}
              className={`px-5 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition-all ${
                itemsToUpload.length > 0 && !isSubmitting
                  ? "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md shadow-blue-500/25 active:scale-95 cursor-pointer"
                  : isDark
                  ? "bg-neutral-800 text-neutral-500 border border-neutral-800 cursor-not-allowed"
                  : "bg-neutral-200 text-neutral-500 border border-neutral-300 cursor-not-allowed"
              }`}
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span className="text-white font-bold">Uploading to Workspace...</span>
                </>
              ) : (
                <>
                  <Upload className={`w-3.5 h-3.5 ${itemsToUpload.length > 0 ? "text-white" : isDark ? "text-neutral-500" : "text-neutral-500"}`} />
                  <span className={itemsToUpload.length > 0 ? "text-white font-bold" : isDark ? "text-neutral-500" : "text-neutral-500 font-semibold"}>
                    Upload {itemsToUpload.length > 0 ? `(${itemsToUpload.length})` : ""}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
export default FileUploadModal;
