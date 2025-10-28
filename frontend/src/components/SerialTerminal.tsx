import React from "react";

interface Message {
  timestamp: string;
  direction: "TX" | "RX" | "INFO" | "ERROR";
  data: string;
  id: string;
}

interface SerialTerminalProps {
  className?: string;
}

interface SerialTerminalState {
  ports: SerialPort[]; // Web Serial API ports
  selectedPort: SerialPort | null;
  selectedPortName: string;
  isConnected: boolean;
  baudRate: number;
  messages: Message[];
  inputText: string;
  inputHex: string;
  inputMode: "TEXT" | "HEX";
  lineEnding: "NONE" | "LF" | "CR" | "CRLF";
  stats: { tx: number; rx: number; errors: number };
}

export class SerialTerminal extends React.Component<
  SerialTerminalProps,
  SerialTerminalState
> {
  private terminalEndRef: React.RefObject<HTMLDivElement>;
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
    this.state = {
      ports: [],
      selectedPort: null,
      selectedPortName: "",
      isConnected: false,
      baudRate: 115200,
      messages: [],
      inputText: "",
      inputHex: "",
      inputMode: "TEXT",
      lineEnding: "NONE",
      stats: { tx: 0, rx: 0, errors: 0 },
    };
  }

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
    if (prevState.messages.length !== this.state.messages.length) {
      this.terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }

  private startAutoRefresh = () => {
    this.refreshInterval = setInterval(() => {
      if (!this.state.isConnected) {
        this.refreshPorts();
      }
    }, 2000);
  };

  private refreshPorts = async () => {
    try {
      const ports = await navigator.serial.getPorts();
      console.log(`Found ${ports.length} authorized ports`);

      this.setState({ ports });

      // If we had a selected port, try to keep it selected
      if (this.state.selectedPort) {
        const stillExists = ports.find((p) => p === this.state.selectedPort);
        if (!stillExists) {
          this.setState({ selectedPort: null, selectedPortName: "" });
        }
      }
    } catch (error) {
      console.error("Error refreshing ports:", error);
      this.addMessage("ERROR", `Failed to refresh ports: ${error}`);
    }
  };

  private requestPort = async () => {
    try {
      const port = await navigator.serial.requestPort({ filters: [] });
      await this.refreshPorts();

      // Auto-select the newly requested port
      const portInfo = port.getInfo();
      this.setState({
        selectedPort: port,
        selectedPortName: this.getPortDisplayName(port),
      });

      this.addMessage("INFO", "Port access granted");
    } catch (error) {
      console.log("Port request cancelled or failed:", error);
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
    if (this.state.isConnected) return;

    if (index >= 0 && index < this.state.ports.length) {
      const port = this.state.ports[index];
      this.setState({
        selectedPort: port,
        selectedPortName: this.getPortDisplayName(port),
      });
    } else {
      this.setState({ selectedPort: null, selectedPortName: "" });
    }
  };

  private connectPort = async () => {
    if (!this.state.selectedPort) {
      this.addMessage("ERROR", "Please select a port first");
      this.setState((prev) => ({
        stats: { ...prev.stats, errors: prev.stats.errors + 1 },
      }));
      return;
    }

    const port = this.state.selectedPort;

    try {
      this.addMessage(
        "INFO",
        `Connecting to ${this.state.selectedPortName} at ${this.state.baudRate} baud...`,
      );

      // Close if already open
      try {
        await port.close();
        console.log("Closed previously open port");
        await new Promise((r) => setTimeout(r, 500));
      } catch (e) {
        // Port wasn't open, that's fine
      }

      console.log(`Opening port with baudRate: ${this.state.baudRate}...`);
      await port.open({
        baudRate: this.state.baudRate,
        dataBits: 8,
        stopBits: 1,
        parity: "none",
        flowControl: "none",
        bufferSize: 4096,
      });
      console.log("✓ Port opened");

      // Set DTR/RTS signals
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

      this.setState({ isConnected: true });
      this.addMessage("INFO", `✓ Connected at ${this.state.baudRate} baud`);
    } catch (error: any) {
      console.error("Connection failed:", error);
      this.addMessage("ERROR", `Connection failed: ${error.message || error}`);
      this.setState((prev) => ({
        stats: { ...prev.stats, errors: prev.stats.errors + 1 },
      }));
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
          const text = new TextDecoder().decode(value);
          console.log("RX:", text);
          this.addMessage("RX", text);
          this.setState((prev) => ({
            stats: { ...prev.stats, rx: prev.stats.rx + 1 },
          }));
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
        this.setState((prev) => ({
          stats: { ...prev.stats, errors: prev.stats.errors + 1 },
        }));
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
    if (!this.state.isConnected) {
      return;
    }

    try {
      this.addMessage("INFO", "Disconnecting...");

      await this.cleanupConnection();

      this.setState({ isConnected: false });
      this.addMessage("INFO", "✓ Disconnected");
    } catch (error) {
      console.error("Disconnect error:", error);
      this.setState({ isConnected: false });
    }
  };

  private getLineEnding = (): string => {
    const endings = { NONE: "", LF: "\n", CR: "\r", CRLF: "\r\n" };
    return endings[this.state.lineEnding];
  };

  private sendText = async () => {
    const text = this.state.inputText.trim();
    if (!text) {
      return;
    }

    if (
      !this.state.isConnected ||
      !this.writerRef ||
      !this.state.selectedPort
    ) {
      this.addMessage("ERROR", "Port not connected");
      this.setState((prev) => ({
        stats: { ...prev.stats, errors: prev.stats.errors + 1 },
      }));
      return;
    }

    try {
      const dataToSend = text + this.getLineEnding();
      const encoded = new TextEncoder().encode(dataToSend);

      console.log(`Sending: "${text}" + ending "${this.state.lineEnding}"`);
      console.log(
        "Bytes:",
        Array.from(encoded)
          .map((b) => `0x${b.toString(16).padStart(2, "0")}`)
          .join(" "),
      );

      await this.writerRef.write(encoded);

      console.log("✓ Data written to buffer");

      this.addMessage("TX", text);
      this.setState((prev) => ({
        stats: { ...prev.stats, tx: prev.stats.tx + 1 },
        inputText: "",
      }));
    } catch (error: any) {
      console.error("Send error:", error);
      this.addMessage("ERROR", `Send failed: ${error.message}`);
      this.setState((prev) => ({
        stats: { ...prev.stats, errors: prev.stats.errors + 1 },
      }));

      if (error.name === "NetworkError" || error.name === "NotFoundError") {
        this.addMessage("ERROR", "Device disconnected");
        await this.disconnectPort();
      }
    }
  };

  private sendHex = async () => {
    const hex = this.state.inputHex.trim();
    if (!hex) {
      return;
    }

    if (
      !this.state.isConnected ||
      !this.writerRef ||
      !this.state.selectedPort
    ) {
      this.addMessage("ERROR", "Port not connected");
      this.setState((prev) => ({
        stats: { ...prev.stats, errors: prev.stats.errors + 1 },
      }));
      return;
    }

    try {
      const hexValues = hex
        .split(/[\s,]+/)
        .filter((x) => x.length > 0)
        .map((x) => {
          const cleaned = x.replace(/^0x/i, "");
          return parseInt(cleaned, 16);
        });

      if (hexValues.some(isNaN) || hexValues.some((v) => v < 0 || v > 255)) {
        this.addMessage(
          "ERROR",
          "Invalid hex format. Use: 01 02 03 or 0x01 0x02 0x03",
        );
        this.setState((prev) => ({
          stats: { ...prev.stats, errors: prev.stats.errors + 1 },
        }));
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
      this.setState((prev) => ({
        stats: { ...prev.stats, tx: prev.stats.tx + 1 },
        inputHex: "",
      }));
    } catch (error: any) {
      console.error("Hex send error:", error);
      this.addMessage("ERROR", `Hex send failed: ${error.message}`);
      this.setState((prev) => ({
        stats: { ...prev.stats, errors: prev.stats.errors + 1 },
      }));

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
          direction,
          data,
          id: `${Date.now()}-${Math.random()}`,
        },
      ],
    }));
  };

  private clearTerminal = () => {
    this.setState({
      messages: [],
      stats: { tx: 0, rx: 0, errors: 0 },
    });
  };

  private exportLog = () => {
    const log = this.state.messages
      .map((m) => `[${m.timestamp}] ${m.direction}: ${m.data}`)
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
    const {
      ports,
      selectedPortName,
      isConnected,
      baudRate,
      messages,
      inputText,
      inputHex,
      inputMode,
      lineEnding,
      stats,
    } = this.state;

    return (
      <div className={className}>
        <div className="control-panel">
          <div className="section">
            <label>Port:</label>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <select
                value={selectedPortName}
                onChange={(e) => {
                  const index = ports.findIndex(
                    (p) => this.getPortDisplayName(p) === e.target.value,
                  );
                  this.handlePortSelection(index);
                }}
                disabled={isConnected}
                style={{ flex: 1 }}
              >
                <option value="">Select...</option>
                {ports.map((port, index) => {
                  const name = this.getPortDisplayName(port);
                  return (
                    <option key={index} value={name}>
                      {name}
                    </option>
                  );
                })}
              </select>
              <button onClick={this.requestPort} disabled={isConnected}>
                ➕
              </button>
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
                this.setState({ baudRate: Number(e.target.value) })
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
            <label>Line End:</label>
            <select
              value={lineEnding}
              onChange={(e) =>
                this.setState({ lineEnding: e.target.value as any })
              }
              disabled={!isConnected}
            >
              <option value="NONE">None</option>
              <option value="LF">LF (\n)</option>
              <option value="CR">CR (\r)</option>
              <option value="CRLF">CRLF (\r\n)</option>
            </select>
            <label>Input Mode:</label>
            <select
              value={inputMode}
              onChange={(e) =>
                this.setState({ inputMode: e.target.value as any })
              }
              disabled={!isConnected}
            >
              <option value="TEXT">Text</option>
              <option value="HEX">Hex</option>
            </select>
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
            TX: {stats.tx} | RX: {stats.rx} | Errors: {stats.errors} |{" "}
            {isConnected ? "Connected" : "Disconnected"}
          </div>
        </div>

        <div className="terminal">
          {messages.map((msg) => (
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

        <div className="input-section">
          <div className="text-input">
            <input
              type="text"
              value={inputMode === "TEXT" ? inputText : inputHex}
              onChange={(e) =>
                inputMode === "TEXT"
                  ? this.setState({ inputText: e.target.value })
                  : this.setState({ inputHex: e.target.value })
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
