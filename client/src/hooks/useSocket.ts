import { useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";

interface SocketEvents {
  "ticket:created": (data: { ticketNumber: number; entryId: number; timestamp: number; isPriority?: boolean; priorityType?: string }) => void;
  "customer:called": (data: { ticketNumber: number; bankId: number; entryId: number; timestamp: number; phoneNumber?: string; isPriority?: boolean; priorityType?: string }) => void;
  "service:completed": (data: { ticketNumber: number; bankId: number; entryId: number; timestamp: number }) => void;
  "bank:statusChanged": (data: { bankId: number; isOccupied: boolean; isActive: boolean; timestamp: number }) => void;
  "system:configUpdated": (data: { totalBanks: number; timestamp: number }) => void;
  "system:state": (data: any) => void;
  "notification:play": (data: { type: string; ticketNumber: number; bankId: number }) => void;
  "soundSettings:updated": (data: { soundType: string; soundVolume: number; isEnabled: boolean; animationType: string; animationSpeed: string }) => void;
  "system:shutdown": (data: { timestamp: number }) => void;
}

export function useSocket(
  clientType: "kiosk" | "display" | "bank" | "admin",
  bankId?: number
) {
  const socketRef = useRef<Socket | null>(null);
  const handlersRef = useRef<Map<string, Function[]>>(new Map());

  useEffect(() => {
    // Connect to Socket.io server
    const socket = io(window.location.origin, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
    });

    socketRef.current = socket;

    let wasDisconnected = false;

    socket.on("connect", () => {
      console.log(`[Socket] Connected as ${clientType}${bankId ? ` (Bank ${bankId})` : ""}`);

      // Register client type
      socket.emit("register", { type: clientType, bankId });

      // Request initial system state
      socket.emit("system:requestState");

      // Sunucu yeniden başladıysa sayfayı tazele
      if (wasDisconnected) {
        wasDisconnected = false;
        window.location.reload();
      }
    });

    socket.on("disconnect", () => {
      console.log("[Socket] Disconnected");
      wasDisconnected = true;
    });

    socket.on("connect_error", (error) => {
      console.error("[Socket] Connection error:", error);
    });

    // Sistem kapatılınca sayfayı tazele
    socket.on("system:shutdown", () => {
      console.log("[Socket] System shut down, reloading");
      window.location.reload();
    });

    return () => {
      socket.disconnect();
    };
  }, [clientType, bankId]);

  const on = useCallback(
    <K extends keyof SocketEvents>(event: K, handler: SocketEvents[K]) => {
      if (!handlersRef.current.has(event)) {
        handlersRef.current.set(event, []);
      }
      handlersRef.current.get(event)!.push(handler as Function);

      // If socket is already connected, add listener immediately
      if (socketRef.current) {
        socketRef.current.on(event, handler as any);
      }

      // Return unsubscribe function
      return () => {
        const handlers = handlersRef.current.get(event) || [];
        const index = handlers.indexOf(handler as Function);
        if (index > -1) {
          handlers.splice(index, 1);
        }
        if (socketRef.current) {
          socketRef.current.off(event, handler as any);
        }
      };
    },
    []
  );

  const emit = useCallback(
    <K extends keyof SocketEvents>(event: K, data: Parameters<SocketEvents[K]>[0]) => {
      if (socketRef.current) {
        socketRef.current.emit(event, data);
      }
    },
    []
  );

  return { socket: socketRef.current, on, emit };
}
