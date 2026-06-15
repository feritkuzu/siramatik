import dgram from "dgram";
import { networkInterfaces } from "os";

const BROADCAST_PORT = 31234;
const INTERVAL_MS = 5000;

function getLocalIp(): string {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }
  return "127.0.0.1";
}

export function startDiscovery(port: number) {
  const ip = getLocalIp();
  const socket = dgram.createSocket({ type: "udp4", reuseAddr: true });

  socket.on("error", (err) => {
    console.error(`[Discovery] Socket error:`, err.message);
  });

  const broadcast = () => {
    const message = JSON.stringify({
      type: "siramatik",
      ip,
      port,
      timestamp: Date.now(),
    });
    socket.send(message, 0, message.length, BROADCAST_PORT, "255.255.255.255", (err) => {
      if (err) console.error("[Discovery] Send error:", err.message);
    });
  };

  socket.bind(() => {
    socket.setBroadcast(true);
    broadcast();
    setInterval(broadcast, INTERVAL_MS);
    console.log(`[Discovery] Broadcasting ${ip}:${port} every ${INTERVAL_MS / 1000}s`);
  });

  return socket;
}
