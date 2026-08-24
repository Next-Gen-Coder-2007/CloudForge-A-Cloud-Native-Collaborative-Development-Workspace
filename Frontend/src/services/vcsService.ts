import API_URL from "../config/api";
import type {
  GitCommit,
  GitTag,
  GitStash,
  FileBlameLine,
  FileHistoryEntry,
  CommitComparisonResult,
  WorkspaceFile,
} from "../types/workspace";

async function vcsRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const data = await res.json();
  if (!res.ok) {
    // If conflict response (status 409)
    if (res.status === 409 && data.hasConflicts) {
      return data as T;
    }
    throw new Error(data.message || `VCS request failed with status ${res.status}`);
  }
  return data;
}

export const vcsService = {
  /**
   * Get all commits for a branch
   */
  getCommits: async (projectId: string, branch?: string): Promise<GitCommit[]> => {
    const url = branch
      ? `${API_URL}/api/projects/${projectId}/vcs/commits?branch=${encodeURIComponent(branch)}`
      : `${API_URL}/api/projects/${projectId}/vcs/commits`;
    const data = await vcsRequest<{ commits: GitCommit[] }>(url);
    return data.commits;
  },

  /**
   * Get details for a specific commit SHA
   */
  getCommitDetails: async (projectId: string, sha: string): Promise<GitCommit> => {
    const data = await vcsRequest<{ commit: GitCommit }>(
      `${API_URL}/api/projects/${projectId}/vcs/commits/${sha}`
    );
    return data.commit;
  },

  /**
   * Create a new commit snapshot (supports selective staged files)
   */
  createCommit: async (
    projectId: string,
    message: string,
    stagedFiles?: any[] | null
  ): Promise<GitCommit> => {
    const data = await vcsRequest<{ commit: GitCommit; message: string }>(
      `${API_URL}/api/projects/${projectId}/vcs/commit`,
      {
        method: "POST",
        body: JSON.stringify({ message, stagedFiles }),
      }
    );
    return data.commit;
  },

  /**
   * Create or switch branch
   */
  switchBranch: async (
    projectId: string,
    branchName: string,
    createNew: boolean = false
  ): Promise<{ currentBranch: string; branches: string[]; files: WorkspaceFile[]; headCommit?: GitCommit }> => {
    return vcsRequest(
      `${API_URL}/api/projects/${projectId}/vcs/branches`,
      {
        method: "POST",
        body: JSON.stringify({ branch: branchName, createNew }),
      }
    );
  },

  /**
   * Delete a branch
   */
  deleteBranch: async (
    projectId: string,
    branchName: string
  ): Promise<{ branches: string[]; message: string }> => {
    return vcsRequest(
      `${API_URL}/api/projects/${projectId}/vcs/branches/${encodeURIComponent(branchName)}`,
      { method: "DELETE" }
    );
  },

  /**
   * Rename a branch
   */
  renameBranch: async (
    projectId: string,
    oldName: string,
    newName: string
  ): Promise<{ currentBranch: string; branches: string[]; message: string }> => {
    return vcsRequest(
      `${API_URL}/api/projects/${projectId}/vcs/branches/rename`,
      {
        method: "PUT",
        body: JSON.stringify({ oldName, newName }),
      }
    );
  },

  /**
   * 3-Way Merge sourceBranch into targetBranch
   */
  mergeBranches: async (
    projectId: string,
    sourceBranch: string,
    targetBranch: string,
    dryRun: boolean = false
  ): Promise<{
    hasConflicts: boolean;
    mergeCommit?: GitCommit;
    files?: WorkspaceFile[];
    conflictFiles?: any[];
    cleanMergedFiles?: any[];
    sourceBranch?: string;
    targetBranch?: string;
    sourceHeadSha?: string;
    targetHeadSha?: string;
    baseSha?: string;
    message?: string;
  }> => {
    return vcsRequest(
      `${API_URL}/api/projects/${projectId}/vcs/merge`,
      {
        method: "POST",
        body: JSON.stringify({ sourceBranch, targetBranch, dryRun }),
      }
    );
  },

  /**
   * Finalize Merge after Conflict Resolution
   */
  finalizeMerge: async (
    projectId: string,
    sourceBranch: string,
    targetBranch: string,
    resolvedFiles: any[],
    customMessage?: string
  ): Promise<{ mergeCommit: GitCommit; files: WorkspaceFile[]; message: string }> => {
    return vcsRequest(
      `${API_URL}/api/projects/${projectId}/vcs/merge/resolve`,
      {
        method: "POST",
        body: JSON.stringify({
          sourceBranch,
          targetBranch,
          resolvedFiles,
          customMessage,
        }),
      }
    );
  },

  /**
   * Cherry-Pick a commit
   */
  cherryPickCommit: async (
    projectId: string,
    sha: string,
    targetBranch?: string
  ): Promise<{ cherryPickCommit: GitCommit; files: WorkspaceFile[]; message: string }> => {
    return vcsRequest(
      `${API_URL}/api/projects/${projectId}/vcs/cherry-pick/${sha}`,
      {
        method: "POST",
        body: JSON.stringify({ targetBranch }),
      }
    );
  },

  /**
   * Revert a commit
   */
  revertCommit: async (
    projectId: string,
    sha: string,
    targetBranch?: string
  ): Promise<{ revertedCommit: GitCommit; files: WorkspaceFile[]; message: string }> => {
    return vcsRequest(
      `${API_URL}/api/projects/${projectId}/vcs/revert/${sha}`,
      {
        method: "POST",
        body: JSON.stringify({ targetBranch }),
      }
    );
  },

  /**
   * Git Stash: Save
   */
  saveStash: async (
    projectId: string,
    message?: string
  ): Promise<{ stash: GitStash; files: WorkspaceFile[]; message: string }> => {
    return vcsRequest(
      `${API_URL}/api/projects/${projectId}/vcs/stash`,
      {
        method: "POST",
        body: JSON.stringify({ message }),
      }
    );
  },

  /**
   * Git Stash: List
   */
  getStashes: async (projectId: string): Promise<GitStash[]> => {
    const data = await vcsRequest<{ stashes: GitStash[] }>(
      `${API_URL}/api/projects/${projectId}/vcs/stashes`
    );
    return data.stashes;
  },

  /**
   * Git Stash: Apply
   */
  applyStash: async (
    projectId: string,
    stashId: string
  ): Promise<{ stash: GitStash; files: WorkspaceFile[]; message: string }> => {
    return vcsRequest(
      `${API_URL}/api/projects/${projectId}/vcs/stash/${stashId}/apply`,
      { method: "POST" }
    );
  },

  /**
   * Git Stash: Pop
   */
  popStash: async (
    projectId: string,
    stashId: string
  ): Promise<{ stash: GitStash; files: WorkspaceFile[]; message: string }> => {
    return vcsRequest(
      `${API_URL}/api/projects/${projectId}/vcs/stash/${stashId}/pop`,
      { method: "POST" }
    );
  },

  /**
   * Git Stash: Drop
   */
  dropStash: async (
    projectId: string,
    stashId: string
  ): Promise<{ message: string }> => {
    return vcsRequest(
      `${API_URL}/api/projects/${projectId}/vcs/stash/${stashId}`,
      { method: "DELETE" }
    );
  },

  /**
   * Create Tag
   */
  createTag: async (
    projectId: string,
    name: string,
    sha: string,
    message?: string
  ): Promise<GitTag> => {
    const data = await vcsRequest<{ tag: GitTag; message: string }>(
      `${API_URL}/api/projects/${projectId}/vcs/tags`,
      {
        method: "POST",
        body: JSON.stringify({ name, sha, message }),
      }
    );
    return data.tag;
  },

  /**
   * Get Tags
   */
  getTags: async (projectId: string): Promise<GitTag[]> => {
    const data = await vcsRequest<{ tags: GitTag[] }>(
      `${API_URL}/api/projects/${projectId}/vcs/tags`
    );
    return data.tags;
  },

  /**
   * Delete Tag
   */
  deleteTag: async (projectId: string, name: string): Promise<{ message: string }> => {
    return vcsRequest(
      `${API_URL}/api/projects/${projectId}/vcs/tags/${encodeURIComponent(name)}`,
      { method: "DELETE" }
    );
  },

  /**
   * Get File Blame
   */
  getFileBlame: async (projectId: string, path: string): Promise<FileBlameLine[]> => {
    const data = await vcsRequest<{ blame: FileBlameLine[] }>(
      `${API_URL}/api/projects/${projectId}/vcs/blame?path=${encodeURIComponent(path)}`
    );
    return data.blame;
  },

  /**
   * Get File History
   */
  getFileHistory: async (projectId: string, path: string): Promise<FileHistoryEntry[]> => {
    const data = await vcsRequest<{ history: FileHistoryEntry[] }>(
      `${API_URL}/api/projects/${projectId}/vcs/history?path=${encodeURIComponent(path)}`
    );
    return data.history;
  },

  /**
   * Compare Snapshots (Branch vs Branch or Commit vs Commit)
   */
  compareSnapshots: async (
    projectId: string,
    base: string,
    head: string
  ): Promise<CommitComparisonResult> => {
    const data = await vcsRequest<{ comparison: CommitComparisonResult }>(
      `${API_URL}/api/projects/${projectId}/vcs/compare?base=${encodeURIComponent(base)}&head=${encodeURIComponent(head)}`
    );
    return data.comparison;
  },

  /**
   * Time-Travel Rollback
   */
  rollbackCommit: async (
    projectId: string,
    sha: string
  ): Promise<{ revertedCommit: GitCommit; newCommit: GitCommit; files: WorkspaceFile[] }> => {
    return vcsRequest(
      `${API_URL}/api/projects/${projectId}/vcs/rollback/${sha}`,
      { method: "POST" }
    );
  },
};
