import React from "react";
import { WithRouter, WithRouterProps } from "@utils";
import {
  GlobalSerialConnection,
  ConnectionState,
} from "../../components/SerialTerminal";
import "@styles/csr.css";

interface CSRMessage {
  timestamp: string;
  type: "TX" | "RX" | "INFO" | "ERROR";
  data: string;
  id: string;
}

interface CSRPageState {
  csrAddress: string;
  csrData: string;
  csrOperation: "READ" | "WRITE";
  messages: CSRMessage[];
  autoScroll: boolean;
  selectedSection: string;
  connectionState: ConnectionState;

  sections: Array<{
    id: string;
    name: string;
    startAddr: string;
    endAddr: string;
  }>;

  presets: Array<{
    name: string;
    address: string;
    description: string;
    section: string;
  }>;
}

class CSRPage extends React.Component<WithRouterProps, CSRPageState> {
  private terminalEndRef: React.RefObject<HTMLDivElement>;
  private connection: GlobalSerialConnection;

  constructor(props: WithRouterProps) {
    super(props);
    this.terminalEndRef = React.createRef();
    this.connection = GlobalSerialConnection.getInstance();

    this.state = {
      csrAddress: "0x10000",
      csrData: "0xDEADBEEF",
      csrOperation: "WRITE",
      messages: [],
      autoScroll: false,
      selectedSection: "all",
      connectionState: this.connection.state,

      sections: [
        {
          id: "slv_regs",
          name: "SLV Registers",
          startAddr: "0x10000",
          endAddr: "0x14000",
        },
        {
          id: "slv_ram",
          name: "SLV RAM",
          startAddr: "0x14000",
          endAddr: "0x18000",
        },
        {
          id: "acm2108",
          name: "ACM2108",
          startAddr: "0x18000",
          endAddr: "0x1C000",
        },
        {
          id: "signal_measure",
          name: "Signal Measure",
          startAddr: "0x1C000",
          endAddr: "0x20000",
        },
        {
          id: "bitseq",
          name: "Bit Sequence",
          startAddr: "0x20000",
          endAddr: "0x24000",
        },
        {
          id: "uart_engine",
          name: "UART Engine",
          startAddr: "0x24000",
          endAddr: "0x28000",
        },
        {
          id: "spi_engine",
          name: "SPI Engine",
          startAddr: "0x28000",
          endAddr: "0x2C000",
        },
        {
          id: "pwm_engine",
          name: "PWM Engine",
          startAddr: "0x2C000",
          endAddr: "0x30000",
        },
        {
          id: "i2c_engine",
          name: "I2C Engine",
          startAddr: "0x30000",
          endAddr: "0x34000",
        },
      ],

      presets: [
        // SLV_REGS Section (0x10000 - 0x14000)
        {
          name: "SLV_REG0",
          address: "0x10000",
          description: "[31:0]: slv_reg0",
          section: "slv_regs",
        },
        {
          name: "SLV_REG1",
          address: "0x11000",
          description: "[31:0]: slv_reg1",
          section: "slv_regs",
        },
        {
          name: "SLV_REG2",
          address: "0x12000",
          description: "[31:0]: slv_reg2",
          section: "slv_regs",
        },
        {
          name: "SLV_REG3",
          address: "0x13000",
          description: "[31:0]: slv_reg3",
          section: "slv_regs",
        },

        // SLV_RAM Section (0x14000 - 0x18000)
        {
          name: "RAM_REGION",
          address: "0x14000",
          description: "[31:0]: ram_data (0x00-0x20)",
          section: "slv_ram",
        },

        // ACM2108 Section
        {
          name: "CONTROL",
          address: "0x18000",
          description: "[0]: restart_req - System restart request",
          section: "acm2108",
        },
        {
          name: "STATUS",
          address: "0x18004",
          description: "[1]: ddr_init, [0]: pll_locked - System status",
          section: "acm2108",
        },
        {
          name: "CHANNEL_SEL",
          address: "0x18008",
          description: "[7:0]: channel_sel - ADC channel selection",
          section: "acm2108",
        },
        {
          name: "DATA_NUM",
          address: "0x1800C",
          description: "[31:0]: data_num - Number of data samples",
          section: "acm2108",
        },
        {
          name: "ADC_SPEED",
          address: "0x18010",
          description: "[31:0]: adc_speed - ADC sampling speed",
          section: "acm2108",
        },
        {
          name: "RESTART",
          address: "0x18014",
          description: "[0]: restart_req - ADC restart (auto-clear)",
          section: "acm2108",
        },
        {
          name: "DDS_CONTROL",
          address: "0x18018",
          description: "[0]: dds_restart - DDS restart (auto-clear)",
          section: "acm2108",
        },
        {
          name: "DDS_WAVE_SEL",
          address: "0x1801C",
          description: "[2:0]: wave_sel - DDS waveform selection",
          section: "acm2108",
        },
        {
          name: "DDS_FTW",
          address: "0x18020",
          description: "[31:0]: ftw - DDS Frequency Tuning Word",
          section: "acm2108",
        },
        {
          name: "DDR_STATUS",
          address: "0x18024",
          description: "[0]: ddr_init - DDR3 init status",
          section: "acm2108",
        },

        // Signal Measure Section
        {
          name: "SIG_CONTROL",
          address: "0x1C000",
          description: "[0]: enable - Enable signal measurement",
          section: "signal_measure",
        },
        {
          name: "SIG_STATUS",
          address: "0x1C004",
          description: "[0]: busy, [1]: finish - Measurement status",
          section: "signal_measure",
        },
        {
          name: "SIG_PERIOD",
          address: "0x1C008",
          description: "[25:0]: period_out - Measured period",
          section: "signal_measure",
        },
        {
          name: "SIG_HIGH_TIME",
          address: "0x1C00C",
          description: "[19:0]: high_time - Measured high time",
          section: "signal_measure",
        },

        // BitSeq Section (abbreviated for brevity - include all your presets)
        {
          name: "BS_CONTROL",
          address: "0x20000",
          description: "[0]: sync_enable, [1]: arm_load, [2]: group_start",
          section: "bitseq",
        },

        // UART Engine Section
        {
          name: "UART_CONFIG",
          address: "0x24000",
          description: "[31:0]: clk_div",
          section: "uart_engine",
        },

        // Add all your other presets here...
      ],
    };
  }

