import crypto from "crypto";
import Project from "../models/Project.js";
import ProjectFile from "../models/ProjectFile.js";
import ProjectCommit from "../models/ProjectCommit.js";

/**
 * Generate a unique cryptographic commit hash
 */
export function generateCommitSha(message, author, timestamp, parentSha = "") {
  const seed = `${message}-${author}-${timestamp}-${parentSha}-${crypto.randomBytes(8).toString("hex")}`;
  return crypto.createHash("sha256").update(seed).digest("hex").substring(0, 7);
}

const isBinaryContent = (content) => {
  return typeof content === "string" && content.startsWith("data:");
};

const computeSize = (content) => {
  if (!content) return 0;
  if (isBinaryContent(content)) {
    const b64 = content.split(",")[1] || "";
    return Math.round((b64.length * 3) / 4);
  }
  return Buffer.byteLength(content, "utf8");
};

/**
 * Compute file changes / diff between previous snapshot and current files
 */
export function computeChanges(previousFiles = [], currentFiles = []) {
  const changes = [];
  const prevMap = new Map(previousFiles.map((f) => [f.path || f.name, f]));
  const currMap = new Map(currentFiles.map((f) => [f.path || f.name, f]));

  // Check modified & added
  for (const [path, curr] of currMap.entries()) {
    const prev = prevMap.get(path);
    const currIsBinary = isBinaryContent(curr.content);

    if (!prev) {
      changes.push({
        path,
        status: "added",
        additions: currIsBinary ? 1 : (curr.content || "").split("\n").length,
        deletions: 0,
      });
    } else if (prev.content !== curr.content) {
      const prevIsBinary = isBinaryContent(prev.content);
      if (currIsBinary || prevIsBinary) {
        changes.push({
          path,
          status: "modified",
          additions: 1,
          deletions: 1,
        });
      } else {
        const prevLines = (prev.content || "").split("\n").length;
        const currLines = (curr.content || "").split("\n").length;
        changes.push({
          path,
          status: "modified",
          additions: Math.max(0, currLines - prevLines + 1),
          deletions: Math.max(0, prevLines - currLines + 1),
        });
      }
    }
  }

  // Check deleted
  for (const [path, prev] of prevMap.entries()) {
    if (!currMap.has(path)) {
      const prevIsBinary = isBinaryContent(prev.content);
      changes.push({
        path,
        status: "deleted",
        additions: 0,
        deletions: prevIsBinary ? 1 : (prev.content || "").split("\n").length,
      });
    }
  }

  return changes;
}

/**
 * Create a new commit in CloudForge VCS
 */
export async function createCommit({
  projectId,
  message,
  branch = "main",
  author,
  files = [],
}) {
  const project = await Project.findById(projectId);
  if (!project) throw new Error("Project not found");

  // Get previous commit on this branch
  const lastCommit = await ProjectCommit.findOne({ projectId, branch }).sort({ createdAt: -1 });

  const filesSnapshot = files.map((f) => ({
    path: f.path || f.name,
    name: f.name,
    content: f.content || "",
    language: f.language || "text",
    type: f.type || "file",
    size: computeSize(f.content),
  }));

  const changes = computeChanges(
    lastCommit?.filesSnapshot || [],
    filesSnapshot
  );

  const totalAdditions = changes.reduce((acc, c) => acc + c.additions, 0);
  const totalDeletions = changes.reduce((acc, c) => acc + c.deletions, 0);

  const sha = generateCommitSha(
    message,
    author?.email || "dev@cloudforge.io",
    Date.now(),
    lastCommit?.sha || ""
  );

  const commit = await ProjectCommit.create({
    projectId,
    sha,
    message: message || "Update workspace files",
    author: {
      name: author?.name || "Developer",
      email: author?.email || "developer@cloudforge.io",
    },
    branch,
    changes,
    stats: {
      total: changes.length,
      additions: totalAdditions,
      deletions: totalDeletions,
    },
    filesSnapshot,
    parentSha: lastCommit?.sha || null,
  });

  return commit;
}

/**
 * Switch branch and synchronize working directory with branch HEAD
 */
