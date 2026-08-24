import crypto from "crypto";
import Project from "../models/Project.js";
import ProjectFile from "../models/ProjectFile.js";
import ProjectCommit from "../models/ProjectCommit.js";
import ProjectTag from "../models/ProjectTag.js";
import ProjectStash from "../models/ProjectStash.js";

/**
 * Generate a unique cryptographic commit hash (7 characters)
 */
export function generateCommitSha(message, author, timestamp, parentSha = "") {
  const seed = `${message}-${author}-${timestamp}-${parentSha}-${crypto.randomBytes(8).toString("hex")}`;
  return crypto.createHash("sha256").update(seed).digest("hex").substring(0, 7);
}

export const isBinaryContent = (content) => {
  return typeof content === "string" && content.startsWith("data:");
};

export const computeSize = (content) => {
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
      const lineCount = currIsBinary ? 1 : (curr.content || "").split("\n").length;
      changes.push({
        path,
        status: "added",
        additions: lineCount,
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
        const prevLines = (prev.content || "").split("\n");
        const currLines = (curr.content || "").split("\n");
        const prevSet = new Set(prevLines);
        const currSet = new Set(currLines);

        let add = 0;
        let del = 0;
        currLines.forEach((l) => {
          if (!prevSet.has(l) && l.trim().length > 0) add++;
        });
        prevLines.forEach((l) => {
          if (!currSet.has(l) && l.trim().length > 0) del++;
        });

        if (add === 0 && del === 0 && prev.content !== curr.content) {
          add = Math.max(1, currLines.length - prevLines.length);
          del = Math.max(1, prevLines.length - currLines.length);
        }

        changes.push({
          path,
          status: "modified",
          additions: add,
          deletions: del,
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
 * Supports selective staging: if stagedFiles array is provided, updates only staged files in snapshot.
 */
export async function createCommit({
  projectId,
  message,
  branch = "main",
  author,
  files = [],
  stagedFiles = null,
  parentSha = null,
  mergeParentSha = null,
  isMergeCommit = false,
  isCherryPick = false,
  isRevert = false,
}) {
  const project = await Project.findById(projectId);
  if (!project) throw new Error("Project not found");

  // Get previous commit on this branch
  const lastCommit = await ProjectCommit.findOne({ projectId, branch }).sort({ createdAt: -1 });

  let finalSnapshot = [];

  if (stagedFiles && Array.isArray(stagedFiles) && lastCommit?.filesSnapshot) {
    // Selective staging: start with previous snapshot, overlay staged files
    const snapshotMap = new Map((lastCommit.filesSnapshot || []).map((f) => [f.path || f.name, f]));
    const stagedMap = new Map(stagedFiles.map((f) => [f.path || f.name, f]));

    for (const [path, staged] of stagedMap.entries()) {
      if (staged.status === "deleted") {
        snapshotMap.delete(path);
      } else {
        snapshotMap.set(path, {
          path: staged.path || staged.name,
          name: staged.name,
          content: staged.content || "",
          language: staged.language || "text",
          type: staged.type || "file",
          size: computeSize(staged.content),
        });
      }
    }
    finalSnapshot = Array.from(snapshotMap.values());
  } else {
    finalSnapshot = files.map((f) => ({
      path: f.path || f.name,
      name: f.name,
      content: f.content || "",
      language: f.language || "text",
      type: f.type || "file",
      size: computeSize(f.content),
    }));
  }

  const changes = computeChanges(
    lastCommit?.filesSnapshot || [],
    finalSnapshot
  );

  const totalAdditions = changes.reduce((acc, c) => acc + c.additions, 0);
  const totalDeletions = changes.reduce((acc, c) => acc + c.deletions, 0);

  const sha = generateCommitSha(
    message,
    author?.email || "dev@cloudforge.io",
    Date.now(),
    parentSha || lastCommit?.sha || ""
  );

  const commit = await ProjectCommit.create({
    projectId,
    sha,
    message: message || "Update workspace files",
    author: {
      name: author?.name || "Developer",
      email: author?.email || "developer@cloudforge.io",
      avatarUrl: author?.avatarUrl || "",
    },
    branch,
    changes,
    stats: {
      total: changes.length,
      additions: totalAdditions,
      deletions: totalDeletions,
    },
    filesSnapshot: finalSnapshot,
    parentSha: parentSha !== undefined ? parentSha : (lastCommit?.sha || null),
    mergeParentSha: mergeParentSha || null,
    isMergeCommit,
    isCherryPick,
    isRevert,
    tags: [],
  });

  return commit;
}

/**
 * Switch branch and synchronize working directory with branch HEAD
 */
export async function switchBranch({ projectId, branchName, createNew = false }) {
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
      language: f.language || "plaintext",
      size: f.size || Buffer.byteLength(f.content || "", "utf8"),
    }));

    await ProjectFile.insertMany(newFiles);
  }

  const currentFiles = await ProjectFile.find({ projectId });
  return { project, files: currentFiles, headCommit: branchHeadCommit };
}

/**
 * Lowest Common Ancestor (LCA) traversal across commit DAG
 */
export async function findCommonAncestor(projectId, branchA, branchB) {
  const headA = await ProjectCommit.findOne({ projectId, branch: branchA }).sort({ createdAt: -1 });
  const headB = await ProjectCommit.findOne({ projectId, branch: branchB }).sort({ createdAt: -1 });

  if (!headA || !headB) return null;
  if (headA.sha === headB.sha) return headA;

  // Build ancestor set for branch A
  const visitedA = new Set();
  const queueA = [headA.sha];

  while (queueA.length > 0) {
    const currentSha = queueA.shift();
    if (!currentSha || visitedA.has(currentSha)) continue;
    visitedA.add(currentSha);

    const c = await ProjectCommit.findOne({ projectId, sha: currentSha });
    if (c) {
      if (c.parentSha) queueA.push(c.parentSha);
      if (c.mergeParentSha) queueA.push(c.mergeParentSha);
    }
  }

  // Traverse branch B ancestors to find first match in visitedA
  const queueB = [headB.sha];
  const visitedB = new Set();

  while (queueB.length > 0) {
    const currentSha = queueB.shift();
    if (!currentSha || visitedB.has(currentSha)) continue;
    visitedB.add(currentSha);

    if (visitedA.has(currentSha)) {
      return await ProjectCommit.findOne({ projectId, sha: currentSha });
    }

    const c = await ProjectCommit.findOne({ projectId, sha: currentSha });
    if (c) {
      if (c.parentSha) queueB.push(c.parentSha);
      if (c.mergeParentSha) queueB.push(c.mergeParentSha);
    }
  }

  return null;
}

/**
 * Line-by-line 3-Way Diff & Merge (diff3) Engine
 */
export function diff3Merge(baseContent = "", currentContent = "", incomingContent = "", targetBranch = "HEAD", sourceBranch = "incoming") {
  if (currentContent === incomingContent) {
    return { mergedContent: currentContent, hasConflict: false };
  }
  if (currentContent === baseContent) {
    return { mergedContent: incomingContent, hasConflict: false };
  }
  if (incomingContent === baseContent) {
    return { mergedContent: currentContent, hasConflict: false };
  }

  const baseLines = baseContent.split("\n");
  const currentLines = currentContent.split("\n");
  const incomingLines = incomingContent.split("\n");

  // If binary or single-line conflict
  if (isBinaryContent(currentContent) || isBinaryContent(incomingContent)) {
    return {
      mergedContent: `<<<<<<< CURRENT (${targetBranch})\n${currentContent}\n=======\n${incomingContent}\n>>>>>>> INCOMING (${sourceBranch})`,
      hasConflict: true,
    };
  }

  const mergedLines = [];
  let hasConflict = false;

  const maxLen = Math.max(baseLines.length, currentLines.length, incomingLines.length);
  let i = 0;
  let j = 0;
  let k = 0;

  while (j < currentLines.length || k < incomingLines.length) {
    const bLine = i < baseLines.length ? baseLines[i] : null;
    const cLine = j < currentLines.length ? currentLines[j] : null;
    const inLine = k < incomingLines.length ? incomingLines[k] : null;

    if (cLine === inLine) {
      if (cLine !== null) mergedLines.push(cLine);
      i++;
      j++;
      k++;
    } else if (cLine === bLine) {
      // Current unchanged, incoming changed -> take incoming
      if (inLine !== null) mergedLines.push(inLine);
      i++;
      j++;
      k++;
    } else if (inLine === bLine) {
      // Incoming unchanged, current changed -> take current
      if (cLine !== null) mergedLines.push(cLine);
      i++;
      j++;
      k++;
    } else {
      // Conflict block
      hasConflict = true;
      mergedLines.push(`<<<<<<< CURRENT (${targetBranch})`);
      if (cLine !== null) mergedLines.push(cLine);
      mergedLines.push(`=======`);
      if (inLine !== null) mergedLines.push(inLine);
      mergedLines.push(`>>>>>>> INCOMING (${sourceBranch})`);
      i++;
      j++;
      k++;
    }
  }

  return {
    mergedContent: mergedLines.join("\n"),
    hasConflict,
  };
}

/**
 * Intelligent 3-Way Merge between sourceBranch and targetBranch
 */
export async function mergeBranches({
  projectId,
  sourceBranch,
  targetBranch,
  author,
  dryRun = false,
}) {
  const project = await Project.findById(projectId);
  if (!project) throw new Error("Project not found");

  const sourceHead = await ProjectCommit.findOne({ projectId, branch: sourceBranch }).sort({ createdAt: -1 });
  const targetHead = await ProjectCommit.findOne({ projectId, branch: targetBranch }).sort({ createdAt: -1 });

  if (!sourceHead) {
    throw new Error(`Source branch '${sourceBranch}' has no commits to merge.`);
  }

  // Find Lowest Common Ancestor (Merge Base)
  const commonAncestor = await findCommonAncestor(projectId, sourceBranch, targetBranch);
  const baseFiles = commonAncestor?.filesSnapshot || [];
  const targetFiles = targetHead?.filesSnapshot || [];
  const sourceFiles = sourceHead?.filesSnapshot || [];

  const baseMap = new Map(baseFiles.map((f) => [f.path || f.name, f]));
  const targetMap = new Map(targetFiles.map((f) => [f.path || f.name, f]));
  const sourceMap = new Map(sourceFiles.map((f) => [f.path || f.name, f]));

  const allPaths = new Set([
    ...baseMap.keys(),
    ...targetMap.keys(),
    ...sourceMap.keys(),
  ]);

  const mergedFiles = [];
  const conflictFiles = [];

  for (const path of allPaths) {
    const baseF = baseMap.get(path);
    const targetF = targetMap.get(path);
    const sourceF = sourceMap.get(path);

    // Case 1: File only in source -> added in source
    if (!baseF && !targetF && sourceF) {
      mergedFiles.push(sourceF);
      continue;
    }
    // Case 2: File only in target -> added in target
    if (!baseF && targetF && !sourceF) {
      mergedFiles.push(targetF);
      continue;
    }
    // Case 3: File deleted in source, untouched in target -> delete
    if (baseF && targetF && !sourceF && targetF.content === baseF.content) {
      continue;
    }
    // Case 4: File deleted in target, untouched in source -> delete
    if (baseF && !targetF && sourceF && sourceF.content === baseF.content) {
      continue;
    }

    // 3-Way diff merge for modified files
    const baseContent = baseF ? baseF.content : "";
    const targetContent = targetF ? targetF.content : "";
    const sourceContent = sourceF ? sourceF.content : "";

    const mergeRes = diff3Merge(baseContent, targetContent, sourceContent, targetBranch, sourceBranch);

    const ref = targetF || sourceF || baseF;
    const fileObj = {
      path,
      name: ref.name,
      content: mergeRes.mergedContent,
      language: ref.language || "text",
      type: ref.type || "file",
      size: computeSize(mergeRes.mergedContent),
    };

    if (mergeRes.hasConflict) {
      conflictFiles.push({
        path,
        name: ref.name,
        language: ref.language || "text",
        baseContent,
        currentContent: targetContent,
        incomingContent: sourceContent,
        conflictedContent: mergeRes.mergedContent,
      });
    }

    mergedFiles.push(fileObj);
  }

  // If conflicts are detected
  if (conflictFiles.length > 0) {
    return {
      hasConflicts: true,
      conflictFiles,
      cleanMergedFiles: mergedFiles,
      sourceBranch,
      targetBranch,
      sourceHeadSha: sourceHead.sha,
      targetHeadSha: targetHead?.sha || null,
      baseSha: commonAncestor?.sha || null,
    };
  }

  if (dryRun) {
    return {
      hasConflicts: false,
      conflictFiles: [],
      mergedFiles,
      sourceBranch,
      targetBranch,
    };
  }

  // Clean merge: create 3-way Merge Commit
  const mergeMessage = `Merge branch '${sourceBranch}' into '${targetBranch}'`;
  const mergeCommit = await createCommit({
    projectId,
    message: mergeMessage,
    branch: targetBranch,
    author,
    files: mergedFiles,
    parentSha: targetHead?.sha || null,
    mergeParentSha: sourceHead.sha,
    isMergeCommit: true,
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
      language: f.language || "plaintext",
      size: f.size || Buffer.byteLength(f.content || "", "utf8"),
    }));
    if (newFiles.length > 0) {
      await ProjectFile.insertMany(newFiles);
    }
  }

  const updatedFiles = await ProjectFile.find({ projectId });
  return {
    hasConflicts: false,
    mergeCommit,
    files: updatedFiles,
  };
}

