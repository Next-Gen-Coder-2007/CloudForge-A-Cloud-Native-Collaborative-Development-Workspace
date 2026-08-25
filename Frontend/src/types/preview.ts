export interface DetectedFramework {
  id: string;
  name: string;
  category: "frontend" | "fullstack" | "backend" | "data-app" | "static";
  runtime: "node" | "python" | "generic";
  icon: string;
  description: string;
  defaultPort: number;
  commonPorts: number[];
  startCommand: string;
  fallbackCommand: string;
  scripts?: Record<string, string>;
}

export interface ActivePort {
  port: number;
  isPrimary: boolean;
  framework: string;
  url: string;
  containerIp: string;
  status: "active" | "idle";
}

export interface PreviewInfoResponse {
  success: boolean;
  framework: DetectedFramework;
  activePorts: ActivePort[];
  hasActiveServer: boolean;
  registeredFrameworksCount: number;
}

export type ViewportMode = "desktop" | "tablet" | "mobile";