export async function switchBranch({ projectId, branchName }) {
  const project = await Project.findById(projectId);
  if (!project) throw new Error("Project not found");

  if (!project.branches.includes(branchName)) {
    project.branches.push(branchName);
  }
  project.currentBranch = branchName;
  await project.save();

  // Find HEAD commit of target branch
  const branchHeadCommit = await ProjectCommit.findOne({
    projectId,
    branch: branchName,
  }).sort({ createdAt: -1 });

  if (branchHeadCommit && branchHeadCommit.filesSnapshot?.length > 0) {
    // Synchronize ProjectFile collection with snapshot
    await ProjectFile.deleteMany({ projectId });

    const newFiles = branchHeadCommit.filesSnapshot.map((f) => ({
      projectId,
      name: f.name,
      path: f.path || f.name,
      type: f.type || "file",
      content: f.content || "",
      language: f.language || "text",
      size: f.size || Buffer.byteLength(f.content || "", "utf8"),
    }));

    await ProjectFile.insertMany(newFiles);
  }

  const currentFiles = await ProjectFile.find({ projectId });
  return { project, files: currentFiles, headCommit: branchHeadCommit };
}

/**
 * Merge sourceBranch into targetBranch
 */
export async function mergeBranches({ projectId, sourceBranch, targetBranch, author }) {
  const project = await Project.findById(projectId);
  if (!project) throw new Error("Project not found");

  const sourceHead = await ProjectCommit.findOne({ projectId, branch: sourceBranch }).sort({ createdAt: -1 });
  const targetHead = await ProjectCommit.findOne({ projectId, branch: targetBranch }).sort({ createdAt: -1 });

  if (!sourceHead) {
    throw new Error(`Source branch '${sourceBranch}' has no commits to merge.`);
  }

  // Merge snapshots (source files override or add to target files)
  const mergedMap = new Map();
  if (targetHead?.filesSnapshot) {
    for (const f of targetHead.filesSnapshot) {
      mergedMap.set(f.path || f.name, f);
    }
  }
  if (sourceHead?.filesSnapshot) {
    for (const f of sourceHead.filesSnapshot) {
      mergedMap.set(f.path || f.name, f);
    }
  }

  const mergedFiles = Array.from(mergedMap.values());

  // Create Merge Commit on target branch
  const mergeMessage = `Merge branch '${sourceBranch}' into '${targetBranch}'`;
  const mergeCommit = await createCommit({
    projectId,
    message: mergeMessage,
    branch: targetBranch,
    author,
    files: mergedFiles,
  });

  // If currently on target branch, update working files
  if (project.currentBranch === targetBranch) {
    await ProjectFile.deleteMany({ projectId });
    const newFiles = mergedFiles.map((f) => ({
      projectId,
      name: f.name,
      path: f.path || f.name,
      type: f.type || "file",
      content: f.content || "",
      language: f.language || "text",
      size: f.size || Buffer.byteLength(f.content || "", "utf8"),
    }));
    await ProjectFile.insertMany(newFiles);
  }

  const updatedFiles = await ProjectFile.find({ projectId });
  return { mergeCommit, files: updatedFiles };
}

/**
 * Time Travel Rollback: Restore workspace to exact snapshot of a past commit
 */
export async function rollbackToCommit({ projectId, sha, author }) {
  const project = await Project.findById(projectId);
  if (!project) throw new Error("Project not found");

  const targetCommit = await ProjectCommit.findOne({ projectId, sha });
  if (!targetCommit) throw new Error(`Commit with SHA '${sha}' not found`);

  const snapshot = targetCommit.filesSnapshot || [];

  // Update working directory files
  await ProjectFile.deleteMany({ projectId });
  const newFiles = snapshot.map((f) => ({
    projectId,
    name: f.name,
    path: f.path || f.name,
    type: f.type || "file",
    content: f.content || "",
    language: f.language || "text",
    size: f.size || Buffer.byteLength(f.content || "", "utf8"),
  }));

  if (newFiles.length > 0) {
    await ProjectFile.insertMany(newFiles);
  }

  // Create a rollback commit record
  const rollbackCommitRecord = await createCommit({
    projectId,
    message: `Rollback workspace to commit ${sha.substring(0, 7)}: "${targetCommit.message}"`,
    branch: project.currentBranch || "main",
    author,
    files: newFiles,
  });

  const updatedFiles = await ProjectFile.find({ projectId });
  return {
    revertedCommit: targetCommit,
    newCommit: rollbackCommitRecord,
    files: updatedFiles,
  };
}