  componentDidMount() {
    // Subscribe to connection state changes
    this.connection.subscribeState(this.handleConnectionStateChange);

    // Subscribe to received messages
    this.connection.subscribeMessages(this.handleReceivedMessage);
  }

  componentWillUnmount() {
    // Unsubscribe from connection events
    this.connection.unsubscribeState(this.handleConnectionStateChange);
    this.connection.unsubscribeMessages(this.handleReceivedMessage);
  }

  componentDidUpdate(prevProps: WithRouterProps, prevState: CSRPageState) {
    if (
      this.state.autoScroll &&
      prevState.messages.length !== this.state.messages.length
    ) {
      this.terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }

  // Handle connection state changes
  private handleConnectionStateChange = (state: ConnectionState) => {
    this.setState({ connectionState: state });
  };

  // Handle received messages from serial port
  private handleReceivedMessage = (msg: {
    direction: string;
    data: string;
  }) => {
    if (msg.direction === "RX") {
      this.addMessage("RX", msg.data);
    }
  };

  private buildCSRCommand = (): Uint8Array | null => {
    try {
      const addrStr = this.state.csrAddress.replace(/^0x/i, "");
      const address = parseInt(addrStr, 16);

      if (isNaN(address) || address < 0 || address > 0xffffffff) {
        this.addMessage("ERROR", "Invalid address format. Use hex: 0x10000");
        return null;
      }

      let data = 0;
      if (this.state.csrOperation === "WRITE") {
        const dataStr = this.state.csrData.replace(/^0x/i, "");
        data = parseInt(dataStr, 16);

        if (isNaN(data) || data < 0 || data > 0xffffffff) {
          this.addMessage("ERROR", "Invalid data format. Use hex: 0xDEADBEEF");
          return null;
        }
      }

      // Build 9-byte CSR command
      const cmd = new Uint8Array(9);
      cmd[0] = this.state.csrOperation === "WRITE" ? 0x00 : 0x01; // Command type
      cmd[1] = (address >> 24) & 0xff; // Address byte 3 (MSB)
      cmd[2] = (address >> 16) & 0xff; // Address byte 2
      cmd[3] = (address >> 8) & 0xff; // Address byte 1
      cmd[4] = address & 0xff; // Address byte 0 (LSB)

      if (this.state.csrOperation === "WRITE") {
        cmd[5] = (data >> 24) & 0xff; // Data byte 3 (MSB)
        cmd[6] = (data >> 16) & 0xff; // Data byte 2
        cmd[7] = (data >> 8) & 0xff; // Data byte 1
        cmd[8] = data & 0xff; // Data byte 0 (LSB)
      } else {
        cmd[5] = cmd[6] = cmd[7] = cmd[8] = 0x00; // Zero data for READ
      }

      return cmd;
    } catch (error: any) {
      this.addMessage("ERROR", `Command build failed: ${error.message}`);
      return null;
    }
  };

  private sendCSRCommand = async () => {
    // Check connection state
    if (this.state.connectionState !== ConnectionState.CONNECTED) {
      this.addMessage(
        "ERROR",
        "❌ Serial port not connected! Please connect via Serial Terminal page.",
      );
      return;
    }

    const cmd = this.buildCSRCommand();
    if (!cmd) return;

    const address = parseInt(this.state.csrAddress.replace(/^0x/i, ""), 16);
    const data =
      this.state.csrOperation === "WRITE"
        ? parseInt(this.state.csrData.replace(/^0x/i, ""), 16)
        : 0;

    const hexDisplay = Array.from(cmd)
      .map((b) => b.toString(16).padStart(2, "0").toUpperCase())
      .join(" ");

    const operation =
      this.state.csrOperation === "WRITE"
        ? `WRITE 0x${data.toString(16).padStart(8, "0").toUpperCase()} to 0x${address.toString(16).padStart(8, "0").toUpperCase()}`
        : `READ from 0x${address.toString(16).padStart(8, "0").toUpperCase()}`;

    this.addMessage("TX", `[CSR ${operation}]`);
    this.addMessage("INFO", `Raw bytes: ${hexDisplay}`);

    try {
      // Send via GlobalSerialConnection
      await this.connection.send(cmd);
      this.addMessage("INFO", "✓ Command sent successfully");
      console.log("CSR Command sent:", hexDisplay);
    } catch (error: any) {
      this.addMessage("ERROR", `❌ Send failed: ${error.message}`);
      console.error("CSR Command send error:", error);
    }
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
      `Loaded: ${preset.name} (${preset.address}) - ${preset.description}`,
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

  private exportLog = () => {
    const log = this.state.messages
      .map((m) => `[${m.timestamp}] ${m.type}: ${m.data}`)
      .join("\n");

    const element = document.createElement("a");
    element.setAttribute(
      "href",
      "data:text/plain;charset=utf-8," + encodeURIComponent(log),
    );
    element.setAttribute("download", `csr-log-${Date.now()}.txt`);
    element.style.display = "none";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  private getFilteredPresets = () => {
    if (this.state.selectedSection === "all") {
      return this.state.presets;
    }
    return this.state.presets.filter(
      (preset) => preset.section === this.state.selectedSection,
    );
  };

  private getConnectionStatusText = (): string => {
    switch (this.state.connectionState) {
      case ConnectionState.CONNECTED:
        return "✓ Connected";
      case ConnectionState.CONNECTING:
        return "⏳ Connecting...";
      case ConnectionState.DISCONNECTING:
        return "⏳ Disconnecting...";
      case ConnectionState.DISCONNECTED:
        return "○ Disconnected";
      case ConnectionState.ERROR:
        return "❌ Error";
      default:
        return "○ Unknown";
    }
  };

  private getConnectionStatusClass = (): string => {
    switch (this.state.connectionState) {
      case ConnectionState.CONNECTED:
        return "status-connected";
      case ConnectionState.CONNECTING:
      case ConnectionState.DISCONNECTING:
        return "status-connecting";
      case ConnectionState.DISCONNECTED:
        return "status-disconnected";
      case ConnectionState.ERROR:
        return "status-error";
      default:
        return "status-unknown";
    }
  };

  render() {
    const {
      csrAddress,
      csrData,
      csrOperation,
      messages,
      autoScroll,
      selectedSection,
      sections,
      connectionState,
    } = this.state;

    const filteredPresets = this.getFilteredPresets();
    const isConnected = connectionState === ConnectionState.CONNECTED;

    return (
      <div className="csr-page">
        <div className="csr-header">
          <h1>CSR Control Panel</h1>
          <p className="description">
            Command Format: 9 bytes - CMD_TYPE(1) + ADDR(4) + DATA(4)
          </p>
        </div>

        <div className="csr-content">
          {/* Left Panel - Controls */}
          <div className="csr-left-panel">
            <div className="csr-controls">
              <h2>Command Builder</h2>

              {/* Connection Status Banner */}
              <div
                className={`connection-status-banner ${this.getConnectionStatusClass()}`}
              >
                <span className="status-icon">{isConnected ? "🔌" : "🔴"}</span>
                <span className="status-text">
                  {this.getConnectionStatusText()}
                </span>
                {!isConnected && (
                  <span className="status-hint">
                    → Go to Serial Terminal page to connect
                  </span>
                )}
              </div>

              {/* Operation Type */}
              <div className="control-group">
                <label>Operation:</label>
                <div className="radio-group">
                  <label className="radio-label">
                    <input
                      type="radio"
                      value="WRITE"
                      checked={csrOperation === "WRITE"}
                      onChange={() => this.setState({ csrOperation: "WRITE" })}
                    />
                    Write (0x00)
                  </label>
                  <label className="radio-label">
                    <input
                      type="radio"
                      value="READ"
                      checked={csrOperation === "READ"}
                      onChange={() => this.setState({ csrOperation: "READ" })}
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
                  onChange={(e) =>
                    this.setState({ csrAddress: e.target.value })
                  }
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
                <button
                  onClick={this.sendCSRCommand}
                  className="btn-send"
                  disabled={!isConnected}
                  title={
                    !isConnected
                      ? "Connect serial port first"
                      : "Send CSR command via serial port"
                  }
                >
                  📤 Send CSR Command
                </button>
              </div>
            </div>

            {/* Preset Registers */}
            <div className="preset-registers">
              <div className="preset-header">
                <h2>Quick Access Registers</h2>
                <select
                  className="section-selector"
                  value={selectedSection}
                  onChange={(e) =>
                    this.setState({ selectedSection: e.target.value })
                  }
                >
                  <option value="all">
                    All Sections ({this.state.presets.length})
                  </option>
                  {sections.map((section) => {
                    const count = this.state.presets.filter(
                      (p) => p.section === section.id,
                    ).length;
                    return (
                      <option key={section.id} value={section.id}>
                        {section.name} ({count})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="preset-list">
                {filteredPresets.map((preset, index) => (
                  <button
                    key={index}
                    className="preset-button"
                    onClick={() => this.loadPreset(preset)}
                    title={preset.description}
                  >
                    <div className="preset-name">{preset.name}</div>
                    <div className="preset-addr">{preset.address}</div>
                    <div className="preset-desc">{preset.description}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Panel - Message Log */}
          <div className="csr-right-panel">
            <div className="message-log">
              <div className="log-header">
                <h2>CSR Command Log</h2>
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
                  <button onClick={this.exportLog} className="btn-export">
                    Export
                  </button>
                </div>
              </div>
              <div className="log-content">
                {messages.length === 0 && (
                  <div className="log-empty">
                    {isConnected
                      ? "No messages yet. Send a CSR command to get started."
                      : "Connect to serial port via Serial Terminal page to begin."}
                  </div>
                )}
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
        </div>
      </div>
    );
  }
}

const WrappedCSRPage = WithRouter(CSRPage);
export default WrappedCSRPage;
