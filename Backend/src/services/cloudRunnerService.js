import axios from "axios";
import tar from "tar-stream";
import Project from "../models/Project.js";
import ProjectFile from "../models/ProjectFile.js";

/**
 * Cloud Container Runner Service
 * Provides cloud-native container orchestration via remote cloud APIs:
 * - CloudForge Remote Container API (CLOUD_RUNNER_API_URL)
 * - Fly.io Machines API (FLY_API_TOKEN, FLY_APP_NAME)
 * - Docker Remote Engine API over HTTPS / mTLS (DOCKER_HOST)
 * - Kubernetes Workspace Pod API (KUBERNETES_API_URL)
 */
class CloudRunnerService {
  constructor() {
    this.provider = this._determineCloudProvider();
  }

  /**
   * Determine active cloud execution provider from environment variables
   */
  _determineCloudProvider() {
    if (process.env.CLOUD_RUNNER_API_URL) {
      return {
        id: "cloudforge_api",
        name: "CloudForge Cloud Runner API",
        type: "dedicated_api",
        endpoint: process.env.CLOUD_RUNNER_API_URL,
        region: process.env.CLOUD_RUNNER_REGION || "us-east-1 (Cloud)",
      };
    }

    if (process.env.FLY_API_TOKEN && process.env.FLY_APP_NAME) {
      return {
        id: "fly_machines",
        name: "Fly.io Cloud MicroVMs API",
        type: "microvm_api",
        endpoint: `https://api.machines.dev/v1/apps/${process.env.FLY_APP_NAME}`,
        region: process.env.FLY_REGION || "iad (Virginia)",
      };
    }

    if (process.env.DOCKER_HOST) {
      return {
        id: "docker_remote",
        name: "Remote Cloud Docker Engine",
        type: "remote_docker",
        endpoint: process.env.DOCKER_HOST,
        region: process.env.CLOUD_REGION || "Remote Cloud VM",
      };
    }

    if (process.env.KUBERNETES_API_URL) {
      return {
        id: "kubernetes",
        name: "Kubernetes Cloud Cluster API",
        type: "k8s_api",
        endpoint: process.env.KUBERNETES_API_URL,
        region: process.env.K8S_NAMESPACE || "cloudforge-workspaces",
      };
    }

    return {
      id: "docker_local",
      name: "Docker Engine (Managed)",
      type: "local_docker",
      endpoint: "localhost / socket",
      region: "Local Workspace",
    };
  }

  /**
   * Return status and metadata of active cloud container runner
   */
  async getCloudRunnerStatus() {
    const provider = this._determineCloudProvider();

    if (provider.id === "cloudforge_api") {
      try {
        const res = await axios.get(`${provider.endpoint}/health`, {
          headers: {
            Authorization: `Bearer ${process.env.CLOUD_RUNNER_API_KEY || ""}`,
          },
          timeout: 4000,
        });
        return {
          available: true,
          provider: provider.name,
          driver: provider.id,
          endpoint: provider.endpoint,
          region: provider.region,
          status: "online",
          cloudHosted: true,
          activeWorkspaces: res.data?.activeWorkspaces || 0,
          version: res.data?.version || "2.1.0-cloud",
        };
      } catch (err) {
        return {
          available: false,
          provider: provider.name,
          driver: provider.id,
          endpoint: provider.endpoint,
          region: provider.region,
          status: "unreachable",
          cloudHosted: true,
          error: `Cloud API Unreachable: ${err.message}`,
        };
      }
    }

    if (provider.id === "fly_machines") {
      try {
        const res = await axios.get(`https://api.machines.dev/v1/apps/${process.env.FLY_APP_NAME}/machines`, {
          headers: {
            Authorization: `Bearer ${process.env.FLY_API_TOKEN}`,
          },
          timeout: 4000,
        });
        return {
          available: true,
          provider: provider.name,
          driver: provider.id,
          endpoint: provider.endpoint,
          region: provider.region,
          status: "online",
          cloudHosted: true,
          activeWorkspaces: Array.isArray(res.data) ? res.data.length : 0,
          version: "Fly Machines v1 REST API",
        };
      } catch (err) {
        return {
          available: false,
          provider: provider.name,
          driver: provider.id,
          endpoint: provider.endpoint,
          region: provider.region,
          status: "unreachable",
          cloudHosted: true,
          error: `Fly.io API Unreachable: ${err.message}`,
        };
      }
    }

    // Default: containerService gets Docker remote / local status
    const { containerService } = await import("./containerService.js");
    const dockerStatus = await containerService.getDockerStatus();

    return {
      available: dockerStatus.available,
      provider: provider.name,
      driver: provider.id,
      endpoint: dockerStatus.dockerHost || provider.endpoint,
      region: provider.region,
      status: dockerStatus.status,
      cloudHosted: provider.id !== "docker_local",
      containersRunning: dockerStatus.containersRunning,
      version: dockerStatus.version,
    };
  }

