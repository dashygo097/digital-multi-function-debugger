import React from "react";

interface Message {
  timestamp: string;
  direction: "TX" | "RX" | "INFO" | "ERROR";
  data: string;
  id: string;
  source?: string;
}

interface UDPTerminalProps {
  className?: string;
  bridgeUrl?: string;
}

interface UDPTerminalState {
  // Connection
  wsConnected: boolean;
  localPort: number;
  fpgaHost: string;
  fpgaPort: number;
  isBound: boolean;

  // Messages
  messages: Message[];
  inputText: string;
  inputHex: string;
  inputMode: "TEXT" | "HEX";

  // Stats
  stats: {
    tx: number;
    rx: number;
    errors: number;
    lastRxTime?: string;
  };

  // Settings
  autoScroll: boolean;
  showHex: boolean;
  hexPrefix: "0x" | "\\x" | "";
}

export class UDPTerminal extends React.Component<
  UDPTerminalProps,
  UDPTerminalState
> {
  private ws: WebSocket | null = null;
  private terminalEndRef: React.RefObject<HTMLDivElement>;
  private reconnectTimer: NodeJS.Timeout | null = null;

  static defaultProps = {
    className: "fpga-udp-terminal",
    bridgeUrl: "ws://localhost:8080",
  };

  constructor(props: UDPTerminalProps) {
    super(props);
    this.terminalEndRef = React.createRef();
    this.state = {
      wsConnected: false,
      localPort: 8888,
      fpgaHost: "127.0.0.1",
      fpgaPort: 9999,
      isBound: false,
      messages: [],
      inputText: "",
      inputHex: "",
      inputMode: "TEXT",
      stats: { tx: 0, rx: 0, errors: 0 },
      autoScroll: false,
      showHex: false,
      hexPrefix: "0x",
    };
  }

  componentDidMount() {
    this.connectWebSocket();
  }

  componentWillUnmount() {
    this.disconnectWebSocket();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
  }

  componentDidUpdate(prevProps: UDPTerminalProps, prevState: UDPTerminalState) {
    if (
      this.state.autoScroll &&
      prevState.messages.length !== this.state.messages.length
    ) {
      this.terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }

  // Web Socket
  private connectWebSocket = () => {
    const { bridgeUrl } = this.props;

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log("WebSocket already connected, skipping");
      return;
    }

    try {
      this.addMessage("INFO", `Connecting to UDP bridge at ${bridgeUrl}...`);

      this.ws = new WebSocket(bridgeUrl!);

      this.ws.onopen = () => {
        console.log("WebSocket connected");
        this.setState({ wsConnected: true });
        this.addMessage("INFO", "✓ Connected to UDP bridge");

        // Request current status
        this.sendWSMessage({ type: "GET_STATUS", payload: {} });
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleWSMessage(data);
        } catch (error: any) {
          console.error("Failed to parse WebSocket message:", error);
        }
      };

      this.ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        this.addMessage("ERROR", "WebSocket connection error");
        this.setState((prev) => ({
          stats: { ...prev.stats, errors: prev.stats.errors + 1 },
        }));
      };

      this.ws.onclose = () => {
        console.log("WebSocket disconnected");
        this.setState({ wsConnected: false, isBound: false });
        this.addMessage("INFO", "Disconnected from UDP bridge");

        // Auto-reconnect after 3 seconds
        this.reconnectTimer = setTimeout(() => {
          this.addMessage("INFO", "Attempting to reconnect...");
          this.connectWebSocket();
        }, 3000);
      };
    } catch (error: any) {
      console.error("WebSocket connection failed:", error);
      this.addMessage("ERROR", `Connection failed: ${error.message}`);
    }
  };

  private disconnectWebSocket = () => {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  };

  private sendWSMessage = (data: any) => {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      this.addMessage("ERROR", "WebSocket not connected");
    }
  };

  private handleWSMessage = (data: any) => {
    const { type, payload } = data;

    switch (type) {
      case "STATUS":
        this.setState({
          isBound: payload.isBound,
          localPort: payload.localPort || this.state.localPort,
          fpgaHost: payload.remoteHost || this.state.fpgaHost,
          fpgaPort: payload.remotePort || this.state.fpgaPort,
        });
        break;

      case "BIND_SUCCESS":
        this.setState({ isBound: true });
        this.addMessage("INFO", `✓ Bound to port ${payload.localPort}`);
        break;

      case "REMOTE_SET":
        this.addMessage(
          "INFO",
          `✓ Remote set to ${payload.host}:${payload.port}`,
        );
        break;

      case "SEND_SUCCESS":
        this.setState((prev) => ({
          stats: { ...prev.stats, tx: prev.stats.tx + 1 },
        }));
        break;

      case "RECEIVE":
        this.handleReceive(payload);
        break;

      case "CLOSE_SUCCESS":
        this.setState({ isBound: false });
        this.addMessage("INFO", "✓ UDP socket closed");
        break;

      case "BROADCAST_SET":
        this.addMessage(
          "INFO",
          `Broadcast ${payload.enabled ? "enabled" : "disabled"}`,
        );
        break;

      case "ERROR":
        this.addMessage("ERROR", payload.message);
        this.setState((prev) => ({
          stats: { ...prev.stats, errors: prev.stats.errors + 1 },
        }));
        break;

      default:
        console.log("Unknown message type:", type);
    }
  };

  private handleReceive = (payload: any) => {
    const { data, remoteAddress, remotePort } = payload;
    const bytes = new Uint8Array(data);
    const text = new TextDecoder().decode(bytes);
    const source = `${remoteAddress}:${remotePort}`;

    console.log(`RX from ${source}:`, text);

    let displayText = text;
    if (this.state.showHex) {
      const hexStr = Array.from(bytes)
        .map((b) => {
          const hex = b.toString(16).padStart(2, "0");
          return `${this.state.hexPrefix}${hex}`;
        })
        .join(" ");
      displayText = `${text} [${hexStr}]`;
    }

    this.addMessage("RX", displayText, source);
    this.setState((prev) => ({
      stats: {
        ...prev.stats,
        rx: prev.stats.rx + 1,
        lastRxTime: new Date().toLocaleTimeString(),
      },
    }));
  };

  // UDP
  private bindUDP = () => {
    if (!this.state.wsConnected) {
      this.addMessage("ERROR", "Not connected to bridge");
      return;
    }

    this.addMessage("INFO", `Binding to port ${this.state.localPort}...`);
    this.sendWSMessage({
      type: "BIND",
      payload: { localPort: this.state.localPort },
    });

    // Set remote host/port
    this.sendWSMessage({
      type: "SET_REMOTE",
      payload: {
        host: this.state.fpgaHost,
        port: this.state.fpgaPort,
      },
    });
  };

  private closeUDP = () => {
    this.addMessage("INFO", "Closing UDP socket...");
    this.sendWSMessage({ type: "CLOSE", payload: {} });
  };

  private sendText = () => {
    const text = this.state.inputText.trim();
    if (!text) return;

    if (!this.state.isBound) {
      this.addMessage("ERROR", "UDP not bound");
      return;
    }

    const encoded = new TextEncoder().encode(text);
    const data = Array.from(encoded);

    console.log(
      `Sending to FPGA (${this.state.fpgaHost}:${this.state.fpgaPort}):`,
      text,
    );

    this.sendWSMessage({
      type: "SEND",
      payload: { data },
    });

    this.addMessage(
      "TX",
      text,
      `${this.state.fpgaHost}:${this.state.fpgaPort}`,
    );
    this.setState({ inputText: "" });
  };

  private sendHex = () => {
    const hex = this.state.inputHex.trim();
    if (!hex) return;

    if (!this.state.isBound) {
      this.addMessage("ERROR", "UDP not bound");
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
        return;
      }

      console.log(
        "Sending hex:",
        hexValues.map((b) => `0x${b.toString(16).padStart(2, "0")}`).join(" "),
      );

      this.sendWSMessage({
        type: "SEND",
        payload: { data: hexValues },
      });

      const hexDisplay = hexValues
        .map((b) => `0x${b.toString(16).padStart(2, "0")}`)
        .join(" ");

      this.addMessage(
        "TX",
        `[HEX] ${hexDisplay}`,
        `${this.state.fpgaHost}:${this.state.fpgaPort}`,
      );
      this.setState({ inputHex: "" });
    } catch (error: any) {
      this.addMessage("ERROR", `Hex send failed: ${error.message}`);
    }
  };

  // UI Helpers
  private addMessage = (
    direction: "TX" | "RX" | "INFO" | "ERROR",
    data: string,
    source?: string,
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
          source,
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
      .map((m) => {
        const source = m.source ? ` [${m.source}]` : "";
        return `[${m.timestamp}] ${m.direction}${source}: ${m.data}`;
      })
      .join("\n");

    const element = document.createElement("a");
    element.setAttribute(
      "href",
      "data:text/plain;charset=utf-8," + encodeURIComponent(log),
    );
    element.setAttribute("download", `fpga-udp-log-${Date.now()}.txt`);
    element.style.display = "none";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // ==================== Render ====================

  render() {
    const { className } = this.props;
    const {
      wsConnected,
      localPort,
      fpgaHost,
      fpgaPort,
      isBound,
      messages,
      inputText,
      inputHex,
      inputMode,
      stats,
      autoScroll,
      showHex,
      hexPrefix,
    } = this.state;

    return (
      <div className={className}>
        {/* Control Panel */}
        <div className="control-panel">
          <div className="section">
            <span
              className={`status-indicator ${wsConnected ? "connected" : "disconnected"}`}
            >
              {wsConnected ? "● Bridge Connected" : "○ Bridge Disconnected"}
            </span>
          </div>

          <div className="section">
            <label>Local Port:</label>
            <input
              type="number"
              value={localPort}
              onChange={(e) =>
                this.setState({ localPort: Number(e.target.value) })
              }
              disabled={isBound}
              min={1}
              max={65535}
            />
          </div>

          <div className="section">
            <label>FPGA IP:</label>
            <input
              type="text"
              value={fpgaHost}
              onChange={(e) => this.setState({ fpgaHost: e.target.value })}
              disabled={isBound}
              placeholder="192.168.1.100"
            />
            <label>FPGA Port:</label>
            <input
              type="number"
              value={fpgaPort}
              onChange={(e) =>
                this.setState({ fpgaPort: Number(e.target.value) })
              }
              disabled={isBound}
              min={1}
              max={65535}
            />
          </div>

          <div className="section">
            <label>Input Mode:</label>
            <select
              value={inputMode}
              onChange={(e) =>
                this.setState({ inputMode: e.target.value as any })
              }
              disabled={!isBound}
            >
              <option value="TEXT">Text</option>
              <option value="HEX">Hex</option>
            </select>

            <label>Hex Display:</label>
            <input
              type="checkbox"
              checked={showHex}
              onChange={(e) => this.setState({ showHex: e.target.checked })}
            />

            {showHex && (
              <>
                <label>Prefix:</label>
                <select
                  value={hexPrefix}
                  onChange={(e) =>
                    this.setState({ hexPrefix: e.target.value as any })
                  }
                >
                  <option value="0x">0x</option>
                  <option value="\x">\x</option>
                  <option value="">None</option>
                </select>
              </>
            )}
          </div>

          <div className="buttons">
            {!isBound ? (
              <button
                onClick={this.bindUDP}
                className="btn-primary"
                disabled={!wsConnected}
              >
                Bind & Connect to FPGA
              </button>
            ) : (
              <button onClick={this.closeUDP} className="btn-danger">
                Disconnect
              </button>
            )}

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

            <button onClick={this.clearTerminal}>Clear</button>
            <button onClick={this.exportLog}>Export Log</button>
          </div>

          <div className="stats">
            TX: {stats.tx} | RX: {stats.rx} | Errors: {stats.errors}
            {stats.lastRxTime && ` | Last RX: ${stats.lastRxTime}`}
          </div>
        </div>

        {/* Terminal */}
        <div className="terminal">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`message ${msg.direction.toLowerCase()}`}
            >
              <span className="timestamp">[{msg.timestamp}]</span>
              <span className="direction">{msg.direction}:</span>
              {msg.source && <span className="source">[{msg.source}]</span>}
              <span className="data">{msg.data}</span>
            </div>
          ))}
          <div ref={this.terminalEndRef} />
        </div>

        {/* Input Section */}
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
                  ? "Type message to send to FPGA..."
                  : "Hex: 01 02 03 or 0x01 0x02 0x03"
              }
              disabled={!isBound}
            />
            <button
              onClick={inputMode === "TEXT" ? this.sendText : this.sendHex}
              disabled={!isBound}
              className="btn-send"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    );
  }
}
