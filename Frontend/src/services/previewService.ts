import API_URL from "../config/api";
import { type PreviewInfoResponse } from "../types/preview";

class PreviewService {
  /**
   * Construct absolute URL for previewing an in-container port
   */
  getPreviewUrl(projectId: string, port: number, subpath: string = "/"): string {
    const cleanSubpath = subpath.startsWith("/") ? subpath : `/${subpath}`;
    return `${API_URL}/api/projects/${projectId}/preview/${port}${cleanSubpath}`;
  }

  /**
   * Fetch detected framework, start commands, and active listening ports
   */
  async getPreviewInfo(projectId: string): Promise<PreviewInfoResponse> {
    const res = await fetch(`${API_URL}/api/projects/${projectId}/preview/info`, {
      credentials: "include",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || `Failed to fetch preview info (${res.status})`);
    }
    return await res.json();
  }

  /**
   * Start development server inside project workspace container
   */
  async startDevServer(
    projectId: string,
    customCommand?: string,
    port?: number
  ): Promise<{ message: string; port: number; activePorts: any[] }> {
    const res = await fetch(`${API_URL}/api/projects/${projectId}/preview/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ customCommand, port }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || "Failed to start development server");
    }
    return data;
  }

  /**
   * Stop development server running on a specific port
   */
  async stopDevServer(projectId: string, port?: number): Promise<{ message: string }> {
    const res = await fetch(`${API_URL}/api/projects/${projectId}/preview/stop`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ port }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || "Failed to stop development server");
    }
    return data;
  }
}

export const previewService = new PreviewService();
export default previewService;
