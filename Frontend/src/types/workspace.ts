export type ActivityBarTab = "explorer" | "sourceControl" | "history" | "search" | "settings";

export interface WorkspaceFile {
  _id: string;
  projectId: string;
  name: string;
  path: string;
  type: "file" | "directory";
  content: string;
  language: string;
  size: number;
  sha?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface FileTreeNode {
  id: string;
  name: string;
  path: string;
  type: "file" | "directory";
  file?: WorkspaceFile;
  children?: FileTreeNode[];
  isOpen?: boolean;
}

export interface GitCommitChange {
  path: string;
  status: "added" | "modified" | "deleted";
  additions: number;
  deletions: number;
  patch?: string;
}

export interface GitCommit {
  _id: string;
  sha: string;
  message: string;
  author: {
    name: string;
    email: string;
    avatarUrl?: string;
  };
  branch: string;
  changes?: GitCommitChange[];
  filesSnapshot?: {
    name: string;
    path: string;
    content: string;
    language?: string;
    type?: string;
    size?: number;
  }[];
  stats?: {
    total: number;
    additions: number;
    deletions: number;
  };
  isGitHubCommit?: boolean;
  createdAt: string;
}

export interface EditorTab {
  fileId: string;
  name: string;
  path: string;
  language: string;
  content: string;
  initialContent: string;
  isDirty: boolean;
}

export interface BreadcrumbItem {
  name: string;
  path: string;
}