  /**
   * Provision or start cloud workspace container via Cloud API
   */
  async startCloudContainer(projectId, customEnv = {}) {
    const provider = this._determineCloudProvider();

    // 1. Dedicated Cloud API Provider
    if (provider.id === "cloudforge_api") {
      const files = await ProjectFile.find({ projectId }).select("name path content type");
      const project = await Project.findById(projectId);

      const payload = {
        projectId: projectId.toString(),
        projectName: project?.name || "Workspace",
        runtime: project?.template || "node",
        envVariables: {
          ...(project?.envVariables?.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {}) || {}),
          ...customEnv,
        },
        files: files.map((f) => ({
          path: f.path || f.name,
          content: f.content,
          type: f.type,
        })),
      };

      const res = await axios.post(`${provider.endpoint}/v1/workspaces`, payload, {
        headers: {
          Authorization: `Bearer ${process.env.CLOUD_RUNNER_API_KEY || ""}`,
          "Content-Type": "application/json",
        },
        timeout: 20000,
      });

      return {
        success: true,
        mode: "cloud_api",
        status: "running",
        cloudContainerId: res.data.containerId || res.data.machineId,
        previewUrl: res.data.previewUrl,
        provider: provider.name,
        message: `Cloud workspace provisioned in ${provider.region}.`,
      };
    }

    // 2. Fly.io Machines API Provider
    if (provider.id === "fly_machines") {
      const project = await Project.findById(projectId);
      const machineName = `cf-${projectId.toString().substring(0, 10)}`;

      const flyPayload = {
        name: machineName,
        region: process.env.FLY_REGION || "iad",
        config: {
          image: "node:20-bookworm-slim",
          guest: {
            cpus: 1,
            cpu_kind: "shared",
            memory_mb: 1024,
          },
          env: {
            WORKSPACE: "/workspace",
            CLOUDFORGE_PROJECT_ID: projectId.toString(),
            ...customEnv,
          },
          init: {
            cmd: ["/bin/sh", "-c", "tail -f /dev/null"],
          },
        },
      };

      const res = await axios.post(
        `https://api.machines.dev/v1/apps/${process.env.FLY_APP_NAME}/machines`,
        flyPayload,
        {
          headers: {
            Authorization: `Bearer ${process.env.FLY_API_TOKEN}`,
            "Content-Type": "application/json",
          },
          timeout: 25000,
        }
      );

      return {
        success: true,
        mode: "fly_machines",
        status: "running",
        cloudContainerId: res.data.id,
        previewUrl: `https://${res.data.id}.fly.dev`,
        provider: provider.name,
        message: `Fly.io Cloud MicroVM created (${res.data.id}).`,
      };
    }

    // 3. Fallback to Container Service (Docker Remote / Local)
    const { containerService } = await import("./containerService.js");
    return await containerService.startProjectContainer(projectId, customEnv);
  }

  /**
   * Stop cloud workspace container
   */
  async stopCloudContainer(projectId) {
    const provider = this._determineCloudProvider();

    if (provider.id === "cloudforge_api") {
      await axios.post(
        `${provider.endpoint}/v1/workspaces/${projectId}/stop`,
        {},
        {
          headers: { Authorization: `Bearer ${process.env.CLOUD_RUNNER_API_KEY || ""}` },
        }
      );
      return { success: true, status: "stopped", message: "Cloud workspace stopped." };
    }

    const { containerService } = await import("./containerService.js");
    return await containerService.stopProjectContainer(projectId);
  }

  /**
   * Execute command inside cloud container via API
   */
  async execCloudCommand(projectId, command, envOverrides = {}) {
    const provider = this._determineCloudProvider();

    if (provider.id === "cloudforge_api") {
      const res = await axios.post(
        `${provider.endpoint}/v1/workspaces/${projectId}/exec`,
        { command, env: envOverrides },
        {
          headers: { Authorization: `Bearer ${process.env.CLOUD_RUNNER_API_KEY || ""}` },
          timeout: 60000,
        }
      );
      return res.data;
    }

    const { containerService } = await import("./containerService.js");
    return await containerService.execCommand(projectId, command, envOverrides);
  }
}

export const cloudRunnerService = new CloudRunnerService();
export default cloudRunnerService;