/**
 * Finalize Merge with manual conflict resolutions submitted by user
 */
export async function finalizeMergeWithResolutions({
  projectId,
  sourceBranch,
  targetBranch,
  resolvedFiles = [],
  author,
  customMessage,
}) {
  const project = await Project.findById(projectId);
  if (!project) throw new Error("Project not found");

  const sourceHead = await ProjectCommit.findOne({ projectId, branch: sourceBranch }).sort({ createdAt: -1 });
  const targetHead = await ProjectCommit.findOne({ projectId, branch: targetBranch }).sort({ createdAt: -1 });

  const formattedSnapshot = resolvedFiles.map((f) => ({
    path: f.path || f.name,
    name: f.name,
    content: f.content || "",
    language: f.language || "plaintext",
    type: f.type || "file",
    size: computeSize(f.content),
  }));

  const mergeMessage =
    customMessage ||
    `Merge branch '${sourceBranch}' into '${targetBranch}' (Conflicts resolved)`;

  const mergeCommit = await createCommit({
    projectId,
    message: mergeMessage,
    branch: targetBranch,
    author,
    files: formattedSnapshot,
    parentSha: targetHead?.sha || null,
    mergeParentSha: sourceHead?.sha || null,
    isMergeCommit: true,
  });

  // If currently on target branch, synchronize working files
  if (project.currentBranch === targetBranch) {
    await ProjectFile.deleteMany({ projectId });
    const newFiles = formattedSnapshot.map((f) => ({
      projectId,
      name: f.name,
      path: f.path || f.name,
      type: f.type || "file",
      content: f.content || "",
      language: f.language || "plaintext",
      size: f.size || Buffer.byteLength(f.content || "", "utf8"),
    }));
    if (newFiles.length > 0) {
      await ProjectFile.insertMany(newFiles);
    }
  }

  const updatedFiles = await ProjectFile.find({ projectId });
  return {
    mergeCommit,
    files: updatedFiles,
  };
}

