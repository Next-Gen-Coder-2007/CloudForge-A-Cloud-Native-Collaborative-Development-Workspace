export interface DockerStatus {
  available: boolean;
  status: "online" | "offline";
  ping?: string;
  version?: string;
  apiVersion?: string;
  os?: string;
  architecture?: string;
  containersRunning?: number;
  containersTotal?: number;
  imagesTotal?: number;
  dockerHost?: string;
  executionMode?: string;
  error?: string;
  details?: string;
}

export interface CloudRunnerStatus {
  available: boolean;
  provider: string;
  driver: string;
  endpoint: string;
  region: string;
  status: string;
  cloudHosted: boolean;
  activeWorkspaces?: number;
  version?: string;
  error?: string;
}

export interface ProjectRuntimeInfo {
  runtime: "node" | "python" | "generic";
  image: string;
  version: string;
  displayName: string;
  defaultCommand: string;
  entrypoint: string;
}

export interface ContainerInfo {
  status: "running" | "stopped" | "paused" | "restarting" | "not_created" | "fallback_shell" | "error";
  dockerAvailable: boolean;
  containerId: string | null;
  name: string;
  image?: string;
  runtime: ProjectRuntimeInfo;
  created?: string;
  startedAt?: string;
  finishedAt?: string;
  exitCode?: number;
  workspaceDir: string;
  volumeName?: string;
  memoryLimit?: string;
  cpuLimit?: string;
  executionMode?: string;
  message?: string;
  error?: string;
}

export interface TerminalTab {
  id: string;
  name: string;
  type: "shell" | "runner" | "custom";
  createdAt: Date;
  status: "connected" | "connecting" | "disconnected" | "error";
}

export interface CommandExecResult {
  success: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  mode: "docker" | "fallback_shell";
}

export interface ContainerStatusResponse {
  success: boolean;
  docker: DockerStatus;
  container: ContainerInfo;
  cloudRunner?: CloudRunnerStatus;
}
