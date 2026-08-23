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
import { vcsService } from "../services/vcsService";

export default function ProjectView() {
  const { id } = useParams<{ id: string }>();
  const { showError, showSuccess } = useAlert();
  const { isDark } = useTheme();

  const [project, setProject] = useState<Project | null>(null);
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
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const [changedFiles, setChangedFiles] = useState<
    {
      file: WorkspaceFile;
      status: "modified" | "added" | "deleted";
      staged: boolean;
    }[]
  >([]);

  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
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

  const handleSaveFile = async (fileId: string) => {
    const tab = tabs.find((t) => t.fileId === fileId);
    if (!tab) return;

    try {
      setIsSaving(true);
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

      showSuccess(`Saved "${tab.name}"`);
    } catch (err: any) {
      showError(err.message || "Failed to save file");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateFile = async (name: string, path: string) => {
    try {
      const res = await fetch(`${API_URL}/api/projects/${id}/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, path, type: "file", content: "" }),
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
      for (const item of uploadedFiles) {
        if (!item.type || item.type === "file") {
          await handleCreateFile(item.name, item.path);
        }
      }
      loadWorkspace();
      showSuccess(`Uploaded ${uploadedFiles.length} files`);
    } catch (err: any) {
      showError(err.message || "Upload failed");
    }
  };

  const handleDownloadFile = (file: WorkspaceFile) => {
    const blob = new Blob([file.content || ""], { type: "text/plain;charset=utf-8" });
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
          zip.file(cleanPath, f.content || "");
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
      const newCommit = await vcsService.createCommit(id, message);
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

  const handleBranchSwitched = (
    newBranch: string,
    newBranches: string[],
    newFiles: WorkspaceFile[]
  ) => {
    setCurrentBranch(newBranch);
    setBranches(newBranches);
    setFiles(newFiles);
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
        <LoadingSpinner text="Initializing CloudForge workspace..." fullScreen />
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
            onChangeTab={(tab) => setActiveActivityTab(tab)}
            changedFilesCount={changedFiles.length}
            commitsCount={commits.length}
          />

          <div className={`w-64 sm:w-72 md:w-80 h-full border-r shrink-0 overflow-hidden flex flex-col transition-colors duration-150 ${
            isDark ? "border-neutral-800 bg-neutral-950" : "border-neutral-200 bg-neutral-50"
          }`}>
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
                onInspectDiff={handleInspectDiff}
                onOpenBranchManager={() => setIsBranchModalOpen(true)}
              />
            )}

            {activeActivityTab === "history" && (
              <VCSHistoryPanel
                projectId={project._id}
                commits={commits}
                currentBranch={currentBranch}
                onCommitSelected={(c) => setSelectedCommit(c)}
                onRollbackComplete={handleRollbackComplete}
              />
            )}

            {activeActivityTab === "search" && (
              <SearchPanel
                files={files}
                onSelectMatch={(file) => handleSelectFile(file)}
              />
            )}

            {activeActivityTab === "settings" && (
              <ProjectSettingsPanel
                project={project}
                filesCount={files.filter((f) => f.type === "file").length}
                commitsCount={commits.length}
                onUpdateProject={(updated) => setProject(updated)}
                onResetTemplate={(updatedProj, newFiles, newCommits) => {
                  setProject(updatedProj);
                  setFiles(newFiles);
                  setCommits(newCommits);
                  setTabs([]);
                  setActiveTabId(null);
                  setChangedFiles([]);
                  setDiffTarget(null);
                }}
              />
            )}
          </div>
        </div>

        <div className={`flex-1 flex flex-col h-full overflow-hidden min-w-0 transition-colors duration-150 ${
          isDark ? "bg-black" : "bg-white"
        }`}>
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
              />
            )}
          </div>
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
      />

      <BranchManagerModal
        isOpen={isBranchModalOpen}
        onClose={() => setIsBranchModalOpen(false)}
        projectId={project._id}
        currentBranch={currentBranch}
        branches={branches}
        onBranchSwitched={handleBranchSwitched}
        onMergeComplete={handleMergeComplete}
      />

      <CommitDetailsModal
        commit={selectedCommit}
        onClose={() => setSelectedCommit(null)}
      />

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