/**
 * Cherry-Pick a specific commit onto current branch HEAD
 */
export async function cherryPickCommit({ projectId, sha, targetBranch, author }) {
  const project = await Project.findById(projectId);
  if (!project) throw new Error("Project not found");

  const commitToPick = await ProjectCommit.findOne({ projectId, sha });
  if (!commitToPick) throw new Error(`Commit with SHA '${sha}' not found`);

  const targetHead = await ProjectCommit.findOne({ projectId, branch: targetBranch }).sort({ createdAt: -1 });
  const parentCommit = commitToPick.parentSha
    ? await ProjectCommit.findOne({ projectId, sha: commitToPick.parentSha })
    : null;

  const parentSnapshot = parentCommit?.filesSnapshot || [];
  const pickSnapshot = commitToPick.filesSnapshot || [];
  const targetSnapshot = targetHead?.filesSnapshot || [];

  // Apply delta of commitToPick over targetSnapshot
  const targetMap = new Map(targetSnapshot.map((f) => [f.path || f.name, { ...f }]));
  const parentMap = new Map(parentSnapshot.map((f) => [f.path || f.name, f]));

  for (const pickFile of pickSnapshot) {
    const path = pickFile.path || pickFile.name;
    const parentFile = parentMap.get(path);

    if (!parentFile || parentFile.content !== pickFile.content) {
      targetMap.set(path, {
        path,
        name: pickFile.name,
        content: pickFile.content,
        language: pickFile.language || "text",
        type: pickFile.type || "file",
        size: computeSize(pickFile.content),
      });
    }
  }

  // Check deleted files in cherry-pick
  for (const [path] of parentMap.entries()) {
    const existsInPick = pickSnapshot.some((f) => (f.path || f.name) === path);
    if (!existsInPick) {
      targetMap.delete(path);
    }
  }

  const newSnapshot = Array.from(targetMap.values());
  const cherryPickMessage = `Cherry-pick "${commitToPick.message}" (${sha.substring(0, 7)})`;

  const newCommit = await createCommit({
    projectId,
    message: cherryPickMessage,
    branch: targetBranch,
    author,
    files: newSnapshot,
    isCherryPick: true,
  });

  if (project.currentBranch === targetBranch) {
    await ProjectFile.deleteMany({ projectId });
    const newFiles = newSnapshot.map((f) => ({
      projectId,
      name: f.name,
      path: f.path || f.name,
      type: f.type || "file",
      content: f.content || "",
      language: f.language || "plaintext",
      size: f.size || Buffer.byteLength(f.content || "", "utf8"),
    }));
    if (newFiles.length > 0) {
      await ProjectFile.insertMany(newFiles);
    }
  }

  const updatedFiles = await ProjectFile.find({ projectId });
  return { cherryPickCommit: newCommit, files: updatedFiles };
}

