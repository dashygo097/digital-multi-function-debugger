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
  terminalContext?: any;
}

interface SerialTerminalState {
  ports: SerialPort[];
  selectedPort: SerialPort | null;
}

// ==================== FSM States & Events ====================

enum ConnectionState {
  DISCONNECTED = "DISCONNECTED",
  CONNECTING = "CONNECTING",
  CONNECTED = "CONNECTED",
  DISCONNECTING = "DISCONNECTING",
  ERROR = "ERROR",
}

enum ConnectionEvent {
  CONNECT = "CONNECT",
  CONNECTION_SUCCESS = "CONNECTION_SUCCESS",
  CONNECTION_FAILED = "CONNECTION_FAILED",
  DISCONNECT = "DISCONNECT",
  DISCONNECTION_COMPLETE = "DISCONNECTION_COMPLETE",
  DEVICE_DISCONNECTED = "DEVICE_DISCONNECTED",
}

// ==================== Global Serial Connection Singleton ====================

class GlobalSerialConnection {
  private static instance: GlobalSerialConnection;

  // Connection resources
  public port: SerialPort | null = null;
  public writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  public reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

  // State
  public state: ConnectionState = ConnectionState.DISCONNECTED;
  public keepReading = false;

  // Callbacks
  private messageCallbacks: Set<(msg: Message) => void> = new Set();
  private stateCallbacks: Set<(state: ConnectionState) => void> = new Set();

  private constructor() {}

  static getInstance(): GlobalSerialConnection {
    if (!GlobalSerialConnection.instance) {
      GlobalSerialConnection.instance = new GlobalSerialConnection();
    }
    return GlobalSerialConnection.instance;
  }

  // ==================== FSM State Machine ====================

  async handleEvent(event: ConnectionEvent, data?: any): Promise<void> {
    const currentState = this.state;
    console.log(`🔄 FSM: ${currentState} + ${event}`);

    switch (currentState) {
      case ConnectionState.DISCONNECTED:
        if (event === ConnectionEvent.CONNECT) {
          this.setState(ConnectionState.CONNECTING);
          await this.performConnect(data.port, data.baudRate);
        }
        break;

      case ConnectionState.CONNECTING:
        if (event === ConnectionEvent.CONNECTION_SUCCESS) {
          this.setState(ConnectionState.CONNECTED);
          this.notifyMessage("INFO", "✓ Connected successfully");
        } else if (event === ConnectionEvent.CONNECTION_FAILED) {
          this.setState(ConnectionState.ERROR);
          this.notifyMessage("ERROR", `❌ Connection failed: ${data?.error}`);
          setTimeout(() => this.setState(ConnectionState.DISCONNECTED), 2000);
        }
        break;

      case ConnectionState.CONNECTED:
        if (event === ConnectionEvent.DISCONNECT) {
          this.setState(ConnectionState.DISCONNECTING);
          await this.performDisconnect();
        } else if (event === ConnectionEvent.DEVICE_DISCONNECTED) {
          this.setState(ConnectionState.DISCONNECTING);
          this.notifyMessage("ERROR", "Device disconnected");
          await this.performDisconnect();
        }
        break;

      case ConnectionState.DISCONNECTING:
        if (event === ConnectionEvent.DISCONNECTION_COMPLETE) {
          this.setState(ConnectionState.DISCONNECTED);
          this.notifyMessage("INFO", "✓ Disconnected");
        }
        break;

      case ConnectionState.ERROR:
        if (event === ConnectionEvent.CONNECT) {
          this.setState(ConnectionState.CONNECTING);
          await this.performConnect(data.port, data.baudRate);
        }
        break;
    }
  }

  // ==================== Connection Operations ====================

