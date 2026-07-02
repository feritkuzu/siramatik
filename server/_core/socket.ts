import { Server as SocketIOServer } from "socket.io";
import { Server as HTTPServer } from "http";
import * as db from "../db";

interface SocketUser {
  id: string;
  type: "kiosk" | "display" | "bank" | "admin";
  bankId?: number;
}

const socketUsers = new Map<string, SocketUser>();
let ioInstance: SocketIOServer | null = null;

export function getIO(): SocketIOServer | null {
  return ioInstance;
}

export function emitCustomerCalled(data: {
  ticketNumber: number;
  bankId: number;
  entryId: number;
  phoneNumber?: string;
  isPriority?: boolean;
  priorityType?: string;
}) {
  const io = getIO();
  if (!io) return;

  io.emit("customer:called", {
    ...data,
    timestamp: Date.now(),
  });

  io.emit("notification:play", {
    type: "customer_called",
    ticketNumber: data.ticketNumber,
    bankId: data.bankId,
  });
}

export function emitServiceCompleted(data: {
  ticketNumber: number;
  bankId: number;
  entryId: number;
}) {
  const io = getIO();
  if (!io) return;

  io.emit("service:completed", {
    ...data,
    timestamp: Date.now(),
  });
}

export function setupSocketIO(httpServer: HTTPServer) {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: ["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:5173"],
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    // Register client type
    socket.on("register", (data: { type: SocketUser["type"]; bankId?: number }) => {
      const user: SocketUser = {
        id: socket.id,
        type: data.type,
        bankId: data.bankId,
      };
      socketUsers.set(socket.id, user);
      console.log(`[Socket] Registered ${data.type}${data.bankId ? ` (Bank ${data.bankId})` : ""}`);

      // Send initial state to newly connected client
      broadcastSystemState(io);
    });

    // New ticket created
    socket.on("ticket:created", async (data: { ticketNumber: number; entryId: number }) => {
      console.log(`[Socket] New ticket created: #${data.ticketNumber}`);
      
      // Broadcast to all clients
      io.emit("ticket:created", {
        ticketNumber: data.ticketNumber,
        entryId: data.entryId,
        timestamp: Date.now(),
      });

      // Update system state
      broadcastSystemState(io);
    });

    // Customer called (from client socket emit)
    socket.on("customer:called", async (data) => {
      try {
        console.log(`[Socket] Customer called: #${data.ticketNumber} -> Bank ${data.bankId}`);
        emitCustomerCalled(data);
        await broadcastSystemState(io);
      } catch (e) {
        console.error("[Socket] Error handling customer:called:", e);
      }
    });

    // Service completed
    socket.on(
      "service:completed",
      async (data: { ticketNumber: number; bankId: number; entryId: number }) => {
        console.log(`[Socket] Service completed: #${data.ticketNumber} at Bank ${data.bankId}`);

        io.emit("service:completed", {
          ticketNumber: data.ticketNumber,
          bankId: data.bankId,
          entryId: data.entryId,
          timestamp: Date.now(),
        });

        // Update system state
        broadcastSystemState(io);
      }
    );

    // Bank status changed
    socket.on(
      "bank:statusChanged",
      async (data: { bankId: number; isOccupied: boolean; isActive: boolean }) => {
        console.log(
          `[Socket] Bank ${data.bankId} status changed: occupied=${data.isOccupied}, active=${data.isActive}`
        );

        io.emit("bank:statusChanged", {
          bankId: data.bankId,
          isOccupied: data.isOccupied,
          isActive: data.isActive,
          timestamp: Date.now(),
        });

        // Update system state
        broadcastSystemState(io);
      }
    );

    // System config updated
    socket.on("system:configUpdated", async (data: { totalBanks: number }) => {
      console.log(`[Socket] System config updated: ${data.totalBanks} banks`);

      io.emit("system:configUpdated", {
        totalBanks: data.totalBanks,
        timestamp: Date.now(),
      });

      // Update system state
      broadcastSystemState(io);
    });

    // Request system state
    socket.on("system:requestState", async () => {
      broadcastSystemState(io, socket.id);
    });

    // Disconnect
    socket.on("disconnect", () => {
      socketUsers.delete(socket.id);
      console.log(`[Socket] Client disconnected: ${socket.id}`);
    });
  });

  ioInstance = io;
  return io;
}

async function broadcastSystemState(io: SocketIOServer, targetSocketId?: string) {
  try {
    const config = await db.getSystemConfig();
    const banks = await db.getAllBanks();
    const waitingQueue = await db.getWaitingQueue();
    const stats = await db.getQueueStats();

    const state = {
      config,
      banks,
      waitingQueue,
      stats,
      timestamp: Date.now(),
    };

    if (targetSocketId) {
      // Send only to specific client
      io.to(targetSocketId).emit("system:state", state);
    } else {
      // Broadcast to all clients
      io.emit("system:state", state);
    }
  } catch (error) {
    console.error("[Socket] Error broadcasting system state:", error);
  }
}

export function emitToClient(io: SocketIOServer, clientType: SocketUser["type"], event: string, data: any) {
  const clients = Array.from(socketUsers.values()).filter((u) => u.type === clientType);
  clients.forEach((client) => {
    io.to(client.id).emit(event, data);
  });
}

export function emitToBank(io: SocketIOServer, bankId: number, event: string, data: any) {
  const clients = Array.from(socketUsers.values()).filter((u) => u.type === "bank" && u.bankId === bankId);
  clients.forEach((client) => {
    io.to(client.id).emit(event, data);
  });
}

export function getConnectedBankIds(): number[] {
  const bankIds = new Set<number>();
  for (const user of socketUsers.values()) {
    if (user.type === "bank" && user.bankId) {
      bankIds.add(user.bankId);
    }
  }
  return Array.from(bankIds);
}