/**
 * Revert a specific commit on current branch HEAD
 */
export async function revertCommit({ projectId, sha, targetBranch, author }) {
  const project = await Project.findById(projectId);
  if (!project) throw new Error("Project not found");

  const commitToRevert = await ProjectCommit.findOne({ projectId, sha });
  if (!commitToRevert) throw new Error(`Commit with SHA '${sha}' not found`);

  const parentCommit = commitToRevert.parentSha
    ? await ProjectCommit.findOne({ projectId, sha: commitToRevert.parentSha })
    : null;

  const targetHead = await ProjectCommit.findOne({ projectId, branch: targetBranch }).sort({ createdAt: -1 });
  const targetSnapshot = targetHead?.filesSnapshot || [];

  const targetMap = new Map(targetSnapshot.map((f) => [f.path || f.name, { ...f }]));
  const revertMap = new Map((commitToRevert.filesSnapshot || []).map((f) => [f.path || f.name, f]));
  const parentMap = new Map((parentCommit?.filesSnapshot || []).map((f) => [f.path || f.name, f]));

  // Invert changes: if commit added/modified file, restore parent version or delete
  for (const [path, revertFile] of revertMap.entries()) {
    const parentFile = parentMap.get(path);
    if (!parentFile) {
      // Commit introduced this file -> Revert deletes it
      targetMap.delete(path);
    } else if (parentFile.content !== revertFile.content) {
      // Commit modified this file -> Revert restores parent content
      targetMap.set(path, {
        path,
        name: parentFile.name,
        content: parentFile.content,
        language: parentFile.language || "text",
        type: parentFile.type || "file",
        size: computeSize(parentFile.content),
      });
    }
  }

  // If commit deleted a file that was in parent -> Revert brings it back
  for (const [path, parentFile] of parentMap.entries()) {
    if (!revertMap.has(path)) {
      targetMap.set(path, {
        path,
        name: parentFile.name,
        content: parentFile.content,
        language: parentFile.language || "text",
        type: parentFile.type || "file",
        size: computeSize(parentFile.content),
      });
    }
  }

  const newSnapshot = Array.from(targetMap.values());
  const revertMessage = `Revert "${commitToRevert.message}" (${sha.substring(0, 7)})`;

  const newCommit = await createCommit({
    projectId,
    message: revertMessage,
    branch: targetBranch,
    author,
    files: newSnapshot,
    isRevert: true,
  });

  if (project.currentBranch === targetBranch) {
    await ProjectFile.deleteMany({ projectId });
    const newFiles = newSnapshot.map((f) => ({
      projectId,
      name: f.name,
      path: f.path || f.name,
      type: f.type || "file",
      content: f.content || "",
      language: f.language || "plaintext",
      size: f.size || Buffer.byteLength(f.content || "", "utf8"),
    }));
    if (newFiles.length > 0) {
      await ProjectFile.insertMany(newFiles);
    }
  }

  const updatedFiles = await ProjectFile.find({ projectId });
  return { revertedCommit: newCommit, files: updatedFiles };
}

