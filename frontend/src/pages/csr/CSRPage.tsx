import React from "react";
import { WithRouter, WithRouterProps } from "@utils";
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

  presets: Array<{
    name: string;
    address: string;
    description: string;
    section: string;
  }>;
}

class CSRPage extends React.Component<WithRouterProps, CSRPageState> {
  private terminalEndRef: React.RefObject<HTMLDivElement>;

  constructor(props: WithRouterProps) {
    super(props);
    this.terminalEndRef = React.createRef();

    this.state = {
      csrAddress: "0x10000",
      csrData: "0xDEADBEEF",
      csrOperation: "WRITE",
      messages: [],
      autoScroll: true,

      presets: [
        // SLV_REGS Section
        {
          name: "SLV_REG0",
          address: "0x10000",
          description: "Slave Register 0",
          section: "slv_regs",
        },
        {
          name: "SLV_REG1",
          address: "0x11000",
          description: "Slave Register 1",
          section: "slv_regs",
        },
        {
          name: "SLV_REG2",
          address: "0x12000",
          description: "Slave Register 2",
          section: "slv_regs",
        },
        {
          name: "SLV_REG3",
          address: "0x13000",
          description: "Slave Register 3",
          section: "slv_regs",
        },

        // ACM2108 Section
        {
          name: "ACM_CONTROL",
          address: "0x18000",
          description: "System restart request",
          section: "acm2108",
        },
        {
          name: "ACM_STATUS",
          address: "0x18004",
          description: "System status (read only)",
          section: "acm2108",
        },
        {
          name: "CHANNEL_SEL",
          address: "0x18008",
          description: "ADC channel selection",
          section: "acm2108",
        },
        {
          name: "DATA_NUM",
          address: "0x1800C",
          description: "Number of data samples",
          section: "acm2108",
        },
        {
          name: "ADC_SPEED",
          address: "0x18010",
          description: "ADC sampling speed",
          section: "acm2108",
        },
        {
          name: "DDS_FTW",
          address: "0x18020",
          description: "DDS Frequency Tuning Word",
          section: "acm2108",
        },

        // Signal Measure Section
        {
          name: "SIG_CONTROL",
          address: "0x1C000",
          description: "Enable signal measurement",
          section: "signal_measure",
        },
        {
          name: "SIG_STATUS",
          address: "0x1C004",
          description: "Measurement status",
          section: "signal_measure",
        },
        {
          name: "SIG_PERIOD",
          address: "0x1C008",
          description: "Measured period",
          section: "signal_measure",
        },

        // UART Engine Section
        {
          name: "UART_CONFIG",
          address: "0x24000",
          description: "Clock divider config",
          section: "uart_engine",
        },
        {
          name: "UART_PARITY",
          address: "0x24004",
          description: "Parity configuration",
          section: "uart_engine",
        },
        {
          name: "UART_FRAME",
          address: "0x24008",
          description: "Frame configuration",
          section: "uart_engine",
        },

        // SPI Engine Section
        {
          name: "SPI_CONFIG",
          address: "0x28000",
          description: "Clock divider config",
          section: "spi_engine",
        },
        {
          name: "SPI_CONTROL",
          address: "0x28004",
          description: "SPI control register",
          section: "spi_engine",
        },

        // PWM Engine Section
        {
          name: "PWM_CONTROL",
          address: "0x2C000",
          description: "PWM enable control",
          section: "pwm_engine",
        },
        {
          name: "PWM_CH_SEL",
          address: "0x2C004",
          description: "Channel selection",
          section: "pwm_engine",
        },

        // I2C Engine Section
        {
          name: "I2C_CONFIG",
          address: "0x30000",
          description: "Clock divider config",
          section: "i2c_engine",
        },
        {
          name: "I2C_CONTROL",
          address: "0x30004",
          description: "I2C control register",
          section: "i2c_engine",
        },
      ],
    };
  }

  componentDidUpdate(prevProps: WithRouterProps, prevState: CSRPageState) {
    if (
      this.state.autoScroll &&
      prevState.messages.length !== this.state.messages.length
    ) {
      this.terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }

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

  private sendCSRCommand = () => {
    const cmd = this.buildCSRCommand();
    if (!cmd) return;

    const address = parseInt(this.state.csrAddress.replace(/^0x/i, ""), 16);
    const data =
      this.state.csrOperation === "WRITE"
        ? parseInt(this.state.csrData.replace(/^0x/i, ""), 16)
        : 0;

    // Log the command
    const hexDisplay = Array.from(cmd)
      .map((b) => b.toString(16).padStart(2, "0").toUpperCase())
      .join(" ");

    const operation =
      this.state.csrOperation === "WRITE"
        ? `WRITE 0x${data.toString(16).padStart(8, "0").toUpperCase()} to 0x${address.toString(16).padStart(8, "0").toUpperCase()}`
        : `READ from 0x${address.toString(16).padStart(8, "0").toUpperCase()}`;

    this.addMessage("TX", `[CSR ${operation}]`);
    this.addMessage("INFO", `Raw bytes: ${hexDisplay}`);

    // TODO: Integrate with SerialTerminal to actually send the command
    // You can emit a custom event or use a shared service
    console.log("CSR Command bytes:", hexDisplay);
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
      `Loaded preset: ${preset.name} - ${preset.description}`,
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

  private groupPresetsBySection = () => {
    const grouped: { [key: string]: typeof this.state.presets } = {};
    this.state.presets.forEach((preset) => {
      if (!grouped[preset.section]) {
        grouped[preset.section] = [];
      }
      grouped[preset.section].push(preset);
    });
    return grouped;
  };

  render() {
    const { csrAddress, csrData, csrOperation, messages, autoScroll } =
      this.state;

    const groupedPresets = this.groupPresetsBySection();

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
                <button onClick={this.sendCSRCommand} className="btn-send">
                  📤 Send CSR Command
                </button>
              </div>
            </div>

            {/* Preset Registers */}
            <div className="preset-registers">
              <h2>Quick Access Registers</h2>
              <div className="preset-sections">
                {Object.entries(groupedPresets).map(([section, presets]) => (
                  <div key={section} className="preset-section">
                    <h3>{section.replace(/_/g, " ").toUpperCase()}</h3>
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
                ))}
              </div>
            </div>
          </div>

          {/* Right Panel - Message Log */}
          <div className="csr-right-panel">
            <div className="message-log">
              <div className="log-header">
                <h2>Message Log</h2>
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
                    No messages yet. Send a CSR command to get started.
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
