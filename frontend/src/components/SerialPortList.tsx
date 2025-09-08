import React from "react";
import Button from "./Button";
import SelectList from "./SelectList";

interface SerialPortListProps {
  className?: string;
}

interface SerialPortListState {
  ports: Electron.SerialPort[];
}

class SerialPortList extends React.Component<
  SerialPortListProps,
  SerialPortListState
> {
  constructor(props: SerialPortListProps) {
    super(props);
    this.state = {
      ports: [],
    };
  }

  async componentDidMount() {
    this.getPorts();
    this.startAutoUpdate();
  }

  async updatePorts() {
    try {
      await navigator.serial.requestPort({ filters: [] });
      await this.getPorts();
    } catch (error) {
      console.log("Permission request cancelled or failed:", error);
    }
  }

  async getPorts() {
    try {
      const ports = await window.serialAPI.getPorts();
      this.setState(() => ({ ports }));
    } catch (error) {
      console.log("Error fetching Serial ports:", error);
    }
  }

  startAutoUpdate() {
    this.updateInterval = setInterval(() => {
      this.getPorts();
    }, 2000);
  }

  render() {
    return (
      <div id={this.props.className}>
        <Button
          onClick={() => this.updatePorts()}
          className={`${this.props.className}-button`}
        >
          Refresh
        </Button>
        <SelectList
          options={this.state.ports.map(getPortDetails)}
          className={`${this.props.className}-selectlist`}
        />
      </div>
    );
  }
}

function getPortDetails(device: Electron.SerialPort) {
  return device.displayName;
}

export default SerialPortList;