/**
 * Git Stash & Shelving Engine
 */
export async function saveStash({ projectId, branch, message, author, files = [] }) {
  const count = await ProjectStash.countDocuments({ projectId });
  const stash = await ProjectStash.create({
    projectId,
    stashIndex: count,
    message: message || `WIP on ${branch}: ${new Date().toLocaleTimeString()}`,
    branch: branch || "main",
    author: {
      name: author?.name || "Developer",
      email: author?.email || "developer@cloudforge.io",
    },
    filesSnapshot: files.map((f) => ({
      path: f.path || f.name,
      name: f.name,
      content: f.content || "",
      language: f.language || "plaintext",
      type: f.type || "file",
      size: computeSize(f.content),
    })),
  });

  // Revert working tree to branch HEAD commit snapshot
  const headCommit = await ProjectCommit.findOne({ projectId, branch }).sort({ createdAt: -1 });
  if (headCommit?.filesSnapshot) {
    await ProjectFile.deleteMany({ projectId });
    const restoredFiles = headCommit.filesSnapshot.map((f) => ({
      projectId,
      name: f.name,
      path: f.path || f.name,
      type: f.type || "file",
      content: f.content || "",
      language: f.language || "plaintext",
      size: f.size || Buffer.byteLength(f.content || "", "utf8"),
    }));
    if (restoredFiles.length > 0) {
      await ProjectFile.insertMany(restoredFiles);
    }
  }

  const currentFiles = await ProjectFile.find({ projectId });
  return { stash, files: currentFiles };
}

