import { app, BrowserWindow, ipcMain, Notification } from "electron";
import path from "node:path";

const createMainWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 1000,
    height: 750,
    frame: true,
    transparent: false,
    backgroundMaterial: "mica",
    webPreferences: {
      sandbox: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow.webContents.session.on(
    "select-serial-port",
    (event, portList, webContents, callback) => {
      mainWindow.webContents.session.on("serial-port-added", (event, port) => {
        console.log("Serial port added:", port);
      });
      mainWindow.webContents.session.on(
        "serial-port-removed",
        (event, port) => {
          console.log("Serial port removed:", port);
        },
      );

      event.preventDefault();
      if (portList && portList.length > 0) {
        callback(portList[0].portId);
      } else {
        callback("");
      }
    },
  );

  mainWindow.webContents.session.setPermissionCheckHandler(
    (webContents, permission, requestingOrigin, details) => {
      if (permission === "serial" && details.securityOrigin === "file:///") {
        return true;
      }
      return false;
    },
  );

  mainWindow.webContents.session.setDevicePermissionHandler((details) => {
    if (details.deviceType === "serial" && details.origin === "file://") {
      return true;
    }
    return false;
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  mainWindow.webContents.openDevTools();
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
