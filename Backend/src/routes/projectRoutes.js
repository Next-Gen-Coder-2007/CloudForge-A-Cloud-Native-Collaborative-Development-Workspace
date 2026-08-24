import express from "express";

import {
  createProject,
  getProjects,
  getProject,
  updateProject,
  deleteProject,
  getProjectEnv,
  updateProjectEnv,
} from "../controllers/projectController.js";

import {
  getWorkspace,
  getProjectFiles,
  createProjectFile,
  batchCreateProjectFiles,
  updateProjectFile,
  renameProjectFile,
  deleteProjectFile,
  getProjectCommits,
  getProjectCommitDetails,
  createProjectCommit,
  createOrSwitchBranch,
  deleteProjectBranch,
  renameProjectBranch,
  mergeBranch,
  finalizeMergeConflict,
  cherryPickCommitHandler,
  revertCommitHandler,
  saveProjectStash,
  getProjectStashes,
  applyProjectStash,
  popProjectStash,
  dropProjectStash,
  createProjectTag,
  getProjectTags,
  deleteProjectTag,
  getProjectFileBlame,
  getProjectFileHistory,
  compareProjectSnapshots,
  rollbackCommit,
} from "../controllers/workspaceController.js";

import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

// Project CRUD & Environment Variables
router.post("/", createProject);
router.get("/", getProjects);
router.get("/:id", getProject);
router.put("/:id", updateProject);
router.delete("/:id", deleteProject);
router.get("/:id/env", getProjectEnv);
router.put("/:id/env", updateProjectEnv);

// Workspace & Files
router.get("/:id/workspace", getWorkspace);
router.get("/:id/files", getProjectFiles);
router.get("/:id/workspace/files", getProjectFiles);
router.post("/:id/files", createProjectFile);
router.post("/:id/workspace/files", createProjectFile);
router.post("/:id/files/batch", batchCreateProjectFiles);
router.post("/:id/workspace/files/batch", batchCreateProjectFiles);
router.put("/:id/files/:fileId", updateProjectFile);
router.put("/:id/workspace/files/:fileId", updateProjectFile);
router.put("/:id/files/:fileId/rename", renameProjectFile);
router.put("/:id/workspace/files/:fileId/rename", renameProjectFile);
router.delete("/:id/files/:fileId", deleteProjectFile);
router.delete("/:id/workspace/files/:fileId", deleteProjectFile);

// CloudForge Version Control System (VCS)
// Commits
router.get("/:id/vcs/commits", getProjectCommits);
router.get("/:id/workspace/commits", getProjectCommits);
router.get("/:id/git/commits", getProjectCommits);
router.get("/:id/vcs/commits/:sha", getProjectCommitDetails);
router.get("/:id/workspace/commits/:sha", getProjectCommitDetails);
router.post("/:id/vcs/commit", createProjectCommit);
router.post("/:id/workspace/commits", createProjectCommit);
router.post("/:id/git/commit", createProjectCommit);

// Branch Management
router.post("/:id/vcs/branches", createOrSwitchBranch);
router.post("/:id/workspace/branches", createOrSwitchBranch);
router.post("/:id/git/branches", createOrSwitchBranch);
router.delete("/:id/vcs/branches/:branchName", deleteProjectBranch);
router.put("/:id/vcs/branches/rename", renameProjectBranch);

// 3-Way Merge & Conflict Resolution
router.post("/:id/vcs/merge", mergeBranch);
router.post("/:id/vcs/merge/resolve", finalizeMergeConflict);

// Cherry-Pick & Revert
router.post("/:id/vcs/cherry-pick/:sha", cherryPickCommitHandler);
router.post("/:id/vcs/revert/:sha", revertCommitHandler);

// Git Stash & Shelving
router.post("/:id/vcs/stash", saveProjectStash);
router.get("/:id/vcs/stashes", getProjectStashes);
router.post("/:id/vcs/stash/:stashId/apply", applyProjectStash);
router.post("/:id/vcs/stash/:stashId/pop", popProjectStash);
router.delete("/:id/vcs/stash/:stashId", dropProjectStash);

// Release Tags
router.post("/:id/vcs/tags", createProjectTag);
router.get("/:id/vcs/tags", getProjectTags);
router.delete("/:id/vcs/tags/:name", deleteProjectTag);

// File Blame, History & Diff Compare
router.get("/:id/vcs/blame", getProjectFileBlame);
router.get("/:id/vcs/history", getProjectFileHistory);
router.get("/:id/vcs/compare", compareProjectSnapshots);

// Time Travel Rollback
router.post("/:id/vcs/rollback/:sha", rollbackCommit);

export default router;