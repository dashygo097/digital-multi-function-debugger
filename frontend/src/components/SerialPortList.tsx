import React from "react";
import { Button } from "./Button";

interface SerialPortListProps {
  className?: string;
  onPortSelect: (portName: string) => void;
  selectedPort: string;
  disabled?: boolean;
}

interface SerialPortListState {
  ports: Electron.SerialPort[];
}

export class SerialPortList extends React.Component<
  SerialPortListProps,
  SerialPortListState
> {
  private updateInterval: NodeJS.Timeout | null = null;

  constructor(props: SerialPortListProps) {
    super(props);
    this.state = {
      ports: [],
    };
  }

  async componentDidMount() {
    await this.getPorts();
    this.startAutoUpdate();
  }

  componentWillUnmount() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
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
      this.setState({ ports });
    } catch (error) {
      console.log("Error fetching Serial ports:", error);
    }
  }

  startAutoUpdate() {
    this.updateInterval = setInterval(() => {
      this.getPorts();
    }, 2000);
  }

  handlePortChange = (portName: string) => {
    if (!this.props.disabled) {
      this.props.onPortSelect(portName);
    }
  };

  render() {
    const { className, selectedPort, disabled } = this.props;

    return (
      <div
        className={className}
        style={{ display: "flex", gap: "8px", alignItems: "center" }}
      >
        <select
          value={selectedPort}
          onChange={(e) => this.handlePortChange(e.target.value)}
          disabled={disabled}
          style={{ flex: 1 }}
        >
          <option value="">Select...</option>
          {this.state.ports.map((p) => (
            <option key={p.portId} value={p.displayName}>
              {p.displayName}
            </option>
          ))}
        </select>
        <Button
          onClick={() => this.updatePorts()}
          className={`${className}-button`}
          disabled={disabled}
        >
          🔄
        </Button>
      </div>
    );
  }
}
