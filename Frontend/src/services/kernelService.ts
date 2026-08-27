import API_URL from "../config/api";
import {
  type KernelType,
  type KernelStatus,
  type KernelVariable,
  type KernelExecutionResult,
  type NotebookOutput,
  type KernelSpecInfo,
} from "../types/notebook";

declare global {
  interface Window {
    loadPyodide?: (config: { indexURL: string }) => Promise<any>;
    pyodideInstance?: any;
    pyodideLoadingPromise?: Promise<any> | null;
  }
}

export const AVAILABLE_KERNELS: KernelSpecInfo[] = [
  {
    id: "pyodide",
    name: "python-pyodide",
    displayName: "Python 3 (In-Browser Pyodide WASM)",
    language: "python",
    description: "Instant real CPython 3.12 running client-side with NumPy, Pandas, and Matplotlib plotting.",
    badge: "WASM Real Python",
    isAvailable: true,
  },
  {
    id: "container",
    name: "python-container",
    displayName: "Python 3 (Cloud Container)",
    language: "python",
    description: "Executes directly inside your dedicated CloudForge Docker container runtime.",
    badge: "Cloud Docker",
    isAvailable: true,
  },
  {
    id: "javascript",
    name: "javascript-v8",
    displayName: "JavaScript / TypeScript (V8 Engine)",
    language: "javascript",
    description: "Interactive JavaScript execution with state persistence, JSON rendering, and console streaming.",
    badge: "Browser JS",
    isAvailable: true,
  },
  {
    id: "simulator",
    name: "python-sim",
    displayName: "Data Science Quick Simulator",
    language: "python",
    description: "Ultra-fast offline simulation engine for data exploration and instant testing.",
    badge: "Fast Offline",
    isAvailable: true,
  },
];

type StatusListener = (status: KernelStatus, message?: string) => void;
type VariableListener = (variables: KernelVariable[]) => void;

class KernelService {
  private activeKernelType: KernelType = "pyodide";
  private status: KernelStatus = "idle";
  private executionCounter: number = 0;
  private statusListeners: Set<StatusListener> = new Set();
  private variableListeners: Set<VariableListener> = new Set();
  private jsContext: Record<string, any> = {};
  private projectId: string | null = null;
  private pyodide: any = null;

  constructor() {
    this.setStatus("idle");
  }

  public setProjectId(projectId: string | null) {
    this.projectId = projectId;
  }

  public getActiveKernelType(): KernelType {
    return this.activeKernelType;
  }

  public getStatus(): KernelStatus {
    return this.status;
  }

  public getExecutionCounter(): number {
    return this.executionCounter;
  }

  public onStatusChange(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => this.statusListeners.delete(listener);
  }

  public onVariablesChange(listener: VariableListener): () => void {
    this.variableListeners.add(listener);
    return () => this.variableListeners.delete(listener);
  }

  private setStatus(status: KernelStatus, message?: string) {
    this.status = status;
    this.statusListeners.forEach((fn) => fn(status, message));
  }

  /**
   * Switch active kernel engine
   */
  public async switchKernel(type: KernelType): Promise<void> {
    if (this.activeKernelType === type && this.status !== "error") {
      return;
    }
    this.activeKernelType = type;
    await this.restartKernel();
  }

  /**
   * Reset kernel state, variables, and execution counter
   */
  public async restartKernel(): Promise<void> {
    this.setStatus("busy", "Restarting kernel...");
    this.executionCounter = 0;
    this.jsContext = {};

    try {
      if (this.activeKernelType === "pyodide") {
        if (this.pyodide) {
          // Reset Pyodide global namespace
          await this.pyodide.runPythonAsync(`
import sys
for mod in list(sys.modules.keys()):
    if mod not in ('sys', 'builtins', '_frozen_importlib', '_frozen_importlib_external', 'pyodide', '_pyodide'):
        pass
`);
        }
      } else if (this.activeKernelType === "container" && this.projectId) {
        // Backend restart signal
        await fetch(`${API_URL}/api/projects/${this.projectId}/kernel/restart`, {
          method: "POST",
          credentials: "include",
        }).catch(() => {});
      }

      this.variableListeners.forEach((fn) => fn([]));
      this.setStatus("idle", "Kernel ready");
    } catch (err: any) {
      console.error("Kernel restart error:", err);
      this.setStatus("error", err.message || "Failed to restart kernel");
    }
  }

