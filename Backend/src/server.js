import http from "http";
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";

import connectDB from "./config/db.js";

import authRoutes from "./routes/authRoutes.js";
import projectRoutes from "./routes/projectRoutes.js";
import previewRoutes from "./routes/previewRoutes.js";
import terminalGateway from "./services/terminalGateway.js";

dotenv.config();

const app = express();
const server = http.createServer(app);

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(cookieParser());

app.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: "CloudForge IDE & Native VCS API with Docker Workspace Execution and Live Web Previews",
    version: "1.2.0",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    environment: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
  });
});

// Dynamic Web Preview & Reverse Proxy routes (Supports Iframe embedding and relative assets)
app.use("/api/projects/:id/preview", previewRoutes);

app.use("/api/auth", authRoutes);
app.use("/api/projects", projectRoutes);

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  const connected = await connectDB();

  if (!connected) {
    console.error("Server startup aborted because MongoDB connection failed.");
    process.exit(1);
  }

  // Initialize Terminal WebSocket Gateway
  terminalGateway.init(server);

  server.listen(PORT, () => {
    console.log(`CloudForge backend running on port ${PORT} [Env: ${process.env.NODE_ENV || "development"}]`);
    console.log(`Terminal WebSocket Gateway listening on ws://localhost:${PORT}/ws/terminal`);
  });
};

startServer();