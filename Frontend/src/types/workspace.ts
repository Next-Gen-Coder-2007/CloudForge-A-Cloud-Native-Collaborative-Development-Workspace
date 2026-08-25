export type ActivityBarTab = "explorer" | "sourceControl" | "history" | "search" | "preview" | "env" | "deploy" | "settings";

export interface WorkspaceFile {
  _id: string;
  projectId: string;
  name: string;
  path: string;
  type: "file" | "directory";
  content: string;
  language: string;
  mimeType?: string;
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
  parentSha?: string | null;
  mergeParentSha?: string | null;
  isMergeCommit?: boolean;
  isCherryPick?: boolean;
  isRevert?: boolean;
  tags?: string[];
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

export interface GitTag {
  _id: string;
  name: string;
  sha: string;
  message?: string;
  author?: {
    name: string;
    email: string;
  };
  createdAt: string;
}

export interface GitStash {
  _id: string;
  stashIndex: number;
  message: string;
  branch: string;
  author: {
    name: string;
    email: string;
  };
  filesSnapshot: {
    name: string;
    path: string;
    content: string;
    language?: string;
    type?: string;
    size?: number;
  }[];
  createdAt: string;
}

export interface ConflictFile {
  path: string;
  name: string;
  language: string;
  baseContent: string;
  currentContent: string;
  incomingContent: string;
  conflictedContent: string;
  resolvedContent?: string;
  isResolved?: boolean;
}

export interface MergeConflictResult {
  hasConflicts: boolean;
  message: string;
  conflictFiles: ConflictFile[];
  cleanMergedFiles: any[];
  sourceBranch: string;
  targetBranch: string;
  sourceHeadSha: string;
  targetHeadSha: string;
  baseSha?: string;
}

export interface FileBlameLine {
  lineNumber: number;
  content: string;
  commitSha: string;
  author: string;
  date: string;
  message: string;
}

export interface FileHistoryEntry {
  commitSha: string;
  message: string;
  author: {
    name: string;
    email: string;
  };
  createdAt: string;
  status: "added" | "modified" | "deleted";
  additions: number;
  deletions: number;
  content: string;
}

export interface CommitComparisonFile {
  path: string;
  status: "added" | "modified" | "deleted";
  additions: number;
  deletions: number;
  originalContent: string;
  modifiedContent: string;
  language: string;
}

export interface CommitComparisonResult {
  base: string;
  head: string;
  baseCommitSha: string | null;
  headCommitSha: string | null;
  stats: {
    filesChanged: number;
    additions: number;
    deletions: number;
  };
  files: CommitComparisonFile[];
}

export interface EditorTab {
  fileId: string;
  name: string;
  path: string;
  language: string;
  mimeType?: string;
  content: string;
  initialContent: string;
  isDirty: boolean;
}

export interface BreadcrumbItem {
  name: string;
  path: string;
}
