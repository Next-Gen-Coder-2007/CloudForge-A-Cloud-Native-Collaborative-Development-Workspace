import runtimeRegistry from "../services/runtimeRegistry.js";
import portDetectorService from "../services/portDetectorService.js";
import previewProxyService from "../services/previewProxyService.js";
import containerService from "../services/containerService.js";
import Project from "../models/Project.js";

// Active dev server processes map (key: `${projectId}:${port}` -> exec session or proc)
const activeDevProcesses = new Map();

/**
 * @desc    Get detected framework & active listening ports for preview
 * @route   GET /api/projects/:id/preview/info
 * @access  Private
 */
export const getPreviewInfo = async (req, res) => {
  try {
    const projectId = req.params.id;
    const project = await Project.findById(projectId);

    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found." });
    }

    const { activePorts, detectedFramework, hasActiveServer } = await portDetectorService.detectActivePorts(
      projectId
    );

    res.json({
      success: true,
      framework: detectedFramework,
      activePorts,
      hasActiveServer,
      registeredFrameworksCount: runtimeRegistry.frameworks.length,
    });
  } catch (err) {
    console.error("getPreviewInfo error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * @desc    Start development server inside project container or local workspace
 * @route   POST /api/projects/:id/preview/start
 * @access  Private
 */
export const startDevServer = async (req, res) => {
  try {
    const projectId = req.params.id;
    const { customCommand, port } = req.body;

    const detected = await runtimeRegistry.detectProjectFramework(projectId);
    const commandToRun = customCommand || detected.startCommand;
    const targetPort = port || detected.defaultPort;

    // 1. Ensure project files are synced to workspace
    await containerService.syncFilesToWorkspace(projectId);

    // 2. Ensure container is started if Docker is available
    await containerService.startProjectContainer(projectId);

    // 3. Trigger dev server command in container
    const processKey = `${projectId}:${targetPort}`;

    // Kill previous process on this port if registered
    if (activeDevProcesses.has(processKey)) {
      const prev = activeDevProcesses.get(processKey);
      try {
        if (prev.kill) prev.kill();
      } catch {
        // ignore
      }
      activeDevProcesses.delete(processKey);
    }

    // Launch non-blocking background command
    const dockerStatus = await containerService.getDockerStatus();
    if (dockerStatus.available) {
      const containerName = containerService.getContainerName(projectId);
      const container = containerService.docker.getContainer(containerName);

      const exec = await container.exec({
        Cmd: ["/bin/sh", "-c", commandToRun],
        AttachStdout: true,
        AttachStderr: true,
        WorkingDir: "/workspace",
        Env: ["NODE_ENV=development", "TERM=xterm-256color"],
      });

      const stream = await exec.start({ hijack: true, stdin: false });
      activeDevProcesses.set(processKey, {
        exec,
        stream,
        command: commandToRun,
        startedAt: new Date(),
        kill: () => {
          try {
            stream.destroy();
          } catch {
            // ignore
          }
        },
      });
    } else {
      // Fallback: spawn in background on host workspace
      const workspaceDir = containerService.getProjectWorkspaceDir(projectId);
      const isWindows = process.platform === "win32";
      const shell = isWindows ? "cmd.exe" : "/bin/sh";
      const args = isWindows ? ["/c", commandToRun] : ["-c", commandToRun];

      const { spawn } = await import("child_process");
      const proc = spawn(shell, args, {
        cwd: workspaceDir,
        env: {
          ...process.env,
          WORKSPACE: workspaceDir,
        },
      });

      activeDevProcesses.set(processKey, {
        proc,
        command: commandToRun,
        startedAt: new Date(),
        kill: () => {
          try {
            proc.kill();
          } catch {
            // ignore
          }
        },
      });
    }

    // Wait briefly (1.5s) and scan active ports
    await new Promise((r) => setTimeout(r, 1500));
    const portInfo = await portDetectorService.detectActivePorts(projectId);

    res.json({
      success: true,
      message: `Development server command '${commandToRun}' started for port :${targetPort}.`,
      command: commandToRun,
      port: targetPort,
      activePorts: portInfo.activePorts,
      hasActiveServer: portInfo.hasActiveServer,
    });
  } catch (err) {
    console.error("startDevServer error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * @desc    Stop development server running on a specific port
 * @route   POST /api/projects/:id/preview/stop
 * @access  Private
 */
export const stopDevServer = async (req, res) => {
  try {
    const projectId = req.params.id;
    const { port } = req.body;
    const targetPort = port || 5173;
    const processKey = `${projectId}:${targetPort}`;

    if (activeDevProcesses.has(processKey)) {
      const active = activeDevProcesses.get(processKey);
      if (active.kill) {
        active.kill();
      }
      activeDevProcesses.delete(processKey);
    }

    res.json({
      success: true,
      message: `Development server on port :${targetPort} stopped.`,
    });
  } catch (err) {
    console.error("stopDevServer error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * @desc    Reverse proxy preview requests to the running web application
 * @route   ALL /api/projects/:id/preview/:port/*
 * @access  Public / Token-authenticated
 */
export const proxyPreview = async (req, res) => {
  const { id: projectId, port } = req.params;
  const subpath = req.url || "/";
  await previewProxyService.handleProxyRequest(req, res, projectId, port, subpath);
};
