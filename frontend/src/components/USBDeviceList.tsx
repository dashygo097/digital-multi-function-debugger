import React from "react";
import { Button } from "./Button";
import { SelectList } from "./SelectList";

interface USBDeviceListProps {
  className?: string;
}

interface USBDeviceListState {
  devices: Electron.USBDevice[];
}

export class USBDeviceList extends React.Component<
  USBDeviceListProps,
  USBDeviceListState
> {
  constructor(props: USBDeviceListProps) {
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
        <Button
          onClick={() => this.updateDevices()}
          className={`${this.props.className}-button`}
        >
          Refresh
        </Button>
        <SelectList
          options={this.state.devices.map(getDeviceDetails)}
          className={`${this.props.className}-selectList`}
        />
      </div>
    );
  }
}

function getDeviceDetails(device: Electron.USBDevice) {
  return device.productName || `Unknown device ${device.deviceId}`;
}
