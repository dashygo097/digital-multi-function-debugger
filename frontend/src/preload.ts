import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("versions", {
  node: () => process.versions.node,
  chrome: () => process.versions.chrome,
  electron: () => process.versions.electron,
});

contextBridge.exposeInMainWorld("usbAPI", {
  getDevices: () => ipcRenderer.invoke("usb-get-devices"),
});

contextBridge.exposeInMainWorld("serialAPI", {
  getPorts: () => ipcRenderer.invoke("serial-get-ports"),
  openPort: (portPath: string, options?: any) =>
    ipcRenderer.invoke("serial-open", portPath, options),
  closePort: (portPath: string) => ipcRenderer.invoke("serial-close", portPath),
  send: (portPath: string, data: string) =>
    ipcRenderer.invoke("serial-send", portPath, data),
  sendRaw: (portPath: string, buffer: Uint8Array) =>
    ipcRenderer.invoke("serial-send-raw", portPath, buffer),
  onPortAdded: (callback: (port: Electron.SerialPort) => void) =>
    ipcRenderer.on("serial-port-added", (_, port) => callback(port)),
  onPortRemoved: (callback: (port: Electron.SerialPort) => void) =>
    ipcRenderer.on("serial-port-removed", (_, port) => callback(port)),
  onPortOpened: (callback: (data: { port: string }) => void) =>
    ipcRenderer.on("serial-opened", (_, data) => callback(data)),
  onPortClosed: (callback: (data: { port: string }) => void) =>
    ipcRenderer.on("serial-closed", (_, data) => callback(data)),
  onDataSent: (callback: (data: { port: string; data: string }) => void) =>
    ipcRenderer.on("serial-data-sent", (_, data) => callback(data)),
  onDataReceived: (callback: (data: { port: string; data: string }) => void) =>
    ipcRenderer.on("serial-data-received", (_, data) => callback(data)),
  notifyDataReceived: (portPath: string, data: string) =>
    ipcRenderer.send("serial-data-received", portPath, data),

  removeAllListeners: () => {
    ipcRenderer.removeAllListeners("serial-port-added");
    ipcRenderer.removeAllListeners("serial-port-removed");
    ipcRenderer.removeAllListeners("serial-opened");
    ipcRenderer.removeAllListeners("serial-closed");
    ipcRenderer.removeAllListeners("serial-data-sent");
    ipcRenderer.removeAllListeners("serial-data-received");
  },
});
