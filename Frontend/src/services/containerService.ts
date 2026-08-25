import API_URL from "../config/api";
import {
  type ContainerInfo,
  type CommandExecResult,
  type ContainerStatusResponse,
} from "../types/container";

class ContainerService {
  /**
   * Get WebSocket URL for the interactive container terminal
   */
  getTerminalWsUrl(projectId: string, tabId: string = "tab-1", cols: number = 80, rows: number = 24): string {
    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    let host = API_URL.replace(/^https?:\/\//, "");
    if (!host) {
      host = window.location.host;
    }
    return `${wsProtocol}//${host}/ws/terminal?projectId=${encodeURIComponent(projectId)}&tabId=${encodeURIComponent(
      tabId
    )}&cols=${cols}&rows=${rows}`;
  }

  /**
   * Fetch live container, Docker daemon, and Cloud Runner status for a project
   */
  async getStatus(projectId: string): Promise<ContainerStatusResponse> {
    const res = await fetch(`${API_URL}/api/projects/${projectId}/container/status`, {
      credentials: "include",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || `Failed to fetch container status (${res.status})`);
    }
    return await res.json();
  }

  /**
   * Start / create dedicated Docker container for a project
   */
  async startContainer(projectId: string, env: Record<string, string> = {}): Promise<{ container: ContainerInfo; message: string }> {
    const res = await fetch(`${API_URL}/api/projects/${projectId}/container/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ env }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || "Failed to start container");
    }
    return data;
  }

  /**
   * Stop project container
   */
  async stopContainer(projectId: string): Promise<{ container: ContainerInfo; message: string }> {
    const res = await fetch(`${API_URL}/api/projects/${projectId}/container/stop`, {
      method: "POST",
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || "Failed to stop container");
    }
    return data;
  }

  /**
   * Restart project container
   */
  async restartContainer(projectId: string): Promise<{ container: ContainerInfo; message: string }> {
    const res = await fetch(`${API_URL}/api/projects/${projectId}/container/restart`, {
      method: "POST",
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || "Failed to restart container");
    }
    return data;
  }

  /**
   * Rebuild project container from scratch
   */
  async rebuildContainer(projectId: string): Promise<{ container: ContainerInfo; message: string }> {
    const res = await fetch(`${API_URL}/api/projects/${projectId}/container/rebuild`, {
      method: "POST",
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || "Failed to rebuild container");
    }
    return data;
  }

  /**
   * Force sync all MongoDB project files to the container disk workspace
   */
  async syncFiles(projectId: string): Promise<{ message: string }> {
    const res = await fetch(`${API_URL}/api/projects/${projectId}/container/sync-files`, {
      method: "POST",
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || "Failed to sync files to container");
    }
    return data;
  }

  /**
   * Execute a command non-interactively
   */
  async execCommand(projectId: string, command: string, env: Record<string, string> = {}): Promise<CommandExecResult> {
    const res = await fetch(`${API_URL}/api/projects/${projectId}/container/exec`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ command, env }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || "Failed to execute command");
    }
    return data.result;
  }
}

export const containerService = new ContainerService();
export default containerService;
