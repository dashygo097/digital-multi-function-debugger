import React, { Component, RefObject } from "react";
import { ProtocolContext } from "@contexts";
import { Message } from "@utils";

interface PWMTerminalProps {
  className?: string;
}

interface PWMTerminalState {
  messages: Message[];
  stats: {
    errors: number;
  };
  selectedChannel: number;
  channelEnables: boolean[];
  highCount: string;
  lowCount: string;
  autoScroll: boolean;
  isEnabled: boolean;
}

export class PWMTerminal extends Component<PWMTerminalProps, PWMTerminalState> {
  static contextType = ProtocolContext;
  context!: React.ContextType<typeof ProtocolContext>;

  private terminalEndRef: RefObject<HTMLDivElement>;

  constructor(props: PWMTerminalProps) {
    super(props);
    this.state = {
      messages: [],
      stats: { errors: 0 },
      selectedChannel: 0,
      channelEnables: Array(8).fill(false),
      highCount: "1000",
      lowCount: "1000",
      autoScroll: false,
      isEnabled: false,
    };
    this.terminalEndRef = React.createRef<HTMLDivElement>();
  }

  componentDidMount() {
    this.updatePWMState();
  }

  componentDidUpdate(_: PWMTerminalProps, prevState: PWMTerminalState) {
    if (
      this.state.autoScroll &&
      this.state.messages.length > prevState.messages.length
    ) {
      this.terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }

  updatePWMState = async () => {
    const { readCSR } = this.context;

    try {
      const controlReg = (await readCSR("0x2C000")) as unknown as number;

      if (controlReg === undefined) {
        this.addMessage("ERROR", "Failed to read PWM state from hardware.");
        return;
      }

      const isEnabled = (controlReg & 0x1) !== 0;
      const channelEnablesValue = (controlReg >> 1) & 0xff;
      const newChannelEnables = Array(8)
        .fill(false)
        .map((_, i) => (channelEnablesValue & (1 << i)) !== 0);

      this.setState({ isEnabled, channelEnables: newChannelEnables });
    } catch (error) {
      this.addMessage("ERROR", "An error occurred while updating PWM state.");
    }
  };

  addMessage = (direction: "TX" | "INFO" | "ERROR", data: string) => {
    const newMessage: Message = {
      id: `${Date.now()}-${Math.random()}`,
      timestamp: new Date().toLocaleTimeString("en-US", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        fractionalSecondDigits: 3,
      }),
      direction,
      data,
    };
    this.setState((prevState) => ({
      messages: [...prevState.messages, newMessage],
      stats:
        direction === "ERROR"
          ? { ...prevState.stats, errors: prevState.stats.errors + 1 }
          : prevState.stats,
    }));
  };

  handleApplyConfig = async () => {
    const { selectedChannel, highCount, lowCount } = this.state;
    this.addMessage(
      "TX",
      `Applying High: ${highCount}, Low: ${lowCount} to Channel ${selectedChannel}`,
    );
    await this.updatePWMTimings(
      selectedChannel,
      Number(highCount),
      Number(lowCount),
    );
  };

  handleToggleChannel = async (channelIndex: number) => {
    const newEnables = [...this.state.channelEnables];
    newEnables[channelIndex] = !newEnables[channelIndex];
    // Optimistically update the UI
    this.setState({ channelEnables: newEnables });
    // Send the full, correct state to the hardware
    await this.updatePWMChannelEnable(newEnables);
  };

  clearTerminal = () => {
    this.setState({ messages: [], stats: { errors: 0 } });
  };

  exportLog = () => {
    const log = this.state.messages
      .map((m) => `[${m.timestamp}] ${m.direction}: ${m.data}`)
      .join("\n");
    const blob = new Blob([log], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const element = document.createElement("a");
    element.href = url;
    element.download = `fpga-pwm-log-${Date.now()}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    URL.revokeObjectURL(url);
  };

  updatePWMTimings = async (
    channel: number,
    highCount: number,
    lowCount: number,
  ) => {
    const { writeCSR } = this.context;
    await writeCSR("0x2C004", channel.toString(16));
    await writeCSR("0x2C008", highCount.toString(16));
    await writeCSR("0x2C00C", lowCount.toString(16));
    await writeCSR("0x2C010", "1");
  };

  resetPWMTerminal = async () => {
    this.addMessage("TX", "Resetting all PWM configurations to 0.");
    await this.pwmDisable();
  };

  updatePWMChannelEnable = async (enables: boolean[]) => {
    const { writeCSR } = this.context;
    let concatEnables = 0;
    enables.forEach((enabled, index) => {
      if (enabled) {
        concatEnables |= 1 << index;
      }
    });

    const masterEnable = concatEnables > 0 ? 1 : 0;
    const finalValue = (concatEnables << 1) | masterEnable;

    this.addMessage(
      "TX",
      `Updating PWM_CONTROL register to 0x${finalValue.toString(16)}`,
    );
    await writeCSR("0x2C000", finalValue.toString(16));

    await this.updatePWMState();
  };

  pwmEnable = async () => {
    this.addMessage("TX", "Enabling PWM system.");
    const { writeCSR } = this.context;
    let channelMask = 0;
    this.state.channelEnables.forEach((en, i) => {
      if (en) channelMask |= 1 << i;
    });
    const finalValue = (channelMask << 1) | 1; // Set bit 0 to 1
    await writeCSR("0x2C000", finalValue.toString(16));
    this.setState({ isEnabled: true });
  };

  pwmDisable = async () => {
    const { writeCSR } = this.context;
    this.addMessage("TX", "Disabling PWM system.");
    await writeCSR("0x2C000", "0");
    this.setState({ isEnabled: false, channelEnables: Array(8).fill(false) });
  };

  render() {
    const { className } = this.props;
    const {
      highCount,
      lowCount,
      selectedChannel,
      isEnabled,
      channelEnables,
      autoScroll,
      stats,
      messages,
    } = this.state;

    return (
      <div className={className}>
        <div className="control-panel">
          <div className="section">
            <span
              className={`status-indicator ${isEnabled ? "connected" : "disconnected"}`}
            >
              {isEnabled ? "● PWM Enabled" : "○ PWM Disabled"}
            </span>
          </div>

          <div className="section">
            <label>Configure Channel:</label>
            <select
              value={selectedChannel}
              onChange={(e) =>
                this.setState({ selectedChannel: Number(e.target.value) })
              }
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
              min={0}
            />
            <label>Low Count:</label>
            <input
              type="number"
              value={lowCount}
              onChange={(e) => this.setState({ lowCount: e.target.value })}
              min={0}
            />
            <button onClick={this.handleApplyConfig} className="btn-secondary">
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
                    checked={channelEnables[i] || false}
                    onChange={() => this.handleToggleChannel(i)}
                  />
                  CH{i}
                </label>
              ))}
            </div>
          </div>

          <div className="buttons">
            {!isEnabled ? (
              <button onClick={this.pwmEnable} className="btn-primary">
                Enable PWM
              </button>
            ) : (
              <button onClick={this.pwmDisable} className="btn-danger">
                Disable PWM
              </button>
            )}
            <button onClick={this.clearTerminal}>Clear Log</button>
            <button onClick={this.exportLog}>Export Log</button>
            <button onClick={this.resetPWMTerminal} className="btn-danger">
              Reset
            </button>
          </div>

          <div className="stats">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) =>
                  this.setState({ autoScroll: e.target.checked })
                }
              />
              Auto-scroll
            </label>
            <div>
              Errors: <strong>{stats.errors}</strong>
            </div>
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
      </div>
    );
  }
}
