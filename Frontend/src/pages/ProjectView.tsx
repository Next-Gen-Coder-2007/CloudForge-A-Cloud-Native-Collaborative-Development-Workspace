import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import JSZip from "jszip";
import API_URL from "../config/api";
import { useAlert } from "../hooks/useAlert";
import { useTheme } from "../context/ThemeContext";
import LoadingSpinner from "../components/ui/LoadingSpinner";
import { type Project } from "../types/project";
import {
  type WorkspaceFile,
  type GitCommit,
  type EditorTab,
  type ActivityBarTab,
} from "../types/workspace";

import { WorkspaceNavbar } from "../components/workspace/WorkspaceNavbar";
import { ActivityBar } from "../components/workspace/ActivityBar";
import { FileExplorer } from "../components/workspace/FileExplorer";
import { SourceControlPanel } from "../components/workspace/SourceControlPanel";
import { VCSHistoryPanel } from "../components/workspace/VCSHistoryPanel";
import { SearchPanel } from "../components/workspace/SearchPanel";
import { ProjectSettingsPanel } from "../components/workspace/ProjectSettingsPanel";
import { CodeEditor } from "../components/workspace/CodeEditor";
import { DiffViewer } from "../components/workspace/DiffViewer";
import { StatusBar } from "../components/workspace/StatusBar";
import { BranchManagerModal } from "../components/workspace/BranchManagerModal";
import { CommitDetailsModal } from "../components/workspace/CommitDetailsModal";
import { UnsavedChangesModal } from "../components/workspace/UnsavedChangesModal";
import { ConflictResolverModal } from "../components/workspace/ConflictResolverModal";
import { StashModal } from "../components/workspace/StashModal";
import { CommitCompareModal } from "../components/workspace/CommitCompareModal";
import { FileBlameModal } from "../components/workspace/FileBlameModal";
import { EnvVariablesPanel } from "../components/workspace/EnvVariablesPanel";
import { DeploymentPanel } from "../components/workspace/DeploymentPanel";
import { BottomPanel } from "../components/workspace/BottomPanel";
import { PreviewPanel } from "../components/workspace/PreviewPanel";
import { vcsService } from "../services/vcsService";
import { containerService } from "../services/containerService";
import { type ContainerInfo, type DockerStatus, type CloudRunnerStatus } from "../types/container";

