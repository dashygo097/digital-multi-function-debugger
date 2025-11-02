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

// FSM States
enum ConnectionState {
  DISCONNECTED = "DISCONNECTED",
  CONNECTING = "CONNECTING",
  CONNECTED = "CONNECTED",
  DISCONNECTING = "DISCONNECTING",
  RECONNECTING = "RECONNECTING",
  ERROR = "ERROR",
}

// FSM Events
enum ConnectionEvent {
  CONNECT = "CONNECT",
  DISCONNECT = "DISCONNECT",
  CONNECTION_SUCCESS = "CONNECTION_SUCCESS",
  CONNECTION_FAILED = "CONNECTION_FAILED",
  DEVICE_DISCONNECTED = "DEVICE_DISCONNECTED",
  AUTO_RECONNECT = "AUTO_RECONNECT",
  RECONNECT_FAILED = "RECONNECT_FAILED",
}

interface SerialTerminalState {
  ports: SerialPort[];
  selectedPort: SerialPort | null;
  connectionState: ConnectionState;
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
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;

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
      connectionState: ConnectionState.DISCONNECTED,
    };
  }

  private updateContext = (updates: any) => {
    this.props.terminalContext?.updateSerialTerminal(updates);
  };

  private getContextState = () => {
    return this.props.terminalContext?.serialTerminal || {};
  };

  // ==================== FSM State Machine ====================

  private handleConnectionEvent = async (event: ConnectionEvent) => {
    const currentState = this.state.connectionState;
    console.log(`🔄 FSM: ${currentState} + ${event}`);

    switch (currentState) {
      case ConnectionState.DISCONNECTED:
        if (event === ConnectionEvent.CONNECT) {
          this.setState({ connectionState: ConnectionState.CONNECTING });
          await this.performConnect();
        } else if (event === ConnectionEvent.AUTO_RECONNECT) {
          this.setState({ connectionState: ConnectionState.RECONNECTING });
          await this.performReconnect();
        }
        break;

      case ConnectionState.CONNECTING:
        if (event === ConnectionEvent.CONNECTION_SUCCESS) {
          this.setState({ connectionState: ConnectionState.CONNECTED });
          this.reconnectAttempts = 0;
          this.addMessage("INFO", "✓ Connected successfully");
        } else if (event === ConnectionEvent.CONNECTION_FAILED) {
          this.setState({ connectionState: ConnectionState.ERROR });
          this.addMessage("ERROR", "❌ Connection failed");
          setTimeout(() => {
            this.setState({ connectionState: ConnectionState.DISCONNECTED });
          }, 1000);
        }
        break;

      case ConnectionState.CONNECTED:
        if (event === ConnectionEvent.DISCONNECT) {
          this.setState({ connectionState: ConnectionState.DISCONNECTING });
          await this.performDisconnect(false); // false = user initiated
        } else if (event === ConnectionEvent.DEVICE_DISCONNECTED) {
          this.setState({ connectionState: ConnectionState.DISCONNECTING });
          await this.performDisconnect(true); // true = device disconnected
        }
        break;

      case ConnectionState.DISCONNECTING:
        // After disconnect completes, transition based on context
        this.setState({ connectionState: ConnectionState.DISCONNECTED });
        break;

      case ConnectionState.RECONNECTING:
        if (event === ConnectionEvent.CONNECTION_SUCCESS) {
          this.setState({ connectionState: ConnectionState.CONNECTED });
          this.reconnectAttempts = 0;
          this.addMessage("INFO", "✓ Reconnected successfully");
        } else if (event === ConnectionEvent.RECONNECT_FAILED) {
          this.reconnectAttempts++;
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.addMessage(
              "INFO",
              `⏳ Retry ${this.reconnectAttempts}/${this.maxReconnectAttempts}...`,
            );
            setTimeout(() => this.performReconnect(), 2000);
          } else {
            this.setState({ connectionState: ConnectionState.ERROR });
            this.addMessage(
              "ERROR",
              "❌ Reconnection failed after max attempts",
            );
            this.updateContext({ shouldAutoReconnect: false });
            setTimeout(() => {
              this.setState({ connectionState: ConnectionState.DISCONNECTED });
            }, 1000);
          }
        }
        break;

      case ConnectionState.ERROR:
        // Can only reset from error state
        if (event === ConnectionEvent.CONNECT) {
          this.reconnectAttempts = 0;
          this.setState({ connectionState: ConnectionState.CONNECTING });
          await this.performConnect();
        }
        break;
    }
  };

  // ==================== Lifecycle Methods ====================

  async componentDidMount() {
    console.log("=== SerialTerminal componentDidMount ===");

    await this.refreshPorts();
    this.startAutoRefresh();

    // Check if we should auto-reconnect
    const contextState = this.getContextState();
    if (contextState.shouldAutoReconnect && contextState.selectedPortInfo) {
      console.log("🔄 Auto-reconnect enabled");
      setTimeout(() => {
        this.handleConnectionEvent(ConnectionEvent.AUTO_RECONNECT);
      }, 1000);
    }
  }

  componentWillUnmount() {
    console.log("=== SerialTerminal componentWillUnmount ===");

    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }

    // Save state if connected
    if (this.state.connectionState === ConnectionState.CONNECTED) {
      const port = this.state.selectedPort;
      const portInfo = port?.getInfo();

      console.log("💾 Saving connection info for auto-reconnect");
      this.updateContext({
        shouldAutoReconnect: true,
        selectedPortInfo: portInfo,
        isConnected: false,
      });

      this.shouldStopRef = true;
      this.keepReading = false;
      this.cleanupConnectionSync();
    }
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

  // ==================== Connection Operations ====================

  private performConnect = async () => {
    if (!this.state.selectedPort) {
      this.addMessage("ERROR", "No port selected");
      await this.handleConnectionEvent(ConnectionEvent.CONNECTION_FAILED);
      return;
    }

    try {
      const port = this.state.selectedPort;
      const baudRate = this.getContextState().baudRate || 115200;

      this.addMessage("INFO", `Connecting at ${baudRate} baud...`);

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

      this.shouldStopRef = false;
      this.keepReading = true;

      this.writerRef = port.writable!.getWriter();
      this.readerRef = port.readable!.getReader();

      this.readLoop();

      const portInfo = port.getInfo();
      this.updateContext({
        isConnected: true,
        selectedPortInfo: portInfo,
        shouldAutoReconnect: true,
      });

      await this.handleConnectionEvent(ConnectionEvent.CONNECTION_SUCCESS);
    } catch (error: any) {
      console.error("Connection error:", error);
      this.addMessage("ERROR", `Connection failed: ${error.message}`);
      await this.cleanupConnection();
      await this.handleConnectionEvent(ConnectionEvent.CONNECTION_FAILED);
    }
  };

  private performReconnect = async () => {
    const contextState = this.getContextState();
    const { selectedPortInfo } = contextState;

    if (!selectedPortInfo) {
      await this.handleConnectionEvent(ConnectionEvent.RECONNECT_FAILED);
      return;
    }

    try {
      this.addMessage(
        "INFO",
        `🔄 Reconnecting (attempt ${this.reconnectAttempts + 1})...`,
      );

      const ports = await navigator.serial.getPorts();
      const matchingPort = ports.find((port) => {
        const info = port.getInfo();
        return (
          info.usbVendorId === selectedPortInfo.usbVendorId &&
          info.usbProductId === selectedPortInfo.usbProductId
        );
      });

      if (!matchingPort) {
        this.addMessage("ERROR", "Previous port not found");
        await this.handleConnectionEvent(ConnectionEvent.RECONNECT_FAILED);
        return;
      }

      this.setState({
        selectedPort: matchingPort,
        ports: ports,
      });

      this.updateContext({
        selectedPortName: this.getPortDisplayName(matchingPort),
      });

      await new Promise((r) => setTimeout(r, 300));
      await this.performConnect();
    } catch (error: any) {
      console.error("Reconnect error:", error);
      this.addMessage("ERROR", `Reconnect failed: ${error.message}`);
      await this.handleConnectionEvent(ConnectionEvent.RECONNECT_FAILED);
    }
  };

  private performDisconnect = async (isDeviceDisconnected: boolean) => {
    console.log(`Disconnecting (device=${isDeviceDisconnected})`);

    if (isDeviceDisconnected) {
      this.addMessage("ERROR", "Device disconnected");
    } else {
      this.addMessage("INFO", "Disconnecting...");
    }

    await this.cleanupConnection();

    this.updateContext({
      isConnected: false,
      shouldAutoReconnect: isDeviceDisconnected, // Only auto-reconnect if device disconnected
    });

    if (!isDeviceDisconnected) {
      this.addMessage("INFO", "✓ Disconnected");
    }

    await this.handleConnectionEvent(ConnectionEvent.DISCONNECT);
  };

  // ==================== Serial Port Operations ====================

  private readLoop = async () => {
    const reader = this.readerRef;
    if (!reader) return;

    console.log("Read loop started");

    try {
      while (this.keepReading) {
        const { value, done } = await reader.read();

        if (done) break;

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

          this.addMessage("RX", displayText);
          const stats = this.getContextState().stats;
          this.updateContext({
            stats: { ...stats, rx: stats.rx + 1 },
          });
        }
      }
    } catch (error: any) {
      if (this.shouldStopRef) return;

      if (error.name === "NetworkError" || error.name === "NotFoundError") {
        await this.handleConnectionEvent(ConnectionEvent.DEVICE_DISCONNECTED);
      } else if (error.name !== "AbortError") {
        console.error("Read error:", error);
        this.addMessage("ERROR", `Read error: ${error.message}`);
      }
    }
  };

  private cleanupConnectionSync = () => {
    console.log("=== Sync cleanup ===");

    try {
      if (this.readerRef) {
        this.readerRef.releaseLock();
        this.readerRef = null;
      }
    } catch (e) {
      console.log("Reader release error:", e);
    }

    try {
      if (this.writerRef) {
        this.writerRef.releaseLock();
        this.writerRef = null;
      }
    } catch (e) {
      console.log("Writer release error:", e);
    }

    try {
      if (this.state.selectedPort) {
        this.state.selectedPort.close();
      }
    } catch (e) {
      console.log("Port close error:", e);
    }
  };

  private cleanupConnection = async () => {
    console.log("=== Async cleanup ===");

    this.shouldStopRef = true;
    this.keepReading = false;

    await new Promise((r) => setTimeout(r, 100));

    if (this.readerRef) {
      try {
        await this.readerRef.cancel();
      } catch (e) {}
      try {
        this.readerRef.releaseLock();
      } catch (e) {}
      this.readerRef = null;
    }

    if (this.writerRef) {
      try {
        await this.writerRef.releaseLock();
      } catch (e) {}
      this.writerRef = null;
    }

    if (this.state.selectedPort) {
      try {
        await this.state.selectedPort.close();
      } catch (e) {}
    }
  };

  // ==================== User Actions ====================

  private handleConnect = () => {
    this.handleConnectionEvent(ConnectionEvent.CONNECT);
  };

  private handleDisconnect = () => {
    this.handleConnectionEvent(ConnectionEvent.DISCONNECT);
  };

  // ==================== Helper Methods ====================

  private startAutoRefresh = () => {
    this.refreshInterval = setInterval(() => {
      if (this.state.connectionState !== ConnectionState.CONNECTED) {
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

  private getPortDisplayName = (port: SerialPort): string => {
    const info = port.getInfo();
    if (info.usbVendorId && info.usbProductId) {
      return `USB Device (VID: 0x${info.usbVendorId.toString(16).padStart(4, "0")}, PID: 0x${info.usbProductId.toString(16).padStart(4, "0")})`;
    }
    return "Serial Port";
  };

  private handlePortSelection = (index: number) => {
    if (this.state.connectionState === ConnectionState.CONNECTED) return;

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

  private getLineEnding = (): string => {
    const endings = { NONE: "", LF: "\n", CR: "\r", CRLF: "\r\n" };
    return endings[this.getContextState().lineEnding] || "";
  };

  private sendText = async () => {
    const text = this.getContextState().inputText?.trim() || "";
    if (!text || this.state.connectionState !== ConnectionState.CONNECTED)
      return;

    try {
      const dataToSend = text + this.getLineEnding();
      const encoded = new TextEncoder().encode(dataToSend);

      await this.writerRef!.write(encoded);

      this.addMessage("TX", text);
      const stats = this.getContextState().stats;
      this.updateContext({
        stats: { ...stats, tx: stats.tx + 1 },
        inputText: "",
      });
    } catch (error: any) {
      console.error("Send error:", error);
      this.addMessage("ERROR", `Send failed: ${error.message}`);
    }
  };

  private sendHex = async () => {
    const hex = this.getContextState().inputHex?.trim() || "";
    if (!hex || this.state.connectionState !== ConnectionState.CONNECTED)
      return;

    try {
      const hexValues = hex
        .split(/[\s,]+/)
        .filter((x) => x.length > 0)
        .map((x) => {
          const cleaned = x.replace(/^0x/i, "").replace(/^\\x/i, "");
          return parseInt(cleaned, 16);
        });

      if (hexValues.some(isNaN) || hexValues.some((v) => v < 0 || v > 255)) {
        this.addMessage("ERROR", "Invalid hex format");
        return;
      }

      const bytes = new Uint8Array(hexValues);
      await this.writerRef!.write(bytes);

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
      shouldAutoReconnect = false,
    } = contextState;

    const { connectionState } = this.state;
    const isConnected = connectionState === ConnectionState.CONNECTED;
    const isConnecting =
      connectionState === ConnectionState.CONNECTING ||
      connectionState === ConnectionState.RECONNECTING;

    return (
      <div className={className}>
        <div className="control-panel">
          <div className="section">
            <label>
              {connectionState === ConnectionState.CONNECTED && "✓ Connected"}
              {connectionState === ConnectionState.CONNECTING &&
                "⏳ Connecting..."}
              {connectionState === ConnectionState.RECONNECTING &&
                "🔄 Reconnecting..."}
              {connectionState === ConnectionState.DISCONNECTING &&
                "⏳ Disconnecting..."}
              {connectionState === ConnectionState.DISCONNECTED &&
                "○ Disconnected"}
              {connectionState === ConnectionState.ERROR && "❌ Error"}
              {shouldAutoReconnect &&
                connectionState === ConnectionState.DISCONNECTED &&
                " (Will auto-reconnect)"}
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
              >
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
            {!isConnected && !isConnecting ? (
              <button
                onClick={this.handleConnect}
                className="btn-primary"
                disabled={!this.state.selectedPort}
              >
                Connect
              </button>
            ) : isConnecting ? (
              <button className="btn-primary" disabled>
                {connectionState === ConnectionState.RECONNECTING
                  ? "Reconnecting..."
                  : "Connecting..."}
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
