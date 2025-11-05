import React, { Component, RefObject } from "react";
import { ProtocolContext } from "@contexts";
import { Message } from "@utils";

const SYSTEM_CLOCK_HZ = 50_000_000;

interface SignalMeasureTerminalProps {
  className?: string;
}

interface SignalMeasureTerminalState {
  messages: Message[];
  stats: { errors: number };
  isBusy: boolean;
  isFinished: boolean;
  period: number;
  highTime: number;
  frequency: number;
  dutyCycle: number;
  autoScroll: boolean;
}

export class SignalMeasureTerminal extends Component<
  SignalMeasureTerminalProps,
  SignalMeasureTerminalState
> {
  static contextType = ProtocolContext;
  context!: React.ContextType<typeof ProtocolContext>;

  private terminalEndRef: RefObject<HTMLDivElement>;
  private pollInterval: number | null = null;

  constructor(props: SignalMeasureTerminalProps) {
    super(props);
    this.state = {
      messages: [],
      stats: { errors: 0 },
      isBusy: false,
      isFinished: false,
      period: 0,
      highTime: 0,
      frequency: 0,
      dutyCycle: 0,
      autoScroll: true,
    };
    this.terminalEndRef = React.createRef<HTMLDivElement>();
  }

  componentWillUnmount() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
  }

  componentDidUpdate(_: {}, prevState: SignalMeasureTerminalState) {
    if (
      this.state.autoScroll &&
      this.state.messages.length > prevState.messages.length
    ) {
      this.terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }

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
          ? { errors: prevState.stats.errors + 1 }
          : prevState.stats,
    }));
  };

  handleStartMeasurement = async () => {
    if (this.state.isBusy) {
      this.addMessage("INFO", "A measurement is already in progress.");
      return;
    }
    this.addMessage("TX", "Starting signal measurement...");
    const { writeCSR } = this.context;
    await writeCSR("0x1C000", "1");
    this.setState({ isFinished: false });

    if (this.pollInterval) clearInterval(this.pollInterval);
    this.pollInterval = window.setInterval(this.pollStatus, 500);
  };

  pollStatus = async () => {
    const { readCSR } = this.context;
    const statusReg = await readCSR("0x1C004");

    if (statusReg === undefined) {
      this.addMessage("ERROR", "Failed to read status register.");
      if (this.pollInterval) clearInterval(this.pollInterval);
      return;
    }

    const isBusy = (statusReg & 0x1) !== 0;

    this.setState({ isBusy });
    if (this.pollInterval) clearInterval(this.pollInterval);
    this.fetchResults();
  };

  fetchResults = async () => {
    const { readCSR } = this.context;
    const period = await readCSR("0x1C008");
    const highTime = await readCSR("0x1C00C");

    if (period === undefined || highTime === undefined) {
      this.addMessage("ERROR", "Failed to read result registers.");
      return;
    }

    if (period === 0) {
      this.addMessage("ERROR", "Measured period is zero. Check signal input.");
      this.setState({
        isBusy: false,
        isFinished: true,
        period: 0,
        highTime: 0,
        frequency: 0,
        dutyCycle: 0,
      });
      return;
    }

    const frequency = SYSTEM_CLOCK_HZ / period;
    const dutyCycle = (highTime / period) * 100;

    this.setState({
      period,
      highTime,
      frequency,
      dutyCycle,
      isBusy: false,
      isFinished: true,
    });

    this.addMessage(
      "INFO",
      `Period: ${period.toLocaleString()}, High Time: ${highTime.toLocaleString()}`,
    );
    this.addMessage(
      "INFO",
      `Frequency: ${frequency.toFixed(2)} Hz, Duty Cycle: ${dutyCycle.toFixed(2)}%`,
    );
  };

  clearTerminal = () => {
    this.setState({ messages: [], stats: { errors: 0 } });
  };

  render() {
    const { className } = this.props;
    const {
      isBusy,
      isFinished,
      period,
      highTime,
      frequency,
      dutyCycle,
      autoScroll,
      stats,
      messages,
    } = this.state;

    return (
      <div className={`main-signalterminal ${className || ""}`}>
        <div className="control-panel">
          <div className="section">
            <span
              className={`status-indicator ${isBusy ? "busy" : isFinished ? "connected" : "disconnected"}`}
            >
              {isBusy ? "● Measuring..." : isFinished ? "● Finished" : "○ Idle"}
            </span>
          </div>

          <div className="section result-grid">
            <div className="result-item">
              <label>Frequency</label>
              <span>{frequency.toFixed(2)} Hz</span>
            </div>
            <div className="result-item">
              <label>Duty Cycle</label>
              <span>{dutyCycle.toFixed(2)} %</span>
            </div>
            <div className="result-item">
              <label>Period</label>
              <span>{period.toLocaleString()} cycles</span>
            </div>
            <div className="result-item">
              <label>High Time</label>
              <span>{highTime.toLocaleString()} cycles</span>
            </div>
          </div>

          <div className="buttons">
            <button
              onClick={this.handleStartMeasurement}
              className="btn-primary"
              disabled={isBusy}
            >
              {isBusy ? "Measuring..." : "Start Measurement"}
            </button>
            <button onClick={this.clearTerminal} className="btn-secondary">
              Clear Log
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
