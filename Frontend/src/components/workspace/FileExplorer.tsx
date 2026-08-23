import React, { useState, useMemo, useRef } from "react";
import {
  FilePlus,
  FolderPlus,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  Trash2,
  Edit2,
  Search,
  FolderMinus,
  FileCode,
  Upload,
  Download,
  X,
} from "lucide-react";
import { FileIcon } from "./FileIcon";
import { type WorkspaceFile, type FileTreeNode } from "../../types/workspace";
import { useTheme } from "../../context/ThemeContext";

interface FileExplorerProps {
  files: WorkspaceFile[];
  activeFileId: string | null;
  onSelectFile: (file: WorkspaceFile) => void;
  onCreateFile: (name: string, path: string) => Promise<void>;
  onCreateFolder: (name: string, path: string) => Promise<void>;
  onRenameFile: (fileId: string, newName: string) => Promise<void>;
  onDeleteFile: (fileId: string) => Promise<void>;
  onUploadFiles?: (uploaded: { name: string; path: string; content: string }[]) => Promise<void>;
  onDownloadFile?: (file: WorkspaceFile) => void;
  onRefreshFiles: () => Promise<void>;
  projectName: string;
}

export const FileExplorer: React.FC<FileExplorerProps> = ({
  files,
  activeFileId,
  onSelectFile,
  onCreateFile,
  onCreateFolder,
  onRenameFile,
  onDeleteFile,
  onUploadFiles,
  onDownloadFile,
  onRefreshFiles,
  projectName,
}) => {
  const { isDark } = useTheme();
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(
    new Set()
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [creatingType, setCreatingType] = useState<"file" | "folder" | null>(
    null
  );
  const [creatingParentPath, setCreatingParentPath] = useState<string>("");
  const [newItemName, setNewItemName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fileTree = useMemo(() => {
    const root: FileTreeNode[] = [];
    const map: { [path: string]: FileTreeNode } = {};

    const sorted = [...files].sort((a, b) => {
      if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
      return a.path.localeCompare(b.path);
    });

    sorted.forEach((file) => {
      const cleanPath = file.path.startsWith("/")
        ? file.path.slice(1)
        : file.path;
      const parts = cleanPath.split("/").filter(Boolean);

      let currentPath = "";
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const prevPath = currentPath;
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        const isLeaf = i === parts.length - 1;

        if (!map[currentPath]) {
          const newNode: FileTreeNode = {
            id: isLeaf ? file._id : currentPath,
            name: part,
            path: `/${currentPath}`,
            type: isLeaf ? file.type : "directory",
            children: isLeaf && file.type === "file" ? undefined : [],
            file: isLeaf ? file : undefined,
          };
          map[currentPath] = newNode;

          if (prevPath && map[prevPath]) {
            if (!map[prevPath].children) map[prevPath].children = [];
            map[prevPath].children!.push(newNode);
          } else {
            root.push(newNode);
          }
        }
      }
    });

    return root;
  }, [files]);

  const filteredFiles = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase();
    return files.filter(
      (f) =>
        f.type === "file" &&
        (f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q))
    );
  }, [files, searchQuery]);

  const toggleFolder = (path: string) => {
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const collapseAllFolders = () => {
    const allFolderPaths = new Set<string>();
    const collectPaths = (nodes: FileTreeNode[]) => {
      nodes.forEach((n) => {
        if (n.type === "directory") {
          allFolderPaths.add(n.path);
          if (n.children) collectPaths(n.children);
        }
      });
    };
    collectPaths(fileTree);
    setCollapsedFolders(allFolderPaths);
  };

  const handleStartCreate = (type: "file" | "folder", parentPath: string) => {
    setCreatingType(type);
    setCreatingParentPath(parentPath);
    setNewItemName("");
    if (parentPath && collapsedFolders.has(parentPath)) {
      toggleFolder(parentPath);
    }
  };

  const handleFinishCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim() || !creatingType) {
      setCreatingType(null);
      return;
    }

    const cleanName = newItemName.trim();
    const cleanParent = creatingParentPath.endsWith("/")
      ? creatingParentPath
      : creatingParentPath
      ? `${creatingParentPath}/`
      : "/";
    const fullPath = `${cleanParent}${cleanName}`;

    try {
      if (creatingType === "file") {
        await onCreateFile(cleanName, fullPath);
      } else {
        await onCreateFolder(cleanName, fullPath);
      }
    } finally {
      setCreatingType(null);
      setNewItemName("");
    }
  };

  const handleStartRename = (file: WorkspaceFile) => {
    setRenamingId(file._id);
    setRenameValue(file.name);
  };

  const handleFinishRename = async (fileId: string) => {
    if (!renameValue.trim() || renameValue === files.find((f) => f._id === fileId)?.name) {
      setRenamingId(null);
      return;
    }

    try {
      await onRenameFile(fileId, renameValue.trim());
    } finally {
      setRenamingId(null);
      setRenameValue("");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !onUploadFiles) return;

    const uploadedList: { name: string; path: string; content: string }[] = [];
    for (let i = 0; i < e.target.files.length; i++) {
      const file = e.target.files[i];
      const text = await file.text();
      uploadedList.push({
        name: file.name,
        path: `/${file.name}`,
        content: text,
      });
    }

    if (uploadedList.length > 0) {
      await onUploadFiles(uploadedList);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefreshFiles();
    } finally {
      setIsRefreshing(false);
    }
  };

  const renderNode = (node: FileTreeNode, depth: number = 0) => {
    const isFolder = node.type === "directory";
    const isCollapsed = collapsedFolders.has(node.path);
    const isActive = node.file && node.file._id === activeFileId;
    const isRenaming = renamingId === node.id;

    return (
      <div key={node.id} className="select-none font-mono">
        <div
          onClick={() => {
            if (isFolder) toggleFolder(node.path);
            else if (node.file) onSelectFile(node.file);
          }}
          style={{ paddingLeft: `${depth * 14 + 10}px` }}
          className={`group flex items-center justify-between py-1.5 pr-2 rounded-lg text-xs cursor-pointer transition-colors ${
            isActive
              ? isDark
                ? "bg-blue-500/20 text-blue-300 font-semibold border-l-2 border-blue-500 shadow-2xs"
                : "bg-blue-100/70 text-blue-900 font-semibold border-l-2 border-blue-600 shadow-2xs"
              : isDark
              ? "text-neutral-300 hover:bg-neutral-900 hover:text-white"
              : "text-neutral-700 hover:bg-neutral-200/60 hover:text-black"
          }`}
        >
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            {isFolder ? (
              <span className={isDark ? "text-neutral-500" : "text-neutral-400"}>
                {isCollapsed ? (
                  <ChevronRight className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </span>
            ) : (
              <span className="w-3.5" />
            )}

            <FileIcon
              name={node.name}
              type={node.type}
              isOpen={!isCollapsed}
              className="w-4 h-4 shrink-0"
            />

            {isRenaming ? (
              <input
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={() => handleFinishRename(node.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleFinishRename(node.id);
                  if (e.key === "Escape") setRenamingId(null);
                }}
                autoFocus
                onClick={(e) => e.stopPropagation()}
                className={`px-1.5 py-0.5 border border-blue-500 rounded text-xs outline-none w-full shadow-xs ${
                  isDark ? "bg-black text-white" : "bg-white text-black"
                }`}
              />
            ) : (
              <span className="truncate">{node.name}</span>
            )}
          </div>

          {!isRenaming && (
            <div
              className={`hidden group-hover:flex items-center gap-1 ${isDark ? "text-neutral-400" : "text-neutral-500"}`}
              onClick={(e) => e.stopPropagation()}
            >
              {isFolder && (
                <>
                  <button
                    onClick={() => handleStartCreate("file", node.path)}
                    title="New File inside folder"
                    className={`p-1 rounded ${isDark ? "hover:text-white hover:bg-neutral-800" : "hover:text-black hover:bg-neutral-200"}`}
                  >
                    <FilePlus className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => handleStartCreate("folder", node.path)}
                    title="New Folder inside folder"
                    className={`p-1 rounded ${isDark ? "hover:text-white hover:bg-neutral-800" : "hover:text-black hover:bg-neutral-200"}`}
                  >
                    <FolderPlus className="w-3 h-3" />
                  </button>
                </>
              )}

              {node.file && onDownloadFile && (
                <button
                  onClick={() => onDownloadFile(node.file!)}
                  title="Download File"
                  className={`p-1 rounded ${isDark ? "hover:text-white hover:bg-neutral-800" : "hover:text-black hover:bg-neutral-200"}`}
                >
                  <Download className="w-3 h-3" />
                </button>
              )}

              {node.file && (
                <button
                  onClick={() => handleStartRename(node.file!)}
                  title="Rename"
                  className={`p-1 rounded ${isDark ? "hover:text-white hover:bg-neutral-800" : "hover:text-black hover:bg-neutral-200"}`}
                >
                  <Edit2 className="w-3 h-3" />
                </button>
              )}

              <button
                onClick={() => onDeleteFile(node.id)}
                title="Delete"
                className={`p-1 rounded ${isDark ? "hover:text-rose-400 hover:bg-rose-500/10" : "hover:text-rose-600 hover:bg-rose-50"}`}
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {isFolder && !isCollapsed && (
          <div>
            {creatingType && creatingParentPath === node.path && (
              <form
                onSubmit={handleFinishCreate}
                style={{ paddingLeft: `${(depth + 1) * 14 + 10}px` }}
                className="py-1 pr-2 flex items-center gap-1.5"
              >
                <FileIcon
                  name={newItemName || "untitled"}
                  type={creatingType === "folder" ? "directory" : "file"}
                  className="w-3.5 h-3.5 text-blue-500"
                />
                <input
                  type="text"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder={
                    creatingType === "file" ? "filename.tsx" : "folder-name"
                  }
                  autoFocus
                  onBlur={() => setCreatingType(null)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setCreatingType(null);
                  }}
                  className={`px-1.5 py-0.5 border border-blue-500 rounded text-xs outline-none w-full shadow-xs ${
                    isDark ? "bg-black text-white" : "bg-white text-black"
                  }`}
                />
              </form>
            )}

            {node.children &&
              node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`h-full flex flex-col select-none overflow-hidden border-r transition-colors duration-150 ${
      isDark ? "bg-neutral-950 text-neutral-300 border-neutral-800" : "bg-white text-neutral-700 border-neutral-200"
    }`}>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileUpload}
        className="hidden"
      />

      <div className={`px-3 py-2.5 flex items-center justify-between border-b ${
        isDark ? "bg-neutral-950 border-neutral-800" : "bg-neutral-50/70 border-neutral-200"
      }`}>
        <span className={`text-[11px] font-bold tracking-wider uppercase ${isDark ? "text-neutral-400" : "text-neutral-500"}`}>
          Explorer
        </span>

        <div className="flex items-center gap-1">
          <button
            onClick={() => handleStartCreate("file", "")}
            className={`p-1 rounded transition-colors cursor-pointer ${
              isDark ? "text-neutral-400 hover:text-white hover:bg-neutral-800" : "text-neutral-500 hover:text-black hover:bg-neutral-200"
            }`}
            title="New File at root"
          >
            <FilePlus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleStartCreate("folder", "")}
            className={`p-1 rounded transition-colors cursor-pointer ${
              isDark ? "text-neutral-400 hover:text-white hover:bg-neutral-800" : "text-neutral-500 hover:text-black hover:bg-neutral-200"
            }`}
            title="New Folder at root"
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </button>
          {onUploadFiles && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className={`p-1 rounded transition-colors cursor-pointer ${
                isDark ? "text-neutral-400 hover:text-white hover:bg-neutral-800" : "text-neutral-500 hover:text-black hover:bg-neutral-200"
              }`}
              title="Upload Local Files into Project"
            >
              <Upload className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={handleRefresh}
            className={`p-1 rounded transition-colors cursor-pointer ${
              isDark ? "text-neutral-400 hover:text-white hover:bg-neutral-800" : "text-neutral-500 hover:text-black hover:bg-neutral-200"
            }`}
            title="Refresh Explorer"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-blue-500" : ""}`}
            />
          </button>
          <button
            onClick={collapseAllFolders}
            className={`p-1 rounded transition-colors cursor-pointer ${
              isDark ? "text-neutral-400 hover:text-white hover:bg-neutral-800" : "text-neutral-500 hover:text-black hover:bg-neutral-200"
            }`}
            title="Collapse All Folders"
          >
            <FolderMinus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className={`px-3 py-1.5 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider border-b ${
        isDark ? "bg-black border-neutral-800 text-neutral-300" : "bg-neutral-100/70 border-neutral-200 text-neutral-700"
      }`}>
        <span className="truncate">{projectName}</span>
        <button
          onClick={() => setShowSearch(!showSearch)}
          className={`p-0.5 rounded cursor-pointer ${
            showSearch ? "text-blue-500" : isDark ? "text-neutral-500 hover:text-white" : "text-neutral-400 hover:text-black"
          }`}
          title="Filter files"
        >
          <Search className="w-3 h-3" />
        </button>
      </div>

      {showSearch && (
        <div className={`p-2 border-b flex items-center gap-1.5 ${
          isDark ? "bg-neutral-900 border-neutral-800" : "bg-white border-neutral-200"
        }`}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter files by name..."
            className={`w-full px-2 py-1 border rounded text-xs outline-none focus:border-blue-500 ${
              isDark ? "bg-black border-neutral-700 text-white placeholder-neutral-500" : "bg-neutral-50 border-neutral-200 text-black placeholder-neutral-400"
            }`}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="p-1 text-neutral-400 hover:text-neutral-200 cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5 font-mono text-xs">
        {filteredFiles ? (
          <div>
            <p className={`px-2 py-1 text-[11px] ${isDark ? "text-neutral-400" : "text-neutral-500"}`}>
              {filteredFiles.length} matched files:
            </p>
            {filteredFiles.map((file) => (
              <div
                key={file._id}
                onClick={() => onSelectFile(file)}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer ${
                  file._id === activeFileId
                    ? isDark
                      ? "bg-blue-500/20 text-blue-300 font-semibold"
                      : "bg-blue-100 text-blue-900 font-semibold"
                    : isDark
                    ? "hover:bg-neutral-900 text-neutral-200"
                    : "hover:bg-neutral-200 text-neutral-800"
                }`}
              >
                <FileIcon name={file.name} type={file.type} className="w-4 h-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold">{file.name}</p>
                  <p className={`truncate text-[10px] ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>{file.path}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div>
            {creatingType && creatingParentPath === "" && (
              <form
                onSubmit={handleFinishCreate}
                className="px-2 py-1 flex items-center gap-1.5"
              >
                <FileIcon
                  name={newItemName || "untitled"}
                  type={creatingType === "folder" ? "directory" : "file"}
                  className="w-4 h-4 text-blue-500"
                />
                <input
                  type="text"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder={
                    creatingType === "file" ? "filename.tsx" : "folder-name"
                  }
                  autoFocus
                  onBlur={() => setCreatingType(null)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setCreatingType(null);
                  }}
                  className={`px-1.5 py-0.5 border border-blue-500 rounded text-xs outline-none w-full shadow-xs ${
                    isDark ? "bg-black text-white" : "bg-white text-black"
                  }`}
                />
              </form>
            )}

            {fileTree.map((node) => renderNode(node, 0))}

            {fileTree.length === 0 && !creatingType && (
              <div className={`py-8 text-center text-xs ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>
                <FileCode className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p>No files in workspace</p>
                <button
                  onClick={() => handleStartCreate("file", "")}
                  className="mt-2 text-blue-500 hover:underline font-semibold cursor-pointer"
                >
                  + Create first file
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
