import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { exec } from "child_process";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { setupSocketIO } from "./socket";
import { getAllBanks, getSystemConfig, updateSystemConfig, resetQueue } from "../db";
import { startDiscovery } from "./discovery";
import { getIO } from "./socket";


function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function killPort(port: number): Promise<void> {
  return new Promise(resolve => {
    exec(`netstat -ano | findstr :${port}`, { encoding: "utf8", timeout: 3000 }, (err, stdout) => {
      if (err || !stdout) return resolve();
      const lines = stdout.split("\n").filter(l => l.includes("LISTENING"));
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && pid !== "0") {
          exec(`taskkill /PID ${pid} /F`, { timeout: 2000 }, () => {});
        }
      }
      resolve();
    });
  });
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  // Setup Socket.io for real-time communication
  setupSocketIO(server);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // Bank IP restriction middleware: bank PCs can only see /bank page
  app.use(async (req, res, next) => {
    const clientIp = req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() || req.socket.remoteAddress || "";
    const ip = clientIp.replace(/^::ffff:/, "");
    if (!ip) return next();

    try {
      const banks = await getAllBanks();
      const isBankIp = banks.some((b: any) => b.ipAddress === ip);
      if (isBankIp) {
        // Allow API calls, static assets, and the /bank page
        if (
          req.path.startsWith("/api/") ||
          req.path.startsWith("/assets/") ||
          req.path.startsWith("/src/") ||
          req.path === "/bank" ||
          req.path.startsWith("/bank/")
        ) {
          return next();
        }
        // Redirect everything else to /bank
        return res.redirect("/bank");
      }
    } catch (_) {}
    next();
  });

  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");

  // Kill any existing process on the preferred port
  await killPort(preferredPort);
  await new Promise(r => setTimeout(r, 300));

  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  async function checkBusinessHours() {
    try {
      const cfg = await getSystemConfig();
      if (!cfg) return;
      const now = new Date();
      const minutes = now.getHours() * 60 + now.getMinutes();
      const start = (cfg.businessHoursStart || "09:00").split(":").map(Number);
      const end = (cfg.businessHoursEnd || "18:00").split(":").map(Number);
      const startMinutes = start[0] * 60 + start[1];
      const endMinutes = end[0] * 60 + end[1];
      const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay();
      const days = (cfg.workingDays || "1,2,3,4,5").split(",").map(Number);
      const isWorkingDay = days.includes(dayOfWeek);
      const withinHours = minutes >= startMinutes && minutes < endMinutes;
      if (!(isWorkingDay && withinHours)) {
        if (cfg.isSystemActive) {
          await updateSystemConfig({ isSystemActive: false });
          await resetQueue();
          const io = getIO();
          if (io) io.emit("system:shutdown", { timestamp: Date.now() });
          console.log("[Server] System auto-closed (outside business hours), queue cleared");
        }
      }
    } catch (e) {
      console.error("[Server] Business hours check error:", e);
    }
  }

  // Hemen kontrol et, sonra her 30sn'de bir tekrarla
  await checkBusinessHours();
  setInterval(checkBusinessHours, 30000);

  server.listen(port, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${port}/`);
    startDiscovery(port);
  });
}

startServer().catch(console.error);
