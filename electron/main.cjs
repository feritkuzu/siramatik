const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");

const CONFIG_FILE = path.join(app.getPath("userData"), "config.json");

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

function createMainWindow(serverUrl) {
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
  // Add default port 3000 if no port specified
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
    height: 350,
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
  });
}

ipcMain.handle("save-config", (_event, serverUrl) => {
  saveConfig(serverUrl);
  if (configWindow) {
    configWindow.close();
  }
  createMainWindow(serverUrl);
});

ipcMain.handle("get-config", () => {
  return loadConfig();
});

ipcMain.on("window-minimize", () => {
  if (mainWindow) {
    mainWindow.minimize();
  }
});

ipcMain.on("window-close", () => {
  if (mainWindow) mainWindow.destroy();
  app.exit(0);
});

app.whenReady().then(() => {
  const config = loadConfig();
  if (config && config.serverUrl) {
    createMainWindow(config.serverUrl);
  } else {
    createConfigWindow();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
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
