import "./app";
import { ipcRenderer } from "electron";

async function test_serialport() {
  const filters: any = [];

  try {
    const port = await navigator.serial.requestPort({ filters });
    const portInfo = port.getInfo();
    document.getElementById("device-name").innerHTML =
      `vender ID: ${portInfo.usbVendorId}, product ID: ${portInfo.usbProductId}`;
    console.log("123");
  } catch (e) {
    if (e.name === "NotFoundError") {
      document.getElementById("device-name").innerHTML = "DEVICE NOT FOUND";
    } else {
      document.getElementById("device-name").innerHTML = `ERROR: ${e.message}`;
    }
  }
}

document.getElementById("clickme").addEventListener("click", test_serialport);
