import { WebSocketServer } from "ws";
import jwt from "jsonwebtoken";
import url from "url";
import containerService from "./containerService.js";
import previewProxyService from "./previewProxyService.js";
import Project from "../models/Project.js";

class TerminalGateway {
  constructor() {
    this.wss = null;
    this.activeSessions = new Map(); // key: `${projectId}:${tabId}` -> session object
  }

  /**
   * Initializes WebSocket Server attached to the main HTTP server
   */
  init(httpServer) {
    this.wss = new WebSocketServer({
      noServer: true,
    });

    httpServer.on("upgrade", async (request, socket, head) => {
      const parsedUrl = url.parse(request.url, true);
      const pathname = parsedUrl.pathname || "";

      if (pathname === "/ws/terminal" || pathname === "/api/ws/terminal") {
        this.wss.handleUpgrade(request, socket, head, (ws) => {
          this.wss.emit("connection", ws, request);
        });
      } else if (pathname.includes("/preview/")) {
        // Delegate to previewProxyService for live Vite/Next.js/Streamlit HMR WebSockets
        const handled = await previewProxyService.handleWebSocketUpgrade(request, socket, head);
        if (!handled) {
          socket.destroy();
        }
      } else {
        socket.destroy();
      }
    });

    this.wss.on("connection", (ws, request) => {
      this._handleConnection(ws, request);
    });

    console.log("CloudForge Terminal WebSocket Gateway initialized on /ws/terminal");
  }

  /**
   * Extract JWT token from cookie or query params
   */
  _extractToken(request, query) {
    if (query.token) return query.token;

    const cookieHeader = request.headers.cookie;
    if (cookieHeader) {
      const cookies = cookieHeader.split(";").map((c) => c.trim());
      for (const cookie of cookies) {
        if (cookie.startsWith("token=")) {
          return cookie.substring(6);
        }
      }
    }

    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      return authHeader.substring(7);
    }

    return null;
  }

  /**
   * Handle incoming WebSocket client connection
   */
  async _handleConnection(ws, request) {
    const parsedUrl = url.parse(request.url, true);
    const query = parsedUrl.query;
    const projectId = query.projectId;
    const tabId = query.tabId || "tab-1";
    const initialCols = parseInt(query.cols, 10) || 80;
    const initialRows = parseInt(query.rows, 10) || 24;

    if (!projectId) {
      ws.send(JSON.stringify({ type: "error", message: "Missing projectId query parameter." }));
      ws.close(1008, "Missing projectId");
      return;
    }

    // Authenticate token (if JWT_SECRET is configured)
    const token = this._extractToken(request, query);
    let userId = null;
    if (process.env.JWT_SECRET && token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.id;
      } catch (err) {
        console.warn(`Terminal WS connection auth token warning: ${err.message}`);
      }
    }

    // Verify project exists
    try {
      const project = await Project.findById(projectId);
      if (!project) {
        ws.send(JSON.stringify({ type: "error", message: "Project not found." }));
        ws.close(1008, "Project not found");
        return;
      }
    } catch (err) {
      ws.send(JSON.stringify({ type: "error", message: "Database lookup failed: " + err.message }));
      ws.close(1011, "Lookup error");
      return;
    }

    const sessionKey = `${projectId}:${tabId}`;

    // Clean up existing session for this tab if open
    if (this.activeSessions.has(sessionKey)) {
      const prevSession = this.activeSessions.get(sessionKey);
      try {
        prevSession.pty.kill();
      } catch {
        // ignore
      }
      this.activeSessions.delete(sessionKey);
    }

    try {
      // Attach PTY session via containerService
      const ptySession = await containerService.attachTerminalPty(
        projectId,
        ws,
        initialCols,
        initialRows
      );

      const sessionObj = {
        projectId,
        tabId,
        ws,
        pty: ptySession,
        createdAt: new Date(),
      };

      this.activeSessions.set(sessionKey, sessionObj);

      // Send initial connection ready message
      const containerInfo = await containerService.getProjectContainer(projectId);
      ws.send(
        JSON.stringify({
          type: "ready",
          projectId,
          tabId,
          container: containerInfo,
        })
      );

      // Handle incoming messages from the frontend xterm.js
      ws.on("message", async (rawMessage) => {
        try {
          const msg = JSON.parse(rawMessage.toString());

          switch (msg.type) {
            case "input":
              if (msg.data && ptySession && ptySession.write) {
                ptySession.write(msg.data);
              }
              break;

            case "resize":
              if (msg.cols && msg.rows && ptySession && ptySession.resize) {
                ptySession.resize(parseInt(msg.cols, 10), parseInt(msg.rows, 10));
              }
              break;

            case "sync_files":
              await containerService.syncFilesToWorkspace(projectId);
              ws.send(
                JSON.stringify({
                  type: "notification",
                  message: "Workspace files synchronized with container.",
                })
              );
              break;

            case "restart_container":
              ws.send(JSON.stringify({ type: "output", data: "\r\nRestarting container...\r\n" }));
              await containerService.restartProjectContainer(projectId);
              ws.send(JSON.stringify({ type: "output", data: "Container restarted successfully.\r\n" }));
              break;

            case "ping":
              ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
              break;

            default:
              break;
          }
        } catch {
          // If raw text data was sent directly, write it to stdin
          if (ptySession && ptySession.write) {
            ptySession.write(rawMessage.toString());
          }
        }
      });

      ws.on("close", () => {
        if (ptySession && ptySession.kill) {
          ptySession.kill();
        }
        this.activeSessions.delete(sessionKey);
      });

      ws.on("error", (err) => {
        console.error(`Terminal WS socket error (${sessionKey}):`, err.message);
        if (ptySession && ptySession.kill) {
          ptySession.kill();
        }
        this.activeSessions.delete(sessionKey);
      });
    } catch (err) {
      console.error(`Failed to initialize terminal PTY for project ${projectId}:`, err);
      ws.send(
        JSON.stringify({
          type: "error",
          message: "Failed to spawn container terminal: " + err.message,
        })
      );
      ws.close(1011, "PTY Spawn Error");
    }
  }

  /**
   * Broadcast container status change to all connected tabs for a project
   */
  broadcastContainerStatus(projectId, containerInfo) {
    for (const [key, session] of this.activeSessions.entries()) {
      if (session.projectId === projectId.toString() && session.ws.readyState === 1) {
        session.ws.send(
          JSON.stringify({
            type: "container_status",
            container: containerInfo,
          })
        );
      }
    }
  }
}

export const terminalGateway = new TerminalGateway();
export default terminalGateway;
