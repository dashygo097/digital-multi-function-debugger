import React, { Component, RefObject } from "react";
import { ProtocolContext, ConnectionState, PortInfo } from "../contexts";

interface SerialTerminalProps {
  className?: string;
}

interface SerialTerminalComponentState {
  inputText: string;
  inputHex: string;
}

export class SerialTerminal extends Component<
  SerialTerminalProps,
  SerialTerminalComponentState
> {
  static contextType = ProtocolContext;
  context!: React.ContextType<typeof ProtocolContext>;

  private terminalEndRef: RefObject<HTMLDivElement>;

  constructor(props: SerialTerminalProps) {
    super(props);
    this.state = {
      inputText: "",
      inputHex: "",
    };
    this.terminalEndRef = React.createRef<HTMLDivElement>();
  }

  componentDidUpdate() {
    const { serialTerminal } = this.context;
    if (serialTerminal.autoScroll) {
      this.terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }

  handleSend = () => {
    const { serialTerminal, serialSend, serialSendHex } = this.context;
    if (serialTerminal.inputMode === "TEXT") {
      serialSend(this.state.inputText);
      this.setState({ inputText: "" });
    } else {
      serialSendHex(this.state.inputHex);
      this.setState({ inputHex: "" });
    }
  };

  handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      this.handleSend();
    }
  };

  clearTerminal = () => {
    this.context.updateSerialTerminal({
      messages: [],
      stats: { tx: 0, rx: 0, errors: 0 },
    });
  };

  getPortIdentifier = (portInfo: PortInfo): string => {
    if (!portInfo.usbVendorId || !portInfo.usbProductId) {
      return "Unknown Port";
    }
    return `VID_0x${portInfo.usbVendorId.toString(16).padStart(4, "0")}_PID_0x${portInfo.usbProductId.toString(16).padStart(4, "0")}`;
  };

  render() {
    const { className } = this.props;
    const { inputText, inputHex } = this.state;
    const {
      serialTerminal,
      updateSerialTerminal,
      resetSerialTerminal,
      serialConnect,
      serialDisconnect,
    } = this.context;

    const isConnected =
      serialTerminal.connectionState === ConnectionState.CONNECTED;

    return (
      <div className={`terminal-container ${className || "serial-terminal"}`}>
        <div className="control-panel">
          <div className="section">
            <span
              className={`status-indicator ${isConnected ? "connected" : "disconnected"}`}
            >
              ● {serialTerminal.connectionState}
            </span>
            {serialTerminal.selectedPortInfo && isConnected && (
              <span className="port-info">
                ({this.getPortIdentifier(serialTerminal.selectedPortInfo)})
              </span>
            )}
          </div>
          <div className="section">
            <label>Available Ports:</label>
            <div className="port-selector">
              <select
                value={serialTerminal.selectedPortName}
                onChange={(e) =>
                  updateSerialTerminal({ selectedPortName: e.target.value })
                }
                disabled={isConnected}
              >
                <option value="">-- Request or Select a Port --</option>
                {serialTerminal.availablePorts.map((port, index) => {
                  const id = this.getPortIdentifier(port);
                  return (
                    <option key={index} value={id}>
                      {id}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
          <div className="section">
            <label>Baud Rate:</label>
            <select
              value={serialTerminal.baudRate}
              onChange={(e) =>
                updateSerialTerminal({ baudRate: Number(e.target.value) })
              }
              disabled={isConnected}
            >
              <option value="9600">9600</option>
              <option value="19200">19200</option>
              <option value="38400">38400</option>
              <option value="57600">57600</option>
              <option value="115200">115200</option>
            </select>
          </div>
          <div className="section">
            <label>Line Ending (for Text mode):</label>
            <select
              value={serialTerminal.lineEnding}
              onChange={(e) =>
                updateSerialTerminal({ lineEnding: e.target.value as any })
              }
            >
              <option value="NONE">None</option>
              <option value="LF">LF (\n)</option>
              <option value="CR">CR (\r)</option>
              <option value="CRLF">CRLF (\r\n)</option>
            </select>
          </div>
          <div className="section">
            <label>I/O Settings</label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={serialTerminal.showHex}
                onChange={(e) =>
                  updateSerialTerminal({ showHex: e.target.checked })
                }
              />
              Show RX as Hex
            </label>
            <select
              value={serialTerminal.inputMode}
              onChange={(e) =>
                updateSerialTerminal({ inputMode: e.target.value as any })
              }
              disabled={!isConnected}
            >
              <option value="TEXT">Input as Text</option>
              <option value="HEX">Input as Hex</option>
            </select>
          </div>
          <div className="buttons">
            {!isConnected ? (
              <button onClick={serialConnect} className="btn-primary">
                {serialTerminal.selectedPortName ? "Connect" : "Request Port"}
              </button>
            ) : (
              <button
                onClick={() => serialDisconnect(false)}
                className="btn-danger"
              >
                Disconnect
              </button>
            )}
            <button onClick={this.clearTerminal}>Clear</button>
            <button onClick={resetSerialTerminal}>Reset</button>
          </div>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={serialTerminal.autoScroll}
              onChange={(e) =>
                updateSerialTerminal({ autoScroll: e.target.checked })
              }
            />
            Auto-scroll
          </label>
          <div className="stats">
            TX: {serialTerminal.stats.tx} | RX: {serialTerminal.stats.rx} |
            Errors: {serialTerminal.stats.errors}
          </div>
        </div>

        <div className="terminal">
          {serialTerminal.messages.map((msg) => (
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
              value={serialTerminal.inputMode === "TEXT" ? inputText : inputHex}
              onChange={(e) => {
                if (serialTerminal.inputMode === "TEXT") {
                  this.setState({ inputText: e.target.value });
                } else {
                  this.setState({ inputHex: e.target.value });
                }
              }}
              onKeyPress={this.handleKeyPress}
              placeholder={
                serialTerminal.inputMode === "TEXT"
                  ? "Type message and press Enter..."
                  : "Enter hex bytes separated by space (e.g., 48 65 6C 6C 6F)"
              }
              disabled={!isConnected}
            />
            <button
              onClick={this.handleSend}
              disabled={!isConnected}
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
