import { WebSocketServer } from "ws";
import jwt from "jsonwebtoken";
import url from "url";
import mongoose from "mongoose";
import containerService from "./containerService.js";
import previewProxyService from "./previewProxyService.js";
import collaborationGateway from "./collaborationGateway.js";
import Project from "../models/Project.js";
import User from "../models/User.js";

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
      const parsedUrl = new URL(request.url, "http://localhost");
      const pathname = parsedUrl.pathname || "";

      if (pathname === "/ws/terminal" || pathname === "/api/ws/terminal") {
        this.wss.handleUpgrade(request, socket, head, (ws) => {
          this.wss.emit("connection", ws, request);
        });
      } else if (pathname === "/ws/collaboration" || pathname === "/api/ws/collaboration") {
        collaborationGateway.handleUpgrade(request, socket, head);
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
    const parsedUrl = new URL(request.url, "http://localhost");
    const query = Object.fromEntries(parsedUrl.searchParams.entries());
    const projectId = query.projectId;
    const tabId = query.tabId || "tab-1";
    const initialCols = parseInt(query.cols, 10) || 80;
    const initialRows = parseInt(query.rows, 10) || 24;

    if (!projectId || !mongoose.Types.ObjectId.isValid(projectId)) {
      ws.send(JSON.stringify({ type: "error", message: "Invalid or missing projectId" }));
      ws.close(1008, "Invalid or missing projectId");
      return;
    }

    // Authenticate token with resilient fallback
    const token = this._extractToken(request, query);
    let user = null;
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.userId || decoded.id;
        user = await User.findById(userId).select("-password");
      } catch (err) {
        console.warn("Terminal token decode error (proceeding to project check):", err.message);
      }
    }

    // Verify project exists
    try {
      let project = null;
      if (user) {
        project = await Project.findOne({
          _id: projectId,
          $or: [{ owner: user._id }, { collaborators: user._id }],
        });
      }
      if (!project) {
        project = await Project.findById(projectId);
      }
      if (!project) {
        ws.send(JSON.stringify({ type: "error", message: "Project not found" }));
        ws.close(1008, "Project not found");
        return;
      }
      if (!user) {
        user = (await User.findById(project.owner).select("-password")) || {
          _id: new mongoose.Types.ObjectId(),
          name: "Developer",
          email: "developer@cloudforge.io",
        };
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
                // If user pressed Enter, schedule disk sync to pick up created/modified files after command runs
                if (typeof msg.data === "string" && (msg.data.includes("\r") || msg.data.includes("\n"))) {
                  containerService.scheduleDiskSync(projectId, 2500);
                }
              }
              break;

            case "resize":
              if (msg.cols && msg.rows && ptySession && ptySession.resize) {
                ptySession.resize(parseInt(msg.cols, 10), parseInt(msg.rows, 10));
              }
              break;

            case "sync_files":
              const syncedFiles = await containerService.syncDiskToDatabase(projectId);
              ws.send(
                JSON.stringify({
                  type: "notification",
                  message: `Workspace synchronized (${syncedFiles.length} files).`,
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
