import http from "http";
import https from "https";
import url from "url";
import net from "net";
import containerService from "./containerService.js";

class PreviewProxyService {
  /**
   * Resolve target host (container IP or 127.0.0.1) for a project
   */
  /**
   * Resolve target host (Cloud Container IP, Remote Worker Domain, or 127.0.0.1) for a project
   */
  async resolveTargetHost(projectId) {
    try {
      // 1. Explicit remote container host / worker node
      if (process.env.REMOTE_CONTAINER_HOST) {
        return process.env.REMOTE_CONTAINER_HOST;
      }

      // 2. Remote DOCKER_HOST hostname
      if (process.env.DOCKER_HOST) {
        try {
          const parsed = new URL(process.env.DOCKER_HOST.replace("tcp://", "http://"));
          if (parsed.hostname && parsed.hostname !== "127.0.0.1" && parsed.hostname !== "localhost") {
            return parsed.hostname;
          }
        } catch {
          // ignore
        }
      }

      // 3. Inspect container IP
      const dockerStatus = await containerService.getDockerStatus();
      if (dockerStatus.available) {
        const containerName = containerService.getContainerName(projectId);
        const container = containerService.docker.getContainer(containerName);
        const inspect = await container.inspect();
        if (inspect.State.Running && inspect.NetworkSettings?.IPAddress) {
          return inspect.NetworkSettings.IPAddress;
        }
      }
    } catch {
      // ignore
    }
    return "127.0.0.1";
  }

  /**
   * Handle incoming HTTP preview request and reverse-proxy to target service
   */
  async handleProxyRequest(req, res, projectId, targetPort, subpath = "") {
    const port = parseInt(targetPort, 10);

    // Port security check
    if (isNaN(port) || port < 1024 || port > 65535) {
      return res.status(400).send(`Invalid preview port: ${targetPort}. Allowed range: 1024-65535.`);
    }

    const targetHost = await this.resolveTargetHost(projectId);
    const targetBaseUrl = `/api/projects/${projectId}/preview/${port}/`;

    // Ensure leading slash on subpath
    let targetPath = subpath.startsWith("/") ? subpath : `/${subpath}`;
    if (!targetPath || targetPath === "/") {
      targetPath = "/";
    }

    // Preserve query strings
    const queryString = url.parse(req.url).search || "";
    const fullTargetPath = targetPath + queryString;

    const proxyHeaders = { ...req.headers };
    proxyHeaders.host = `${targetHost}:${port}`;
    proxyHeaders["x-forwarded-host"] = req.headers.host || "localhost:5000";
    proxyHeaders["x-forwarded-proto"] = req.headers["x-forwarded-proto"] || "http";
    proxyHeaders["x-forwarded-for"] = req.socket.remoteAddress || "127.0.0.1";
    delete proxyHeaders["accept-encoding"]; // Avoid gzip to enable HTML <base> tag injection

    const proxyOptions = {
      hostname: targetHost,
      port: port,
      path: fullTargetPath,
      method: req.method,
      headers: proxyHeaders,
      timeout: 15000,
    };

    const proxyReq = http.request(proxyOptions, (proxyRes) => {
      const statusCode = proxyRes.statusCode || 200;
      const contentType = (proxyRes.headers["content-type"] || "").toLowerCase();

      // Handle HTML pages: inject <base> tag so relative CSS/JS assets resolve through the preview proxy
      if (contentType.includes("text/html")) {
        const responseHeaders = { ...proxyRes.headers };
        delete responseHeaders["content-length"]; // Content length will change due to <base> injection
        delete responseHeaders["content-security-policy"]; // Prevent iframe embedding blockage

        res.writeHead(statusCode, responseHeaders);

        let htmlBody = "";
        proxyRes.setEncoding("utf8");

        proxyRes.on("data", (chunk) => {
          htmlBody += chunk;
        });

        proxyRes.on("end", () => {
          // Inject <base href="..."> if not already present
          if (!htmlBody.includes("<base ") && htmlBody.includes("<head>")) {
            htmlBody = htmlBody.replace(
              "<head>",
              `<head>\n  <base href="${targetBaseUrl}">\n  <script>window.__CLOUDFORGE_PREVIEW__ = { projectId: "${projectId}", port: ${port} };</script>`
            );
          } else if (!htmlBody.includes("<base ") && htmlBody.includes("<!DOCTYPE html>")) {
            htmlBody = htmlBody.replace(
              "<!DOCTYPE html>",
              `<!DOCTYPE html>\n<base href="${targetBaseUrl}">`
            );
          }
          res.end(htmlBody);
        });
      } else {
        // Direct stream for CSS, JS, images, API JSON, and binary assets
        res.writeHead(statusCode, proxyRes.headers);
        proxyRes.pipe(res);
      }
    });

    proxyReq.on("error", (err) => {
      if (!res.headersSent) {
        res.status(502).send(`
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8" />
              <title>Preview Server Offline - CloudForge</title>
              <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #09090b; color: #e4e4e7; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                .card { background: #18181b; border: 1px solid #27272a; padding: 2rem; border-radius: 12px; max-width: 480px; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
                h2 { color: #60a5fa; margin-top: 0; font-size: 1.25rem; }
                p { font-size: 0.875rem; color: #a1a1aa; line-height: 1.5; }
                .port-badge { background: #3b82f6; color: white; padding: 2px 8px; border-radius: 6px; font-family: monospace; font-size: 0.9rem; }
                .btn { display: inline-block; margin-top: 1rem; padding: 0.5rem 1rem; background: #2563eb; color: white; border-radius: 8px; text-decoration: none; font-size: 0.875rem; font-weight: 600; }
              </style>
            </head>
            <body>
              <div class="card">
                <h2>Web Server Not Responding</h2>
                <p>No active service was found listening on port <span class="port-badge">:${port}</span> inside this project's workspace.</p>
                <p>Please start your development server (e.g. <code>npm run dev</code> or <code>python app.py</code>) in the terminal or click <strong>Start Server</strong> in the preview toolbar.</p>
              </div>
            </body>
          </html>
        `);
      }
    });

    proxyReq.on("timeout", () => {
      proxyReq.destroy();
      if (!res.headersSent) {
        res.status(504).send("Gateway Timeout: Development server did not respond within 15 seconds.");
      }
    });

    req.pipe(proxyReq);
  }

