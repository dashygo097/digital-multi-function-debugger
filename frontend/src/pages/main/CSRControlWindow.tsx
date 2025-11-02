import React from "react";
import "@styles/csr-control.css";

interface CSRMessage {
  timestamp: string;
  type: "TX" | "RX" | "INFO" | "ERROR";
  data: string;
  id: string;
}

interface CSRControlWindowProps {
  onSendCommand?: (command: Uint8Array) => void;
}

interface CSRControlWindowState {
  csrAddress: string;
  csrData: string;
  csrOperation: "READ" | "WRITE";
  messages: CSRMessage[];
  autoScroll: boolean;

  // Preset registers
  presets: Array<{
    name: string;
    address: string;
    description: string;
  }>;
}

export class CSRControlWindow extends React.Component<
  CSRControlWindowProps,
  CSRControlWindowState
> {
  private terminalEndRef: React.RefObject<HTMLDivElement>;

  constructor(props: CSRControlWindowProps) {
    super(props);
    this.terminalEndRef = React.createRef();

    this.state = {
      csrAddress: "0x10000",
      csrData: "0xDEADBEEF",
      csrOperation: "WRITE",
      messages: [],
      autoScroll: true,

      presets: [
        {
          name: "SLV_REG0",
          address: "0x10000",
          description: "Slave Register 0",
        },
        {
          name: "SLV_REG1",
          address: "0x11000",
          description: "Slave Register 1",
        },
        {
          name: "SLV_REG2",
          address: "0x12000",
          description: "Slave Register 2",
        },
        {
          name: "SLV_REG3",
          address: "0x13000",
          description: "Slave Register 3",
        },
        {
          name: "ACM_CONTROL",
          address: "0x18000",
          description: "ACM2108 Control",
        },
        {
          name: "ACM_STATUS",
          address: "0x18004",
          description: "ACM2108 Status",
        },
        {
          name: "UART_CONFIG",
          address: "0x24000",
          description: "UART Configuration",
        },
        {
          name: "SPI_CONFIG",
          address: "0x28000",
          description: "SPI Configuration",
        },
      ],
    };

    // Listen for responses from main process
    if (window.electron) {
      window.electron.ipcRenderer.on("csr-response", this.handleCSRResponse);
    }
  }

  componentDidUpdate(
    prevProps: CSRControlWindowProps,
    prevState: CSRControlWindowState,
  ) {
    if (
      this.state.autoScroll &&
      prevState.messages.length !== this.state.messages.length
    ) {
      this.terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }

  componentWillUnmount() {
    if (window.electron) {
      window.electron.ipcRenderer.removeListener(
        "csr-response",
        this.handleCSRResponse,
      );
    }
  }

  private handleCSRResponse = (event: any, data: any) => {
    this.addMessage("RX", data.message);
  };

  private buildCSRCommand = (): Uint8Array | null => {
    try {
      // Parse address
      const addrStr = this.state.csrAddress.replace(/^0x/i, "");
      const address = parseInt(addrStr, 16);

      if (isNaN(address) || address < 0 || address > 0xffffffff) {
        this.addMessage("ERROR", "Invalid address format. Use hex: 0x10000");
        return null;
      }

      // Parse data for write operation
      let data = 0;
      if (this.state.csrOperation === "WRITE") {
        const dataStr = this.state.csrData.replace(/^0x/i, "");
        data = parseInt(dataStr, 16);

        if (isNaN(data) || data < 0 || data > 0xffffffff) {
          this.addMessage("ERROR", "Invalid data format. Use hex: 0xDEADBEEF");
          return null;
        }
      }

      // Build 9-byte command
      const cmd = new Uint8Array(9);

      // Byte 0: Command type (0x00 = WRITE, 0x01 = READ)
      cmd[0] = this.state.csrOperation === "WRITE" ? 0x00 : 0x01;

      // Bytes 1-4: Address (big-endian)
      cmd[1] = (address >> 24) & 0xff;
      cmd[2] = (address >> 16) & 0xff;
      cmd[3] = (address >> 8) & 0xff;
      cmd[4] = address & 0xff;

      // Bytes 5-8: Data (big-endian, or 0x00 for READ)
      if (this.state.csrOperation === "WRITE") {
        cmd[5] = (data >> 24) & 0xff;
        cmd[6] = (data >> 16) & 0xff;
        cmd[7] = (data >> 8) & 0xff;
        cmd[8] = data & 0xff;
      } else {
        cmd[5] = cmd[6] = cmd[7] = cmd[8] = 0x00;
      }

      return cmd;
    } catch (error: any) {
      this.addMessage("ERROR", `Command build failed: ${error.message}`);
      return null;
    }
  };

  private sendCSRCommand = async () => {
    const cmd = this.buildCSRCommand();
    if (!cmd) return;

    const address = parseInt(this.state.csrAddress.replace(/^0x/i, ""), 16);
    const data =
      this.state.csrOperation === "WRITE"
        ? parseInt(this.state.csrData.replace(/^0x/i, ""), 16)
        : 0;

    // Send to main process via IPC
    if (window.electron) {
      window.electron.ipcRenderer.send("send-csr-command", {
        command: Array.from(cmd),
        operation: this.state.csrOperation,
        address: address,
        data: data,
      });
    }

    // Log the command
    const hexDisplay = Array.from(cmd)
      .map((b) => b.toString(16).padStart(2, "0").toUpperCase())
      .join(" ");

    const operation =
      this.state.csrOperation === "WRITE"
        ? `WRITE 0x${data.toString(16).padStart(8, "0").toUpperCase()} to 0x${address.toString(16).padStart(8, "0").toUpperCase()}`
        : `READ from 0x${address.toString(16).padStart(8, "0").toUpperCase()}`;

    this.addMessage("TX", `[CSR ${operation}]`);
    this.addMessage("INFO", `Raw: ${hexDisplay}`);
  };

  private loadPreset = (preset: {
    name: string;
    address: string;
    description: string;
  }) => {
    this.setState({
      csrAddress: preset.address,
    });
    this.addMessage(
      "INFO",
      `Loaded preset: ${preset.name} (${preset.description})`,
    );
  };

  private addMessage = (type: "TX" | "RX" | "INFO" | "ERROR", data: string) => {
    this.setState((prev) => ({
      messages: [
        ...prev.messages,
        {
          timestamp: new Date().toLocaleTimeString("en-US", {
            hour12: false,
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            fractionalSecondDigits: 3,
          }),
          type,
          data,
          id: `${Date.now()}-${Math.random()}`,
        },
      ],
    }));
  };

  private clearMessages = () => {
    this.setState({ messages: [] });
  };

  render() {
    const { csrAddress, csrData, csrOperation, messages, autoScroll, presets } =
      this.state;

    return (
      <div className="csr-control-window">
        <div className="csr-header">
          <h2>CSR Control Panel</h2>
          <p className="description">
            Command Format: 9 bytes - CMD_TYPE(1) + ADDR(4) + DATA(4)
          </p>
        </div>

        <div className="csr-controls">
          {/* Operation Type */}
          <div className="control-group">
            <label>Operation:</label>
            <div className="radio-group">
              <label className="radio-label">
                <input
                  type="radio"
                  value="WRITE"
                  checked={csrOperation === "WRITE"}
                  onChange={(e) => this.setState({ csrOperation: "WRITE" })}
                />
                Write (0x00)
              </label>
              <label className="radio-label">
                <input
                  type="radio"
                  value="READ"
                  checked={csrOperation === "READ"}
                  onChange={(e) => this.setState({ csrOperation: "READ" })}
                />
                Read (0x01)
              </label>
            </div>
          </div>

          {/* Address Input */}
          <div className="control-group">
            <label>Address (4 bytes):</label>
            <input
              type="text"
              value={csrAddress}
              onChange={(e) => this.setState({ csrAddress: e.target.value })}
              placeholder="0x10000"
              className="hex-input"
            />
          </div>

          {/* Data Input (only for WRITE) */}
          {csrOperation === "WRITE" && (
            <div className="control-group">
              <label>Data (4 bytes):</label>
              <input
                type="text"
                value={csrData}
                onChange={(e) => this.setState({ csrData: e.target.value })}
                placeholder="0xDEADBEEF"
                className="hex-input"
              />
            </div>
          )}

          {/* Send Button */}
          <div className="control-group">
            <button onClick={this.sendCSRCommand} className="btn-send">
              Send CSR Command
            </button>
          </div>
        </div>

        {/* Preset Registers */}
        <div className="preset-registers">
          <h3>Quick Access Registers</h3>
          <div className="preset-grid">
            {presets.map((preset, index) => (
              <button
                key={index}
                className="preset-button"
                onClick={() => this.loadPreset(preset)}
                title={preset.description}
              >
                <div className="preset-name">{preset.name}</div>
                <div className="preset-addr">{preset.address}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Message Log */}
        <div className="message-log">
          <div className="log-header">
            <h3>Message Log</h3>
            <div className="log-controls">
              <label>
                <input
                  type="checkbox"
                  checked={autoScroll}
                  onChange={(e) =>
                    this.setState({ autoScroll: e.target.checked })
                  }
                />
                Auto-scroll
              </label>
              <button onClick={this.clearMessages} className="btn-clear">
                Clear
              </button>
            </div>
          </div>
          <div className="log-content">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`log-message ${msg.type.toLowerCase()}`}
              >
                <span className="log-timestamp">[{msg.timestamp}]</span>
                <span className="log-type">{msg.type}:</span>
                <span className="log-data">{msg.data}</span>
              </div>
            ))}
            <div ref={this.terminalEndRef} />
          </div>
        </div>
      </div>
    );
  }
}
