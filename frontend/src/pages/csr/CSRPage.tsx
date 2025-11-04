import React from "react";
import { WithRouter, WithRouterProps } from "@utils";
import { getPresets, getSections } from "@assets";
import { ProtocolContext, ConnectionState } from "@contexts";
import "@styles/csr.css";

interface CSRMessage {
  timestamp: string;
  type: "TX" | "RX" | "INFO" | "ERROR";
  data: string;
  id: string;
  payloadHex?: string;
}

interface Preset {
  name: string;
  address: string;
  description: string;
  section: string;
  value?: string;
  loading?: boolean;
}

interface CSRPageState {
  csrAddress: string;
  csrData: string;
  csrOperation: "READ" | "WRITE";
  messages: CSRMessage[];
  autoScroll: boolean;
  selectedSection: string;
  showRxAsHex: boolean;
  lastProcessedMessageIndex: number;
  sections: Array<{
    id: string;
    name: string;
    startAddr: string;
    endAddr: string;
  }>;
  presets: Preset[];
  isRegisterSidebarOpen: boolean;
  isLoadingRegisters: boolean;
  responseResolver: ((value: string | null) => void) | null;
}

class CSRPage extends React.Component<WithRouterProps, CSRPageState> {
  static contextType = ProtocolContext;
  context!: React.ContextType<typeof ProtocolContext>;

  private terminalEndRef: React.RefObject<HTMLDivElement>;

  constructor(props: WithRouterProps) {
    super(props);
    this.terminalEndRef = React.createRef();

    this.state = {
      csrAddress: "0x10000",
      csrData: "0xDEADBEEF",
      csrOperation: "WRITE",
      messages: [],
      autoScroll: false,
      selectedSection: "all",
      showRxAsHex: true,
      lastProcessedMessageIndex: -1,
      isRegisterSidebarOpen: true,
      isLoadingRegisters: false,
      responseResolver: null,
      sections: [],
      presets: [],
    };
  }

  async componentDidMount() {
    const loadedSections = await getSections();
    const loadedPresets = await getPresets();
    this.setState({ sections: loadedSections, presets: loadedPresets });
  }

