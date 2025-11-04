import React, { Component, RefObject } from "react";
import { ProtocolContext } from "../contexts";

interface UDPTerminalProps {
  className?: string;
}

interface UDPTerminalComponentState {
  inputText: string;
  inputHex: string;
}

export class UDPTerminal extends Component<
  UDPTerminalProps,
  UDPTerminalComponentState
> {
  static contextType = ProtocolContext;
  context!: React.ContextType<typeof ProtocolContext>;

  private terminalEndRef: RefObject<HTMLDivElement>;

  constructor(props: UDPTerminalProps) {
    super(props);
    this.state = {
      inputText: "",
      inputHex: "",
    };
    this.terminalEndRef = React.createRef<HTMLDivElement>();
  }

  componentDidUpdate(
    prevProps: UDPTerminalProps,
    prevState: UDPTerminalComponentState,
  ) {
    const { udpTerminal } = this.context;
    const prevMessages = this.context.udpTerminal?.messages || [];
    if (
      udpTerminal.autoScroll &&
      udpTerminal.messages.length !== prevMessages.length
    ) {
      this.terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }

  handleSend = () => {
    const { udpTerminal, udpSendText, udpSendHex } = this.context;
    if (udpTerminal.inputMode === "TEXT") {
      udpSendText(this.state.inputText);
      this.setState({ inputText: "" });
    } else {
      udpSendHex(this.state.inputHex);
      this.setState({ inputHex: "" });
    }
  };

  handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      this.handleSend();
    }
  };

  clearTerminal = () => {
    this.context.updateUDPTerminal({
      messages: [],
      stats: { tx: 0, rx: 0, errors: 0, lastRxTime: undefined },
    });
  };

  exportLog = () => {
    const { udpTerminal } = this.context;
    const log = udpTerminal.messages
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

  render() {
    const { className } = this.props;
    const { inputText, inputHex } = this.state;
    const {
      udpTerminal,
      updateUDPTerminal,
      resetUDPTerminal,
      udpBind,
      udpClose,
    } = this.context;

    return (
      <div className={`terminal-container ${className || "udp-terminal"}`}>
        <div className="control-panel">
          <div className="section">
            <span
              className={`status-indicator ${udpTerminal.wsConnected ? "connected" : "disconnected"}`}
            >
              {udpTerminal.wsConnected
                ? "● Bridge Connected"
                : "○ Bridge Disconnected"}
            </span>
          </div>

          <div className="section">
            <label>Local Port:</label>
            <input
              type="number"
              value={udpTerminal.localPort}
              onChange={(e) =>
                updateUDPTerminal({ localPort: Number(e.target.value) })
              }
              disabled={udpTerminal.isBound}
              min={1}
              max={65535}
            />
          </div>

          <div className="section">
            <label>FPGA IP:</label>
            <input
              type="text"
              value={udpTerminal.fpgaHost}
              onChange={(e) => updateUDPTerminal({ fpgaHost: e.target.value })}
              disabled={udpTerminal.isBound}
              placeholder="192.168.1.100"
            />
            <label>FPGA Port:</label>
            <input
              type="number"
              value={udpTerminal.fpgaPort}
              onChange={(e) =>
                updateUDPTerminal({ fpgaPort: Number(e.target.value) })
              }
              disabled={udpTerminal.isBound}
              min={1}
              max={65535}
            />
          </div>

          <div className="section">
            <label>I/O Settings</label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={udpTerminal.showHex}
                onChange={(e) =>
                  updateUDPTerminal({ showHex: e.target.checked })
                }
              />
              Show RX as Hex
            </label>
            {udpTerminal.showHex && (
              <select
                value={udpTerminal.hexPrefix}
                onChange={(e) =>
                  updateUDPTerminal({ hexPrefix: e.target.value as any })
                }
              >
                <option value="0x">0x Prefix</option>
                <option value="\x">\x Prefix</option>
                <option value="">No Prefix</option>
              </select>
            )}
            <select
              value={udpTerminal.inputMode}
              onChange={(e) =>
                updateUDPTerminal({ inputMode: e.target.value as any })
              }
              disabled={!udpTerminal.isBound}
            >
              <option value="TEXT">Input as Text</option>
              <option value="HEX">Input as Hex</option>
            </select>
          </div>

          <div className="buttons">
            {!udpTerminal.isBound ? (
              <button
                onClick={udpBind}
                className="btn-primary"
                disabled={!udpTerminal.wsConnected}
              >
                Bind
              </button>
            ) : (
              <button onClick={udpClose} className="btn-danger">
                Unbind
              </button>
            )}
            <button onClick={this.clearTerminal}>Clear</button>
            <button onClick={this.exportLog}>Export Log</button>
            <button onClick={resetUDPTerminal}>Reset</button>
          </div>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={udpTerminal.autoScroll}
              onChange={(e) =>
                updateUDPTerminal({ autoScroll: e.target.checked })
              }
            />
            Auto-scroll
          </label>
          <div className="stats">
            TX: {udpTerminal.stats.tx} | RX: {udpTerminal.stats.rx} | Errors:{" "}
            {udpTerminal.stats.errors}
            {udpTerminal.stats.lastRxTime &&
              ` | Last RX: ${udpTerminal.stats.lastRxTime}`}
          </div>
        </div>

        <div className="terminal">
          {udpTerminal.messages.map((msg) => (
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

        <div className="input-section">
          <div className="text-input">
            <input
              type="text"
              value={udpTerminal.inputMode === "TEXT" ? inputText : inputHex}
              onChange={(e) => {
                if (udpTerminal.inputMode === "TEXT")
                  this.setState({ inputText: e.target.value });
                else this.setState({ inputHex: e.target.value });
              }}
              onKeyPress={this.handleKeyPress}
              placeholder={
                udpTerminal.inputMode === "TEXT"
                  ? "Type message to send..."
                  : "Hex: 01 02 03 or 0x01 0x02 0x03"
              }
              disabled={!udpTerminal.isBound}
            />
            <button
              onClick={this.handleSend}
              disabled={!udpTerminal.isBound}
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
