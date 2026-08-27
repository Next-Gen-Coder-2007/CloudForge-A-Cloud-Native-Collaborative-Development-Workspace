export type CellType = "code" | "markdown" | "raw";

export type OutputType = "stream" | "execute_result" | "display_data" | "error";

export interface StreamOutput {
  output_type: "stream";
  name: "stdout" | "stderr";
  text: string | string[];
}

export interface ExecuteResultOutput {
  output_type: "execute_result";
  execution_count: number | null;
  data: {
    "text/plain"?: string | string[];
    "text/html"?: string | string[];
    "image/png"?: string;
    "image/jpeg"?: string;
    "image/svg+xml"?: string | string[];
    "text/latex"?: string | string[];
    "application/json"?: any;
    [mimeType: string]: any;
  };
  metadata?: Record<string, any>;
}

export interface DisplayDataOutput {
  output_type: "display_data";
  data: {
    "text/plain"?: string | string[];
    "text/html"?: string | string[];
    "image/png"?: string;
    "image/jpeg"?: string;
    "image/svg+xml"?: string | string[];
    "text/latex"?: string | string[];
    "application/json"?: any;
    [mimeType: string]: any;
  };
  metadata?: Record<string, any>;
}

export interface ErrorOutput {
  output_type: "error";
  ename: string;
  evalue: string;
  traceback: string[];
}

export type NotebookOutput = StreamOutput | ExecuteResultOutput | DisplayDataOutput | ErrorOutput;

export interface NotebookCell {
  id: string;
  cell_type: CellType;
  metadata: Record<string, any>;
  source: string | string[];
  execution_count?: number | null;
  outputs?: NotebookOutput[];
  // UI helper state (ephemeral)
  isExecuting?: boolean;
  executionDurationMs?: number;
  isEditingMarkdown?: boolean;
}

export interface NotebookMetadata {
  kernelspec?: {
    name: string;
    display_name: string;
    language?: string;
  };
  language_info?: {
    name: string;
    version?: string;
    mimetype?: string;
    file_extension?: string;
    pygments_lexer?: string;
    codemirror_mode?: any;
    nbconvert_exporter?: string;
  };
  [key: string]: any;
}

export interface NotebookData {
  cells: NotebookCell[];
  metadata: NotebookMetadata;
  nbformat: number;
  nbformat_minor: number;
}

export type KernelType = "pyodide" | "container" | "javascript" | "simulator";

export type KernelStatus = "idle" | "busy" | "initializing" | "error" | "disconnected";

export interface KernelVariable {
  name: string;
  type: string;
  sizeOrShape?: string;
  valuePreview: string;
}

export interface KernelExecutionResult {
  success: boolean;
  executionCount: number;
  outputs: NotebookOutput[];
  executionDurationMs: number;
  variables?: KernelVariable[];
  error?: string;
}

export interface KernelSpecInfo {
  id: KernelType;
  name: string;
  displayName: string;
  language: string;
  description: string;
  badge: string;
  isAvailable: boolean;
}
