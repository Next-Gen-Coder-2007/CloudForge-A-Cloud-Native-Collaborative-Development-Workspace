import net from "net";
import containerService from "./containerService.js";
import runtimeRegistry from "./runtimeRegistry.js";

class PortDetectorService {
  constructor() {
    this.defaultProbePorts = [
      5173, // Vite / Svelte
      3000, // Next.js / Nuxt / React CRA / Node
      8000, // FastAPI / Django / Python
      5000, // Flask / Express / Python
      8501, // Streamlit
      4200, // Angular
      4321, // Astro
      8080, // Generic Web / Vue CLI
      8050, // Plotly Dash
      7860, // Gradio
      3001, // Alternative Node
      8001, // Alternative Python
      8081, // Alternative Web
    ];
  }

  /**
   * Fast TCP connect probe to check if a port is listening on host/container
   */
  _checkPort(host, port, timeoutMs = 400) {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      let isListening = false;

      socket.setTimeout(timeoutMs);

      socket.on("connect", () => {
        isListening = true;
        socket.destroy();
        resolve(true);
      });

      socket.on("timeout", () => {
        socket.destroy();
        resolve(false);
      });

      socket.on("error", () => {
        socket.destroy();
        resolve(false);
      });

      try {
        socket.connect(port, host);
      } catch {
        resolve(false);
      }
    });
  }

  /**
   * Parse /proc/net/tcp output from Linux container
   */
  _parseProcNetTcp(rawOutput) {
    const ports = new Set();
    const lines = rawOutput.split(/[\r\n]+/);

    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 4) {
        const localAddress = parts[1];
        const state = parts[3];

        // State 0A is TCP_LISTEN in Linux kernel
        if (state === "0A" && localAddress.includes(":")) {
          const hexPort = localAddress.split(":")[1];
          const decimalPort = parseInt(hexPort, 16);
          if (decimalPort > 0 && decimalPort < 65536) {
            // Exclude internal ports like SSH / system
            if (decimalPort !== 22 && decimalPort !== 25) {
              ports.add(decimalPort);
            }
          }
        }
      }
    }

    return Array.from(ports);
  }

  /**
   * Inspect all listening ports inside a project container
   */
  async detectActivePorts(projectId) {
    const dockerStatus = await containerService.getDockerStatus();
    const detectedFramework = await runtimeRegistry.detectProjectFramework(projectId);

    const portsToProbe = new Set([
      detectedFramework.defaultPort,
      ...(detectedFramework.commonPorts || []),
      ...this.defaultProbePorts,
    ]);

    const activePorts = [];

    if (dockerStatus.available) {
      // 1. Try querying /proc/net/tcp directly inside the container
      try {
        const containerName = containerService.getContainerName(projectId);
        const container = containerService.docker.getContainer(containerName);
        const inspectData = await container.inspect();

        if (inspectData.State.Running) {
          const containerIp = inspectData.NetworkSettings?.IPAddress || "127.0.0.1";

          // Read /proc/net/tcp
          const exec = await container.exec({
            Cmd: ["/bin/sh", "-c", "cat /proc/net/tcp /proc/net/tcp6 2>/dev/null || ss -tulpn 2>/dev/null"],
            AttachStdout: true,
            AttachStderr: true,
          });

          const rawOutput = await new Promise((resolve) => {
            exec.start({ hijack: true, stdin: false }, (err, stream) => {
              if (err) return resolve("");
              let out = "";
              containerService.docker.modem.demuxStream(
                stream,
                { write: (c) => (out += c.toString("utf8")) },
                { write: () => {} }
              );
              stream.on("end", () => resolve(out));
            });
          });

          const procPorts = this._parseProcNetTcp(rawOutput);
          procPorts.forEach((p) => portsToProbe.add(p));

          // Test connection to each discovered port on container IP and localhost
          for (const port of portsToProbe) {
            const isListening =
              (await this._checkPort(containerIp, port, 250)) || (await this._checkPort("127.0.0.1", port, 250));

            if (isListening || procPorts.includes(port)) {
              activePorts.push({
                port,
                isPrimary: port === detectedFramework.defaultPort,
                framework: detectedFramework.name,
                url: `/api/projects/${projectId}/preview/${port}/`,
                containerIp,
                status: "active",
              });
            }
          }
        }
      } catch (err) {
        console.warn(`Container port inspection warning (${projectId}):`, err.message);
      }
    }

    // 2. Fallback check on 127.0.0.1 for local host execution
    if (activePorts.length === 0) {
      for (const port of portsToProbe) {
        const isOpen = await this._checkPort("127.0.0.1", port, 250);
        if (isOpen) {
          activePorts.push({
            port,
            isPrimary: port === detectedFramework.defaultPort,
            framework: detectedFramework.name,
            url: `/api/projects/${projectId}/preview/${port}/`,
            containerIp: "127.0.0.1",
            status: "active",
          });
        }
      }
    }

    // If no active ports detected yet, provide the primary expected default port
    if (activePorts.length === 0) {
      activePorts.push({
        port: detectedFramework.defaultPort,
        isPrimary: true,
        framework: detectedFramework.name,
        url: `/api/projects/${projectId}/preview/${detectedFramework.defaultPort}/`,
        containerIp: "127.0.0.1",
        status: "idle",
      });
    }

    return {
      activePorts,
      detectedFramework,
      hasActiveServer: activePorts.some((p) => p.status === "active"),
    };
  }
}

export const portDetectorService = new PortDetectorService();
export default portDetectorService;