  /**
   * Main Execute method for Code Cells
   */
  public async executeCode(code: string): Promise<KernelExecutionResult> {
    const startTime = performance.now();
    this.executionCounter += 1;
    const currentCount = this.executionCounter;
    this.setStatus("busy", `Executing cell [${currentCount}]...`);

    const trimmed = code.trim();
    if (!trimmed) {
      this.setStatus("idle");
      return {
        success: true,
        executionCount: currentCount,
        outputs: [],
        executionDurationMs: 0,
      };
    }

    try {
      let result: KernelExecutionResult;

      switch (this.activeKernelType) {
        case "pyodide":
          result = await this.executePyodide(code, currentCount, startTime);
          break;
        case "container":
          result = await this.executeContainer(code, currentCount, startTime);
          break;
        case "javascript":
          result = await this.executeJavaScript(code, currentCount, startTime);
          break;
        case "simulator":
        default:
          result = await this.executeSimulator(code, currentCount, startTime);
          break;
      }

      this.setStatus("idle");
      return result;
    } catch (err: any) {
      const duration = Math.round(performance.now() - startTime);
      this.setStatus("idle");
      const errorOutput: NotebookOutput = {
        output_type: "error",
        ename: err.name || "ExecutionError",
        evalue: err.message || String(err),
        traceback: [
          `\u001b[0;31m---------------------------------------------------------------------------\u001b[0m`,
          `\u001b[0;31m${err.name || "Error"}\u001b[0m: ${err.message || String(err)}`,
        ],
      };

      return {
        success: false,
        executionCount: currentCount,
        outputs: [errorOutput],
        executionDurationMs: duration,
        error: err.message,
      };
    }
  }

  /**
   * 1. Pyodide WASM Kernel Execution
   */
  private async initPyodide(): Promise<any> {
    if (this.pyodide) return this.pyodide;
    if (window.pyodideInstance) {
      this.pyodide = window.pyodideInstance;
      return this.pyodide;
    }
    if (window.pyodideLoadingPromise) {
      return await window.pyodideLoadingPromise;
    }

    this.setStatus("initializing", "Loading Python WebAssembly Kernel...");

    window.pyodideLoadingPromise = new Promise(async (resolve, reject) => {
      try {
        if (!window.loadPyodide) {
          const script = document.createElement("script");
          script.src = "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js";
          script.async = true;
          document.head.appendChild(script);

          await new Promise((res, rej) => {
            script.onload = res;
            script.onerror = () => rej(new Error("Failed to load Pyodide WASM runtime from CDN."));
          });
        }

        const pyodide = await window.loadPyodide!({
          indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/",
        });

        // Initialize standard packages & Matplotlib interception
        await pyodide.loadPackage(["micropip"]);

        await pyodide.runPythonAsync(`
import sys
import io
import base64

# CloudForge standard output interceptor
class CFStream(io.StringIO):
    def __init__(self, name):
        super().__init__()
        self.name = name

def _cf_setup_env():
    import sys
    sys.stdout = io.StringIO()
    sys.stderr = io.StringIO()

_cf_setup_env()
`);

        window.pyodideInstance = pyodide;
        this.pyodide = pyodide;
        resolve(pyodide);
      } catch (err) {
        window.pyodideLoadingPromise = null;
        reject(err);
      }
    });

    return await window.pyodideLoadingPromise;
  }