export async function getStashes({ projectId }) {
  return await ProjectStash.find({ projectId }).sort({ createdAt: -1 });
}

export async function applyStash({ projectId, stashId }) {
  const stash = await ProjectStash.findOne({ _id: stashId, projectId });
  if (!stash) throw new Error("Stash not found");

  // Overlay stashed files onto working files
  await ProjectFile.deleteMany({ projectId });
  const newFiles = stash.filesSnapshot.map((f) => ({
    projectId,
    name: f.name,
    path: f.path || f.name,
    type: f.type || "file",
    content: f.content || "",
    language: f.language || "plaintext",
    size: f.size || Buffer.byteLength(f.content || "", "utf8"),
  }));

  if (newFiles.length > 0) {
    await ProjectFile.insertMany(newFiles);
  }

  const updatedFiles = await ProjectFile.find({ projectId });
  return { stash, files: updatedFiles };
}

export async function popStash({ projectId, stashId }) {
  const res = await applyStash({ projectId, stashId });
  await ProjectStash.deleteOne({ _id: stashId, projectId });
  return res;
}

export async function dropStash({ projectId, stashId }) {
  const res = await ProjectStash.deleteOne({ _id: stashId, projectId });
  return { success: res.deletedCount > 0 };
}

/**
 * Release Tags & Annotations Engine
 */