  componentDidUpdate(prevProps: WithRouterProps, prevState: CSRPageState) {
    if (
      this.state.autoScroll &&
      prevState.messages.length !== this.state.messages.length
    ) {
      this.terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    this.processNewMessages();
  }

  private processNewMessages() {
    if (!this.context) return;
    const { serialTerminal } = this.context;
    const { messages: contextMessages } = serialTerminal;

    if (
      contextMessages.length === 0 &&
      this.state.lastProcessedMessageIndex !== -1
    ) {
      this.setState({ lastProcessedMessageIndex: -1 });
      return;
    }

    const startIndex = this.state.lastProcessedMessageIndex + 1;
    if (startIndex >= contextMessages.length) return;

    for (let i = startIndex; i < contextMessages.length; i++) {
      const msg = contextMessages[i];
      if (msg.direction === "RX") {
        const displayData = this.formatRxData(msg.data, msg.payloadHex);
        this.addMessage("RX", displayData, msg.payloadHex);
        if (this.state.responseResolver && msg.payloadHex) {
          const hexValues = msg.payloadHex.split(" ");
          if (hexValues.length >= 5) {
            this.state.responseResolver(msg.payloadHex);
            this.setState({ responseResolver: null });
          }
        }
      }
    }

    this.setState({ lastProcessedMessageIndex: contextMessages.length - 1 });
  }

  private formatRxData = (data: string, payloadHex?: string): string => {
    if (!this.state.showRxAsHex || !payloadHex) {
      return data;
    }
    const bytes = payloadHex.split(" ").map((hex) => parseInt(hex, 16));
    const asciiString = bytes
      .map((b) => (b >= 32 && b <= 126 ? String.fromCharCode(b) : "."))
      .join("");
    return `[HEX] ${payloadHex.toUpperCase()} | ${asciiString}`;
  };

  private buildCSRCommandHex = (
    operation: "READ" | "WRITE",
    addressStr: string,
    dataStr?: string,
  ): string | null => {
    try {
      const addr = parseInt(addressStr.replace(/^0x/i, ""), 16);
      if (isNaN(addr) || addr < 0 || addr > 0xffffffff) {
        this.addMessage("ERROR", "Invalid address format. Use hex: 0x10000");
        return null;
      }

      let data = 0;
      if (operation === "WRITE") {
        data = parseInt((dataStr || "0x0").replace(/^0x/i, ""), 16);
        if (isNaN(data) || data < 0 || data > 0xffffffff) {
          this.addMessage("ERROR", "Invalid data format. Use hex: 0xDEADBEEF");
          return null;
        }
      }

      const cmdType = operation === "WRITE" ? "00" : "01";
      const addrHex = addr.toString(16).padStart(8, "0");
      const dataHex = data.toString(16).padStart(8, "0");

      const finalCmd =
        operation === "WRITE"
          ? `${cmdType} ${addrHex.slice(0, 2)} ${addrHex.slice(2, 4)} ${addrHex.slice(4, 6)} ${addrHex.slice(6, 8)} ${dataHex.slice(0, 2)} ${dataHex.slice(2, 4)} ${dataHex.slice(4, 6)} ${dataHex.slice(6, 8)}`
          : `${cmdType} ${addrHex.slice(0, 2)} ${addrHex.slice(2, 4)} ${addrHex.slice(4, 6)} ${addrHex.slice(6, 8)} 00 00 00 00`;

      return finalCmd;
    } catch (error: any) {
      this.addMessage("ERROR", `Command build failed: ${error.message}`);
      return null;
    }
  };

  private waitForResponse = (timeout = 100): Promise<string | null> => {
    return new Promise((resolve) => {
      this.setState({ responseResolver: resolve });
      setTimeout(() => {
        if (this.state.responseResolver) {
          this.setState({ responseResolver: null });
          resolve(null);
        }
      }, timeout);
    });
  };

  private sendCSRCommand = async () => {
    if (
      this.context?.serialTerminal.connectionState !== ConnectionState.CONNECTED
    ) {
      this.addMessage("ERROR", "❌ Serial port not connected!");
      return;
    }
    const { csrOperation, csrAddress, csrData } = this.state;
    const cmdHex = this.buildCSRCommandHex(csrOperation, csrAddress, csrData);
    if (!cmdHex) return;

    this.addMessage("TX", `[CSR HEX] ${cmdHex.toUpperCase()}`);
    this.context.serialSendHex(cmdHex);

    if (csrOperation === "READ") {
      const responseHex = await this.waitForResponse();
      if (responseHex) {
        const hexParts = responseHex.split(" ");
        const status = parseInt(hexParts[0], 16);
        if (status === 0x00) {
          // Success status for read
          const valueHex = hexParts.slice(1, 5).join("");
          const value = parseInt(valueHex, 16);
          this.addMessage(
            "RX",
            `[CSR READ from ${csrAddress}] -> 0x${value.toString(16).toUpperCase().padStart(8, "0")}`,
          );
        } else {
          this.addMessage(
            "ERROR",
            `Read failed for ${csrAddress}. Status: 0x${status.toString(16)}`,
          );
        }
      } else {
        this.addMessage("ERROR", `No response for ${csrAddress}`);
      }
    }
  };

  private readRegisterValue = async (
    preset: Preset,
    index: number,
  ): Promise<void> => {
    if (
      this.context?.serialTerminal.connectionState !== ConnectionState.CONNECTED
    ) {
      this.addMessage("ERROR", "Serial port not connected.");
      return;
    }

    this.setState((prevState) => {
      const newPresets = [...prevState.presets];
      newPresets[index] = { ...newPresets[index], loading: true };
      return { presets: newPresets };
    });

    const cmdHex = this.buildCSRCommandHex("READ", preset.address);
    if (!cmdHex) {
      this.setState((prevState) => {
        const newPresets = [...prevState.presets];
        newPresets[index] = { ...newPresets[index], loading: false };
        return { presets: newPresets };
      });
      return;
    }

    this.context.serialSendHex(cmdHex);
    this.addMessage("TX", `[CSR HEX] ${cmdHex.toUpperCase()}`);

    const responseHex = await this.waitForResponse();
    let finalValue = "Error";
    if (responseHex) {
      const hexParts = responseHex.split(" ");
      const status = parseInt(hexParts[0], 16);
      if (status === 0x00) {
        const valueHex = hexParts.slice(1, 5).join("");
        finalValue = `0x${valueHex.toUpperCase()}`;
      }
    }

    this.setState((prevState) => {
      const newPresets = [...prevState.presets];
      newPresets[index] = {
        ...newPresets[index],
        value: finalValue,
        loading: false,
      };
      return { presets: newPresets };
    });
  };

  private loadPreset = (preset: Preset) => {
    this.setState({ csrAddress: preset.address });
    this.addMessage(
      "INFO",
      `Loaded: ${preset.name} (${preset.address}) - ${preset.description}`,
    );
  };

  private addMessage = (
    type: "TX" | "RX" | "INFO" | "ERROR",
    data: string,
    payloadHex?: string,
  ) => {
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
          payloadHex,
        },
      ],
    }));
  };

  private clearMessages = () => {
    this.setState({ messages: [], lastProcessedMessageIndex: -1 });
    if (this.context) {
      this.context.updateSerialTerminal({ messages: [] });
    }
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
    const connectionState =
      this.context?.serialTerminal.connectionState ||
      ConnectionState.DISCONNECTED;
    switch (connectionState) {
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
    const connectionState =
      this.context?.serialTerminal.connectionState ||
      ConnectionState.DISCONNECTED;
    switch (connectionState) {
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

  private renderRegisterSidebar = () => {
    const { isRegisterSidebarOpen, sections, presets } = this.state;
    const isConnected =
      this.context?.serialTerminal.connectionState ===
      ConnectionState.CONNECTED;

    return (
      <div
        className={`register-sidebar ${isRegisterSidebarOpen ? "open" : ""}`}
      >
        <button
          className="sidebar-toggle"
          onClick={() =>
            this.setState({ isRegisterSidebarOpen: !isRegisterSidebarOpen })
          }
        >
          {isRegisterSidebarOpen ? "◀" : "▶"}
        </button>
        <div className="sidebar-content">
          <div className="sidebar-header">
            <h2>Register Map</h2>
          </div>
          <div className="sidebar-registers">
            {sections.map((section) => (
              <div key={section.id} className="register-section">
                <h3>{section.name}</h3>
                {presets
                  .filter((p) => p.section === section.id)
                  .map((preset) => {
                    const presetIndex = this.state.presets.findIndex(
                      (p) => p.address === preset.address,
                    );
                    return (
                      <div
                        key={preset.address}
                        className="register-item"
                        title={preset.description}
                      >
                        <div className="register-info">
                          <span className="register-name">{preset.name}</span>
                          <span className="register-address">
                            {preset.address}
                          </span>
                        </div>
                        <div className="register-value-action">
                          <span className="register-value">
                            {this.state.presets[presetIndex].loading
                              ? "..."
                              : this.state.presets[presetIndex].value || "N/A"}
                          </span>
                          <button
                            onClick={() =>
                              this.readRegisterValue(preset, presetIndex)
                            }
                            disabled={
                              !isConnected ||
                              this.state.presets[presetIndex].loading
                            }
                            className="btn-read-single"
                          >
                            Read
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
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
      showRxAsHex,
      isRegisterSidebarOpen,
    } = this.state;
    const isConnected =
      this.context?.serialTerminal.connectionState ===
      ConnectionState.CONNECTED;
    const filteredPresets = this.getFilteredPresets();

    return (
      <div className="csr-page-container">
        {this.renderRegisterSidebar()}
        <div
          className={`csr-page ${isRegisterSidebarOpen ? "sidebar-open" : ""}`}
        >
          <div className="csr-header">
            <h1>CSR Control Panel</h1>
            <p className="description">
              Command Format: 9 bytes - CMD_TYPE(1) + ADDR(4) + DATA(4)
            </p>
          </div>
          <div className="csr-content">
            <div className="csr-left-panel">
              <div className="csr-controls">
                <h2>Command Builder</h2>
                <div
                  className={`connection-status-banner ${this.getConnectionStatusClass()}`}
                >
                  <span className="status-text">
                    {this.getConnectionStatusText()}
                  </span>
                  {!isConnected && (
                    <span className="status-hint">
                      → Go to Serial Terminal page to connect
                    </span>
                  )}
                </div>
                <div className="control-group">
                  <label>Operation:</label>
                  <div className="radio-group">
                    <label className="radio-label">
                      <input
                        type="radio"
                        value="WRITE"
                        checked={csrOperation === "WRITE"}
                        onChange={() =>
                          this.setState({ csrOperation: "WRITE" })
                        }
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
                {csrOperation === "WRITE" && (
                  <div className="control-group">
                    <label>Data (4 bytes):</label>
                    <input
                      type="text"
                      value={csrData}
                      onChange={(e) =>
                        this.setState({ csrData: e.target.value })
                      }
                      placeholder="0xDEADBEEF"
                      className="hex-input"
                    />
                  </div>
                )}
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
            <div className="csr-right-panel">
              <div className="message-log">
                <div className="log-header">
                  <h2>CSR Command Log</h2>
                  <div className="log-controls">
                    <label>
                      <input
                        type="checkbox"
                        checked={showRxAsHex}
                        onChange={(e) =>
                          this.setState({ showRxAsHex: e.target.checked })
                        }
                      />
                      Show RX as Hex
                    </label>
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
      </div>
    );
  }
}

const WrappedCSRPage = WithRouter(CSRPage);
export default WrappedCSRPage;
