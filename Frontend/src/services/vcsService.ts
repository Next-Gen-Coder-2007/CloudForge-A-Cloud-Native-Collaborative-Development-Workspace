import API_URL from "../config/api";
import type { GitCommit, WorkspaceFile } from "../types/workspace";

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
    throw new Error(data.message || `VCS request failed with status ${res.status}`);
  }
  return data;
}

export const vcsService = {
  /**
   * Get all commits for current branch
   */
  getCommits: async (projectId: string): Promise<GitCommit[]> => {
    const data = await vcsRequest<{ commits: GitCommit[] }>(
      `${API_URL}/api/projects/${projectId}/vcs/commits`
    );
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
   * Create a new commit snapshot
   */
  createCommit: async (projectId: string, message: string): Promise<GitCommit> => {
    const data = await vcsRequest<{ commit: GitCommit; message: string }>(
      `${API_URL}/api/projects/${projectId}/vcs/commit`,
      {
        method: "POST",
        body: JSON.stringify({ message }),
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
  ): Promise<{ currentBranch: string; branches: string[]; files: WorkspaceFile[] }> => {
    return vcsRequest(
      `${API_URL}/api/projects/${projectId}/vcs/branches`,
      {
        method: "POST",
        body: JSON.stringify({ branch: branchName, createNew }),
      }
    );
  },

  /**
   * Merge sourceBranch into targetBranch
   */
  mergeBranches: async (
    projectId: string,
    sourceBranch: string,
    targetBranch: string
  ): Promise<{ mergeCommit: GitCommit; files: WorkspaceFile[]; message: string }> => {
    return vcsRequest(
      `${API_URL}/api/projects/${projectId}/vcs/merge`,
      {
        method: "POST",
        body: JSON.stringify({ sourceBranch, targetBranch }),
      }
    );
  },

  /**
   * Time-Travel Rollback: Restore workspace to exact commit snapshot
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