export default function ProjectView() {
  const { id } = useParams<{ id: string }>();
  const { showError, showSuccess } = useAlert();
  const { isDark } = useTheme();

  const [project, setProject] = useState<Project | null>(null);
  const [cloudRunner, setCloudRunner] = useState<CloudRunnerStatus | null>(null);
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [commits, setCommits] = useState<GitCommit[]>([]);
  const [currentBranch, setCurrentBranch] = useState<string>("main");
  const [branches, setBranches] = useState<string[]>(["main"]);
  const [loading, setLoading] = useState(true);

  const [tabs, setTabs] = useState<EditorTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Unsaved changes confirmation states
  const [closeTabPending, setCloseTabPending] = useState<string | null>(null);
  const [commitPending, setCommitPending] = useState<{
    message: string;
    stagedOnly: boolean;
  } | null>(null);

  const [activeActivityTab, setActiveActivityTab] =
    useState<ActivityBarTab>("explorer");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Bottom Terminal & Execution Panel States
  const [isTerminalOpen, setIsTerminalOpen] = useState<boolean>(() => {
    const saved = localStorage.getItem("cf_terminal_open");
    return saved !== null ? saved === "true" : true;
  });
  const [terminalHeight, setTerminalHeight] = useState<number>(() => {
    const saved = localStorage.getItem("cf_terminal_height");
    return saved ? Math.max(120, parseInt(saved, 10)) : 230;
  });
  const [containerInfo, setContainerInfo] = useState<ContainerInfo | null>(null);
  const [dockerStatus, setDockerStatus] = useState<DockerStatus | null>(null);

  useEffect(() => {
    localStorage.setItem("cf_terminal_open", isTerminalOpen.toString());
  }, [isTerminalOpen]);

  useEffect(() => {
    localStorage.setItem("cf_terminal_height", terminalHeight.toString());
  }, [terminalHeight]);

  // Global Keyboard Shortcuts (Ctrl+` or Cmd+` to toggle terminal)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "`") {
        e.preventDefault();
        setIsTerminalOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Split Live Web App Preview State
  const [isPreviewSplitOpen, setIsPreviewSplitOpen] = useState<boolean>(() => {
    const saved = localStorage.getItem("cf_preview_split_open");
    return saved === "true";
  });
  const [previewSplitWidth, setPreviewSplitWidth] = useState<number>(() => {
    const saved = localStorage.getItem("cf_preview_split_width");
    return saved ? Math.max(25, Math.min(75, parseInt(saved, 10))) : 48;
  });
  const [isResizingPreview, setIsResizingPreview] = useState(false);

  useEffect(() => {
    localStorage.setItem("cf_preview_split_open", isPreviewSplitOpen.toString());
  }, [isPreviewSplitOpen]);

  useEffect(() => {
    localStorage.setItem("cf_preview_split_width", previewSplitWidth.toString());
  }, [previewSplitWidth]);

  const handleMouseDownPreviewResize = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingPreview(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingPreview) return;
      const totalWidth = window.innerWidth;
      const rightDistance = totalWidth - e.clientX;
      const percent = Math.max(20, Math.min(80, (rightDistance / totalWidth) * 100));
      setPreviewSplitWidth(Math.round(percent));
    };

    const handleMouseUp = () => {
      setIsResizingPreview(false);
    };

    if (isResizingPreview) {
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizingPreview]);

  // Fetch Container Status
  const refreshContainerState = useCallback(async () => {
    if (!id) return;
    try {
      const data = await containerService.getStatus(id);
      setDockerStatus(data.docker);
      setContainerInfo(data.container);
      if (data.cloudRunner) {
        setCloudRunner(data.cloudRunner);
      }
    } catch {
      // ignore
    }
  }, [id]);

  useEffect(() => {
    refreshContainerState();
    const interval = setInterval(refreshContainerState, 10000);
    return () => clearInterval(interval);
  }, [refreshContainerState]);

  // Dynamic Sidebar Resizing (VS Code style)
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    const saved = localStorage.getItem("cf_sidebar_width");
    return saved ? Math.max(200, parseInt(saved, 10)) : 290;
  });
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);

  useEffect(() => {
    localStorage.setItem("cf_sidebar_width", sidebarWidth.toString());
  }, [sidebarWidth]);

  const handleMouseDownResize = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingSidebar(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingSidebar) return;
      // 48px is the width of the fixed ActivityBar
      const activityBarWidth = 48;
      const newWidth = Math.max(200, Math.min(650, e.clientX - activityBarWidth));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizingSidebar(false);
    };

    if (isResizingSidebar) {
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizingSidebar]);

  const handleToggleActivityTab = (tab: ActivityBarTab) => {
    if (activeActivityTab === tab) {
      setIsSidebarOpen((prev) => !prev);
    } else {
      setActiveActivityTab(tab);
      setIsSidebarOpen(true);
    }
  };

  const [changedFiles, setChangedFiles] = useState<
    {
      file: WorkspaceFile;
      status: "modified" | "added" | "deleted";
      staged: boolean;
    }[]
  >([]);

  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
  const [isStashModalOpen, setIsStashModalOpen] = useState(false);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  const [conflictModalData, setConflictModalData] = useState<{
    sourceBranch: string;
    targetBranch: string;
    conflictFiles: any[];
  } | null>(null);
  const [fileBlameTarget, setFileBlameTarget] = useState<{
    path: string;
    name: string;
  } | null>(null);
  const [selectedCommit, setSelectedCommit] = useState<GitCommit | null>(null);
  const [diffTarget, setDiffTarget] = useState<{
    filename: string;
    filepath: string;
    originalContent?: string;
    modifiedContent?: string;
    fileId?: string;
  } | null>(null);

  const loadWorkspace = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`${API_URL}/api/projects/${id}/workspace`, {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to load workspace");
      }

      setProject(data.project);
      setFiles(data.files || []);
      setCommits(data.commits || []);
      setCurrentBranch(data.currentBranch || data.project?.currentBranch || "main");
      setBranches(data.branches || data.project?.branches || ["main"]);
    } catch (err: any) {
      showError(err.message || "Failed to initialize workspace");
    } finally {
      setLoading(false);
    }
  }, [id, showError]);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  useEffect(() => {
    if (files.length > 0 && tabs.length === 0) {
      const firstCodeFile = files.find(
        (f) =>
          f.type === "file" &&
          (f.name.endsWith(".tsx") ||
            f.name.endsWith(".jsx") ||
            f.name.endsWith(".ts") ||
            f.name.endsWith(".js") ||
            f.name.endsWith(".py") ||
            f.name.endsWith(".html") ||
            f.name.endsWith(".json"))
      ) || files.find((f) => f.type === "file");

      if (firstCodeFile) {
        setTabs([
          {
            fileId: firstCodeFile._id,
            name: firstCodeFile.name,
            path: firstCodeFile.path,
            language: firstCodeFile.language,
            content: firstCodeFile.content || "",
            initialContent: firstCodeFile.content || "",
            isDirty: false,
          },
        ]);
        setActiveTabId(firstCodeFile._id);
      }
    }
  }, [files]);

  // Source Control changes: compare current files (and active tab edits) against the latest VCS commit
  useEffect(() => {
    const lastCommit = commits && commits.length > 0 ? commits[0] : null;
    const lastSnapshot = lastCommit?.filesSnapshot || [];
    const snapshotMap = new Map<string, { path: string; name: string; content: string }>(
      lastSnapshot.map((s) => [s.path || s.name, s])
    );

    const changes: {
      file: WorkspaceFile;
      status: "modified" | "added" | "deleted";
      staged: boolean;
    }[] = [];

    // Map open tab contents over files
    const currentFiles = files.map((f) => {
      const openTab = tabs.find((t) => t.fileId === f._id);
      return openTab ? { ...f, content: openTab.content } : f;
    });

    if (!lastCommit) {
      // If there are no commits yet, track files modified or created in workspace
      currentFiles.forEach((curr) => {
        if (curr.type === "directory") return;
        const openTab = tabs.find((t) => t.fileId === curr._id);
        const isModified = openTab ? openTab.isDirty : false;
        changes.push({
          file: curr,
          status: isModified ? "modified" : "added",
          staged: false,
        });
      });
    } else {
      // Check modified & added against last VCS commit
      currentFiles.forEach((curr) => {
        if (curr.type === "directory") return;
        const snap = snapshotMap.get(curr.path || curr.name);

        if (!snap) {
          changes.push({
            file: curr,
            status: "added",
            staged: false,
          });
        } else if (snap.content !== curr.content) {
          changes.push({
            file: curr,
            status: "modified",
            staged: false,
          });
        }
      });

      // Check deleted
      lastSnapshot.forEach((snap) => {
        if (snap.type === "directory") return;
        const exists = currentFiles.some((f) => (f.path || f.name) === (snap.path || snap.name));
        if (!exists) {
          changes.push({
            file: {
              _id: `deleted-${snap.path || snap.name}`,
              projectId: id || "",
              name: snap.name,
              path: snap.path,
              type: "file",
              content: snap.content,
              language: snap.language || "text",
              size: snap.size || 0,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            status: "deleted",
            staged: false,
          });
        }
      });
    }

    setChangedFiles((prev) => {
      const stagedSet = new Set(prev.filter((p) => p.staged).map((p) => p.file._id));
      return changes.map((c) => ({
        ...c,
        staged: stagedSet.has(c.file._id),
      }));
    });
  }, [tabs, files, commits, id]);

  const handleSelectFile = (file: WorkspaceFile) => {
    if (file.type === "directory") return;

    const existing = tabs.find((t) => t.fileId === file._id);
    if (existing) {
      setActiveTabId(file._id);
    } else {
      const newTab: EditorTab = {
        fileId: file._id,
        name: file.name,
        path: file.path,
        language: file.language,
        content: file.content || "",
        initialContent: file.content || "",
        isDirty: false,
      };
      setTabs((prev) => [...prev, newTab]);
      setActiveTabId(file._id);
    }

    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setIsMobileSidebarOpen(false);
    }
  };

  const executeCloseTab = (fileId: string) => {
    const nextTabs = tabs.filter((t) => t.fileId !== fileId);
    setTabs(nextTabs);

    if (activeTabId === fileId) {
      if (nextTabs.length > 0) {
        setActiveTabId(nextTabs[nextTabs.length - 1].fileId);
      } else {
        setActiveTabId(null);
      }
    }
  };

  const handleCloseTab = (fileId: string) => {
    const targetTab = tabs.find((t) => t.fileId === fileId);
    if (targetTab && targetTab.isDirty) {
      setCloseTabPending(fileId);
      return;
    }
    executeCloseTab(fileId);
  };

  const handleModalSaveAndClose = async () => {
    if (!closeTabPending) return;
    const fileId = closeTabPending;
    await handleSaveFile(fileId);
    executeCloseTab(fileId);
    setCloseTabPending(null);
  };

  const handleModalDontSaveAndClose = () => {
    if (!closeTabPending) return;
    const fileId = closeTabPending;
    const originalFile = files.find((f) => f._id === fileId);
    if (originalFile) {
      setTabs((prev) =>
        prev.map((t) =>
          t.fileId === fileId
            ? { ...t, content: originalFile.content || "", isDirty: false }
            : t
        )
      );
    }
    executeCloseTab(fileId);
    setCloseTabPending(null);
  };

  const handleContentChange = (fileId: string, newContent: string) => {
    setTabs((prev) =>
      prev.map((t) =>
        t.fileId === fileId
          ? {
              ...t,
              content: newContent,
              isDirty: newContent !== t.initialContent,
            }
          : t
      )
    );
  };

  const handleSaveFile = async (fileId: string, isSilent: boolean = false) => {
    const tab = tabs.find((t) => t.fileId === fileId);
    if (!tab) return;

    try {
      if (!isSilent) setIsSaving(true);
      const res = await fetch(
        `${API_URL}/api/projects/${id}/files/${fileId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ content: tab.content }),
        }
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to save file");
      }

      setTabs((prev) =>
        prev.map((t) =>
          t.fileId === fileId
            ? { ...t, initialContent: t.content, isDirty: false }
            : t
        )
      );

      setFiles((prev) =>
        prev.map((f) =>
          f._id === fileId ? { ...f, content: tab.content } : f
        )
      );

      // Only show success toast for explicit manual save (button click or Ctrl+S)
      if (!isSilent) {
        showSuccess(`Saved "${tab.name}"`);
      }
    } catch (err: any) {
      if (!isSilent) {
        showError(err.message || "Failed to save file");
      }
    } finally {
      if (!isSilent) setIsSaving(false);
    }
  };

  const handleCreateFile = async (name: string, path: string, content: string = "") => {
    try {
      const res = await fetch(`${API_URL}/api/projects/${id}/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, path, type: "file", content }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to create file");
      }

      setFiles((prev) => [...prev, data.file]);
      handleSelectFile(data.file);
      showSuccess(`Created "${name}"`);
    } catch (err: any) {
      showError(err.message || "Failed to create file");
    }
  };

  const handleCreateFolder = async (name: string, path: string) => {
    try {
      const res = await fetch(`${API_URL}/api/projects/${id}/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, path, type: "directory" }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to create folder");
      }

      setFiles((prev) => [...prev, data.file]);
      showSuccess(`Created folder "${name}"`);
    } catch (err: any) {
      showError(err.message || "Failed to create folder");
    }
  };

  const handleRenameFile = async (fileId: string, newName: string) => {
    try {
      const res = await fetch(
        `${API_URL}/api/projects/${id}/files/${fileId}/rename`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ newName }),
        }
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to rename");
      }

      if (data.files) {
        setFiles(data.files);
      } else {
        setFiles((prev) =>
          prev.map((f) => (f._id === fileId ? data.file : f))
        );
      }

      setTabs((prev) =>
        prev.map((t) =>
          t.fileId === fileId
            ? { ...t, name: data.file.name, path: data.file.path }
            : t
        )
      );

      showSuccess(`Renamed to "${newName}"`);
    } catch (err: any) {
      showError(err.message || "Failed to rename");
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    try {
      const res = await fetch(
        `${API_URL}/api/projects/${id}/files/${fileId}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to delete");
      }

      handleCloseTab(fileId);
      setFiles((prev) => prev.filter((f) => f._id !== fileId));
      showSuccess("Deleted successfully");
    } catch (err: any) {
      showError(err.message || "Failed to delete");
    }
  };

  const handleUploadFiles = async (
    uploadedFiles: { name: string; path: string; content: string; type?: "file" | "directory" }[]
  ) => {
    try {
      const res = await fetch(`${API_URL}/api/projects/${id}/files/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ files: uploadedFiles }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to upload files");
      }

      if (data.files) {
        setFiles(data.files);
      } else {
        await loadWorkspace();
      }

      showSuccess(`Uploaded ${uploadedFiles.length} item${uploadedFiles.length !== 1 ? "s" : ""}`);
    } catch (err: any) {
      showError(err.message || "Upload failed");
    }
  };

  const handleDownloadFile = (file: WorkspaceFile) => {
    let blob: Blob;
    const isDataUrl = typeof file.content === "string" && file.content.startsWith("data:");

    if (isDataUrl) {
      const mime = file.content.split(";")[0].replace("data:", "") || "application/octet-stream";
      const base64 = file.content.split(",")[1] || "";
      const byteChars = window.atob(base64);
      const byteNumbers = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteNumbers[i] = byteChars.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      blob = new Blob([byteArray], { type: mime });
    } else {
      blob = new Blob([file.content || ""], { type: "text/plain;charset=utf-8" });
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadZip = async () => {
    try {
      const zip = new JSZip();
      files
        .filter((f) => f.type === "file")
        .forEach((f) => {
          const cleanPath = f.path.startsWith("/") ? f.path.slice(1) : f.path;
          const isDataUrl = typeof f.content === "string" && f.content.startsWith("data:");

          if (isDataUrl) {
            const base64 = f.content.split(",")[1] || "";
            zip.file(cleanPath, base64, { base64: true });
          } else {
            zip.file(cleanPath, f.content || "");
          }
        });

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${project?.name || "workspace"}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showSuccess("Workspace downloaded as ZIP archive");
    } catch (err: any) {
      showError(err.message || "Failed to export ZIP");
    }
  };

  const handleStageFile = (fileId: string) => {
    setChangedFiles((prev) =>
      prev.map((c) => (c.file._id === fileId ? { ...c, staged: true } : c))
    );
  };

  const handleUnstageFile = (fileId: string) => {
    setChangedFiles((prev) =>
      prev.map((c) => (c.file._id === fileId ? { ...c, staged: false } : c))
    );
  };

  const handleStageAll = () => {
    setChangedFiles((prev) => prev.map((c) => ({ ...c, staged: true })));
  };

  const handleUnstageAll = () => {
    setChangedFiles((prev) => prev.map((c) => ({ ...c, staged: false })));
  };

  const handleDiscardChange = async (fileId: string) => {
    const file = files.find((f) => f._id === fileId);
    if (!file) return;

    const lastCommit = commits && commits.length > 0 ? commits[0] : null;
    const snap = lastCommit?.filesSnapshot?.find(
      (s: any) => (s.path || s.name) === (file.path || file.name)
    );
    const revertContent = snap ? snap.content : "";

    setTabs((prev) =>
      prev.map((t) =>
        t.fileId === fileId
          ? { ...t, content: revertContent, initialContent: revertContent, isDirty: false }
          : t
      )
    );

    try {
      await fetch(`${API_URL}/api/projects/${id}/files/${fileId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content: revertContent }),
      });
      setFiles((prev) =>
        prev.map((f) => (f._id === fileId ? { ...f, content: revertContent } : f))
      );
      showSuccess(`Discarded changes for "${file.name}"`);
    } catch (err: any) {
      showError(err.message || "Failed to discard changes");
    }
  };

  const handleInspectDiff = (file: WorkspaceFile) => {
    const tab = tabs.find((t) => t.fileId === file._id);
    const lastCommit = commits && commits.length > 0 ? commits[0] : null;
    const snap = lastCommit?.filesSnapshot?.find(
      (s: any) => (s.path || s.name) === (file.path || file.name)
    );
    const original = snap ? snap.content : files.find((f) => f._id === file._id)?.content || "";
    const modified = tab ? tab.content : file.content || "";

    setDiffTarget({
      filename: file.name,
      filepath: file.path,
      originalContent: original,
      modifiedContent: modified,
      fileId: file._id,
    });
  };

  const executeCommit = async (message: string, stagedOnly: boolean) => {
    if (!id) return;
    try {
      const stagedList = stagedOnly
        ? changedFiles.filter((c) => c.staged).map((c) => c.file)
        : null;

      const newCommit = await vcsService.createCommit(id, message, stagedList);
      setCommits((prev) => [newCommit, ...prev]);

      const committedIds = new Set(
        stagedOnly
          ? changedFiles.filter((c) => c.staged).map((c) => c.file._id)
          : changedFiles.map((c) => c.file._id)
      );

      setChangedFiles((prev) =>
        prev.filter((c) => !committedIds.has(c.file._id))
      );

      setTabs((prev) =>
        prev.map((t) =>
          committedIds.has(t.fileId)
            ? { ...t, initialContent: t.content, isDirty: false }
            : t
        )
      );

      showSuccess(`Created commit "${message}"`);
    } catch (err: any) {
      showError(err.message || "Failed to create commit");
    }
  };

  const handleCommit = async (message: string, stagedOnly: boolean) => {
    const dirtyTabs = tabs.filter((t) => t.isDirty);
    if (dirtyTabs.length > 0) {
      setCommitPending({ message, stagedOnly });
      return;
    }
    await executeCommit(message, stagedOnly);
  };

  const handleModalSaveAllAndCommit = async () => {
    if (!commitPending) return;
    const dirtyTabs = tabs.filter((t) => t.isDirty);
    for (const tab of dirtyTabs) {
      await handleSaveFile(tab.fileId);
    }
    const { message, stagedOnly } = commitPending;
    setCommitPending(null);
    await executeCommit(message, stagedOnly);
  };

  const handleModalCommitWithoutSaving = async () => {
    if (!commitPending) return;
    const { message, stagedOnly } = commitPending;
    setCommitPending(null);
    await executeCommit(message, stagedOnly);
  };

  const handleDiscardAll = () => {
    if (!window.confirm("Discard all uncommitted changes in the entire workspace?")) return;
    setTabs((prev) =>
      prev.map((t) => ({
        ...t,
        content: t.initialContent,
        isDirty: false,
      }))
    );
    setChangedFiles([]);
    setDiffTarget(null);
    showSuccess("Discarded all workspace modifications.");
  };

  const handleBranchSwitched = (
    newBranch: string,
    newBranches: string[],
    newFiles: WorkspaceFile[]
  ) => {
    setCurrentBranch(newBranch);
    setBranches(newBranches);
    if (newFiles && newFiles.length > 0) {
      setFiles(newFiles);
    }
    setTabs([]);
    setActiveTabId(null);
    setChangedFiles([]);
    setDiffTarget(null);
    showSuccess(`Switched workspace to branch "${newBranch}"`);
  };

  const handleMergeComplete = (mergeCommit: GitCommit, newFiles: WorkspaceFile[]) => {
    setCommits((prev) => [mergeCommit, ...prev]);
    setFiles(newFiles);
    setTabs([]);
    setActiveTabId(null);
    setChangedFiles([]);
    setDiffTarget(null);
    showSuccess(`Branch merge complete! Created merge commit ${mergeCommit.sha.substring(0, 7)}`);
  };

  const handleConflictDetected = (conflictData: any) => {
    setConflictModalData({
      sourceBranch: conflictData.sourceBranch,
      targetBranch: conflictData.targetBranch,
      conflictFiles: conflictData.conflictFiles || [],
    });
  };

  const handleFinalizeConflictMerge = async (resolvedFiles: any[]) => {
    if (!id || !conflictModalData) return;
    const res = await vcsService.finalizeMerge(
      id,
      conflictModalData.sourceBranch,
      conflictModalData.targetBranch,
      resolvedFiles
    );
    setConflictModalData(null);
    handleMergeComplete(res.mergeCommit, res.files);
  };

  const handleStashSaved = (newFiles: WorkspaceFile[]) => {
    if (newFiles && newFiles.length > 0) {
      setFiles(newFiles);
    }
    setTabs([]);
    setActiveTabId(null);
    setChangedFiles([]);
    setDiffTarget(null);
    showSuccess("Workspace stashed cleanly.");
  };

  const handleStashApplied = (newFiles: WorkspaceFile[]) => {
    if (newFiles && newFiles.length > 0) {
      setFiles(newFiles);
    }
    setTabs([]);
    setActiveTabId(null);
    setChangedFiles([]);
    setDiffTarget(null);
    showSuccess("Stash applied to workspace.");
  };

  const handleCherryPickComplete = (newFiles: WorkspaceFile[], newCommit: GitCommit) => {
    setCommits((prev) => [newCommit, ...prev]);
    if (newFiles && newFiles.length > 0) {
      setFiles(newFiles);
    }
    setTabs([]);
    setActiveTabId(null);
    setChangedFiles([]);
    setDiffTarget(null);
    showSuccess(`Cherry-picked commit ${newCommit.sha.substring(0, 7)} successfully`);
  };

  const handleRevertComplete = (newFiles: WorkspaceFile[], newCommit: GitCommit) => {
    setCommits((prev) => [newCommit, ...prev]);
    if (newFiles && newFiles.length > 0) {
      setFiles(newFiles);
    }
    setTabs([]);
    setActiveTabId(null);
    setChangedFiles([]);
    setDiffTarget(null);
    showSuccess(`Reverted commit ${newCommit.sha.substring(0, 7)} successfully`);
  };

  const handleOpenFileBlame = (filePath: string, fileName: string) => {
    setFileBlameTarget({ path: filePath, name: fileName });
  };

  const handleRollbackComplete = (newFiles: WorkspaceFile[], newCommit: GitCommit) => {
    setFiles(newFiles);
    setCommits((prev) => [newCommit, ...prev]);
    setTabs([]);
    setActiveTabId(null);
    setChangedFiles([]);
    setDiffTarget(null);
    showSuccess("Time-travel rollback complete! Workspace restored to commit snapshot.");
  };

  const isAnyTabDirty = tabs.some((t) => t.isDirty);
  const activeTab = tabs.find((t) => t.fileId === activeTabId);

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center transition-colors duration-150 ${
        isDark ? "bg-black text-white" : "bg-white text-black"
      }`}>
        <LoadingSpinner text="Initializing NebulaCode workspace..." fullScreen />
      </div>
    );
  }

  if (!project) return null;

  return (
    <div className={`h-screen w-screen flex flex-col overflow-hidden font-sans select-none relative transition-colors duration-150 ${
      isDark ? "bg-black text-white" : "bg-white text-black"
    }`}>
      <WorkspaceNavbar
        project={project}
        isDirty={isAnyTabDirty || changedFiles.length > 0}
        isSaving={isSaving}
        filesCount={files.filter((f) => f.type === "file").length}
        commitsCount={commits.length}
        onDownloadZip={handleDownloadZip}
        onToggleMobileSidebar={() => setIsMobileSidebarOpen((prev) => !prev)}
        isMobileSidebarOpen={isMobileSidebarOpen}
        onTogglePreview={() => setIsPreviewSplitOpen((prev) => !prev)}
        isPreviewOpen={isPreviewSplitOpen}
      />

      <div className="flex-1 flex overflow-hidden relative">
        {isMobileSidebarOpen && (
          <div
            onClick={() => setIsMobileSidebarOpen(false)}
            className="fixed inset-0 bg-black/80 backdrop-blur-xs z-30 md:hidden animate-in fade-in"
          />
        )}

        <div
          className={`fixed md:relative top-13 sm:top-14 md:top-0 bottom-6 md:bottom-0 left-0 z-40 md:z-auto flex h-[calc(100vh-theme(spacing.13)-theme(spacing.6))] sm:h-[calc(100vh-theme(spacing.14)-theme(spacing.6))] md:h-full shadow-2xl md:shadow-none transition-all duration-200 ease-in-out shrink-0 ${
            isDark ? "bg-black border-neutral-800" : "bg-white border-neutral-200"
          } ${
            isMobileSidebarOpen
              ? "translate-x-0"
              : "-translate-x-full md:translate-x-0"
          }`}
        >
          <ActivityBar
            activeTab={activeActivityTab}
            onChangeTab={handleToggleActivityTab}
            isSidebarOpen={isSidebarOpen}
            changedFilesCount={changedFiles.length}
            commitsCount={commits.length}
            envVariablesCount={project?.envVariables?.length || 0}
            onToggleTerminal={() => setIsTerminalOpen((prev) => !prev)}
            isTerminalOpen={isTerminalOpen}
          />

          <div
            style={{
              width: isSidebarOpen ? `${sidebarWidth}px` : "0px",
            }}
            className={`h-full border-r shrink-0 overflow-hidden flex flex-col ${
              isResizingSidebar ? "" : "transition-all duration-200 ease-in-out"
            } ${
              isSidebarOpen ? "opacity-100" : "w-0 border-r-0 opacity-0 pointer-events-none"
            } ${
              isDark ? "border-neutral-800 bg-neutral-950" : "border-neutral-200 bg-neutral-50"
            }`}
          >
            <div
              style={{ width: `${sidebarWidth}px` }}
              className="h-full w-full min-w-0 max-w-full flex flex-col overflow-hidden shrink-0"
            >
              {activeActivityTab === "explorer" && (
                <FileExplorer
                  files={files}
                  activeFileId={activeTabId}
                  onSelectFile={handleSelectFile}
                  onCreateFile={handleCreateFile}
                  onCreateFolder={handleCreateFolder}
                  onRenameFile={handleRenameFile}
                  onDeleteFile={handleDeleteFile}
                  onUploadFiles={handleUploadFiles}
                  onDownloadFile={handleDownloadFile}
                  onRefreshFiles={loadWorkspace}
                  projectName={project.name}
                  onCollapse={() => setIsSidebarOpen(false)}
                  onOpenFileBlame={handleOpenFileBlame}
                />
              )}

              {activeActivityTab === "sourceControl" && (
                <SourceControlPanel
                  project={project}
                  changedFiles={changedFiles}
                  currentBranch={currentBranch}
                  branches={branches}
                  onCommit={handleCommit}
                  onStageFile={handleStageFile}
                  onUnstageFile={handleUnstageFile}
                  onStageAll={handleStageAll}
                  onUnstageAll={handleUnstageAll}
                  onDiscardChange={handleDiscardChange}
                  onDiscardAll={handleDiscardAll}
                  onInspectDiff={handleInspectDiff}
                  onOpenBranchManager={() => setIsBranchModalOpen(true)}
                  onOpenStashModal={() => setIsStashModalOpen(true)}
                  onOpenCompareModal={() => setIsCompareModalOpen(true)}
                  onOpenFileBlame={handleOpenFileBlame}
                />
              )}

              {activeActivityTab === "history" && (
                <VCSHistoryPanel
                  projectId={project._id}
                  commits={commits}
                  currentBranch={currentBranch}
                  onCommitSelected={(c) => setSelectedCommit(c)}
                  onRollbackComplete={handleRollbackComplete}
                  onCherryPickComplete={handleCherryPickComplete}
                  onRevertComplete={handleRevertComplete}
                />
              )}

              {activeActivityTab === "search" && (
                <SearchPanel
                  files={files}
                  onSelectMatch={(file) => handleSelectFile(file)}
                />
              )}

              {activeActivityTab === "preview" && (
                <PreviewPanel
                  projectId={project._id}
                  projectName={project.name}
                  files={files}
                />
              )}

              {activeActivityTab === "env" && (
                <EnvVariablesPanel
                  project={project}
                  onUpdateProject={(updated) => setProject(updated)}
                />
              )}

              {activeActivityTab === "deploy" && (
                <DeploymentPanel projectName={project?.name} />
              )}

              {activeActivityTab === "settings" && (
                <ProjectSettingsPanel
                  project={project}
                  filesCount={files.filter((f) => f.type === "file").length}
                  commitsCount={commits.length}
                  onUpdateProject={(updated) => setProject(updated)}
                />
              )}
            </div>
          </div>

          {/* VS Code Interactive Drag Resize Handle */}
          {isSidebarOpen && (
            <div
              onMouseDown={handleMouseDownResize}
              onDoubleClick={() => setSidebarWidth(290)}
              className={`w-1 cursor-col-resize select-none h-full shrink-0 relative z-20 group transition-colors ${
                isResizingSidebar
                  ? "bg-blue-500 w-1.5 shadow-xs"
                  : isDark
                  ? "hover:bg-blue-500/70 bg-transparent"
                  : "hover:bg-blue-500/70 bg-transparent"
              }`}
              title="Drag to resize sidebar (Double click to reset to 280px)"
            >
              <div className="absolute inset-y-0 -left-1 -right-1 cursor-col-resize" />
            </div>
          )}
        </div>

        <div className={`flex-1 flex flex-row h-full overflow-hidden min-w-0 transition-colors duration-150 ${
          isDark ? "bg-black" : "bg-white"
        }`}>
          {/* Main Editor & Terminal Column */}
          <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
            <div className="flex-1 overflow-hidden">
              {diffTarget ? (
                <DiffViewer
                  filename={diffTarget.filename}
                  filepath={diffTarget.filepath}
                  originalContent={diffTarget.originalContent}
                  modifiedContent={diffTarget.modifiedContent}
                  onClose={() => setDiffTarget(null)}
                  onStageChange={
                    diffTarget.fileId
                      ? () => handleStageFile(diffTarget.fileId!)
                      : undefined
                  }
                />
              ) : (
                <CodeEditor
                  tabs={tabs}
                  activeTabId={activeTabId}
                  onSelectTab={(fileId) => setActiveTabId(fileId)}
                  onCloseTab={handleCloseTab}
                  onContentChange={handleContentChange}
                  onSaveFile={handleSaveFile}
                  projectName={project.name}
                  projectId={project._id}
                />
              )}
            </div>

            {/* CloudForge In-Container Interactive Terminal & Diagnostics Panel */}
            <BottomPanel
              projectId={project._id}
              projectName={project.name}
              isOpen={isTerminalOpen}
              onClose={() => setIsTerminalOpen(false)}
              height={terminalHeight}
              onHeightChange={(h) => setTerminalHeight(h)}
            />
          </div>

          {/* Split Screen Live Web Application Preview Pane */}
          {isPreviewSplitOpen && (
            <>
              {/* Center Draggable Resizing Divider */}
              <div
                onMouseDown={handleMouseDownPreviewResize}
                className={`w-1 cursor-col-resize select-none h-full shrink-0 relative z-20 group transition-colors ${
                  isResizingPreview
                    ? "bg-blue-500 w-1.5 shadow-xs"
                    : isDark
                    ? "hover:bg-blue-500/70 bg-neutral-800"
                    : "hover:bg-blue-500/70 bg-neutral-200"
                }`}
                title="Drag to resize split preview"
              >
                <div className="absolute inset-y-0 -left-1 -right-1 cursor-col-resize" />
              </div>

              {/* Live Preview Panel */}
              <div
                style={{ width: `${previewSplitWidth}%` }}
                className={`h-full flex flex-col overflow-hidden min-w-[320px] max-w-[85%] border-l shrink-0 ${
                  isDark ? "border-neutral-800" : "border-neutral-200"
                }`}
              >
                <PreviewPanel
                  projectId={project._id}
                  projectName={project.name}
                  files={files}
                  onClose={() => setIsPreviewSplitOpen(false)}
                />
              </div>
            </>
          )}
        </div>
      </div>

      <StatusBar
        currentBranch={currentBranch}
        changedFilesCount={changedFiles.length}
        activeLanguage={activeTab?.language || "Plain Text"}
        onOpenSourceControl={() => {
          setActiveActivityTab("sourceControl");
          if (typeof window !== "undefined" && window.innerWidth < 768) {
            setIsMobileSidebarOpen(true);
          }
        }}
        onToggleTerminal={() => setIsTerminalOpen((prev) => !prev)}
        isTerminalOpen={isTerminalOpen}
        containerRunning={containerInfo?.status === "running"}
        containerRuntime={containerInfo?.runtime?.displayName}
        dockerAvailable={dockerStatus?.available}
        cloudProvider={cloudRunner?.provider || "Cloud Engine"}
        cloudHosted={cloudRunner ? cloudRunner.cloudHosted : true}
      />

      <BranchManagerModal
        isOpen={isBranchModalOpen}
        onClose={() => setIsBranchModalOpen(false)}
        projectId={project._id}
        currentBranch={currentBranch}
        branches={branches}
        onBranchSwitched={handleBranchSwitched}
        onMergeComplete={handleMergeComplete}
        onConflictDetected={handleConflictDetected}
      />

      <CommitDetailsModal
        commit={selectedCommit}
        onClose={() => setSelectedCommit(null)}
      />

      <StashModal
        isOpen={isStashModalOpen}
        onClose={() => setIsStashModalOpen(false)}
        projectId={project._id}
        currentBranch={currentBranch}
        hasDirtyFiles={changedFiles.length > 0}
        onStashSaved={handleStashSaved}
        onStashApplied={handleStashApplied}
      />

      <CommitCompareModal
        isOpen={isCompareModalOpen}
        onClose={() => setIsCompareModalOpen(false)}
        projectId={project._id}
        branches={branches}
        initialBase={currentBranch}
      />

      {fileBlameTarget && (
        <FileBlameModal
          isOpen={Boolean(fileBlameTarget)}
          onClose={() => setFileBlameTarget(null)}
          projectId={project._id}
          filePath={fileBlameTarget.path}
          fileName={fileBlameTarget.name}
        />
      )}

      {conflictModalData && (
        <ConflictResolverModal
          isOpen={Boolean(conflictModalData)}
          onClose={() => setConflictModalData(null)}
          sourceBranch={conflictModalData.sourceBranch}
          targetBranch={conflictModalData.targetBranch}
          conflictFiles={conflictModalData.conflictFiles}
          onFinalizeMerge={handleFinalizeConflictMerge}
        />
      )}

      {closeTabPending && (
        <UnsavedChangesModal
          isOpen={Boolean(closeTabPending)}
          type="close-tab"
          fileName={tabs.find((t) => t.fileId === closeTabPending)?.name || "file"}
          onSave={handleModalSaveAndClose}
          onDontSave={handleModalDontSaveAndClose}
          onCancel={() => setCloseTabPending(null)}
        />
      )}

      {commitPending && (
        <UnsavedChangesModal
          isOpen={Boolean(commitPending)}
          type="commit"
          dirtyFileNames={tabs.filter((t) => t.isDirty).map((t) => t.name)}
          onSaveAllAndCommit={handleModalSaveAllAndCommit}
          onCommitWithoutSaving={handleModalCommitWithoutSaving}
          onCancel={() => setCommitPending(null)}
        />
      )}
    </div>
  );
}