  private async performConnect(
    port: SerialPort,
    baudRate: number,
  ): Promise<void> {
    try {
      await port.open({
        baudRate,
        dataBits: 8,
        stopBits: 1,
        parity: "none",
        flowControl: "none",
        bufferSize: 4096,
      });

      try {
        await port.setSignals({
          dataTerminalReady: true,
          requestToSend: true,
        });
      } catch (e) {
        console.log("Could not set signals:", e);
      }

      this.port = port;
      this.writer = port.writable!.getWriter();
      this.reader = port.readable!.getReader();
      this.keepReading = true;

      this.readLoop();

      await this.handleEvent(ConnectionEvent.CONNECTION_SUCCESS);
    } catch (error: any) {
      await this.handleEvent(ConnectionEvent.CONNECTION_FAILED, {
        error: error.message,
      });
      await this.cleanup();
    }
  }

  private async performDisconnect(): Promise<void> {
    await this.cleanup();
    await this.handleEvent(ConnectionEvent.DISCONNECTION_COMPLETE);
  }

  private async cleanup(): Promise<void> {
    this.keepReading = false;

    if (this.reader) {
      try {
        await this.reader.cancel();
      } catch (e) {}
      try {
        this.reader.releaseLock();
      } catch (e) {}
      this.reader = null;
    }

    if (this.writer) {
      try {
        await this.writer.releaseLock();
      } catch (e) {}
      this.writer = null;
    }

    if (this.port) {
      try {
        await this.port.close();
      } catch (e) {}
      this.port = null;
    }
  }

  // ==================== Read Loop ====================

  private async readLoop(): Promise<void> {
    if (!this.reader) return;

    try {
      while (this.keepReading) {
        const { value, done } = await this.reader.read();

        if (done) break;

        if (value && value.length > 0) {
          const displayText = new TextDecoder().decode(value);
          this.notifyMessage("RX", displayText);
        }
      }
    } catch (error: any) {
      if (this.keepReading) {
        if (error.name === "NetworkError" || error.name === "NotFoundError") {
          await this.handleEvent(ConnectionEvent.DEVICE_DISCONNECTED);
        } else if (error.name !== "AbortError") {
          this.notifyMessage("ERROR", `Read error: ${error.message}`);
        }
      }
    }
  }

  // ==================== Send Data ====================

  async send(data: Uint8Array): Promise<void> {
    if (this.state !== ConnectionState.CONNECTED || !this.writer) {
      throw new Error("Not connected");
    }

    try {
      await this.writer.write(data);
    } catch (error: any) {
      if (error.name === "NetworkError" || error.name === "NotFoundError") {
        await this.handleEvent(ConnectionEvent.DEVICE_DISCONNECTED);
      }
      throw error;
    }
  }

  // ==================== Callbacks ====================

  private setState(state: ConnectionState): void {
    this.state = state;
    this.stateCallbacks.forEach((cb) => cb(state));
  }

