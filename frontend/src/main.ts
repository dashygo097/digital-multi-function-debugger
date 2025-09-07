import { app, BrowserWindow, ipcMain, Notification } from "electron";
import path from "node:path";

const createMainWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 1000,
    height: 750,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  let usbDeviceLists: Electron.USBDevice[] = [];
  let grantedDeviceThroughPermHandler: Electron.USBDevice;

  mainWindow.webContents.session.on(
    "select-usb-device",
    (event, details, callback) => {
      console.log("select-usb-device triggered:", details);
      usbDeviceLists = details.deviceList;

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
    usbDeviceLists.push(device);
  });

  mainWindow.webContents.session.on("usb-device-removed", (event, device) => {
    console.log("USB device removed:", device);
    usbDeviceLists = usbDeviceLists.filter(
      (d) => d.deviceId !== device.deviceId,
    );
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
    }
    return false;
  });

  mainWindow.webContents.session.setUSBProtectedClassesHandler((details) => {
    return details.protectedClasses.filter((usbClass) => {
      return usbClass.indexOf("audio") === -1;
    });
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

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
