import React, { Component, RefObject } from "react";
import { ProtocolContext } from "@contexts";

interface PWMTerminalProps {
  className?: string;
}

interface PWMTerminalComponentState {
  selectedChannel: number;
  highCount: string;
  lowCount: string;
}

export class PWMTerminal extends Component<
  PWMTerminalProps,
  PWMTerminalComponentState
> {
  static contextType = ProtocolContext;
  context!: React.ContextType<typeof ProtocolContext>;

  private terminalEndRef: RefObject<HTMLDivElement>;

  constructor(props: PWMTerminalProps) {
    super(props);
    const { pwmTerminal } = this.context;
    this.state = {
      selectedChannel: pwmTerminal.selectedChannel || 0,
      highCount: (pwmTerminal.highCount || 1000).toString(),
      lowCount: (pwmTerminal.lowCount || 1000).toString(),
    };
    this.terminalEndRef = React.createRef<HTMLDivElement>();
  }

  componentDidUpdate() {
    const { pwmTerminal } = this.context;
    if (pwmTerminal.autoScroll) {
      this.terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }

  handleApplyConfig = () => {
    const { updatePWMTimings } = this.context;
    const { selectedChannel, highCount, lowCount } = this.state;
    updatePWMTimings(selectedChannel, Number(highCount), Number(lowCount));
  };

  handleToggleChannel = (channelIndex: number) => {
    const { pwmTerminal, updatePWMChannelEnable } = this.context;
    const currentEnables = [...pwmTerminal.channelEnables];
    currentEnables[channelIndex] = !currentEnables[channelIndex];
    updatePWMChannelEnable(currentEnables);
  };

  clearTerminal = () => {
    this.context.updatePWMTerminal({
      messages: [],
      stats: { errors: 0 },
    });
  };

  exportLog = () => {
    const { pwmTerminal } = this.context;
    const log = pwmTerminal.messages
      .map((m) => `[${m.timestamp}] ${m.direction}: ${m.data}`)
      .join("\n");

    const element = document.createElement("a");
    element.setAttribute(
      "href",
      "data:text/plain;charset=utf-8," + encodeURIComponent(log),
    );
    element.setAttribute("download", `fpga-pwm-log-${Date.now()}.txt`);
    element.style.display = "none";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  render() {
    const { className } = this.props;
    const { highCount, lowCount, selectedChannel } = this.state;
    const {
      pwmTerminal,
      updatePWMTerminal,
      resetPWMTerminal,
      pwmEnable,
      pwmDisable,
    } = this.context;

    return (
      <div className={`terminal-container ${className || "pwm-terminal"}`}>
        <div className="control-panel">
          <div className="section">
            <span
              className={`status-indicator ${pwmTerminal.isEnabled ? "connected" : "disconnected"}`}
            >
              {pwmTerminal.isEnabled ? "● PWM Enabled" : "○ PWM Disabled"}
            </span>
          </div>

          <div className="section">
            <label>Configure Channel:</label>
            <select
              value={selectedChannel}
              onChange={(e) =>
                this.setState({ selectedChannel: Number(e.target.value) })
              }
              disabled={!pwmTerminal.isEnabled}
            >
              {[...Array(8).keys()].map((i) => (
                <option key={i} value={i}>
                  Channel {i}
                </option>
              ))}
            </select>
          </div>

          <div className="section">
            <label>High Count:</label>
            <input
              type="number"
              value={highCount}
              onChange={(e) => this.setState({ highCount: e.target.value })}
              disabled={!pwmTerminal.isEnabled}
              min={0}
            />
            <label>Low Count:</label>
            <input
              type="number"
              value={lowCount}
              onChange={(e) => this.setState({ lowCount: e.target.value })}
              disabled={!pwmTerminal.isEnabled}
              min={0}
            />
            <button
              onClick={this.handleApplyConfig}
              className="btn-secondary"
              disabled={!pwmTerminal.isEnabled}
            >
              Apply Config
            </button>
          </div>

          <div className="section">
            <label>Channel Status:</label>
            <div className="channel-status-grid">
              {[...Array(8).keys()].map((i) => (
                <label key={i} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={pwmTerminal.channelEnables[i] || false}
                    onChange={() => this.handleToggleChannel(i)}
                    disabled={!pwmTerminal.isEnabled}
                  />
                  CH{i}
                </label>
              ))}
            </div>
          </div>

          <div className="buttons">
            {!pwmTerminal.isEnabled ? (
              <button onClick={pwmEnable} className="btn-primary">
                Enable PWM
              </button>
            ) : (
              <button onClick={pwmDisable} className="btn-danger">
                Disable PWM
              </button>
            )}
            <button onClick={this.clearTerminal}>Clear Log</button>
            <button onClick={this.exportLog}>Export Log</button>
            <button onClick={resetPWMTerminal}>Reset</button>
          </div>

          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={pwmTerminal.autoScroll}
              onChange={(e) =>
                updatePWMTerminal({ autoScroll: e.target.checked })
              }
            />
            Auto-scroll
          </label>
          <div className="stats">Errors: {pwmTerminal.stats.errors}</div>
        </div>

        <div className="terminal">
          {pwmTerminal.messages.map((msg) => (
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
      </div>
    );
  }
}
