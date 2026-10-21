import fs from "fs";
import path from "path";
import net from "net";
import { fileURLToPath } from "url";
import mongoose from "mongoose";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mongodInstance = null;

const DEFAULT_DB_PATH = path.resolve(__dirname, "../../storage/data/db");
const DEFAULT_PORT = 27018;
const DEFAULT_DB_NAME = "cloudforge";

const isPortListening = (port, host = "127.0.0.1", timeoutMs = 800) => {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, host);
  });
};

/**
 * Connect to MongoDB with robust persistence:
 * 1. Configured MONGODB_URI (e.g. Atlas or external MongoDB)
 * 2. Probe existing local running instance on LOCAL_DB_PORT
 * 3. Spawn embedded persistent MongoDB with WiredTiger storage engine pointing to LOCAL_DB_PATH
 */
export const connectDB = async () => {
  // Reuse existing connection in warm serverless environments
  if (mongoose.connection.readyState >= 1) {
    return true;
  }

  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;

  // 1. Try connecting to configured external URI if provided
  if (mongoUri) {
    try {
      console.log("Connecting to configured MongoDB URI...");
      await mongoose.connect(mongoUri, {
        dbName: process.env.DB_NAME || "cloudforge",
        serverSelectionTimeoutMS: 5000,
      });
      console.log("MongoDB connected successfully to configured URI");
      return true;
    } catch (error) {
      console.warn("Configured MongoDB connection failed:", error.message);

      // If it failed with a DNS SRV error, try public DNS fallback
      if (mongoUri.startsWith("mongodb+srv://") && (error.message.includes("querySrv") || error.message.includes("ENOTFOUND"))) {
        try {
          console.log("Attempting DNS fallback for MongoDB SRV resolution...");
          const dns = (await import("dns")).default;
          dns.setServers(["8.8.8.8", "1.1.1.1"]);
          await mongoose.connect(mongoUri, {
            dbName: process.env.DB_NAME || "cloudforge",
            serverSelectionTimeoutMS: 5000,
          });
          console.log("MongoDB connected successfully via DNS fallback");
          return true;
        } catch (fallbackErr) {
          console.warn("MongoDB DNS fallback failed:", fallbackErr.message);
        }
      }

      if (process.env.VERCEL) {
        console.error("Serverless MongoDB connection failed. Please ensure MONGO_URI is set in Vercel project environment variables.");
        return false;
      }
      console.log("Falling back to local persistent database...");
    }
  }

  if (process.env.VERCEL) {
    console.warn("MONGO_URI not configured in Vercel environment.");
    return false;
  }

  const localPort = parseInt(process.env.LOCAL_DB_PORT || String(DEFAULT_PORT), 10);
  const dbName = process.env.LOCAL_DB_NAME || DEFAULT_DB_NAME;
  const dbPath = process.env.LOCAL_DB_PATH
    ? path.resolve(process.env.LOCAL_DB_PATH)
    : DEFAULT_DB_PATH;

  // Ensure persistent data directory exists
  if (!fs.existsSync(dbPath)) {
    fs.mkdirSync(dbPath, { recursive: true });
  }

  const localUri = `mongodb://127.0.0.1:${localPort}/${dbName}`;

  // 2. Probe if an existing local MongoDB is already running on this port using raw TCP socket (does not pollute Mongoose state)
  const isListening = await isPortListening(localPort);
  if (isListening) {
    try {
      console.log(`Connecting to existing local MongoDB at ${localUri}...`);
      await mongoose.connect(localUri, { serverSelectionTimeoutMS: 3000 });
      console.log(`Connected to existing running MongoDB at ${localUri}`);
      return true;
    } catch (err) {
      console.warn(`Could not connect to listener on port ${localPort}:`, err.message);
    }
  }

  // 3. Launch embedded persistent MongoDB instance using WiredTiger on disk
  try {
    console.log(`Starting embedded persistent MongoDB server at [${dbPath}] on port ${localPort}...`);
    const { MongoMemoryServer } = await import("mongodb-memory-server");

    mongodInstance = await MongoMemoryServer.create({
      instance: {
        dbPath,
        storageEngine: "wiredTiger",
        port: localPort,
        dbName,
      },
    });

    const uri = mongodInstance.getUri(dbName);
    console.log(`Embedded persistent MongoDB server started at ${uri}`);
    await mongoose.connect(uri);
    console.log("MongoDB connected successfully (Persistent Local Storage)");
    return true;
  } catch (err) {
    console.warn(`Could not bind to local port ${localPort} (${err.message}). Attempting dynamic port with persistent storage...`);

    // Fallback if localPort has a conflict: still use persistent dbPath with dynamic port
    try {
      const { MongoMemoryServer } = await import("mongodb-memory-server");
      mongodInstance = await MongoMemoryServer.create({
        instance: {
          dbPath,
          storageEngine: "wiredTiger",
          dbName,
        },
      });

      const uri = mongodInstance.getUri(dbName);
      console.log(`Embedded persistent MongoDB server started on dynamic port at ${uri}`);
      await mongoose.connect(uri);
      console.log("MongoDB connected successfully (Persistent Local Storage - Dynamic Port)");
      return true;
    } catch (innerErr) {
      console.error("Failed to start persistent MongoDB server:", innerErr.message);
      return false;
    }
  }
};

/**
 * Cleanly disconnect Mongoose and shut down the embedded instance
 */
export const disconnectDB = async () => {
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
      console.log("Mongoose disconnected");
    }
    if (mongodInstance) {
      console.log("Stopping embedded persistent MongoDB server...");
      await mongodInstance.stop();
      mongodInstance = null;
      console.log("Embedded MongoDB server stopped");
    }
  } catch (err) {
    console.error("Error during database disconnect:", err.message);
  }
};

export default connectDB;