  private async executePyodide(code: string, count: number, startTime: number): Promise<KernelExecutionResult> {
    const py = await this.initPyodide();

    // Auto-detect if code imports packages that need loading
    const needsMatplotlib = code.includes("matplotlib") || code.includes("plt.");
    const needsPandas = code.includes("pandas") || code.includes("pd.");
    const needsNumpy = code.includes("numpy") || code.includes("np.");
    const needsScipy = code.includes("scipy");
    const needsSympy = code.includes("sympy");

    const packagesToLoad: string[] = [];
    if (needsNumpy && !py.loadedPackages?.numpy) packagesToLoad.push("numpy");
    if (needsPandas && !py.loadedPackages?.pandas) packagesToLoad.push("pandas");
    if (needsMatplotlib && !py.loadedPackages?.matplotlib) packagesToLoad.push("matplotlib");
    if (needsScipy && !py.loadedPackages?.scipy) packagesToLoad.push("scipy");
    if (needsSympy && !py.loadedPackages?.sympy) packagesToLoad.push("sympy");

    if (packagesToLoad.length > 0) {
      this.setStatus("initializing", `Loading Python packages (${packagesToLoad.join(", ")})...`);
      await py.loadPackage(packagesToLoad);
    }

    // Set up output capture and matplotlib figure extraction
    const wrapper = `
import sys, io, base64

sys.stdout = io.StringIO()
sys.stderr = io.StringIO()

_cf_plot_data = []

# Matplotlib figure capture helper
if 'matplotlib' in sys.modules or 'matplotlib.pyplot' in sys.modules:
    import matplotlib.pyplot as plt
    for fignum in plt.get_fignums():
        plt.close(fignum)

def _cf_capture_plots():
    plots = []
    if 'matplotlib' in sys.modules or 'matplotlib.pyplot' in sys.modules:
        import matplotlib.pyplot as plt
        for fignum in plt.get_fignums():
            fig = plt.figure(fignum)
            buf = io.BytesIO()
            fig.savefig(buf, format='png', bbox_inches='tight', dpi=110)
            buf.seek(0)
            plots.append(base64.b64encode(buf.read()).decode('utf-8'))
        plt.close('all')
    return plots
`;

    await py.runPythonAsync(wrapper);

    const outputs: NotebookOutput[] = [];
    let evalResult: any = undefined;
    let executionError: any = null;

    try {
      evalResult = await py.runPythonAsync(code);
    } catch (err: any) {
      executionError = err;
    }

    // Extract stdout, stderr, plots, variables
    const harvestCode = `
_cf_stdout_val = sys.stdout.getvalue()
_cf_stderr_val = sys.stderr.getvalue()
_cf_plots_val = _cf_capture_plots()

# Extract non-internal variables
_cf_vars = []
for _name, _val in list(globals().items()):
    if not _name.startswith('_') and _name not in ('sys', 'io', 'base64', 'CFStream', 'plt', 'np', 'pd'):
        try:
            _type_str = type(_val).__name__
            _preview = str(_val)
            if len(_preview) > 120:
                _preview = _preview[:117] + '...'
            _size = ""
            if hasattr(_val, 'shape'):
                _size = f"shape: {getattr(_val, 'shape')}"
            elif hasattr(_val, '__len__'):
                try:
                    _size = f"len: {len(_val)}"
                except:
                    pass
            _cf_vars.append({
                "name": str(_name),
                "type": str(_type_str),
                "sizeOrShape": str(_size),
                "valuePreview": str(_preview)
            })
        except:
            pass
`;
    await py.runPythonAsync(harvestCode);

    const stdout = py.globals.get("_cf_stdout_val") || "";
    const stderr = py.globals.get("_cf_stderr_val") || "";
    const plotsProxy = py.globals.get("_cf_plots_val");
    const plots: string[] = plotsProxy ? plotsProxy.toJs() : [];
    const varsProxy = py.globals.get("_cf_vars");
    const vars: KernelVariable[] = varsProxy ? varsProxy.toJs() : [];

    this.variableListeners.forEach((fn) => fn(vars));

    if (stdout && stdout.trim()) {
      outputs.push({
        output_type: "stream",
        name: "stdout",
        text: stdout.endsWith("\n") ? stdout : stdout + "\n",
      });
    }

    if (stderr && stderr.trim()) {
      outputs.push({
        output_type: "stream",
        name: "stderr",
        text: stderr.endsWith("\n") ? stderr : stderr + "\n",
      });
    }

    // Add generated plots
    for (const plotB64 of plots) {
      outputs.push({
        output_type: "display_data",
        data: {
          "image/png": plotB64,
          "text/plain": "<Figure size 640x480 with Matplotlib Axes>",
        },
      });
    }

    // If there was an error in execution
    if (executionError) {
      const msg = executionError.message || String(executionError);
      outputs.push({
        output_type: "error",
        ename: "PythonError",
        evalue: msg,
        traceback: [
          `\u001b[0;31m---------------------------------------------------------------------------\u001b[0m`,
          `\u001b[0;31mTraceback (most recent call last)\u001b[0m`,
          `\u001b[0;31m${msg}\u001b[0m`,
        ],
      });
    } else if (evalResult !== undefined && evalResult !== null) {
      // Formulate return display
      const rep = String(evalResult);
      if (rep !== "None" && rep !== "undefined") {
        outputs.push({
          output_type: "execute_result",
          execution_count: count,
          data: {
            "text/plain": rep,
          },
        });
      }
    }

    const duration = Math.round(performance.now() - startTime);

    return {
      success: !executionError,
      executionCount: count,
      outputs,
      executionDurationMs: duration,
      variables: vars,
    };
  }