  private notifyMessage(
    direction: "TX" | "RX" | "INFO" | "ERROR",
    data: string,
  ): void {
    const msg: Message = {
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
    this.messageCallbacks.forEach((cb) => cb(msg));
  }

  subscribeMessages(callback: (msg: Message) => void): void {
    this.messageCallbacks.add(callback);
  }

  unsubscribeMessages(callback: (msg: Message) => void): void {
    this.messageCallbacks.delete(callback);
  }

  subscribeState(callback: (state: ConnectionState) => void): void {
    this.stateCallbacks.add(callback);
  }

  unsubscribeState(callback: (state: ConnectionState) => void): void {
    this.stateCallbacks.delete(callback);
  }
}

// ==================== Serial Terminal Component ====================

class SerialTerminalBase extends React.Component<
  SerialTerminalProps,
  SerialTerminalState
> {
  private terminalEndRef: React.RefObject<HTMLDivElement>;
  private terminalRef: React.RefObject<HTMLDivElement>;
  private connection: GlobalSerialConnection;
  private refreshInterval: NodeJS.Timeout | null = null;

  static defaultProps = {
    className: "serial-terminal",
  };

  constructor(props: SerialTerminalProps) {
    super(props);
    this.terminalEndRef = React.createRef();
    this.terminalRef = React.createRef();
    this.connection = GlobalSerialConnection.getInstance();

    this.state = {
      ports: [],
      selectedPort: this.connection.port,
    };
  }

  private updateContext = (updates: any) => {
    this.props.terminalContext?.updateSerialTerminal(updates);
  };

  private getContextState = () => {
    return this.props.terminalContext?.serialTerminal || {};
  };

  // ==================== Lifecycle ====================

  async componentDidMount() {
    console.log("=== SerialTerminal componentDidMount ===");

    // Subscribe to connection events
    this.connection.subscribeMessages(this.handleMessage);
    this.connection.subscribeState(this.handleStateChange);

    await this.refreshPorts();
    this.startAutoRefresh();

    // Sync state
    this.forceUpdate();
  }

  componentWillUnmount() {
    console.log("=== SerialTerminal componentWillUnmount ===");

    // Unsubscribe
    this.connection.unsubscribeMessages(this.handleMessage);
    this.connection.unsubscribeState(this.handleStateChange);

    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }

    // DO NOT disconnect - keep connection alive!
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

  // ==================== Event Handlers ====================

  private handleMessage = (msg: Message) => {
    const currentMessages = this.getContextState().messages || [];
    this.updateContext({
      messages: [...currentMessages, msg],
    });

    if (msg.direction === "RX") {
      const stats = this.getContextState().stats || { tx: 0, rx: 0, errors: 0 };
      this.updateContext({
        stats: { ...stats, rx: stats.rx + 1 },
      });
    }
  };

  private handleStateChange = (state: ConnectionState) => {
    console.log("State changed:", state);
    this.forceUpdate();
  };

  // ==================== User Actions ====================

  private handleConnect = async () => {
    if (!this.state.selectedPort) {
      this.addMessage("ERROR", "Please select a port first");
      return;
    }

    const baudRate = this.getContextState().baudRate || 115200;

    await this.connection.handleEvent(ConnectionEvent.CONNECT, {
      port: this.state.selectedPort,
      baudRate,
    });
  };

  private handleDisconnect = async () => {
    await this.connection.handleEvent(ConnectionEvent.DISCONNECT);
  };

  // ==================== Port Management ====================

  private startAutoRefresh = () => {
    this.refreshInterval = setInterval(() => {
      if (this.connection.state === ConnectionState.DISCONNECTED) {
        this.refreshPorts();
      }
    }, 2000);
  };

  private refreshPorts = async () => {
    try {
      const ports = await navigator.serial.getPorts();
      this.setState({ ports });
    } catch (error) {
      console.error("Error refreshing ports:", error);
    }
  };

  private requestPort = async () => {
    try {
      const port = await navigator.serial.requestPort();
      await this.refreshPorts();
      this.setState({ selectedPort: port });
      this.updateContext({
        selectedPortName: this.getPortDisplayName(port),
      });
      this.addMessage("INFO", "✓ New port authorized and selected");
    } catch (error: any) {
      if (error.name !== "NotFoundError") {
        console.error("Error requesting port:", error);
        this.addMessage("ERROR", `Failed to request port: ${error.message}`);
      }
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
    if (this.connection.state === ConnectionState.CONNECTED) return;

    if (index >= 0 && index < this.state.ports.length) {
      const port = this.state.ports[index];
      this.setState({ selectedPort: port });
      this.updateContext({
        selectedPortName: this.getPortDisplayName(port),
      });
    } else {
      this.setState({ selectedPort: null });
      this.updateContext({ selectedPortName: "" });
    }
  };

  // ==================== Send/Receive ====================

  private sendText = async () => {
    const text = this.getContextState().inputText?.trim() || "";
    if (!text) return;

    try {
      const dataToSend = text + this.getLineEnding();
      const encoded = new TextEncoder().encode(dataToSend);

      await this.connection.send(encoded);

      this.addMessage("TX", text);
      const stats = this.getContextState().stats || { tx: 0, rx: 0, errors: 0 };
      this.updateContext({
        stats: { ...stats, tx: stats.tx + 1 },
        inputText: "",
      });
    } catch (error: any) {
      this.addMessage("ERROR", `Send failed: ${error.message}`);
      const stats = this.getContextState().stats || { tx: 0, rx: 0, errors: 0 };
      this.updateContext({
        stats: { ...stats, errors: stats.errors + 1 },
      });
    }
  };

  private sendHex = async () => {
    const hex = this.getContextState().inputHex?.trim() || "";
    if (!hex) return;

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

      const bytes = new Uint8Array(hexValues);
      await this.connection.send(bytes);

      const hexDisplay = Array.from(bytes)
        .map((b) => `0x${b.toString(16).padStart(2, "0")}`)
        .join(" ");
      this.addMessage("TX", `[HEX] ${hexDisplay}`);
      const stats = this.getContextState().stats || { tx: 0, rx: 0, errors: 0 };
      this.updateContext({
        stats: { ...stats, tx: stats.tx + 1 },
        inputHex: "",
      });
    } catch (error: any) {
      this.addMessage("ERROR", `Hex send failed: ${error.message}`);
      const stats = this.getContextState().stats || { tx: 0, rx: 0, errors: 0 };
      this.updateContext({
        stats: { ...stats, errors: stats.errors + 1 },
      });
    }
  };

  // Helper method to send raw bytes (for CSR page)
  public async sendBytes(bytes: Uint8Array): Promise<void> {
    return this.connection.send(bytes);
  }

  private getLineEnding = (): string => {
    const endings = { NONE: "", LF: "\n", CR: "\r", CRLF: "\r\n" };
    return endings[this.getContextState().lineEnding] || "";
  };

  // ==================== UI Helpers ====================

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

  private addMessage = (
    direction: "TX" | "RX" | "INFO" | "ERROR",
    data: string,
  ) => {
    const msg: Message = {
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
      messages: [...currentMessages, msg],
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

  // ==================== Render ====================

  render() {
    const { className } = this.props;
    const contextState = this.getContextState();
    const {
      selectedPortName = "",
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

    const connectionState = this.connection.state;
    const isConnected = connectionState === ConnectionState.CONNECTED;
    const isConnecting = connectionState === ConnectionState.CONNECTING;
    const isDisconnecting = connectionState === ConnectionState.DISCONNECTING;

    return (
      <div className={className}>
        <div className="control-panel">
          <div className="section">
            <label>
              {connectionState === ConnectionState.CONNECTED && "✓ Connected"}
              {connectionState === ConnectionState.CONNECTING &&
                "⏳ Connecting..."}
              {connectionState === ConnectionState.DISCONNECTING &&
                "⏳ Disconnecting..."}
              {connectionState === ConnectionState.DISCONNECTED &&
                "○ Disconnected"}
              {connectionState === ConnectionState.ERROR && "❌ Error"}
            </label>
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
                disabled={isConnected || isConnecting}
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
              <button
                onClick={this.refreshPorts}
                disabled={isConnected || isConnecting}
                title="Refresh port list"
              >
                🔄
              </button>
              <button
                onClick={this.requestPort}
                disabled={isConnected || isConnecting}
                title="Request new port"
              >
                ➕
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
              disabled={isConnected || isConnecting}
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
            {!isConnected && !isConnecting && !isDisconnecting ? (
              <button
                onClick={this.handleConnect}
                className="btn-primary"
                disabled={!this.state.selectedPort}
              >
                Connect
              </button>
            ) : isConnecting || isDisconnecting ? (
              <button className="btn-primary" disabled>
                {isConnecting ? "Connecting..." : "Disconnecting..."}
              </button>
            ) : (
              <button onClick={this.handleDisconnect} className="btn-danger">
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
          {!autoScroll && newMessagesCount > 0 && (
            <div className="new-messages-badge visible">
              +{newMessagesCount} new
            </div>
          )}

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

// Export singleton for external access (e.g., from CSR page)
export { GlobalSerialConnection, ConnectionState };
