import React from "react";
import SelectList from "./SelectList";

interface USBDevicesProps {}

interface USBDevicesState {
  devices: Electron.USBDevice[];
}

class USBDevices extends React.Component<USBDevicesProps, USBDevicesState> {
  constructor(props: USBDevicesProps) {
    super(props);
    this.state = {
      devices: [],
    };
  }

  async updateDevices() {
    try {
      const devices = await window.usbAPI.getDevices();
      this.setState(() => ({ devices }));
      console.log("Fetched USB devices:", devices);
    } catch (error) {
      console.log("Error fetching USB devices:", error);
    }
  }

  render() {
    return (
      <div>
        <button onClick={() => this.updateDevices()}>Refresh</button>
        <SelectList options={this.state.devices.map(getDeviceDetails)} />
      </div>
    );
  }
}

function getDeviceDetails(device: Electron.USBDevice) {
  return device.productName || `Unknown device ${device.deviceId}`;
}

export default USBDevices;