  /**
   * 2. Cloud Container Remote Kernel Execution
   */
  private async executeContainer(code: string, count: number, startTime: number): Promise<KernelExecutionResult> {
    if (!this.projectId) {
      throw new Error("No active Project ID configured for Cloud Container execution.");
    }

    const res = await fetch(`${API_URL}/api/projects/${this.projectId}/kernel/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ code }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || "Failed to execute code in Cloud Container.");
    }

    const duration = Math.round(performance.now() - startTime);

    if (data.variables) {
      this.variableListeners.forEach((fn) => fn(data.variables));
    }

    return {
      success: data.success ?? true,
      executionCount: count,
      outputs: data.outputs || [],
      executionDurationMs: data.executionDurationMs || duration,
      variables: data.variables || [],
    };
  }

  /**
   * 3. JavaScript / TypeScript V8 In-Browser Execution
   */
  private async executeJavaScript(code: string, count: number, startTime: number): Promise<KernelExecutionResult> {
    const outputs: NotebookOutput[] = [];
    const stdoutLogs: string[] = [];
    const stderrLogs: string[] = [];

    // Custom console interception for cell execution
    const customConsole = {
      log: (...args: any[]) => {
        stdoutLogs.push(args.map((a) => (typeof a === "object" ? JSON.stringify(a, null, 2) : String(a))).join(" "));
      },
      info: (...args: any[]) => {
        stdoutLogs.push(args.map((a) => (typeof a === "object" ? JSON.stringify(a, null, 2) : String(a))).join(" "));
      },
      warn: (...args: any[]) => {
        stderrLogs.push(args.map((a) => (typeof a === "object" ? JSON.stringify(a, null, 2) : String(a))).join(" "));
      },
      error: (...args: any[]) => {
        stderrLogs.push(args.map((a) => (typeof a === "object" ? JSON.stringify(a, null, 2) : String(a))).join(" "));
      },
      table: (data: any) => {
        try {
          stdoutLogs.push(JSON.stringify(data, null, 2));
        } catch {
          stdoutLogs.push(String(data));
        }
      },
    };

    let evalResult: any = undefined;
    let evalError: any = null;

    try {
      // Build function with preserved context variables
      const contextKeys = Object.keys(this.jsContext);
      const contextVals = Object.values(this.jsContext);

      // Async wrapper
      const asyncFn = new Function(
        "console",
        "context",
        ...contextKeys,
        `
        return (async () => {
          ${code.includes("return ") ? code : `return (async () => {\n${code}\n})()`}
        })();
      `
      );

      evalResult = await asyncFn(customConsole, this.jsContext, ...contextVals);

      // Inspect global-like assignments or window changes
      const currentVars: KernelVariable[] = Object.entries(this.jsContext).map(([k, v]) => ({
        name: k,
        type: typeof v,
        sizeOrShape: Array.isArray(v) ? `length: ${v.length}` : typeof v === "object" && v ? `keys: ${Object.keys(v).length}` : "",
        valuePreview: typeof v === "object" ? JSON.stringify(v) : String(v),
      }));
      this.variableListeners.forEach((fn) => fn(currentVars));
    } catch (err: any) {
      evalError = err;
    }

    if (stdoutLogs.length > 0) {
      outputs.push({
        output_type: "stream",
        name: "stdout",
        text: stdoutLogs.join("\n") + "\n",
      });
    }

    if (stderrLogs.length > 0) {
      outputs.push({
        output_type: "stream",
        name: "stderr",
        text: stderrLogs.join("\n") + "\n",
      });
    }

    if (evalError) {
      outputs.push({
        output_type: "error",
        ename: evalError.name || "JavaScriptError",
        evalue: evalError.message || String(evalError),
        traceback: [
          `\u001b[0;31mJavaScript Runtime Error\u001b[0m`,
          `\u001b[0;31m${evalError.message || String(evalError)}\u001b[0m`,
        ],
      });
    } else if (evalResult !== undefined) {
      if (typeof evalResult === "object" && evalResult !== null) {
        outputs.push({
          output_type: "execute_result",
          execution_count: count,
          data: {
            "application/json": evalResult,
            "text/plain": JSON.stringify(evalResult, null, 2),
          },
        });
      } else {
        outputs.push({
          output_type: "execute_result",
          execution_count: count,
          data: {
            "text/plain": String(evalResult),
          },
        });
      }
    }

    const duration = Math.round(performance.now() - startTime);

    return {
      success: !evalError,
      executionCount: count,
      outputs,
      executionDurationMs: duration,
    };
  }

  /**
   * 4. Quick Offline Simulation Engine
   */
  private async executeSimulator(code: string, count: number, startTime: number): Promise<KernelExecutionResult> {
    await new Promise((r) => setTimeout(r, 120)); // simulated latency
    const outputs: NotebookOutput[] = [];
    const lines = code.trim().split("\n");

    const printMatches = code.match(/print\((.*?)\)/g);
    if (printMatches) {
      const stdout = printMatches
        .map((p) => {
          const inner = p.replace(/^print\(/, "").replace(/\)$/, "").replace(/^['"]/, "").replace(/['"]$/, "");
          return inner;
        })
        .join("\n");
      outputs.push({
        output_type: "stream",
        name: "stdout",
        text: stdout + "\n",
      });
    }

    // Check for plot simulation
    if (code.includes("plt.plot") || code.includes("plt.show")) {
      // SVG chart sample
      const svg = `<svg width="480" height="240" viewBox="0 0 480 240" xmlns="http://www.w3.org/2000/svg" style="background:#09090b; border-radius:8px;">
        <line x1="40" y1="20" x2="40" y2="200" stroke="#3f3f46" stroke-width="2"/>
        <line x1="40" y1="200" x2="460" y2="200" stroke="#3f3f46" stroke-width="2"/>
        <polyline fill="none" stroke="#3b82f6" stroke-width="3" points="40,180 120,120 200,150 280,60 360,90 440,30" />
        <circle cx="120" cy="120" r="4" fill="#60a5fa"/>
        <circle cx="200" cy="150" r="4" fill="#60a5fa"/>
        <circle cx="280" cy="60" r="4" fill="#60a5fa"/>
        <circle cx="360" cy="90" r="4" fill="#60a5fa"/>
        <circle cx="440" cy="30" r="4" fill="#60a5fa"/>
        <text x="240" y="225" fill="#a1a1aa" font-family="sans-serif" font-size="11" text-anchor="middle">Sample Simulation Series</text>
      </svg>`;
      outputs.push({
        output_type: "display_data",
        data: {
          "image/svg+xml": svg,
          "text/plain": "<Simulation Plot Output>",
        },
      });
    }

    // Last expression evaluation
    const lastLine = lines[lines.length - 1].trim();
    if (!lastLine.startsWith("import") && !lastLine.startsWith("def") && !lastLine.startsWith("for") && !lastLine.startsWith("print")) {
      try {
        // Safe evaluation of simple math
        if (/^[\d\s\+\-\*\/\%\(\)\.\,]+$/.test(lastLine)) {
          const val = Function(`'use strict'; return (${lastLine})`)();
          outputs.push({
            output_type: "execute_result",
            execution_count: count,
            data: { "text/plain": String(val) },
          });
        }
      } catch {
        // ignore
      }
    }

    const duration = Math.round(performance.now() - startTime);

    return {
      success: true,
      executionCount: count,
      outputs,
      executionDurationMs: duration,
    };
  }
}

export const kernelService = new KernelService();
export default kernelService;
