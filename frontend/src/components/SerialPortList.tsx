import React from "react";
import "../styles/serial.css";

interface SerialPortInfo {
  path: string;
  manufacturer?: string;
  serialNumber?: string;
  pnpId?: string;
  locationId?: string;
  productId?: string;
  vendorId?: string;
}

interface SerialPortsListProps {}

interface SerialPortsListState {
  ports: SerialPortInfo[];
  error: string;
  isLoading: boolean;
  useWebSerial: boolean;
}

class SerialPortsList extends React.Component<
  SerialPortsListProps,
  SerialPortsListState
> {
  private intervalId: NodeJS.Timeout | null = null;

  constructor(props: SerialPortsListProps) {
    super(props);
    this.state = {
      ports: [],
      error: "",
      isLoading: true,
      useWebSerial: false,
    };
  }

  componentDidMount() {
    this.listSerialPorts();
    this.intervalId = setInterval(() => {
      this.listSerialPorts();
    }, 5000);
  }

  componentWillUnmount() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  getWebSerialPorts = async (): Promise<SerialPortInfo[]> => {
    if ("serial" in navigator) {
      try {
        const ports = await (navigator as any).serial.getPorts();
        return ports.map((port: any, index: number) => ({
          path: `Web Serial Port ${index + 1}`,
          manufacturer: "Unknown",
          serialNumber: "N/A",
          pnpId: "Web Serial API",
          locationId: "N/A",
          productId: "N/A",
          vendorId: "N/A",
        }));
      } catch (error) {
        console.error("Web Serial API error:", error);
        return [];
      }
    }
    return [];
  };

  listSerialPorts = async () => {
    try {
      this.setState({ isLoading: true });

      let portList: SerialPortInfo[] = [];

      if (this.state.useWebSerial) {
        portList = await this.getWebSerialPorts();
        if (portList.length === 0) {
          this.setState({
            error:
              'No Web Serial ports found. Click "Request Port Access" to connect a device.',
          });
        } else {
          this.setState({ error: "" });
        }
      } else {
        await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate async operation
        portList = [];

        if (portList.length === 0) {
          this.setState({ error: "No ports discovered" });
        } else {
          this.setState({ error: "" });
        }
      }

      this.setState({ ports: portList });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Unknown error occurred";
      this.setState({ error: errorMessage, ports: [] });
    } finally {
      this.setState({ isLoading: false });
    }
  };

  requestWebSerialAccess = async () => {
    if ("serial" in navigator) {
      try {
        await (navigator as any).serial.requestPort();
        this.setState({ useWebSerial: true }, () => {
          this.listSerialPorts();
        });
      } catch (error) {
        this.setState({
          error:
            "Failed to access Web Serial API. User may have cancelled the request.",
        });
      }
    } else {
      this.setState({
        error: "Web Serial API is not supported in this browser.",
      });
    }
  };

  toggleWebSerial = () => {
    this.setState({ useWebSerial: !this.state.useWebSerial });
  };

  renderPortsTable = () => {
    const { ports } = this.state;
    if (ports.length === 0) return null;

    const headers = [
      "Path",
      "Manufacturer",
      "Serial Number",
      "PnP ID",
      "Location ID",
      "Product ID",
      "Vendor ID",
    ];

    return (
      <div className="table-container">
        <table className="ports-table">
          <thead>
            <tr className="table-header">
              {headers.map((header) => (
                <th key={header} className="table-header-cell">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ports.map((port, index) => (
              <tr key={`${port.path}-${index}`} className="table-row">
                <td className="table-cell">{port.path}</td>
                <td className="table-cell">{port.manufacturer || "-"}</td>
                <td className="table-cell">{port.serialNumber || "-"}</td>
                <td className="table-cell">{port.pnpId || "-"}</td>
                <td className="table-cell">{port.locationId || "-"}</td>
                <td className="table-cell">{port.productId || "-"}</td>
                <td className="table-cell">{port.vendorId || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  render() {
    const { ports, error, isLoading, useWebSerial } = this.state;

    return (
      <div className="serial-ports-container">
        <h1 className="title">Serial Ports</h1>

        {error && (
          <div className="error-container">
            <strong>Error:</strong> {error}
          </div>
        )}

        <div className="button-container">
          <button
            onClick={this.listSerialPorts}
            className={`button button-primary ${isLoading ? "button-disabled" : ""}`}
            disabled={isLoading}
          >
            {isLoading ? "Refreshing..." : "Refresh Now"}
          </button>

          <button
            onClick={this.toggleWebSerial}
            className="button button-secondary"
          >
            {useWebSerial ? "Use Mock Data" : "Use Web Serial API"}
          </button>

          {!useWebSerial && (
            <button
              onClick={this.requestWebSerialAccess}
              className="button button-success"
            >
              Request Port Access
            </button>
          )}
        </div>

        {!isLoading && !error && (
          <div className="ports-count">
            Found {ports.length} serial port{ports.length !== 1 ? "s" : ""}
            <span className="auto-refresh-text">
              (Auto-refreshes every 2 seconds)
            </span>
          </div>
        )}

        {isLoading && (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <span className="loading-text">Loading serial ports...</span>
          </div>
        )}

        <div id="ports">{this.renderPortsTable()}</div>
      </div>
    );
  }
}

export default SerialPortsList;
