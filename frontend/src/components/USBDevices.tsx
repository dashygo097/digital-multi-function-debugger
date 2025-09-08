import React from "react";
import Button from "./Button";
import SelectList from "./SelectList";

interface USBDevicesProps {
  className?: string;
}

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

  async componentDidMount() {
    this.getDevices();
    this.startAutoUpdate();
  }

  async updateDevices() {
    try {
      await navigator.usb.requestDevice({ filters: [] });
      await this.getDevices();
    } catch (error) {
      console.log("Permission request cancelled or failed:", error);
    }
  }

  async getDevices() {
    try {
      const devices = await window.usbAPI.getDevices();
      this.setState(() => ({ devices }));
    } catch (error) {
      console.log("Error fetching USB devices:", error);
    }
  }

  startAutoUpdate() {
    this.updateInterval = setInterval(() => {
      this.getDevices();
    }, 2000);
  }

  render() {
    return (
      <div id={this.props.className}>
        <Button onClick={() => this.updateDevices()}>Refresh</Button>
        <SelectList options={this.state.devices.map(getDeviceDetails)} />
      </div>
    );
  }
}

function getDeviceDetails(device: Electron.USBDevice) {
  return device.productName || `Unknown device ${device.deviceId}`;
}

export default USBDevices;