export async function createTag({ projectId, name, sha, message, author }) {
  const cleanName = name.trim().replace(/\s+/g, "-");
  const existing = await ProjectTag.findOne({ projectId, name: cleanName });
  if (existing) throw new Error(`Tag '${cleanName}' already exists.`);

  const commit = await ProjectCommit.findOne({ projectId, sha });
  if (!commit) throw new Error(`Commit '${sha}' not found.`);

  const tag = await ProjectTag.create({
    projectId,
    name: cleanName,
    sha,
    message: message || "",
    author: {
      name: author?.name || "Developer",
      email: author?.email || "developer@cloudforge.io",
    },
  });

  if (!commit.tags.includes(cleanName)) {
    commit.tags.push(cleanName);
    await commit.save();
  }

  return tag;
}

export async function getTags({ projectId }) {
  return await ProjectTag.find({ projectId }).sort({ createdAt: -1 });
}

export async function deleteTag({ projectId, name }) {
  await ProjectTag.deleteOne({ projectId, name });
  await ProjectCommit.updateMany({ projectId, tags: name }, { $pull: { tags: name } });
  return { success: true };
}

/**
 * Line-by-line Blame Engine
 */
export async function getFileBlame({ projectId, path, branch = "main" }) {
  const commits = await ProjectCommit.find({ projectId, branch }).sort({ createdAt: 1 });
  if (!commits || commits.length === 0) return [];

  // Find latest commit with this file
  const latestCommit = commits[commits.length - 1];
  const fileSnap = latestCommit.filesSnapshot?.find((f) => (f.path || f.name) === path);
  if (!fileSnap) return [];

  const lines = fileSnap.content.split("\n");
  const blameInfo = lines.map((lineText, idx) => ({
    lineNumber: idx + 1,
    content: lineText,
    commitSha: latestCommit.sha,
    author: latestCommit.author?.name || "Developer",
    date: latestCommit.createdAt,
    message: latestCommit.message,
  }));

  // Trace backwards to locate introducing commit
  for (let cIdx = 0; cIdx < commits.length; cIdx++) {
    const c = commits[cIdx];
    const snap = c.filesSnapshot?.find((f) => (f.path || f.name) === path);
    if (!snap) continue;

    const snapLines = snap.content.split("\n");
    snapLines.forEach((sLine, sIdx) => {
      if (blameInfo[sIdx] && blameInfo[sIdx].content === sLine) {
        if (!blameInfo[sIdx].found) {
          blameInfo[sIdx].commitSha = c.sha;
          blameInfo[sIdx].author = c.author?.name || "Developer";
          blameInfo[sIdx].date = c.createdAt;
          blameInfo[sIdx].message = c.message;
          blameInfo[sIdx].found = true;
        }
      }
    });
  }

  return blameInfo;
}

/**
 * File History Evolution
 */
