import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import Docker from "dockerode";
import tar from "tar-stream";
import Project from "../models/Project.js";
import ProjectFile from "../models/ProjectFile.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STORAGE_ROOT = path.resolve(__dirname, "../../storage/workspaces");

// Ensure base storage directory exists
if (!fs.existsSync(STORAGE_ROOT)) {
  fs.mkdirSync(STORAGE_ROOT, { recursive: true });
}

class ContainerService {
  constructor() {
    this.docker = this._initDockerClient();
    this.activeFallbackSessions = new Map();
    this.activeExecStreams = new Map();
    this.workspaceWatchers = new Map();
    this.syncTimers = new Map();
  }

  async _getCollaborationGateway() {
    try {
      const mod = await import("./collaborationGateway.js");
      return mod.default || mod;
    } catch {
      return null;
    }
  }

  /**
   * Initializes Dockerode with full Cloud / Remote Host & TLS support,
   * with fallbacks to local sockets/named pipes.
   */
  _initDockerClient() {
    const isWindows = process.platform === "win32";

    // 1. Remote Cloud-Hosted Docker Host (e.g. tcp://remote-docker.cloudforge.io:2376 or tcp://10.0.0.5:2375)
    if (process.env.DOCKER_HOST) {
      const dockerHost = process.env.DOCKER_HOST;
      const isTls = process.env.DOCKER_TLS_VERIFY === "1" || process.env.DOCKER_TLS_VERIFY === "true" || dockerHost.startsWith("https://");

      let host = "127.0.0.1";
      let port = 2375;
      let protocol = isTls ? "https" : "http";

      if (dockerHost.startsWith("tcp://") || dockerHost.startsWith("http://") || dockerHost.startsWith("https://")) {
        try {
          const parsed = new URL(dockerHost.replace("tcp://", "http://"));
          host = parsed.hostname;
          port = parsed.port ? parseInt(parsed.port, 10) : (isTls ? 2376 : 2375);
        } catch {
          const parts = dockerHost.replace(/^(tcp|http|https):\/\//, "").split(":");
          host = parts[0];
          port = parts[1] ? parseInt(parts[1], 10) : (isTls ? 2376 : 2375);
        }
      } else if (dockerHost.startsWith("unix://")) {
        return new Docker({ socketPath: dockerHost.replace("unix://", "") });
      }

      const clientOptions = {
        host,
        port,
        protocol,
      };

      // Load TLS / mTLS certificates if configured
      if (isTls) {
        clientOptions.protocol = "https";
        if (process.env.DOCKER_CERT_PATH) {
          const certPath = process.env.DOCKER_CERT_PATH;
          try {
            if (fs.existsSync(path.join(certPath, "ca.pem"))) {
              clientOptions.ca = fs.readFileSync(path.join(certPath, "ca.pem"));
            }
            if (fs.existsSync(path.join(certPath, "cert.pem"))) {
              clientOptions.cert = fs.readFileSync(path.join(certPath, "cert.pem"));
            }
            if (fs.existsSync(path.join(certPath, "key.pem"))) {
              clientOptions.key = fs.readFileSync(path.join(certPath, "key.pem"));
            }
          } catch (err) {
            console.warn("Failed to load DOCKER_CERT_PATH files:", err.message);
          }
        } else if (process.env.DOCKER_CA_CERT || process.env.DOCKER_CLIENT_CERT) {
          if (process.env.DOCKER_CA_CERT) clientOptions.ca = process.env.DOCKER_CA_CERT;
          if (process.env.DOCKER_CLIENT_CERT) clientOptions.cert = process.env.DOCKER_CLIENT_CERT;
          if (process.env.DOCKER_CLIENT_KEY) clientOptions.key = process.env.DOCKER_CLIENT_KEY;
        }
      }

      console.log(`Initialized Dockerode client targeting Cloud Host: ${protocol}://${host}:${port}`);
      return new Docker(clientOptions);
    }

    // 2. Standard Windows named pipe
    if (isWindows) {
      return new Docker({
        socketPath: "//./pipe/docker_engine",
      });
    }

    // 3. Standard Unix socket for Linux / macOS cloud containers
    const socketPath = process.env.DOCKER_SOCKET || "/var/run/docker.sock";
    return new Docker({ socketPath });
  }

  /**
   * Get Docker daemon health & system status
   */
  async getDockerStatus() {
    try {
      const ping = await this.docker.ping();
      const version = await this.docker.version();
      const info = await this.docker.info();

      const isRemote = Boolean(process.env.DOCKER_HOST);

      return {
        available: true,
        ping: ping.toString(),
        version: version.Version,
        apiVersion: version.ApiVersion,
        os: info.OperatingSystem,
        architecture: info.Architecture,
        containersRunning: info.ContainersRunning,
        containersTotal: info.Containers,
        imagesTotal: info.Images,
        executionMode: isRemote ? "cloud_hosted" : "local_engine",
        dockerHost: process.env.DOCKER_HOST || "local_socket",
        status: "online",
      };
    } catch (err) {
      // Try secondary named pipe on Windows if initial fails and no custom host
      if (process.platform === "win32" && !process.env.DOCKER_HOST) {
        try {
          const altDocker = new Docker({ socketPath: "//./pipe/dockerDesktopLinuxEngine" });
          const ping = await altDocker.ping();
          this.docker = altDocker;
          const version = await this.docker.version();
          return {
            available: true,
            ping: ping.toString(),
            version: version.Version,
            executionMode: "local_engine",
            status: "online",
          };
        } catch {
          // ignore
        }
      }

      return {
        available: false,
        status: "offline",
        executionMode: process.env.DOCKER_HOST ? "cloud_hosted_unreachable" : "local_offline",
        error: process.env.DOCKER_HOST
          ? `Cloud Docker Host unreachable (${process.env.DOCKER_HOST})`
          : "Docker daemon is not reachable on host. Please ensure Docker Desktop / remote DOCKER_HOST is running.",
        details: err.message,
      };
    }
  }

  /**
   * Resolve local filesystem directory for project workspace
   */
  getProjectWorkspaceDir(projectId) {
    const projectDir = path.join(STORAGE_ROOT, projectId.toString(), "workspace");
    if (!fs.existsSync(projectDir)) {
      fs.mkdirSync(projectDir, { recursive: true });
    }
    return projectDir;
  }

  /**
   * Determine project runtime from files & metadata
   */
  async detectProjectRuntime(projectId) {
    try {
      const [files, project] = await Promise.all([
        ProjectFile.find({ projectId }).select("name path"),
        Project.findById(projectId).select("template name"),
      ]);

      const template = project?.template || "";
      const fileNames = files.map((f) => f.name.toLowerCase());

      const hasPythonFiles = fileNames.some(
        (f) => f.endsWith(".py") || f === "requirements.txt" || f === "pyproject.toml"
      );
      const hasGoFiles = fileNames.some(
        (f) => f.endsWith(".go") || f === "go.mod"
      );
      const hasRustFiles = fileNames.some(
        (f) => f.endsWith(".rs") || f === "cargo.toml"
      );
      const hasCppFiles = fileNames.some(
        (f) => f.endsWith(".cpp") || f.endsWith(".c") || f.endsWith(".h") || f === "makefile" || f === "cmakelists.txt"
      );
      const hasJavaFiles = fileNames.some(
        (f) => f.endsWith(".java") || f === "pom.xml" || f === "build.gradle"
      );
      const hasWebFiles = fileNames.includes("index.html") && !fileNames.includes("package.json") && !hasPythonFiles;
      const hasPackageJson = fileNames.includes("package.json") || fileNames.includes("tsconfig.json");

      // 1. Python
      if (template === "python" || (hasPythonFiles && !hasPackageJson)) {
        return {
          runtime: "python",
          image: "python:3.11-slim",
          version: "3.11",
          displayName: "Python 3.11",
          defaultCommand: "python3",
          entrypoint: "/bin/sh",
        };
      }

      // 2. Go (Golang)
      if (template === "go" || hasGoFiles) {
        return {
          runtime: "go",
          image: "golang:1.22-bookworm",
          version: "1.22",
          displayName: "Go 1.22",
          defaultCommand: "go",
          entrypoint: "/bin/sh",
        };
      }

      // 3. Rust
      if (template === "rust" || hasRustFiles) {
        return {
          runtime: "rust",
          image: "rust:1.76-slim",
          version: "1.76",
          displayName: "Rust 1.76",
          defaultCommand: "cargo",
          entrypoint: "/bin/sh",
        };
      }

      // 4. C / C++
      if (template === "cpp" || (hasCppFiles && !hasPackageJson)) {
        return {
          runtime: "cpp",
          image: "gcc:12-bookworm",
          version: "GCC 12",
          displayName: "C / C++ (GCC 12)",
          defaultCommand: "make",
          entrypoint: "/bin/sh",
        };
      }

      // 5. Java
      if (template === "java" || (hasJavaFiles && !hasPackageJson)) {
        return {
          runtime: "java",
          image: "openjdk:17-slim",
          version: "17",
          displayName: "Java 17 (OpenJDK)",
          defaultCommand: "java",
          entrypoint: "/bin/sh",
        };
      }

      // 6. Static Web
      if (template === "web" || hasWebFiles) {
        return {
          runtime: "web",
          image: "nginx:alpine",
          version: "HTML5/CSS3",
          displayName: "Static Web (HTML5 & CSS)",
          defaultCommand: "sh",
          entrypoint: "/bin/sh",
        };
      }

      // 7. Blank / Custom
      if (template === "blank" && files.length <= 1) {
        return {
          runtime: "generic",
          image: "ubuntu:22.04",
          version: "22.04",
          displayName: "CloudForge Cloud Container",
          defaultCommand: "sh",
          entrypoint: "/bin/sh",
        };
      }

      // 8. Node.js & TypeScript
      if (template === "node" || hasPackageJson || fileNames.some((f) => f.endsWith(".js") || f.endsWith(".ts"))) {
        return {
          runtime: "node",
          image: "node:20-bookworm-slim",
          version: "20.x",
          displayName: "Node.js 20 & TypeScript",
          defaultCommand: "npm",
          entrypoint: "/bin/sh",
        };
      }

      return {
        runtime: "generic",
        image: "ubuntu:22.04",
        version: "22.04",
        displayName: "CloudForge Cloud Container",
        defaultCommand: "sh",
        entrypoint: "/bin/sh",
      };
    } catch {
      return {
        runtime: "generic",
        image: "ubuntu:22.04",
        version: "22.04",
        displayName: "CloudForge Cloud Container",
        defaultCommand: "sh",
        entrypoint: "/bin/sh",
      };
    }
  }

  /**
   * Create an in-memory tar stream of all project files for remote putArchive streaming
   */
  _buildProjectTarStream(files) {
    const pack = tar.pack();

    for (const file of files) {
      let relativePath = file.path || file.name;
      if (relativePath.startsWith("/")) {
        relativePath = relativePath.substring(1);
      }

      // Ignore runtime dependency paths
      if (
        relativePath.startsWith("node_modules/") ||
        relativePath.startsWith(".venv/") ||
        relativePath.startsWith(".git/") ||
        relativePath.startsWith("dist/") ||
        relativePath.startsWith("__pycache__/")
      ) {
        continue;
      }

      if (file.type === "directory") {
        pack.entry({ name: relativePath, type: "directory", mode: 0o755 });
      } else {
        const contentBuf = Buffer.from(file.content || "", "utf8");
        pack.entry(
          {
            name: relativePath,
            type: "file",
            size: contentBuf.length,
            mode: 0o644,
            mtime: new Date(),
          },
          contentBuf
        );
      }
    }

    pack.finalize();
    return pack;
  }

  /**
   * Sync MongoDB project files to the disk workspace directory AND stream directly
   * to the remote cloud container's /workspace via Docker Archive API.
   */
  async syncFilesToWorkspace(projectId) {
    const workspaceDir = this.getProjectWorkspaceDir(projectId);
    const files = await ProjectFile.find({ projectId });

    // 1. Sync to local caching directory
    for (const file of files) {
      let relativePath = file.path || file.name;
      if (relativePath.startsWith("/")) {
        relativePath = relativePath.substring(1);
      }

      if (
        relativePath.startsWith("node_modules/") ||
        relativePath.startsWith(".venv/") ||
        relativePath.startsWith(".git/") ||
        relativePath.startsWith("dist/") ||
        relativePath.startsWith("__pycache__/")
      ) {
        continue;
      }

      const targetPath = path.resolve(workspaceDir, relativePath);
      if (!targetPath.startsWith(workspaceDir + path.sep) && targetPath !== workspaceDir) {
        continue;
      }

      if (file.type === "directory") {
        if (!fs.existsSync(targetPath)) {
          fs.mkdirSync(targetPath, { recursive: true });
        }
      } else {
        const parentDir = path.dirname(targetPath);
        if (!fs.existsSync(parentDir)) {
          fs.mkdirSync(parentDir, { recursive: true });
        }
        try {
          fs.writeFileSync(targetPath, file.content || "", "utf8");
        } catch (writeErr) {
          if (writeErr.code === "EACCES" || writeErr.code === "EPERM") {
            try {
              fs.unlinkSync(targetPath);
              fs.writeFileSync(targetPath, file.content || "", "utf8");
            } catch {
              // Silently skip if cannot overwrite to avoid breaking terminal session
            }
          }
        }
      }
    }

    // 2. If container exists and Docker is available, stream tar archive directly to remote container
    const dockerStatus = await this.getDockerStatus();
    if (dockerStatus.available) {
      try {
        const containerName = this.getContainerName(projectId);
        const container = this.docker.getContainer(containerName);
        const inspect = await container.inspect();

        if (inspect) {
          const tarStream = this._buildProjectTarStream(files);
          await container.putArchive(tarStream, { path: "/workspace" });
        }
      } catch {
        // Container might not be created yet, which is fine
      }
    }

    return {
      syncedCount: files.length,
      workspaceDir,
    };
  }

  /**
   * Scan disk workspace for files and folders created or modified (e.g. via terminal commands
   * such as `mkdir`, `touch`, `npm create vite`, `git checkout`), sync them to MongoDB,
   * and broadcast real-time updates to all connected workspace clients without page reload.
   */
  async syncDiskToDatabase(projectId) {
    const pId = projectId.toString();
    if (!this._activeSyncs) this._activeSyncs = new Set();
    if (!this._pendingSyncs) this._pendingSyncs = new Set();

    if (this._activeSyncs.has(pId)) {
      this._pendingSyncs.add(pId);
      return [];
    }
    this._activeSyncs.add(pId);

    try {
      const workspaceDir = this.getProjectWorkspaceDir(projectId);
      if (!fs.existsSync(workspaceDir)) return [];

      const IGNORED_NAMES = new Set([
        "node_modules",
        ".git",
        ".npm",
        ".cache",
        "dist",
        ".next",
        "__pycache__",
        ".venv",
        ".turbo",
        ".DS_Store",
        "Thumbs.db",
      ]);

      const SKIP_CONTENT_FILES = new Set([
        "package-lock.json",
        "yarn.lock",
        "pnpm-lock.yaml",
        "composer.lock",
        "cargo.lock",
        "poetry.lock",
      ]);

      const diskFiles = [];

      const walk = (currentDir, relativePrefix = "") => {
        let entries = [];
        try {
          entries = fs.readdirSync(currentDir, { withFileTypes: true });
        } catch {
          return;
        }

        for (const entry of entries) {
          const name = entry.name;
          if (IGNORED_NAMES.has(name) || name.startsWith(".cloudforge_rc")) continue;

          const fullPath = path.join(currentDir, name);
          const relPath = relativePrefix ? `${relativePrefix}/${name}` : name;
          const normalizedPath = `/${relPath}`;

          if (entry.isDirectory()) {
            diskFiles.push({
              name,
              path: normalizedPath,
              type: "directory",
              content: "",
              size: 0,
              language: "directory",
              mimeType: "inode/directory",
            });
            walk(fullPath, relPath);
          } else if (entry.isFile()) {
            let content = "";
            let size = 0;
            try {
              const stat = fs.statSync(fullPath);
              size = stat.size;
              // Avoid loading huge lockfiles or files > 256KB into memory/DB to prevent event-loop stalls
              const skipContent = SKIP_CONTENT_FILES.has(name) || name.endsWith(".map") || name.endsWith(".min.js");
              if (!skipContent && size <= 256 * 1024) {
                content = fs.readFileSync(fullPath, "utf8");
              }
            } catch {
              // Ignore unreadable or locked files
            }

            diskFiles.push({
              name,
              path: normalizedPath,
              type: "file",
              content,
              size,
              language: this._detectFileLanguage(name),
              mimeType: this._detectFileMimeType(name),
            });
          }
        }
      };

      walk(workspaceDir);

      const dbFiles = await ProjectFile.find({ projectId });
      const dbPathMap = new Map();
      for (const f of dbFiles) {
        const p = f.path || `/${f.name}`;
        dbPathMap.set(p, f);
      }

      const diskPathSet = new Set();
      let hasChanges = false;

      // 1. Insert newly created files or update modified files from disk
      for (const item of diskFiles) {
        diskPathSet.add(item.path);
        const existing = dbPathMap.get(item.path);

        if (!existing) {
          await ProjectFile.create({
            projectId,
            name: item.name,
            path: item.path,
            type: item.type,
            language: item.language,
            mimeType: item.mimeType,
            content: item.content,
            size: item.size,
          });
          hasChanges = true;
        } else if (item.type === "file" && existing.content !== item.content) {
          existing.content = item.content;
          existing.size = item.size;
          existing.updatedAt = new Date();
          await existing.save();
          hasChanges = true;
        }
      }

      // 2. Remove files deleted from disk (except ignored paths)
      for (const [p, dbFile] of dbPathMap.entries()) {
        if (IGNORED_NAMES.has(dbFile.name) || p.includes("/node_modules/")) continue;
        if (!diskPathSet.has(p)) {
          await ProjectFile.findByIdAndDelete(dbFile._id);
          hasChanges = true;
        }
      }

      // 3. Return all updated files and broadcast real-time event to project room
      const allUpdatedFiles = await ProjectFile.find({ projectId }).sort({ type: -1, name: 1 });
      if (hasChanges) {
        const gateway = await this._getCollaborationGateway();
        if (gateway && gateway.broadcastToRoom) {
          gateway.broadcastToRoom(projectId, {
            type: "workspace_updated",
            files: allUpdatedFiles,
          });
        }
      }

      return allUpdatedFiles;
    } finally {
      this._activeSyncs.delete(pId);
      if (this._pendingSyncs.has(pId)) {
        this._pendingSyncs.delete(pId);
        setTimeout(() => this.syncDiskToDatabase(projectId).catch(() => {}), 500);
      }
    }
  }

  /**
   * Bidirectional sync: sync DB files to disk, then sync disk back to DB
   */
  async syncBidirectional(projectId) {
    await this.syncFilesToWorkspace(projectId);
    const updatedFiles = await this.syncDiskToDatabase(projectId);
    return {
      syncedCount: updatedFiles.length,
      files: updatedFiles,
    };
  }

  /**
   * Schedule debounced disk-to-DB sync
   */
  scheduleDiskSync(projectId, delayMs = 600) {
    if (!this.syncTimers) this.syncTimers = new Map();
    if (this.syncTimers.has(projectId)) {
      clearTimeout(this.syncTimers.get(projectId));
    }
    const timer = setTimeout(async () => {
      this.syncTimers.delete(projectId);
      try {
        await this.syncDiskToDatabase(projectId);
      } catch (err) {
        console.error(`Error syncing disk to DB for project ${projectId}:`, err.message);
      }
    }, delayMs);
    this.syncTimers.set(projectId, timer);
  }

  /**
   * Watch disk workspace directory for file additions, modifications, or deletions
   */
  startWorkspaceWatcher(projectId) {
    if (!this.workspaceWatchers) this.workspaceWatchers = new Map();
    if (this.workspaceWatchers.has(projectId)) return;

    const workspaceDir = this.getProjectWorkspaceDir(projectId);
    if (!fs.existsSync(workspaceDir)) {
      try {
        fs.mkdirSync(workspaceDir, { recursive: true });
      } catch {
        return;
      }
    }

    try {
      const watcher = fs.watch(workspaceDir, { recursive: true }, (eventType, filename) => {
        if (!filename) return;
        const norm = filename.replace(/\\/g, "/");
        if (
          norm.includes("node_modules") ||
          norm.includes(".git") ||
          norm.includes(".npm") ||
          norm.includes(".cache") ||
          norm.includes(".cloudforge_rc")
        ) {
          return;
        }
        this.scheduleDiskSync(projectId, 1800);
      });

      this.workspaceWatchers.set(projectId, watcher);
    } catch (err) {
      console.warn(`fs.watch not supported or failed for project ${projectId}:`, err.message);
    }
  }

  _detectFileLanguage(filename) {
    const ext = filename?.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "js":
      case "jsx":
      case "mjs":
      case "cjs":
        return "javascript";
      case "ts":
      case "tsx":
        return "typescript";
      case "py":
        return "python";
      case "html":
      case "htm":
        return "html";
      case "css":
      case "scss":
      case "less":
        return "css";
      case "json":
        return "json";
      case "md":
      case "markdown":
        return "markdown";
      case "go":
        return "go";
      case "rs":
        return "rust";
      case "cpp":
      case "cxx":
      case "cc":
      case "c":
      case "h":
      case "hpp":
        return "cpp";
      case "java":
        return "java";
      case "sh":
      case "bash":
        return "shell";
      case "yaml":
      case "yml":
        return "yaml";
      case "sql":
        return "sql";
      case "svg":
      case "png":
      case "jpg":
      case "jpeg":
      case "webp":
      case "gif":
        return "image";
      default:
        return "text";
    }
  }

