import containerService from "../services/containerService.js";
import Project from "../models/Project.js";

/**
 * Executes a Python code snippet inside the project's Docker container or host Python runtime
 * @route POST /api/projects/:id/kernel/execute
 * @access Private
 */
export const executeCode = async (req, res) => {
  const startTime = Date.now();
  try {
    const projectId = req.params.id;
    const { code } = req.body;

    if (!code || typeof code !== "string") {
      return res.status(400).json({ success: false, message: "code string is required." });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found." });
    }

    // Python wrapper script to capture stdout, stderr, plots, and variables
    const escapedCode = Buffer.from(code).toString("base64");
    const runnerScript = `
import sys, io, base64, json

sys.stdout = io.StringIO()
sys.stderr = io.StringIO()

_raw_code = base64.b64decode("${escapedCode}").decode("utf-8")
_exec_error = None
_eval_result = None

try:
    # Try eval for expression vs exec for block
    _compiled = compile(_raw_code, "<jupyter_cell>", "exec")
    exec(_compiled, globals())
except Exception as e:
    _exec_error = {
        "ename": type(e).__name__,
        "evalue": str(e)
    }

_stdout_str = sys.stdout.getvalue()
_stderr_str = sys.stderr.getvalue()

# Extract matplotlib figures if available
_plots = []
try:
    if 'matplotlib' in sys.modules or 'matplotlib.pyplot' in sys.modules:
        import matplotlib.pyplot as plt
        for fignum in plt.get_fignums():
            fig = plt.figure(fignum)
            buf = io.BytesIO()
            fig.savefig(buf, format='png', bbox_inches='tight', dpi=100)
            buf.seek(0)
            _plots.append(base64.b64encode(buf.read()).decode('utf-8'))
        plt.close('all')
except:
    pass

# Harvest variables
_vars = []
for k, v in list(globals().items()):
    if not k.startswith('_') and k not in ('sys', 'io', 'base64', 'json', 'plt', 'np', 'pd'):
        try:
            _vars.append({
                "name": str(k),
                "type": type(v).__name__,
                "valuePreview": str(v)[:120]
            })
        except:
            pass

_response = {
    "stdout": _stdout_str,
    "stderr": _stderr_str,
    "plots": _plots,
    "vars": _vars,
    "error": _exec_error
}

print("__CF_KERNEL_DELIMITER__" + json.dumps(_response))
`;

    const runnerB64 = Buffer.from(runnerScript).toString("base64");
    const shellCommand = `python3 -c 'import base64; exec(base64.b64decode("${runnerB64}").decode("utf-8"))' 2>&1 || python -c "import base64; exec(base64.b64decode('${runnerB64}').decode('utf-8'))" 2>&1`;

    const execResult = await containerService.execCommand(projectId, shellCommand);
    const combinedOutput = (execResult.stdout || "") + (execResult.stderr || "");

    const outputs = [];
    let variables = [];
    let isSuccess = true;

    if (combinedOutput.includes("__CF_KERNEL_DELIMITER__")) {
      const parts = combinedOutput.split("__CF_KERNEL_DELIMITER__");
      const jsonStr = parts[1]?.trim() || "{}";
      try {
        const parsed = JSON.parse(jsonStr);

        if (parsed.stdout && parsed.stdout.trim()) {
          outputs.push({
            output_type: "stream",
            name: "stdout",
            text: parsed.stdout,
          });
        }

        if (parsed.stderr && parsed.stderr.trim()) {
          outputs.push({
            output_type: "stream",
            name: "stderr",
            text: parsed.stderr,
          });
        }

        if (parsed.plots && Array.isArray(parsed.plots)) {
          for (const p of parsed.plots) {
            outputs.push({
              output_type: "display_data",
              data: {
                "image/png": p,
                "text/plain": "<Figure size 640x480 with Matplotlib Axes>",
              },
            });
          }
        }

        if (parsed.error) {
          isSuccess = false;
          outputs.push({
            output_type: "error",
            ename: parsed.error.ename,
            evalue: parsed.error.evalue,
            traceback: [
              `\u001b[0;31m---------------------------------------------------------------------------\u001b[0m`,
              `\u001b[0;31m${parsed.error.ename}\u001b[0m: ${parsed.error.evalue}`,
            ],
          });
        }

        variables = parsed.vars || [];
      } catch (err) {
        outputs.push({
          output_type: "stream",
          name: "stdout",
          text: combinedOutput,
        });
      }
    } else {
      if (combinedOutput.trim()) {
        outputs.push({
          output_type: "stream",
          name: execResult.exitCode === 0 ? "stdout" : "stderr",
          text: combinedOutput,
        });
      }
    }

    const duration = Date.now() - startTime;

    res.json({
      success: isSuccess,
      outputs,
      variables,
      executionDurationMs: duration,
    });
  } catch (err) {
    console.error("Kernel execute error:", err);
    res.status(500).json({
      success: false,
      message: err.message,
      executionDurationMs: Date.now() - startTime,
      outputs: [
        {
          output_type: "error",
          ename: "ServerError",
          evalue: err.message,
          traceback: [err.message],
        },
      ],
    });
  }
};

/**
 * @desc Get kernel runtime status and package health
 * @route GET /api/projects/:id/kernel/status
 * @access Private
 */
export const getKernelStatus = async (req, res) => {
  try {
    const projectId = req.params.id;
    const containerStatus = await containerService.getProjectContainer(projectId);

    res.json({
      success: true,
      runtime: "python3",
      containerRunning: Boolean(containerStatus && containerStatus.status === "running"),
      supportedKernels: ["pyodide", "container", "javascript", "simulator"],
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * @desc Reset server kernel session
 * @route POST /api/projects/:id/kernel/restart
 * @access Private
 */
export const restartKernel = async (req, res) => {
  try {
    res.json({ success: true, message: "Kernel session restarted." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
