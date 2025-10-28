import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";

const serialConnections = new Map<string, any>();

const createMainWindow = () => {
  const mainWindow = new BrowserWindow({
    title: "Control Panel",
    width: 1000,
    height: 750,
    autoHideMenuBar: true,
    center: true,
    vibrancy: "under-window",
    visualEffectState: "active",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      sandbox: true,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  let usbDevices: Electron.USBDevice[] = [];
  let serialPorts: Electron.SerialPort[] = [];
  let grantedDeviceThroughPermHandler: Electron.USBDevice;

  mainWindow.webContents.session.on(
    "select-usb-device",
    (event, details, callback) => {
      console.log("select-usb-device triggered:", details);
      usbDevices = details.deviceList;

      event.preventDefault();

      if (details.deviceList && details.deviceList.length > 0) {
        const deviceToReturn = details.deviceList.find((device) => {
          return (
            !grantedDeviceThroughPermHandler ||
            device.deviceId !== grantedDeviceThroughPermHandler.deviceId
          );
        });

        if (deviceToReturn) {
          callback(deviceToReturn.deviceId);
        } else {
          callback();
        }
      } else {
        callback();
      }
    },
  );

  mainWindow.webContents.session.on("usb-device-added", (event, device) => {
    console.log("Detected new USB device:", device);
    usbDevices.push(device);
  });
  mainWindow.webContents.session.on("usb-device-removed", (event, device) => {
    console.log("USB device removed:", device);
    usbDevices = usbDevices.filter((d) => d.deviceId !== device.deviceId);
  });

  mainWindow.webContents.session.on(
    "select-serial-port",
    (event, portList, webContents, callback) => {
      console.log("select-serial-port triggered:", portList);
      serialPorts = portList;

      event.preventDefault();
      if (portList && portList.length > 0) {
        callback(portList[0].portId);
      } else {
        callback("");
      }
    },
  );

  mainWindow.webContents.session.on("serial-port-added", (event, port) => {
    console.log("IPC: Detected new Serial Port:", port);
    serialPorts.push(port);
  });
  mainWindow.webContents.session.on("serial-port-removed", (event, port) => {
    console.log("IPC: Serial Port removed:", port);
    serialPorts = serialPorts.filter((p) => p.portId !== port.portId);
  });

  // USB IPC handlers
  ipcMain.handle("usb-get-devices", () => {
    return usbDevices;
  });

  // Serial IPC handlers
  ipcMain.handle("serial-get-ports", () => {
    return serialPorts;
  });

  ipcMain.handle("serial-open", async (event, portPath, options) => {
    try {
      console.log(`IPC: serial-open - Port: ${portPath}, Options:`, options);

      if (serialConnections.has(portPath)) {
        console.log(`Port ${portPath} already open`);
        return { success: false, error: "Port already open" };
      }

      const port = serialPorts.find((p) => p.displayName === portPath);
      if (!port) {
        console.log(`Port ${portPath} not found in serialPorts`);
        return { success: false, error: "Port not found" };
      }

      serialConnections.set(portPath, {
        portId: port.portId,
        displayName: port.displayName,
        opened: true,
        options: options,
        timestamp: new Date().toISOString(),
      });

      console.log(`✓ Port ${portPath} registered as open`);
      mainWindow.webContents.send("serial-opened", { port: portPath });
      return {
        success: true,
        message: `Opened ${portPath}`,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("serial-open error:", errorMsg);
      return { success: false, error: errorMsg };
    }
  });

  ipcMain.handle("serial-close", async (event, portPath) => {
    try {
      console.log(`IPC: serial-close - Port: ${portPath}`);

      if (serialConnections.has(portPath)) {
        serialConnections.delete(portPath);
        console.log(`✓ Port ${portPath} closed`);
        mainWindow.webContents.send("serial-closed", { port: portPath });
        return { success: true, message: `Closed ${portPath}` };
      }
      return { success: false, error: "Port not open" };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("serial-close error:", errorMsg);
      return { success: false, error: errorMsg };
    }
  });

  ipcMain.handle("serial-send", async (event, portPath, data) => {
    try {
      if (!serialConnections.has(portPath)) {
        console.log(`Port ${portPath} not in connections`);
        return { success: false, error: "Port not open" };
      }

      console.log(`IPC: serial-send - Port: ${portPath}, Data:`, data);
      mainWindow.webContents.send("serial-data-sent", {
        port: portPath,
        data,
        timestamp: new Date().toISOString(),
      });

      return { success: true };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("serial-send error:", errorMsg);
      return { success: false, error: errorMsg };
    }
  });

  ipcMain.on("serial-data-received", (event, portPath, data) => {
    console.log(`Received from ${portPath}:`, data);
    mainWindow.webContents.send("serial-data-received", {
      port: portPath,
      data,
      timestamp: new Date().toISOString(),
    });
  });

  mainWindow.webContents.session.setPermissionCheckHandler(
    (webContents, permission, requestingOrigin, details) => {
      if (permission === "usb") {
        const validOrigins = [
          "file:///",
          MAIN_WINDOW_VITE_DEV_SERVER_URL,
        ].filter(Boolean);

        return validOrigins.some(
          (origin) =>
            requestingOrigin.startsWith(origin) ||
            details?.securityOrigin?.startsWith(origin),
        );
      } else if (permission === "serial") {
        const validOrigins = [
          "file:///",
          MAIN_WINDOW_VITE_DEV_SERVER_URL,
        ].filter(Boolean);

        return validOrigins.some(
          (origin) =>
            requestingOrigin.startsWith(origin) ||
            details?.securityOrigin?.startsWith(origin),
        );
      }
      return false;
    },
  );
  mainWindow.webContents.session.setDevicePermissionHandler((details) => {
    if (details.deviceType === "usb") {
      const validOrigins = [
        "file://",
        MAIN_WINDOW_VITE_DEV_SERVER_URL?.replace(/\/$/, ""),
      ].filter(Boolean);

      const isValidOrigin = validOrigins.some((origin) =>
        details.origin.startsWith(origin),
      );

      if (isValidOrigin) {
        if (!grantedDeviceThroughPermHandler) {
          grantedDeviceThroughPermHandler = details.device;
          return true;
        }
        return (
          grantedDeviceThroughPermHandler.deviceId === details.device.deviceId
        );
      }
    } else if (details.deviceType === "serial") {
      const validOrigins = [
        " file:///",
        MAIN_WINDOW_VITE_DEV_SERVER_URL?.replace(/\/$/, ""),
      ].filter(Boolean);

      const isValidOrigin = validOrigins.some((origin) =>
        details.origin.startsWith(origin),
      );

      if (isValidOrigin) {
        if (!grantedDeviceThroughPermHandler) {
          grantedDeviceThroughPermHandler = details.device;
          return true;
        }
        return (
          grantedDeviceThroughPermHandler.deviceId === details.device.deviceId
        );
      }
    }
    return false;
  });

  mainWindow.webContents.session.setUSBProtectedClassesHandler((details) => {
    return details.protectedClasses.filter((usbClass) => {
      return usbClass.indexOf("audio") === -1;
    });
  });

  mainWindow.webContents.openDevTools();
  return mainWindow;
};

app.on("ready", () => {
  createMainWindow();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