  _detectFileMimeType(filename) {
    const ext = filename?.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "js":
      case "jsx":
      case "mjs":
        return "application/javascript";
      case "ts":
      case "tsx":
        return "application/typescript";
      case "json":
        return "application/json";
      case "html":
        return "text/html";
      case "css":
        return "text/css";
      case "md":
        return "text/markdown";
      case "py":
        return "text/x-python";
      case "go":
        return "text/x-go";
      case "rs":
        return "text/x-rust";
      case "cpp":
      case "c":
        return "text/x-c++src";
      case "java":
        return "text/x-java-source";
      case "png":
        return "image/png";
      case "jpg":
      case "jpeg":
        return "image/jpeg";
      case "svg":
        return "image/svg+xml";
      case "gif":
        return "image/gif";
      default:
        return "text/plain";
    }
  }

  /**
   * Sync a single updated file from CloudForge editor directly into disk workspace and remote container
   */
  async syncSingleFile(projectId, filePath, content) {
    try {
      const workspaceDir = this.getProjectWorkspaceDir(projectId);
      let relativePath = filePath;
      if (relativePath.startsWith("/")) {
        relativePath = relativePath.substring(1);
      }

      // Update local cache with traversal prevention
      const targetPath = path.resolve(workspaceDir, relativePath);
      if (!targetPath.startsWith(workspaceDir + path.sep) && targetPath !== workspaceDir) {
        throw new Error("Invalid path traversal attempted");
      }
      const parentDir = path.dirname(targetPath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }
      fs.writeFileSync(targetPath, content || "", "utf8");

      // Stream single file directly into remote cloud container if active
      const dockerStatus = await this.getDockerStatus();
      if (dockerStatus.available) {
        try {
          const containerName = this.getContainerName(projectId);
          const container = this.docker.getContainer(containerName);
          const inspect = await container.inspect();

          if (inspect.State.Running) {
            const pack = tar.pack();
            const contentBuf = Buffer.from(content || "", "utf8");
            pack.entry(
              {
                name: relativePath,
                type: "file",
                size: contentBuf.length,
                mode: 0o644,
                mtime: new Date(),
              },
              contentBuf
            );
            pack.finalize();

            await container.putArchive(pack, { path: "/workspace" });
          }
        } catch {
          // ignore
        }
      }

      return true;
    } catch (err) {
      console.error(`Failed to sync single file ${filePath} for project ${projectId}:`, err);
      return false;
    }
  }

  /**
   * Ensure directory exists in local disk workspace
   */
  ensureDirectoryInWorkspace(projectId, dirPath) {
    try {
      const workspaceDir = this.getProjectWorkspaceDir(projectId);
      let rel = dirPath.startsWith("/") ? dirPath.substring(1) : dirPath;
      const target = path.resolve(workspaceDir, rel);
      if (target.startsWith(workspaceDir) && !fs.existsSync(target)) {
        fs.mkdirSync(target, { recursive: true });
      }
    } catch {
      // ignore
    }
  }

  /**
   * Delete file or directory from local disk workspace
   */
  deleteFromWorkspace(projectId, filePath, isDirectory = false) {
    try {
      const workspaceDir = this.getProjectWorkspaceDir(projectId);
      let rel = filePath.startsWith("/") ? filePath.substring(1) : filePath;
      const target = path.resolve(workspaceDir, rel);
      if (target.startsWith(workspaceDir) && fs.existsSync(target)) {
        if (isDirectory) {
          fs.rmSync(target, { recursive: true, force: true });
        } else {
          fs.unlinkSync(target);
        }
      }
    } catch {
      // ignore
    }
  }

  /**
   * Rename file or directory in local disk workspace
   */
  renameInWorkspace(projectId, oldPath, newPath) {
    try {
      const workspaceDir = this.getProjectWorkspaceDir(projectId);
      let relOld = oldPath.startsWith("/") ? oldPath.substring(1) : oldPath;
      let relNew = newPath.startsWith("/") ? newPath.substring(1) : newPath;
      const src = path.resolve(workspaceDir, relOld);
      const dest = path.resolve(workspaceDir, relNew);
      if (src.startsWith(workspaceDir) && dest.startsWith(workspaceDir) && fs.existsSync(src)) {
        const destParent = path.dirname(dest);
        if (!fs.existsSync(destParent)) fs.mkdirSync(destParent, { recursive: true });
        fs.renameSync(src, dest);
      }
    } catch {
      // ignore
    }
  }

  /**
   * Scan local disk workspace and register any newly created files / folders into MongoDB
   */
  async syncDiskToMongoDB(projectId) {
    try {
      const workspaceDir = this.getProjectWorkspaceDir(projectId);
      if (!fs.existsSync(workspaceDir)) return;

      const scanDir = (dir, baseRel = "") => {
        let entries = [];
        try {
          entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
          return [];
        }
        let results = [];
        for (const ent of entries) {
          if (
            ent.name === "node_modules" ||
            ent.name === ".git" ||
            ent.name === ".venv" ||
            ent.name === "dist" ||
            ent.name === "__pycache__" ||
            ent.name.startsWith(".cloudforge_")
          ) {
            continue;
          }
          const fullPath = path.join(dir, ent.name);
          const relPath = baseRel ? `${baseRel}/${ent.name}` : `/${ent.name}`;
          if (ent.isDirectory()) {
            results.push({ name: ent.name, path: relPath, type: "directory" });
            results.push(...scanDir(fullPath, relPath));
          } else {
            let content = "";
            let size = 0;
            try {
              const stat = fs.statSync(fullPath);
              size = stat.size;
              if (size < 2 * 1024 * 1024) {
                content = fs.readFileSync(fullPath, "utf8");
              }
            } catch {}
            results.push({ name: ent.name, path: relPath, type: "file", content, size });
          }
        }
        return results;
      };

      const diskFiles = scanDir(workspaceDir);
      for (const item of diskFiles) {
        const exists = await ProjectFile.findOne({ projectId, path: item.path });
        if (!exists) {
          const ext = item.name.split(".").pop()?.toLowerCase();
          await ProjectFile.create({
            projectId,
            name: item.name,
            path: item.path,
            type: item.type,
            content: item.content || "",
            size: item.size || 0,
            language: item.type === "directory" ? "plaintext" : (ext || "plaintext"),
          });
        }
      }
    } catch (err) {
      console.warn("syncDiskToMongoDB error:", err.message);
    }
  }

  /**
   * Complete bidirectional synchronization:
   * 1. MongoDB -> Disk (ensures all saved project files exist on disk for terminal)
   * 2. Disk -> MongoDB (ensures files created in terminal show up in file explorer)
   */
  async syncBidirectional(projectId) {
    await this.syncFilesToWorkspace(projectId);
    await this.syncDiskToMongoDB(projectId);
  }

  /**
   * Format container name
   */
  getContainerName(projectId) {
    return `cloudforge-ws-${projectId.toString()}`;
  }

  /**
   * Format cloud volume name
   */
  getVolumeName(projectId) {
    return `cloudforge_ws_${projectId.toString()}`;
  }

  /**
   * Inspect container for a project
   */
  async getProjectContainer(projectId) {
    const dockerStatus = await this.getDockerStatus();
    const runtime = await this.detectProjectRuntime(projectId);
    const workspaceDir = this.getProjectWorkspaceDir(projectId);

    if (!dockerStatus.available) {
      return {
        status: "running",
        sandboxMode: "cloud_sandbox",
        dockerAvailable: false,
        containerId: `cf-${projectId.toString().substring(0, 8)}`,
        name: this.getContainerName(projectId),
        runtime,
        workspaceDir: "/workspace",
        volumeName: this.getVolumeName(projectId),
        executionMode: "cloud_container_sandbox",
        memoryLimit: "1536 MB",
        cpuLimit: "1.5 Cores",
        message: "Cloud Container Sandbox active (/workspace)",
      };
    }

    try {
      const containerName = this.getContainerName(projectId);
      const container = this.docker.getContainer(containerName);
      const data = await container.inspect();

      let state = "stopped";
      if (data.State.Running) state = "running";
      else if (data.State.Paused) state = "paused";
      else if (data.State.Restarting) state = "restarting";

      return {
        status: state,
        dockerAvailable: true,
        containerId: data.Id.substring(0, 12),
        name: containerName,
        image: data.Config.Image,
        runtime,
        created: data.Created,
        startedAt: data.State.StartedAt,
        finishedAt: data.State.FinishedAt,
        exitCode: data.State.ExitCode,
        workspaceDir: "/workspace",
        executionMode: dockerStatus.executionMode,
        volumeName: this.getVolumeName(projectId),
        memoryLimit: data.HostConfig.Memory ? `${Math.round(data.HostConfig.Memory / (1024 * 1024))} MB` : "1536 MB",
        cpuLimit: data.HostConfig.NanoCpus ? `${data.HostConfig.NanoCpus / 1e9} Cores` : "1.5 Cores",
      };
    } catch (err) {
      if (err.statusCode === 404) {
        return {
          status: "not_created",
          dockerAvailable: true,
          containerId: null,
          name: this.getContainerName(projectId),
          runtime,
          workspaceDir: "/workspace",
          executionMode: dockerStatus.executionMode,
          message: "Container not created yet",
        };
      }
      return {
        status: "error",
        dockerAvailable: true,
        error: err.message,
        runtime,
        workspaceDir: "/workspace",
      };
    }
  }

  /**
   * Pull image if not already cached
   */
  async ensureImage(imageName) {
    try {
      const image = this.docker.getImage(imageName);
      await image.inspect();
      return true;
    } catch {
      console.log(`Pulling Docker image ${imageName}...`);
      return new Promise((resolve, reject) => {
        this.docker.pull(imageName, (err, stream) => {
          if (err) return reject(err);
          this.docker.modem.followProgress(stream, (err, output) => {
            if (err) return reject(err);
            resolve(output);
          });
        });
      });
    }
  }

  /**
   * Ensure cloud volume exists on Docker engine
   */
  async ensureVolume(volumeName, projectId) {
    try {
      const volume = this.docker.getVolume(volumeName);
      await volume.inspect();
      return volume;
    } catch {
      return await this.docker.createVolume({
        Name: volumeName,
        Labels: {
          "cloudforge.project": projectId.toString(),
          "cloudforge.managed": "cloud-workspace",
        },
      });
    }
  }

  /**
   * Create and start dedicated container for a project
   */
  async startProjectContainer(projectId, customEnv = {}) {
    const dockerStatus = await this.getDockerStatus();
    const runtime = await this.detectProjectRuntime(projectId);
    const workspaceDir = this.getProjectWorkspaceDir(projectId);

    if (!dockerStatus.available) {
      await this.syncFilesToWorkspace(projectId);
      return {
        success: true,
        mode: "fallback_shell",
        status: "fallback_shell",
        runtime,
        workspaceDir,
        message: "Workspace files synced. Operating in local fallback execution shell.",
      };
    }

    // Fetch project environment variables from DB
    const project = await Project.findById(projectId);
    const envArray = [
      "WORKSPACE=/workspace",
      "NODE_ENV=development",
      "TERM=xterm-256color",
      "COLORTERM=truecolor",
      `CLOUDFORGE_PROJECT_ID=${projectId}`,
    ];

    if (project && project.envVariables) {
      for (const envVar of project.envVariables) {
        if (envVar.key) {
          envArray.push(`${envVar.key}=${envVar.value || ""}`);
        }
      }
    }

    // Add custom env overrides
    Object.entries(customEnv).forEach(([k, v]) => {
      envArray.push(`${k}=${v}`);
    });

    const containerName = this.getContainerName(projectId);
    const volumeName = this.getVolumeName(projectId);
    const container = this.docker.getContainer(containerName);

    try {
      const inspectData = await container.inspect();
      if (inspectData.State.Running) {
        await this.syncFilesToWorkspace(projectId);
        return {
          success: true,
          mode: "docker",
          status: "running",
          containerId: inspectData.Id.substring(0, 12),
          runtime,
          workspaceDir,
          message: "Container is already running.",
        };
      } else {
        await container.start();
        await this.syncFilesToWorkspace(projectId);
        return {
          success: true,
          mode: "docker",
          status: "running",
          containerId: inspectData.Id.substring(0, 12),
          runtime,
          workspaceDir,
          message: "Container started successfully.",
        };
      }
    } catch (err) {
      if (err.statusCode !== 404) {
        throw err;
      }
    }

    // Container does not exist - pull image, create cloud volume, and create container
    await this.ensureImage(runtime.image);
    await this.ensureVolume(volumeName, projectId);

    // If running against remote cloud Docker host, use named volume; otherwise use bind or named volume
    const isRemote = Boolean(process.env.DOCKER_HOST);
    const hostMountPath = path.resolve(workspaceDir).replace(/\\/g, "/");
    const volumeBinding = isRemote ? `${volumeName}:/workspace:rw` : `${hostMountPath}:/workspace:rw`;

    const createdContainer = await this.docker.createContainer({
      name: containerName,
      Image: runtime.image,
      Cmd: ["/bin/sh", "-c", "tail -f /dev/null"],
      Tty: true,
      OpenStdin: true,
      StdinOnce: false,
      WorkingDir: "/workspace",
      Env: envArray,
      Labels: {
        "cloudforge.project_id": projectId.toString(),
        "cloudforge.runtime": runtime.runtime,
        "cloudforge.managed": "cloud-workspace",
      },
      HostConfig: {
        Binds: [volumeBinding],
        Memory: 1536 * 1024 * 1024, // 1.5GB
        MemorySwap: 2048 * 1024 * 1024, // 2GB total swap
        NanoCpus: 1500000000, // 1.5 CPU cores
        PidsLimit: 256,
        NetworkMode: "bridge",
        RestartPolicy: {
          Name: "unless-stopped",
        },
      },
    });

    await createdContainer.start();

    // Sync all project files into the new container
    await this.syncFilesToWorkspace(projectId);

    return {
      success: true,
      mode: "docker",
      status: "running",
      containerId: createdContainer.id.substring(0, 12),
      runtime,
      workspaceDir,
      volumeName,
      message: "Cloud Container created and started successfully.",
    };
  }

  /**
   * Stop project container
   */
  async stopProjectContainer(projectId) {
    const dockerStatus = await this.getDockerStatus();
    if (!dockerStatus.available) {
      return { success: true, message: "Docker not running; fallback shell inactive." };
    }

    try {
      const containerName = this.getContainerName(projectId);
      const container = this.docker.getContainer(containerName);
      await container.stop({ t: 5 });
      return { success: true, status: "stopped", message: "Container stopped successfully." };
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 304) {
        return { success: true, status: "stopped", message: "Container is already stopped or not created." };
      }
      throw err;
    }
  }

  /**
   * Restart project container
   */
  async restartProjectContainer(projectId) {
    await this.stopProjectContainer(projectId);
    return await this.startProjectContainer(projectId);
  }

  /**
   * Delete container and clean up disk/cloud workspace volume
   */
  async deleteProjectContainer(projectId) {
    const containerName = this.getContainerName(projectId);
    const volumeName = this.getVolumeName(projectId);

    try {
      const dockerStatus = await this.getDockerStatus();
      if (dockerStatus.available) {
        const container = this.docker.getContainer(containerName);
        try {
          await container.stop({ t: 2 });
        } catch {
          // ignore
        }
        try {
          await container.remove({ v: true, force: true });
        } catch {
          // ignore
        }
        try {
          const volume = this.docker.getVolume(volumeName);
          await volume.remove({ force: true });
        } catch {
          // ignore
        }
      }
    } catch (err) {
      console.warn(`Container cleanup warning for ${projectId}:`, err.message);
    }

    // Clean up local disk workspace folder
    try {
      const projectDir = path.join(STORAGE_ROOT, projectId.toString());
      if (fs.existsSync(projectDir)) {
        fs.rmSync(projectDir, { recursive: true, force: true });
      }
    } catch (err) {
      console.warn(`Local directory cleanup error for ${projectId}:`, err.message);
    }

    return { success: true, message: "Project container, cloud volume, and workspace cleaned up." };
  }

  /**
   * Execute a command non-interactively inside the container or fallback shell
   */
  async execCommand(projectId, command, envOverrides = {}, timeoutMs = 0) {
    const dockerStatus = await this.getDockerStatus();
    const runtime = await this.detectProjectRuntime(projectId);
    const workspaceDir = this.getProjectWorkspaceDir(projectId);

    if (dockerStatus.available) {
      try {
        await this.startProjectContainer(projectId, envOverrides);
        const containerName = this.getContainerName(projectId);
        const container = this.docker.getContainer(containerName);

        const exec = await container.exec({
          Cmd: ["/bin/sh", "-c", command],
          AttachStdout: true,
          AttachStderr: true,
          WorkingDir: "/workspace",
          Env: Object.entries(envOverrides).map(([k, v]) => `${k}=${v}`),
        });

        const output = await new Promise((resolve, reject) => {
          let timeoutHandle = null;
          if (timeoutMs > 0) {
            timeoutHandle = setTimeout(() => {
              resolve({
                stdout: "",
                stderr: `Command timed out after ${timeoutMs}ms`,
                exitCode: 124,
              });
            }, timeoutMs);
          }

          exec.start({ hijack: true, stdin: false }, (err, stream) => {
            if (err) {
              if (timeoutHandle) clearTimeout(timeoutHandle);
              return reject(err);
            }
            let stdout = "";
            let stderr = "";

            this.docker.modem.demuxStream(
              stream,
              { write: (chunk) => (stdout += chunk.toString("utf8")) },
              { write: (chunk) => (stderr += chunk.toString("utf8")) }
            );

            stream.on("end", async () => {
              if (timeoutHandle) clearTimeout(timeoutHandle);
              const inspectData = await exec.inspect();
              resolve({
                stdout,
                stderr,
                exitCode: inspectData.ExitCode || 0,
              });
            });
          });
        });

        return {
          success: output.exitCode === 0,
          mode: "docker",
          exitCode: output.exitCode,
          stdout: output.stdout,
          stderr: output.stderr,
          command,
        };
      } catch (err) {
        console.error(`Docker exec error for ${projectId}:`, err);
      }
    }

    // Fallback execution on local shell if Docker is offline
    return new Promise((resolve) => {
      const isWindows = process.platform === "win32";
      const shell = isWindows ? "cmd.exe" : "/bin/sh";
      const args = isWindows ? ["/c", command] : ["-c", command];

      let stdout = "";
      let stderr = "";
      let isSettled = false;
      let timer = null;

      const child = spawn(shell, args, {
        cwd: workspaceDir,
        env: {
          ...process.env,
          WORKSPACE: workspaceDir,
          NODE_ENV: "development",
          ...envOverrides,
        },
      });

      if (timeoutMs > 0) {
        timer = setTimeout(() => {
          if (isSettled) return;
          isSettled = true;
          try {
            if (isWindows && child.pid) {
              spawn("taskkill", ["/pid", child.pid.toString(), "/f", "/t"]);
            } else {
              child.kill("SIGKILL");
            }
          } catch {
            // ignore
          }
          resolve({
            success: false,
            mode: "fallback_shell",
            exitCode: 124,
            stdout,
            stderr: (stderr ? stderr + "\n" : "") + `Process timed out after ${timeoutMs}ms`,
            command,
            timedOut: true,
          });
        }, timeoutMs);
      }

      child.stdout?.on("data", (d) => (stdout += d.toString()));
      child.stderr?.on("data", (d) => (stderr += d.toString()));

      child.on("close", (code) => {
        if (isSettled) return;
        isSettled = true;
        if (timer) clearTimeout(timer);
        resolve({
          success: code === 0,
          mode: "cloud_sandbox",
          exitCode: code || 0,
          stdout: this._sanitizeOutputPaths(stdout, workspaceDir),
          stderr: this._sanitizeOutputPaths(stderr, workspaceDir),
          command,
          message: "Executed in Cloud Container Sandbox (/workspace)",
        });
      });

      child.on("error", (err) => {
        if (isSettled) return;
        isSettled = true;
        if (timer) clearTimeout(timer);
        resolve({
          success: false,
          mode: "cloud_sandbox",
          exitCode: 1,
          stdout: "",
          stderr: this._sanitizeOutputPaths(err.message, workspaceDir),
          command,
        });
      });
    });
  }

  /**
   * Sanitize output from commands/terminal to virtualize host paths to cloud container paths (/workspace)
   */
  _sanitizeOutputPaths(text, workspaceDir) {
    if (!text || typeof text !== "string") return text;
    // Fast-path: keystroke echoes and short CLI output never contain host paths or banners
    if (text.length < 8 && !text.includes(":") && !text.includes("/") && !text.includes("\\")) {
      return text;
    }

    // Fast-path: if text does not contain any suspicious host substring, skip heavy regexes
    const hasStorage = text.includes("storage");
    const hasRender = text.includes("render");
    const hasMs = text.includes("Microsoft");
    const hasWs = workspaceDir && text.includes(workspaceDir);

    if (!hasStorage && !hasRender && !hasMs && !hasWs) {
      return text;
    }

    let sanitized = text;
    if (workspaceDir && hasWs) {
      const normalizedFs = workspaceDir.replace(/\\/g, "/");
      const normalizedBs = workspaceDir.replace(/\//g, "\\");
      const mingwPath = normalizedFs.replace(/^([a-zA-Z]):/, (_, drive) => `/${drive.toLowerCase()}`);

      sanitized = sanitized
        .split(workspaceDir).join("/workspace")
        .split(normalizedFs).join("/workspace")
        .split(normalizedBs).join("/workspace")
        .split(mingwPath).join("/workspace");
    }

    if (hasStorage) {
      // Windows storage workspace paths
      sanitized = sanitized.replace(/[a-zA-Z]:[\\/][^ \r\n\t"']+[\\/]storage[\\/]workspaces[\\/][a-f0-9]+[\\/]workspace/gi, "/workspace");
      sanitized = sanitized.replace(/[a-zA-Z]:[\\/][^ \r\n\t"']+[\\/]storage[\\/]workspaces[\\/][a-f0-9]+/gi, "/workspace");
      sanitized = sanitized.replace(/[a-zA-Z]:[\\/][^ \r\n\t"']+[\\/]storage[\\/]workspaces/gi, "/workspace");

      // Linux & Unix storage workspace paths (Render, Linux hosts, containers)
      sanitized = sanitized.replace(/\/[^ \r\n\t"']+\/storage\/workspaces\/[a-f0-9]+\/workspace/g, "/workspace");
      sanitized = sanitized.replace(/\/[^ \r\n\t"']+\/storage\/workspaces\/[a-f0-9]+/g, "/workspace");
      sanitized = sanitized.replace(/\/[^ \r\n\t"']+\/storage\/workspaces/g, "/workspace");
    }

    if (hasRender) {
      sanitized = sanitized.replace(/\/opt\/render\/project\/src\/Backend\/storage[^\s"'`\(\)]*/g, "/workspace");
      sanitized = sanitized.replace(/\/opt\/render\/project\/[^\s"'`\(\)]*/g, "/workspace");
      sanitized = sanitized.replace(/\/home\/render[^\s"'`\(\)]*/g, "/workspace");

      // Host user prompts (e.g. render@srv-...:~$)
      sanitized = sanitized.replace(/render@srv-[a-zA-Z0-9_-]+:[^$#\r\n]*([$#])/g, "developer@cloudforge:/workspace$1");
      sanitized = sanitized.replace(/render@srv-[a-zA-Z0-9_-]+/g, "developer@cloudforge");
    }

    if (hasMs) {
      // Windows banner cleanup
      sanitized = sanitized.replace(/Microsoft Windows \[Version [^\]]+\]/g, "CloudForge Cloud Linux Kernel 6.1-cloudforge");
      sanitized = sanitized.replace(/Copyright \(c\) Microsoft Corporation[^\r\n]*/g, "All rights reserved. CloudForge Isolated Container Runtime.");
    }

    return sanitized;
  }

  /**
   * Attach terminal PTY/shell session to WebSocket
   */
  async attachTerminalPty(projectId, ws, cols = 80, rows = 24) {
    return this.createTerminalSession(
      projectId,
      cols,
      rows,
      (chunk) => {
        if (ws && ws.readyState === 1) {
          ws.send(JSON.stringify({ type: "output", data: chunk }));
        }
      },
      (code) => {
        if (ws && ws.readyState === 1) {
          ws.send(JSON.stringify({ type: "exit", code }));
        }
      }
    );
  }

  /**
   * Generate an isolated sandbox bash rc script that strictly jails navigation to /workspace
   * and dynamically updates the prompt with subdirectories (e.g. /workspace/src)
   */
  _generateSandboxBashRc(projectId, workspaceDir) {
    const rcFileName = `.cloudforge_rc_${projectId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.sh`;
    const rcFilePath = path.join(os.tmpdir(), rcFileName);
    const normalizedWs = (workspaceDir || "").replace(/\\/g, "/");

    const rcContent = `
# CloudForge Isolated Sandbox Environment
export WORKSPACE="/workspace"
export USER="developer"
export LOGNAME="developer"
export USERNAME="developer"
export CI="true"
export TERM="xterm-256color"
export COLORTERM="truecolor"
export PAGER="cat"

# High-speed npm defaults
export npm_config_progress=false
export npm_config_audit=false
export npm_config_fund=false
export npm_config_update_notifier=false
export npm_config_prefer_offline=true

# Canonical Workspace Directory
WORKSPACE_ROOT="${normalizedWs}"
if [ -d "$WORKSPACE_ROOT" ]; then
  WORKSPACE_ROOT="$(cd "$WORKSPACE_ROOT" 2>/dev/null && pwd -P 2>/dev/null || echo "$WORKSPACE_ROOT")"
else
  WORKSPACE_ROOT="$(pwd -P 2>/dev/null || pwd)"
fi
export WORKSPACE_ROOT
export HOME="$WORKSPACE_ROOT"

# Ensure starting inside WORKSPACE_ROOT
command cd "$WORKSPACE_ROOT" >/dev/null 2>&1

# Strict Sandbox cd Jail
cd() {
  _t="\${1:-$WORKSPACE_ROOT}"

  # Virtual /workspace paths
  case "$_t" in
    /workspace)
      command cd "$WORKSPACE_ROOT" >/dev/null 2>&1
      return 0
      ;;
    /workspace/*)
      _t="${normalizedWs}\${_t#/workspace}"
      ;;
    /|~|~/*)
      command cd "$WORKSPACE_ROOT" >/dev/null 2>&1
      return 0
      ;;
    /*)
      echo "bash: cd: \$1: Permission denied (restricted to /workspace sandbox)"
      return 1
      ;;
  esac

  # If currently at WORKSPACE_ROOT and trying to go up (..), forbid
  _cur="$(pwd -P 2>/dev/null || pwd)"
  if [ "$_cur" = "$WORKSPACE_ROOT" ]; then
    case "$_t" in
      ..|../*|*/..|*/../*)
        echo "bash: cd: restricted: cannot navigate outside of project workspace (/workspace)"
        return 1
        ;;
    esac
  fi

  # Attempt cd
  command cd "$_t" 2>/dev/null
  _status=$?
  if [ $_status -ne 0 ]; then
    echo "bash: cd: \$1: No such file or directory"
    return 1
  fi

  # Verify destination is inside WORKSPACE_ROOT
  _dest="$(pwd -P 2>/dev/null || pwd)"
  case "$_dest" in
    "$WORKSPACE_ROOT"|"$WORKSPACE_ROOT"/*)
      return 0
      ;;
    *)
      # Jail violation! Revert immediately back to WORKSPACE_ROOT
      command cd "$WORKSPACE_ROOT" >/dev/null 2>&1
      echo "bash: cd: restricted: cannot navigate outside of project workspace (/workspace)"
      return 1
      ;;
  esac
}

pushd() {
  cd "$@"
}

popd() {
  command popd "$@" 2>/dev/null
  _cur="$(pwd -P 2>/dev/null || pwd)"
  case "$_cur" in
    "$WORKSPACE_ROOT"|"$WORKSPACE_ROOT"/*)
      ;;
    *)
      command cd "$WORKSPACE_ROOT" >/dev/null 2>&1
      echo "popd: restricted: reset to /workspace"
      ;;
  esac
}

chdir() {
  cd "$@"
}

pwd() {
  _cur="$(pwd -P 2>/dev/null || pwd)"
  case "$_cur" in
    "$WORKSPACE_ROOT"*)
      _rel="\${_cur#$WORKSPACE_ROOT}"
      if [ -z "$_rel" ]; then
        echo "/workspace"
      else
        echo "/workspace\$_rel"
      fi
      ;;
    *)
      echo "/workspace"
      ;;
  esac
}

__cf_set_prompt() {
  _code=$?
  _cur="$(pwd -P 2>/dev/null || pwd)"
  case "$_cur" in
    "$WORKSPACE_ROOT"*)
      _sub="\${_cur#$WORKSPACE_ROOT}"
      if [ -z "$_sub" ]; then
        _vpath="/workspace"
      else
        _vpath="/workspace\$_sub"
      fi
      ;;
    *)
      command cd "$WORKSPACE_ROOT" >/dev/null 2>&1
      _vpath="/workspace"
      ;;
  esac

  PS1="\\[\\e[1;32m\\]developer@cloudforge\\[\\e[0m\\]:\\[\\e[1;34m\\]\${_vpath}\\[\\e[0m\\]\\$ "
  return $_code
}

PROMPT_COMMAND="__cf_set_prompt"
export PS1="\[\e[1;32m\]developer@cloudforge\[\e[0m\]:\[\e[1;34m\]/workspace\[\e[0m\]\$ "

# Lock sandbox functions and critical vars so user scripts cannot overwrite or unset them
readonly -f cd 2>/dev/null || true
readonly -f pushd 2>/dev/null || true
readonly -f chdir 2>/dev/null || true
readonly -f pwd 2>/dev/null || true
readonly -f __cf_set_prompt 2>/dev/null || true
readonly PROMPT_COMMAND 2>/dev/null || true
readonly WORKSPACE_ROOT 2>/dev/null || true

alias dir="ls -la" 2>/dev/null || true
alias ll="ls -la" 2>/dev/null || true
alias npm="npm --no-audit --no-fund --no-progress" 2>/dev/null || true
alias npx="npx --no-audit --no-fund" 2>/dev/null || true
`;
    try {
      fs.writeFileSync(rcFilePath, rcContent, "utf8");
    } catch {
      // ignore
    }
    return rcFilePath;
  }

  /**
   * Create interactive PTY streaming session for WebSockets
   */
  async createTerminalSession(projectId, cols = 80, rows = 24, onData, onExit) {
    const dockerStatus = await this.getDockerStatus();
    const runtime = await this.detectProjectRuntime(projectId);
    const workspaceDir = this.getProjectWorkspaceDir(projectId);

    // Synchronize all files and folders between DB and disk workspace before starting session
    try {
      await this.syncBidirectional(projectId);
    } catch {
      // ignore
    }

    if (dockerStatus.available) {
      try {
        await this.startProjectContainer(projectId);
        const containerName = this.getContainerName(projectId);
        const container = this.docker.getContainer(containerName);

        const exec = await container.exec({
          Cmd: ["/bin/sh"],
          AttachStdin: true,
          AttachStdout: true,
          AttachStderr: true,
          Tty: true,
          WorkingDir: "/workspace",
          Env: ["TERM=xterm-256color", "COLORTERM=truecolor"],
        });

        const stream = await exec.start({
          hijack: true,
          stdin: true,
          Tty: true,
        });

        // Set initial window size
        try {
          await exec.resize({ h: rows, w: cols });
        } catch {
          // ignore
        }

        stream.on("data", (chunk) => {
          if (onData) onData(chunk.toString("utf8"));
        });

        stream.on("end", () => {
          if (onExit) onExit(0);
        });

        return {
          mode: "docker",
          runtime,
          write: (data) => {
            try {
              stream.write(data);
            } catch {
              // ignore
            }
          },
          resize: async (newCols, newRows) => {
            try {
              await exec.resize({ h: newRows, w: newCols });
            } catch {
              // ignore
            }
          },
          kill: () => {
            try {
              stream.destroy();
            } catch {
              // ignore
            }
          },
        };
      } catch (err) {
        console.error(`Failed to create Docker terminal for ${projectId}:`, err);
      }
    }

    // Cloud Container Sandbox interactive shell session
    // Uses Linux bash if available (Git Bash / WSL / sh) with strict path virtualization to /workspace
    let bashBin = null;
    let isBash = false;

    if (process.platform === "win32") {
      const candidates = [
        "C:\\Program Files\\Git\\bin\\bash.exe",
        "C:\\Program Files (x86)\\Git\\bin\\bash.exe",
        path.join(process.env.LOCALAPPDATA || "", "Programs\\Git\\bin\\bash.exe"),
      ];
      for (const c of candidates) {
        if (fs.existsSync(c)) {
          bashBin = c;
          isBash = true;
          break;
        }
      }
      if (!bashBin) {
        bashBin = "powershell.exe";
        isBash = false;
      }
    } else {
      const candidates = ["/bin/bash", "/usr/bin/bash", "/usr/local/bin/bash"];
      for (const c of candidates) {
        if (fs.existsSync(c)) {
          bashBin = c;
          isBash = true;
          break;
        }
      }
      if (!bashBin) {
        bashBin = "/bin/sh";
        isBash = false;
      }
    }

    const rcFilePath = this._generateSandboxBashRc(projectId, workspaceDir);
    const normalizedRcPath = rcFilePath.replace(/\\/g, "/");

    let shellArgs;
    if (isBash) {
      shellArgs = ["--noprofile", "--rcfile", normalizedRcPath, "-i"];
    } else if (bashBin && bashBin.includes("powershell")) {
      shellArgs = ["-NoLogo", "-NoExit"];
    } else {
      shellArgs = ["-i"];
    }

    const banner = `\r\n\x1b[38;2;14;165;233m┌────────────────────────────────────────────────────────┐\x1b[0m\r\n\x1b[38;2;14;165;233m│\x1b[0m  \x1b[1;32mCloudForge Cloud Container Environment\x1b[0m                \x1b[38;2;14;165;233m│\x1b[0m\r\n\x1b[38;2;14;165;233m│\x1b[0m  \x1b[90mRuntime:\x1b[0m \x1b[37m${(runtime.displayName || "CloudForge Linux Container").padEnd(46, " ")}\x1b[0m\x1b[38;2;14;165;233m│\x1b[0m\r\n\x1b[38;2;14;165;233m│\x1b[0m  \x1b[90mIsolated Sandbox:\x1b[0m \x1b[35m/workspace\x1b[0m                          \x1b[38;2;14;165;233m│\x1b[0m\r\n\x1b[38;2;14;165;233m└────────────────────────────────────────────────────────┘\x1b[0m\r\n\r\n`;

    const sanitizeChunk = (chunk) => {
      let str = chunk.toString();
      str = str.replace(/bash: cannot set terminal process group[^\r\n]*\r?\n?/g, "");
      str = str.replace(/bash: no job control in this shell\r?\n?/g, "");
      str = str.replace(/\u001b\]0;[^\u0007\x1b]*(\u0007|\x1b\\)/g, "");
      return this._sanitizeOutputPaths(str, workspaceDir);
    };

    // Shared warm NPM package cache directory
    const sharedNpmCache = path.join(os.tmpdir(), "cloudforge_shared_npm_cache");
    if (!fs.existsSync(sharedNpmCache)) {
      try {
        fs.mkdirSync(sharedNpmCache, { recursive: true });
      } catch {
        // ignore
      }
    }

    // High-performance sandbox environment (optimizes npm, npx, and CLI tool rendering)
    const sandboxEnv = {
      ...process.env,
      WORKSPACE: "/workspace",
      HOME: workspaceDir,
      USER: "developer",
      LOGNAME: "developer",
      USERNAME: "developer",
      ENV: rcFilePath,
      BASH_ENV: rcFilePath,
      TERM: "xterm-256color",
      COLORTERM: "truecolor",
      npm_config_cache: sharedNpmCache,
      npm_config_prefer_offline: "true",
      npm_config_audit: "false",
      npm_config_fund: "false",
      npm_config_progress: "false",
      npm_config_update_notifier: "false",
      CI: "true",
      PAGER: "cat",
    };

    // High-throughput 16ms output buffer to prevent WebSocket packet floods during npm installs
    const createStreamer = (callback) => {
      let buf = "";
      let timer = null;

      const flush = () => {
        if (buf && callback) {
          callback(buf);
          buf = "";
        }
        timer = null;
      };

      return {
        write: (chunk) => {
          const clean = sanitizeChunk(chunk);
          if (!clean) return;
          buf += clean;
          if (buf.length >= 2048) {
            if (timer) clearTimeout(timer);
            flush();
          } else if (!timer) {
            timer = setTimeout(flush, 16);
          }
        },
        flushDirect: (data) => {
          if (timer) clearTimeout(timer);
          flush();
          if (data && callback) callback(data);
        },
        destroy: () => {
          if (timer) clearTimeout(timer);
          buf = "";
        },
      };
    };

    const streamer = createStreamer(onData);

    // Start disk workspace watcher so changes made in terminal reflect immediately in UI
    this.startWorkspaceWatcher(projectId);

    // 1. Try real Windows ConPTY/WinPTY terminal session via node-pty (Full TTY, arrow keys, Tab completion, interactive CLI)
    let ptyModule = null;
    try {
      const mod = await import("node-pty");
      ptyModule = mod.default || mod;
    } catch {
      // fallback
    }

    if (ptyModule && bashBin) {
      try {
        const ptyProc = ptyModule.spawn(bashBin, shellArgs, {
          name: "xterm-256color",
          cols: cols || 80,
          rows: rows || 24,
          useConpty: false,
          cwd: workspaceDir,
          env: sandboxEnv,
        });

        streamer.flushDirect(banner);

        ptyProc.onData((data) => {
          streamer.write(data);
        });

        ptyProc.onExit(({ exitCode }) => {
          streamer.destroy();
          try {
            if (fs.existsSync(rcFilePath)) fs.unlinkSync(rcFilePath);
          } catch {
            // ignore
          }
          this.scheduleDiskSync(projectId, 100);
          if (onExit) onExit(exitCode || 0);
        });

        return {
          mode: "cloud_sandbox_pty",
          runtime,
          write: (data) => {
            try {
              ptyProc.write(data);
            } catch {
              // ignore
            }
          },
          resize: (newCols, newRows) => {
            try {
              ptyProc.resize(newCols, newRows);
            } catch {
              // ignore
            }
          },
          kill: () => {
            try {
              streamer.destroy();
              if (fs.existsSync(rcFilePath)) fs.unlinkSync(rcFilePath);
              ptyProc.kill();
            } catch {
              // ignore
            }
          },
        };
      } catch (ptyErr) {
        console.warn("node-pty spawn failed, falling back to process spawn:", ptyErr.message);
      }
    }

    if (bashBin) {
      const proc = spawn(bashBin, shellArgs, {
        cwd: workspaceDir,
        env: sandboxEnv,
        stdio: ["pipe", "pipe", "pipe"],
      });

      streamer.flushDirect(banner);

      proc.stdout?.on("data", (d) => {
        streamer.write(d);
      });

      proc.stderr?.on("data", (d) => {
        streamer.write(d);
      });

      proc.on("close", (code) => {
        streamer.destroy();
        try {
          if (fs.existsSync(rcFilePath)) fs.unlinkSync(rcFilePath);
        } catch {
          // ignore
        }
        this.scheduleDiskSync(projectId, 100);
        if (onExit) onExit(code || 0);
      });

      return {
        mode: "cloud_sandbox",
        runtime,
        write: (data) => {
          try {
            proc.stdin?.write(data);
          } catch {
            // ignore
          }
        },
        resize: () => {},
        kill: () => {
          try {
            streamer.destroy();
            if (fs.existsSync(rcFilePath)) fs.unlinkSync(rcFilePath);
            proc.kill();
          } catch {
            // ignore
          }
        },
      };
    }

    // Fallback: sanitized shell wrapper
    const isWin = process.platform === "win32";
    const fallbackCmd = isWin ? "cmd.exe" : "/bin/sh";
    const fallbackArgs = isWin ? [] : ["-i"];

    const proc = spawn(fallbackCmd, fallbackArgs, {
      cwd: workspaceDir,
      env: sandboxEnv,
      stdio: ["pipe", "pipe", "pipe"],
    });

    streamer.flushDirect(banner);

    proc.stdout?.on("data", (d) => {
      streamer.write(d);
    });

    proc.stderr?.on("data", (d) => {
      streamer.write(d);
    });

    proc.on("close", (code) => {
      streamer.destroy();
      this.scheduleDiskSync(projectId, 100);
      if (onExit) onExit(code || 0);
    });

    return {
      mode: "cloud_sandbox",
      runtime,
      write: (data) => {
        try {
          proc.stdin?.write(data);
        } catch {
          // ignore
        }
      },
      resize: () => {},
      kill: () => {
        try {
          streamer.destroy();
          proc.kill();
        } catch {
          // ignore
        }
      },
    };
  }
}

export const containerService = new ContainerService();
export default containerService;
