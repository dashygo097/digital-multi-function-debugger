import React from "react";
import { withTerminalContext } from "../contexts/TerminalContext";

interface Message {
  timestamp: string;
  direction: "TX" | "RX" | "INFO" | "ERROR";
  data: string;
  id: string;
}

interface SerialTerminalProps {
  className?: string;
  terminalContext?: any; // Will be injected by HOC
}

interface SerialTerminalState {
  ports: SerialPort[];
  selectedPort: SerialPort | null;
}

class SerialTerminalBase extends React.Component<
  SerialTerminalProps,
  SerialTerminalState
> {
  private terminalEndRef: React.RefObject<HTMLDivElement>;
  private terminalRef: React.RefObject<HTMLDivElement>;
  private writerRef: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private readerRef: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private shouldStopRef = false;
  private keepReading = false;
  private refreshInterval: NodeJS.Timeout | null = null;

  static defaultProps = {
    className: "serial-terminal",
  };

  constructor(props: SerialTerminalProps) {
    super(props);
    this.terminalEndRef = React.createRef();
    this.terminalRef = React.createRef();
    this.state = {
      ports: [],
      selectedPort: null,
    };
  }

  // Helper to update context
  private updateContext = (updates: any) => {
    this.props.terminalContext?.updateSerialTerminal(updates);
  };

  // Helper to get context state
  private getContextState = () => {
    return this.props.terminalContext?.serialTerminal || {};
  };

  async componentDidMount() {
    await this.refreshPorts();
    this.startAutoRefresh();
  }

  componentWillUnmount() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    this.cleanupConnection();
  }

  componentDidUpdate(
    prevProps: SerialTerminalProps,
    prevState: SerialTerminalState,
  ) {
    const currentMessages = this.getContextState().messages || [];
    const prevMessages =
      this.props.terminalContext?.serialTerminal?.messages || [];

    if (prevMessages.length !== currentMessages.length) {
      const terminal = this.terminalRef.current;
      const isNearBottom = terminal
        ? terminal.scrollHeight - terminal.scrollTop - terminal.clientHeight <
          50
        : true;

      if (this.getContextState().autoScroll) {
        this.scrollToBottom();
      } else if (!isNearBottom) {
        this.updateContext({
          newMessagesCount: this.getContextState().newMessagesCount + 1,
        });
      }
    }
  }

  private handleScroll = () => {
    const terminal = this.terminalRef.current;
    if (!terminal) return;

    const { scrollTop, scrollHeight, clientHeight } = terminal;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 50;

    this.updateContext({
      showScrollIndicator: !isNearBottom,
      newMessagesCount: isNearBottom
        ? 0
        : this.getContextState().newMessagesCount,
    });
  };

  private scrollToBottom = () => {
    this.terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
    this.updateContext({ newMessagesCount: 0 });
  };

  private toggleAutoScroll = (checked: boolean) => {
    this.updateContext({ autoScroll: checked });
    if (checked) {
      this.scrollToBottom();
    }
  };

  private startAutoRefresh = () => {
    this.refreshInterval = setInterval(() => {
      if (!this.getContextState().isConnected) {
        this.refreshPorts();
      }
    }, 2000);
  };

  private refreshPorts = async () => {
    try {
      const ports = await navigator.serial.getPorts();
      console.log(`Found ${ports.length} authorized ports`);

      this.setState({ ports });
      this.updateContext({ ports });

      if (this.state.selectedPort) {
        const stillExists = ports.find((p) => p === this.state.selectedPort);
        if (!stillExists) {
          this.setState({ selectedPort: null });
          this.updateContext({ selectedPort: null, selectedPortName: "" });
        }
      }
    } catch (error) {
      console.error("Error refreshing ports:", error);
      this.addMessage("ERROR", `Failed to refresh ports: ${error}`);
    }
  };

  private getPortDisplayName = (port: SerialPort): string => {
    const info = port.getInfo();
    if (info.usbVendorId && info.usbProductId) {
      return `USB Device (VID: 0x${info.usbVendorId.toString(16).padStart(4, "0")}, PID: 0x${info.usbProductId.toString(16).padStart(4, "0")})`;
    }
    return "Serial Port";
  };

  private handlePortSelection = (index: number) => {
    if (this.getContextState().isConnected) return;

    if (index >= 0 && index < this.state.ports.length) {
      const port = this.state.ports[index];
      this.setState({ selectedPort: port });
      this.updateContext({
        selectedPortName: this.getPortDisplayName(port),
      });
    } else {
      this.setState({ selectedPort: null });
      this.updateContext({ selectedPort: null, selectedPortName: "" });
    }
  };

  private connectPort = async () => {
    if (!this.state.selectedPort) {
      this.addMessage("ERROR", "Please select a port first");
      const stats = this.getContextState().stats;
      this.updateContext({
        stats: { ...stats, errors: stats.errors + 1 },
      });
      return;
    }

    const port = this.state.selectedPort;

    try {
      this.addMessage(
        "INFO",
        `Connecting to ${this.getContextState().selectedPortName} at ${this.getContextState().baudRate} baud...`,
      );

      try {
        await port.close();
        console.log("Closed previously open port");
        await new Promise((r) => setTimeout(r, 500));
      } catch (e) {
        // Port wasn't open, that's fine
      }

      console.log(
        `Opening port with baudRate: ${this.getContextState().baudRate}...`,
      );
      await port.open({
        baudRate: this.getContextState().baudRate,
        dataBits: 8,
        stopBits: 1,
        parity: "none",
        flowControl: "none",
        bufferSize: 4096,
      });
      console.log("✓ Port opened");

      try {
        await port.setSignals({
          dataTerminalReady: true,
          requestToSend: true,
        });
        console.log("✓ DTR/RTS signals set");
      } catch (e) {
        console.log("Could not set signals (may not be supported):", e);
      }

      this.shouldStopRef = false;
      this.keepReading = true;

      if (!port.writable) {
        throw new Error("Port is not writable");
      }
      this.writerRef = port.writable.getWriter();
      console.log("✓ Writer ready");

      if (!port.readable) {
        throw new Error("Port is not readable");
      }
      this.readerRef = port.readable.getReader();
      console.log("✓ Reader ready");

      this.readLoop();

      this.updateContext({ isConnected: true });
      this.addMessage(
        "INFO",
        `✓ Connected at ${this.getContextState().baudRate} baud`,
      );
    } catch (error: any) {
      console.error("Connection failed:", error);
      this.addMessage("ERROR", `Connection failed: ${error.message || error}`);
      const stats = this.getContextState().stats;
      this.updateContext({
        stats: { ...stats, errors: stats.errors + 1 },
      });
      await this.cleanupConnection();
    }
  };

  private readLoop = async () => {
    const reader = this.readerRef;
    if (!reader) {
      console.error("No reader available");
      return;
    }

    console.log("Read loop started");

    try {
      while (this.keepReading) {
        const { value, done } = await reader.read();

        if (done) {
          console.log("Reader done");
          break;
        }

        if (value && value.length > 0) {
          let displayText: string;

          if (this.getContextState().showHex) {
            displayText = Array.from(value)
              .map((b) => {
                const hex = b.toString(16).padStart(2, "0");
                return `${this.getContextState().hexPrefix}${hex}`;
              })
              .join(" ");
          } else {
            displayText = new TextDecoder().decode(value);
          }

          console.log("RX:", displayText);
          this.addMessage("RX", displayText);
          const stats = this.getContextState().stats;
          this.updateContext({
            stats: { ...stats, rx: stats.rx + 1 },
          });
        }
      }
    } catch (error: any) {
      if (this.shouldStopRef) {
        console.log("Read loop stopped by user");
        return;
      }

      if (error.name === "NetworkError" || error.name === "NotFoundError") {
        console.error("Device disconnected");
        this.addMessage("ERROR", "Device disconnected");
        await this.disconnectPort();
      } else if (error.name !== "AbortError") {
        console.error("Read error:", error);
        this.addMessage("ERROR", `Read error: ${error.message}`);
        const stats = this.getContextState().stats;
        this.updateContext({
          stats: { ...stats, errors: stats.errors + 1 },
        });
      }
    } finally {
      console.log("Read loop ended");
    }
  };

  private cleanupConnection = async () => {
    console.log("=== Cleanup started ===");

    this.shouldStopRef = true;
    this.keepReading = false;

    await new Promise((r) => setTimeout(r, 100));

    if (this.readerRef) {
      try {
        await this.readerRef.cancel();
        console.log("✓ Reader canceled");
      } catch (e) {
        console.log("Reader cancel error:", e);
      }
      try {
        this.readerRef.releaseLock();
      } catch (e) {
        console.log("Reader release error:", e);
      }
      this.readerRef = null;
    }

    if (this.writerRef) {
      try {
        await this.writerRef.releaseLock();
        console.log("✓ Writer lock released");
      } catch (e) {
        console.log("Writer release error:", e);
      }
      this.writerRef = null;
    }

    if (this.state.selectedPort) {
      try {
        await this.state.selectedPort.close();
        console.log("✓ Port closed");
      } catch (e) {
        console.log("Port close error:", e);
      }
    }

    await new Promise((r) => setTimeout(r, 300));

    console.log("=== Cleanup complete ===");
  };

  private disconnectPort = async () => {
    if (!this.getContextState().isConnected) {
      return;
    }

    try {
      this.addMessage("INFO", "Disconnecting...");

      await this.cleanupConnection();

      this.updateContext({ isConnected: false });
      this.addMessage("INFO", "✓ Disconnected");
    } catch (error) {
      console.error("Disconnect error:", error);
      this.updateContext({ isConnected: false });
    }
  };

  private getLineEnding = (): string => {
    const endings = { NONE: "", LF: "\n", CR: "\r", CRLF: "\r\n" };
    return endings[this.getContextState().lineEnding] || "";
  };

  private sendText = async () => {
    const text = this.getContextState().inputText?.trim() || "";
    if (!text) {
      return;
    }

    if (
      !this.getContextState().isConnected ||
      !this.writerRef ||
      !this.state.selectedPort
    ) {
      this.addMessage("ERROR", "Port not connected");
      const stats = this.getContextState().stats;
      this.updateContext({
        stats: { ...stats, errors: stats.errors + 1 },
      });
      return;
    }

    try {
      const dataToSend = text + this.getLineEnding();
      const encoded = new TextEncoder().encode(dataToSend);

      console.log(
        `Sending: "${text}" + ending "${this.getContextState().lineEnding}"`,
      );
      console.log(
        "Bytes:",
        Array.from(encoded)
          .map((b) => `0x${b.toString(16).padStart(2, "0")}`)
          .join(" "),
      );

      await this.writerRef.write(encoded);

      console.log("✓ Data written to buffer");

      this.addMessage("TX", text);
      const stats = this.getContextState().stats;
      this.updateContext({
        stats: { ...stats, tx: stats.tx + 1 },
        inputText: "",
      });
    } catch (error: any) {
      console.error("Send error:", error);
      this.addMessage("ERROR", `Send failed: ${error.message}`);
      const stats = this.getContextState().stats;
      this.updateContext({
        stats: { ...stats, errors: stats.errors + 1 },
      });

      if (error.name === "NetworkError" || error.name === "NotFoundError") {
        this.addMessage("ERROR", "Device disconnected");
        await this.disconnectPort();
      }
    }
  };

  private sendHex = async () => {
    const hex = this.getContextState().inputHex?.trim() || "";
    if (!hex) {
      return;
    }

    if (
      !this.getContextState().isConnected ||
      !this.writerRef ||
      !this.state.selectedPort
    ) {
      this.addMessage("ERROR", "Port not connected");
      const stats = this.getContextState().stats;
      this.updateContext({
        stats: { ...stats, errors: stats.errors + 1 },
      });
      return;
    }

    try {
      const hexValues = hex
        .split(/[\s,]+/)
        .filter((x) => x.length > 0)
        .map((x) => {
          const cleaned = x.replace(/^0x/i, "").replace(/^\\x/i, "");
          return parseInt(cleaned, 16);
        });

      if (hexValues.some(isNaN) || hexValues.some((v) => v < 0 || v > 255)) {
        this.addMessage(
          "ERROR",
          "Invalid hex format. Use: 01 02 03 or 0x01 0x02 0x03",
        );
        const stats = this.getContextState().stats;
        this.updateContext({
          stats: { ...stats, errors: stats.errors + 1 },
        });
        return;
      }

      const bytes = new Uint8Array(hexValues);
      console.log(
        "Sending hex:",
        Array.from(bytes)
          .map((b) => `0x${b.toString(16).padStart(2, "0")}`)
          .join(" "),
      );

      await this.writerRef.write(bytes);
      console.log("✓ Hex data sent");

      const hexDisplay = Array.from(bytes)
        .map((b) => `0x${b.toString(16).padStart(2, "0")}`)
        .join(" ");
      this.addMessage("TX", `[HEX] ${hexDisplay}`);
      const stats = this.getContextState().stats;
      this.updateContext({
        stats: { ...stats, tx: stats.tx + 1 },
        inputHex: "",
      });
    } catch (error: any) {
      console.error("Hex send error:", error);
      this.addMessage("ERROR", `Hex send failed: ${error.message}`);
      const stats = this.getContextState().stats;
      this.updateContext({
        stats: { ...stats, errors: stats.errors + 1 },
      });

      if (error.name === "NetworkError" || error.name === "NotFoundError") {
        this.addMessage("ERROR", "Device disconnected");
        await this.disconnectPort();
      }
    }
  };

  private addMessage = (
    direction: "TX" | "RX" | "INFO" | "ERROR",
    data: string,
  ) => {
    const newMessage = {
      timestamp: new Date().toLocaleTimeString("en-US", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        fractionalSecondDigits: 3,
      }),
      direction,
      data,
      id: `${Date.now()}-${Math.random()}`,
    };

    const currentMessages = this.getContextState().messages || [];
    this.updateContext({
      messages: [...currentMessages, newMessage],
    });
  };

  private clearTerminal = () => {
    this.updateContext({
      messages: [],
      stats: { tx: 0, rx: 0, errors: 0 },
      newMessagesCount: 0,
    });
  };

  private exportLog = () => {
    const messages = this.getContextState().messages || [];
    const log = messages
      .map((m: Message) => `[${m.timestamp}] ${m.direction}: ${m.data}`)
      .join("\n");

    const element = document.createElement("a");
    element.setAttribute(
      "href",
      "data:text/plain;charset=utf-8," + encodeURIComponent(log),
    );
    element.setAttribute("download", `serial-log-${Date.now()}.txt`);
    element.style.display = "none";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  render() {
    const { className } = this.props;
    const contextState = this.getContextState();
    const {
      selectedPortName = "",
      isConnected = false,
      baudRate = 115200,
      messages = [],
      inputText = "",
      inputHex = "",
      inputMode = "TEXT",
      lineEnding = "NONE",
      stats = { tx: 0, rx: 0, errors: 0 },
      autoScroll = false,
      showScrollIndicator = false,
      newMessagesCount = 0,
      showHex = false,
      hexPrefix = "0x",
    } = contextState;

    return (
      <div className={className}>
        <div className="control-panel">
          <div className="section">
            <label>{isConnected ? "✓ Connected" : "○ Disconnected"}</label>
          </div>
          <div className="section">
            <label>Port:</label>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <select
                value={selectedPortName}
                onChange={(e) => {
                  const index = this.state.ports.findIndex(
                    (p) => this.getPortDisplayName(p) === e.target.value,
                  );
                  this.handlePortSelection(index);
                }}
                disabled={isConnected}
                style={{ flex: 1 }}
              >
                <option value="">Select...</option>
                {this.state.ports.map((port, index) => {
                  const name = this.getPortDisplayName(port);
                  return (
                    <option key={index} value={name}>
                      {name}
                    </option>
                  );
                })}
              </select>
              <button onClick={this.refreshPorts} disabled={isConnected}>
                🔄
              </button>
            </div>
          </div>

          <div className="section">
            <label>Baud:</label>
            <select
              value={baudRate}
              onChange={(e) =>
                this.updateContext({ baudRate: Number(e.target.value) })
              }
              disabled={isConnected}
            >
              <option value={9600}>9600</option>
              <option value={19200}>19200</option>
              <option value={38400}>38400</option>
              <option value={57600}>57600</option>
              <option value={115200}>115200</option>
              <option value={230400}>230400</option>
              <option value={460800}>460800</option>
              <option value={921600}>921600</option>
            </select>
          </div>

          <div className="section">
            <label>Line End:</label>
            <select
              value={lineEnding}
              onChange={(e) =>
                this.updateContext({ lineEnding: e.target.value as any })
              }
              disabled={!isConnected}
            >
              <option value="NONE">None</option>
              <option value="LF">LF (\n)</option>
              <option value="CR">CR (\r)</option>
              <option value="CRLF">CRLF (\r\n)</option>
            </select>
          </div>

          <div className="section">
            <label>Input Mode:</label>
            <select
              value={inputMode}
              onChange={(e) =>
                this.updateContext({ inputMode: e.target.value as any })
              }
              disabled={!isConnected}
            >
              <option value="TEXT">Text</option>
              <option value="HEX">Hex</option>
            </select>
            <label>
              <input
                type="checkbox"
                checked={showHex}
                onChange={(e) =>
                  this.updateContext({ showHex: e.target.checked })
                }
              />
              Show Hex
            </label>
            {showHex && (
              <>
                <label>Prefix:</label>
                <select
                  value={hexPrefix}
                  onChange={(e) =>
                    this.updateContext({ hexPrefix: e.target.value as any })
                  }
                >
                  <option value="0x">0x</option>
                  <option value="\x">\x</option>
                  <option value="">None</option>
                </select>
              </>
            )}
          </div>

          <div className="section">
            <label>
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => this.toggleAutoScroll(e.target.checked)}
              />
              Auto-scroll
            </label>
          </div>

          <div className="buttons">
            {!isConnected ? (
              <button
                onClick={this.connectPort}
                className="btn-primary"
                disabled={!this.state.selectedPort}
              >
                Connect
              </button>
            ) : (
              <button onClick={this.disconnectPort} className="btn-danger">
                Disconnect
              </button>
            )}
            <button onClick={this.clearTerminal}>Clear</button>
            <button onClick={this.exportLog}>Export</button>
          </div>

          <div className="stats">
            TX: {stats.tx} | RX: {stats.rx} | Errors: {stats.errors}
          </div>
        </div>

        <div className="terminal-wrapper">
          {/* New messages badge */}
          {!autoScroll && newMessagesCount > 0 && (
            <div className="new-messages-badge visible">
              +{newMessagesCount} new
            </div>
          )}

          {/* Terminal */}
          <div
            className={`terminal ${!autoScroll ? "auto-scroll-disabled" : ""}`}
            ref={this.terminalRef}
            onScroll={this.handleScroll}
          >
            {messages.map((msg: Message) => (
              <div
                key={msg.id}
                className={`message ${msg.direction.toLowerCase()}`}
              >
                <span className="timestamp">[{msg.timestamp}]</span>
                <span className="direction">{msg.direction}:</span>
                <span className="data">{msg.data}</span>
              </div>
            ))}
            <div ref={this.terminalEndRef} />
          </div>

          {/* Scroll to bottom button */}
          {!autoScroll && showScrollIndicator && (
            <div
              className="scroll-indicator visible"
              onClick={this.scrollToBottom}
              title="Scroll to bottom"
            />
          )}
        </div>

        <div className="input-section">
          <div className="text-input">
            <input
              type="text"
              value={inputMode === "TEXT" ? inputText : inputHex}
              onChange={(e) =>
                inputMode === "TEXT"
                  ? this.updateContext({ inputText: e.target.value })
                  : this.updateContext({ inputHex: e.target.value })
              }
              onKeyPress={(e) =>
                e.key === "Enter" &&
                (inputMode === "TEXT" ? this.sendText() : this.sendHex())
              }
              placeholder={
                inputMode === "TEXT"
                  ? "Type message..."
                  : "Hex: 01 02 03 or 0x01 0x02 0x03"
              }
              disabled={!isConnected}
            />
            <button
              onClick={inputMode === "TEXT" ? this.sendText : this.sendHex}
              disabled={!isConnected}
            >
              Send
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export const SerialTerminal = withTerminalContext(SerialTerminalBase);