export async function getFileHistory({ projectId, path, branch = "main" }) {
  const commits = await ProjectCommit.find({
    projectId,
    branch,
    "changes.path": path,
  }).sort({ createdAt: -1 });

  return commits.map((c) => {
    const change = c.changes?.find((ch) => ch.path === path);
    const snap = c.filesSnapshot?.find((f) => (f.path || f.name) === path);
    return {
      commitSha: c.sha,
      message: c.message,
      author: c.author,
      createdAt: c.createdAt,
      status: change?.status || "modified",
      additions: change?.additions || 0,
      deletions: change?.deletions || 0,
      content: snap?.content || "",
    };
  });
}

/**
 * Arbitrary Diff Comparison Engine (Branch vs Branch or Commit vs Commit)
 */
export async function compareSnapshots({ projectId, base, head }) {
  // Resolve base snapshot
  let baseSnapshot = [];
  const baseCommit = await ProjectCommit.findOne({
    projectId,
    $or: [{ sha: base }, { branch: base }],
  }).sort({ createdAt: -1 });

  if (baseCommit) {
    baseSnapshot = baseCommit.filesSnapshot || [];
  }

  // Resolve head snapshot
  let headSnapshot = [];
  const headCommit = await ProjectCommit.findOne({
    projectId,
    $or: [{ sha: head }, { branch: head }],
  }).sort({ createdAt: -1 });

  if (headCommit) {
    headSnapshot = headCommit.filesSnapshot || [];
  }

  const changes = computeChanges(baseSnapshot, headSnapshot);
  const baseMap = new Map(baseSnapshot.map((f) => [f.path || f.name, f]));
  const headMap = new Map(headSnapshot.map((f) => [f.path || f.name, f]));

  const detailedFiles = changes.map((ch) => {
    const baseF = baseMap.get(ch.path);
    const headF = headMap.get(ch.path);
    return {
      path: ch.path,
      status: ch.status,
      additions: ch.additions,
      deletions: ch.deletions,
      originalContent: baseF?.content || "",
      modifiedContent: headF?.content || "",
      language: headF?.language || baseF?.language || "text",
    };
  });

  return {
    base,
    head,
    baseCommitSha: baseCommit?.sha || null,
    headCommitSha: headCommit?.sha || null,
    stats: {
      filesChanged: changes.length,
      additions: changes.reduce((a, c) => a + c.additions, 0),
      deletions: changes.reduce((a, c) => a + c.deletions, 0),
    },
    files: detailedFiles,
  };
}

/**
 * Delete a branch
 */
export async function deleteBranch({ projectId, branchName }) {
  const project = await Project.findById(projectId);
  if (!project) throw new Error("Project not found");

  if (project.currentBranch === branchName) {
    throw new Error(`Cannot delete active branch '${branchName}'. Switch to another branch first.`);
  }

  if (branchName === "main") {
    throw new Error("Cannot delete default branch 'main'.");
  }

  project.branches = project.branches.filter((b) => b !== branchName);
  await project.save();

  // Delete commits on deleted branch
  await ProjectCommit.deleteMany({ projectId, branch: branchName });

  return { branches: project.branches };
}

/**
 * Rename a branch
 */
export async function renameBranch({ projectId, oldBranchName, newBranchName }) {
  const project = await Project.findById(projectId);
  if (!project) throw new Error("Project not found");

  const cleanName = newBranchName.trim().replace(/\s+/g, "-");
  if (project.branches.includes(cleanName)) {
    throw new Error(`Branch '${cleanName}' already exists.`);
  }

  project.branches = project.branches.map((b) => (b === oldBranchName ? cleanName : b));
  if (project.currentBranch === oldBranchName) {
    project.currentBranch = cleanName;
  }
  await project.save();

  // Update commits
  await ProjectCommit.updateMany({ projectId, branch: oldBranchName }, { branch: cleanName });

  return {
    currentBranch: project.currentBranch,
    branches: project.branches,
  };
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
    language: f.language || "plaintext",
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
    isRevert: true,
  });

  const updatedFiles = await ProjectFile.find({ projectId });
  return {
    revertedCommit: targetCommit,
    newCommit: rollbackCommitRecord,
    files: updatedFiles,
  };
}
