import React, { Component, RefObject } from "react";
import { ProtocolContext } from "@contexts";

interface SPITerminalProps {
  className?: string;
}

interface SPITerminalComponentState {
  inputText: string;
  inputHex: string;
}

export class SPITerminal extends Component<
  SPITerminalProps,
  SPITerminalComponentState
> {
  static contextType = ProtocolContext;
  context!: React.ContextType<typeof ProtocolContext>;

  private terminalEndRef: RefObject<HTMLDivElement>;

  constructor(props: SPITerminalProps) {
    super(props);
    this.state = {
      inputText: "",
      inputHex: "",
    };
    this.terminalEndRef = React.createRef<HTMLDivElement>();
  }

  componentDidUpdate() {
    const { spiTerminal } = this.context;
    if (spiTerminal.autoScroll) {
      this.terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }

  handleSend = () => {
    const { spiTerminal, spiSendText, spiSendHex } = this.context;
    if (spiTerminal.inputMode === "TEXT") {
      spiSendText(this.state.inputText);
      this.setState({ inputText: "" });
    } else {
      spiSendHex(this.state.inputHex);
      this.setState({ inputHex: "" });
    }
  };

  handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      this.handleSend();
    }
  };

  clearTerminal = () => {
    this.context.updateSPITerminal({
      messages: [],
      stats: { tx: 0, rx: 0, errors: 0 },
    });
  };

  exportLog = () => {
    const { spiTerminal } = this.context;
    const log = spiTerminal.messages
      .map((m) => `[${m.timestamp}] ${m.direction}: ${m.data}`)
      .join("\n");

    const element = document.createElement("a");
    element.setAttribute(
      "href",
      "data:text/plain;charset=utf-8," + encodeURIComponent(log),
    );
    element.setAttribute("download", `fpga-spi-log-${Date.now()}.txt`);
    element.style.display = "none";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  render() {
    const { className } = this.props;
    const { inputText, inputHex } = this.state;
    const {
      spiTerminal,
      updateSPITerminal,
      resetSPITerminal,
      spiEnable,
      spiDisable,
    } = this.context;

    return (
      <div className={`terminal-container ${className || "spi-terminal"}`}>
        <div className="control-panel">
          <div className="section">
            <span
              className={`status-indicator ${spiTerminal.isEnabled ? "connected" : "disconnected"}`}
            >
              {spiTerminal.isEnabled ? "● SPI Enabled" : "○ SPI Disabled"}
            </span>
          </div>

          <div className="section">
            <label>Clock Divider:</label>
            <input
              type="number"
              value={spiTerminal.clkDiv}
              onChange={(e) =>
                updateSPITerminal({ clkDiv: Number(e.target.value) })
              }
              disabled={spiTerminal.isEnabled}
              min={2}
            />
            <label>SPI Mode:</label>
            <select
              value={spiTerminal.spiMode}
              onChange={(e) =>
                updateSPITerminal({ spiMode: Number(e.target.value) })
              }
              disabled={spiTerminal.isEnabled}
            >
              <option value="0">Mode 0 (CPOL=0, CPHA=0)</option>
              <option value="1">Mode 1 (CPOL=0, CPHA=1)</option>
              <option value="2">Mode 2 (CPOL=1, CPHA=0)</option>
              <option value="3">Mode 3 (CPOL=1, CPHA=1)</option>
            </select>
          </div>

          <div className="section">
            <label>I/O Settings</label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={spiTerminal.msbFirst}
                onChange={(e) =>
                  updateSPITerminal({ msbFirst: e.target.checked })
                }
                disabled={spiTerminal.isEnabled}
              />
              MSB First
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={spiTerminal.showHex}
                onChange={(e) =>
                  updateSPITerminal({ showHex: e.target.checked })
                }
              />
              Show RX as Hex
            </label>
            <select
              value={spiTerminal.inputMode}
              onChange={(e) =>
                updateSPITerminal({ inputMode: e.target.value as any })
              }
              disabled={!spiTerminal.isEnabled}
            >
              <option value="TEXT">Input as Text</option>
              <option value="HEX">Input as Hex</option>
            </select>
          </div>

          <div className="buttons">
            {!spiTerminal.isEnabled ? (
              <button onClick={spiEnable} className="btn-primary">
                Enable SPI
              </button>
            ) : (
              <button onClick={spiDisable} className="btn-danger">
                Disable SPI
              </button>
            )}
            <button onClick={this.clearTerminal}>Clear</button>
            <button onClick={this.exportLog}>Export Log</button>
            <button onClick={resetSPITerminal}>Reset</button>
          </div>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={spiTerminal.autoScroll}
              onChange={(e) =>
                updateSPITerminal({ autoScroll: e.target.checked })
              }
            />
            Auto-scroll
          </label>
          <div className="stats">
            TX: {spiTerminal.stats.tx} | RX: {spiTerminal.stats.rx} | Errors:{" "}
            {spiTerminal.stats.errors}
          </div>
        </div>

        <div className="terminal">
          {spiTerminal.messages.map((msg) => (
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
              value={spiTerminal.inputMode === "TEXT" ? inputText : inputHex}
              onChange={(e) => {
                if (spiTerminal.inputMode === "TEXT")
                  this.setState({ inputText: e.target.value });
                else this.setState({ inputHex: e.target.value });
              }}
              onKeyPress={this.handleKeyPress}
              placeholder={
                spiTerminal.inputMode === "TEXT"
                  ? "Type message to send..."
                  : "Hex: 01 AB FF"
              }
              disabled={!spiTerminal.isEnabled}
            />
            <button
              onClick={this.handleSend}
              disabled={!spiTerminal.isEnabled}
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
