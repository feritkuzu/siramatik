const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const dgram = require("dgram");

const CONFIG_FILE = path.join(app.getPath("userData"), "config.json");
const BROADCAST_PORT = 31234;
let discoverySocket = null;

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
    }
  } catch (_) {}
  return null;
}

function saveConfig(serverUrl) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify({ serverUrl }, null, 2));
}

let mainWindow = null;
let configWindow = null;
let discoveryTimer = null;

function startDiscovery() {
  if (discoverySocket) return;
  discoverySocket = dgram.createSocket({ type: "udp4", reuseAddr: true });

  discoverySocket.on("message", (msg) => {
    try {
      const data = JSON.parse(msg.toString());
      if (data.type === "siramatik" && data.ip) {
        const url = `http://${data.ip}:${data.port || 3000}`;
        console.log(`[Discovery] Found server at ${url}`);

        // Notify config window if open
        if (configWindow && !configWindow.isDestroyed()) {
          configWindow.webContents.send("discovered", { ip: data.ip, port: data.port || 3000, url });
        }

        // Auto-connect if no config exists
        const existing = loadConfig();
        if (!existing) {
          saveConfig(url);
          if (configWindow && !configWindow.isDestroyed()) {
            configWindow.close();
          }
          if (!mainWindow) {
            createMainWindow(url);
          }
        } else if (existing.serverUrl !== url) {
          // Server IP changed - update silently
          console.log(`[Discovery] Server changed to ${url}, updating config`);
          saveConfig(url);
        }
      }
    } catch (_) {}
  });

  discoverySocket.on("error", (err) => {
    console.error("[Discovery] Socket error:", err.message);
  });

  discoverySocket.bind(BROADCAST_PORT, () => {
    discoverySocket.setBroadcast(true);
    console.log(`[Discovery] Listening on port ${BROADCAST_PORT}`);
  });
}

function createMainWindow(serverUrl) {
  if (mainWindow) {
    mainWindow.loadURL(serverUrl.replace(/\/+$/, "") + "/bank");
    return;
  }

  mainWindow = new BrowserWindow({
    width: 680,
    height: 620,
    resizable: false,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  let url = serverUrl.replace(/\/+$/, "");
  if (!/:\d+$/.test(url)) {
    url += ":3000";
  }
  url += "/bank";

  mainWindow.loadURL(url);

  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription) => {
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Siramatik</title><style>
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family:Segoe UI,sans-serif; background:#0a0a0a; color:#e0e0e0; display:flex; justify-content:center; align-items:center; min-height:100vh; }
      .box { border:4px solid #ff00ff; padding:40px; max-width:400px; text-align:center; }
      h1 { font-size:20px; font-weight:900; color:#ff00ff; text-shadow:0 0 10px #ff00ff; margin-bottom:16px; }
      p { font-size:14px; color:#888; margin-bottom:8px; }
      .ip { color:#00ffff; font-weight:700; }
    </style></head><body>
    <div class="box">
      <h1>SİRAMATİK</h1>
      <p>Sunucuya bağlanılamadı!</p>
      <p class="ip">${url}</p>
      <p style="font-size:12px;color:#666;margin-top:16px;">Sunucu adresini kontrol edin veya config dosyasını silip tekrar deneyin.</p>
    </div></body></html>`;
    mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function createConfigWindow() {
  configWindow = new BrowserWindow({
    width: 500,
    height: 380,
    resizable: false,
    frame: true,
    title: "Siramatik - Sunucu Bağlantısı",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  configWindow.loadFile(path.join(__dirname, "config.html"));

  configWindow.on("closed", () => {
    configWindow = null;
    if (discoveryTimer) clearTimeout(discoveryTimer);
  });
}

ipcMain.handle("save-config", (_event, serverUrl) => {
  saveConfig(serverUrl);
  if (configWindow && !configWindow.isDestroyed()) {
    configWindow.close();
  }
  if (!mainWindow) {
    createMainWindow(serverUrl);
  }
});

ipcMain.handle("get-config", () => {
  return loadConfig();
});

ipcMain.on("window-minimize", () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on("window-close", () => {
  if (mainWindow) mainWindow.destroy();
  app.exit(0);
});

app.whenReady().then(() => {
  startDiscovery();
  const config = loadConfig();
  if (config && config.serverUrl) {
    createMainWindow(config.serverUrl);
  } else {
    createConfigWindow();
    // Auto-close config window after 15s if discovered
    discoveryTimer = setTimeout(() => {
      if (configWindow && !configWindow.isDestroyed()) {
        const cfg = loadConfig();
        if (cfg) {
          configWindow.close();
          if (!mainWindow) createMainWindow(cfg.serverUrl);
        }
      }
    }, 15000);
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (mainWindow === null && configWindow === null) {
    const config = loadConfig();
    if (config && config.serverUrl) {
      createMainWindow(config.serverUrl);
    } else {
      createConfigWindow();
    }
  }
});

app.on("will-quit", () => {
  if (discoverySocket) {
    discoverySocket.close();
    discoverySocket = null;
  }
});