  /**
   * Handle WebSocket Upgrade for live HMR (Vite / Next.js / Streamlit)
   */
  async handleWebSocketUpgrade(req, socket, head) {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname || "";

    // Expected format: /api/projects/:projectId/preview/:port/...
    const match = pathname.match(/^\/api\/projects\/([^\/]+)\/preview\/(\d+)(\/.*)?$/);
    if (!match) {
      return false;
    }

    const projectId = match[1];
    const port = parseInt(match[2], 10);
    const subpath = (match[3] || "/") + (parsedUrl.search || "");

    const targetHost = await this.resolveTargetHost(projectId);

    const targetSocket = net.connect(port, targetHost, () => {
      // Forward HTTP Upgrade request to the target dev server
      let rawHeader = `${req.method} ${subpath} HTTP/${req.httpVersion}\r\n`;
      for (const [k, v] of Object.entries(req.headers)) {
        if (k.toLowerCase() === "host") {
          rawHeader += `host: ${targetHost}:${port}\r\n`;
        } else {
          rawHeader += `${k}: ${v}\r\n`;
        }
      }
      rawHeader += "\r\n";

      targetSocket.write(rawHeader);
      if (head && head.length) {
        targetSocket.write(head);
      }

      // Bi-directional pipe between browser WebSocket and Container dev server
      targetSocket.pipe(socket);
      socket.pipe(targetSocket);
    });

    targetSocket.on("error", (err) => {
      socket.destroy();
    });

    socket.on("error", (err) => {
      targetSocket.destroy();
    });

    return true;
  }
}

export const previewProxyService = new PreviewProxyService();
export default previewProxyService;
