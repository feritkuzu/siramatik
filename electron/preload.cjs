const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  saveConfig: (serverUrl) => ipcRenderer.invoke("save-config", serverUrl),
  getConfig: () => ipcRenderer.invoke("get-config"),
  minimize: () => ipcRenderer.send("window-minimize"),
  close: () => ipcRenderer.send("window-close"),
  onDiscovered: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("discovered", handler);
    return () => ipcRenderer.removeListener("discovered", handler);
  },
  // Display-specific: play notification sound via main process (no autoplay restrictions)
  playNotification: (filePath) => ipcRenderer.send("play-notification", filePath),
});
