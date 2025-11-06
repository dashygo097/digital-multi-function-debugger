import React, { Component, RefObject } from "react";
import { ProtocolContext } from "@contexts";
import { Message } from "@utils";

const BASE_ADDR = 0x10000;
const REGS = {
  STATUS: BASE_ADDR + 0x04,
  CHANNEL_SEL: BASE_ADDR + 0x08,
  DATA_NUM: BASE_ADDR + 0x0c,
  ADC_SPEED: BASE_ADDR + 0x10,
  RESTART: BASE_ADDR + 0x14,
};
const NUM_CHANNELS = 2;
const SYSTEM_CLOCK_HZ = 50_000_000;

interface ACM2108TerminalProps {
  className?: string;
}

interface ACM2108TerminalState {
  messages: Message[];
  stats: { errors: number };
  autoScroll: boolean;

  // Status
  isPllLocked: boolean;
  isDdrInit: boolean;

  // Configuration
  channelSelMask: boolean[];
  dataNum: string;
  adcSpeedDiv: string;
}

export class ACM2108Terminal extends Component<
  ACM2108TerminalProps,
  ACM2108TerminalState
> {
  static contextType = ProtocolContext;
  context!: React.ContextType<typeof ProtocolContext>;

  private terminalRef: RefObject<HTMLDivElement>;
  private pollInterval: number | null = null;

  constructor(props: ACM2108TerminalProps) {
    super(props);
    this.state = {
      messages: [],
      stats: { errors: 0 },
      autoScroll: true,
      isPllLocked: false,
      isDdrInit: false,
      channelSelMask: Array(NUM_CHANNELS).fill(false),
      dataNum: "1024",
      adcSpeedDiv: "10",
    };
    this.terminalRef = React.createRef<HTMLDivElement>();
  }

  componentDidMount() {
    this.pollInterval = window.setInterval(this.pollStatus, 2000);
  }

  componentWillUnmount() {
    if (this.pollInterval) clearInterval(this.pollInterval);
  }

  componentDidUpdate(_: {}, prevState: ACM2108TerminalState) {
    if (
      this.state.autoScroll &&
      this.state.messages.length > prevState.messages.length
    ) {
      this.terminalRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }

  addMessage = (direction: "TX" | "INFO" | "ERROR" | "RX", data: string) => {
    this.setState((p) => ({
      messages: [
        ...p.messages,
        {
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
        },
      ],
      stats: direction === "ERROR" ? { errors: p.stats.errors + 1 } : p.stats,
    }));
  };

  pollStatus = async () => {
    const { readCSR } = this.context;
    try {
      const status = await readCSR(REGS.STATUS.toString(16));
      if (status !== undefined) {
        this.setState({
          isPllLocked: (status & 0x1) !== 0,
          isDdrInit: (status & 0x2) !== 0,
        });
      }
    } catch (e) {
      /* Fail silently during polling */
    }
  };

  handleChannelSelChange = (index: number) => {
    const newMask = [...this.state.channelSelMask];
    newMask[index] = !newMask[index];
    this.setState({ channelSelMask: newMask });
  };

  applyConfiguration = async () => {
    const { writeCSR } = this.context;
    const { channelSelMask, dataNum, adcSpeedDiv } = this.state;

    const maskValue = channelSelMask.reduce(
      (acc, val, i) => acc | (val ? 1 << i : 0),
      0,
    );
    const dataNumValue = parseInt(dataNum);
    const adcSpeedValue = parseInt(adcSpeedDiv);

    if (isNaN(dataNumValue) || isNaN(adcSpeedValue)) {
      this.addMessage(
        "ERROR",
        "Data Number and ADC Speed must be valid numbers.",
      );
      return;
    }

    this.addMessage("TX", "Applying acquisition configuration...");
    await writeCSR(REGS.CHANNEL_SEL.toString(16), maskValue.toString(16));
    await writeCSR(REGS.DATA_NUM.toString(16), dataNumValue.toString(16));
    await writeCSR(REGS.ADC_SPEED.toString(16), adcSpeedValue.toString(16));
    this.addMessage(
      "INFO",
      `Config Sent: Channels=0b${maskValue.toString(2).padStart(8, "0")}, Samples=${dataNumValue}, Divider=${adcSpeedValue}`,
    );
  };

  startAcquisition = async () => {
    const { writeCSR } = this.context;
    this.addMessage("TX", "Sending Start Acquisition pulse...");
    await this.applyConfiguration();
    await writeCSR(REGS.RESTART.toString(16), "1");
    this.addMessage("INFO", "Start pulse sent to hardware.");
  };

  render() {
    const { className } = this.props;
    const {
      isPllLocked,
      isDdrInit,
      channelSelMask,
      dataNum,
      adcSpeedDiv,
      messages,
      autoScroll,
    } = this.state;
    const samplingRate = SYSTEM_CLOCK_HZ / (parseInt(adcSpeedDiv) || 1);

    return (
      <div className={`main-acm2108 ${className}`}>
        <div className="control-panel">
          <div className="section">
            <label>Board Status</label>
            <div className="status-grid">
              <div className={`status-item ${isPllLocked ? "ok" : "error"}`}>
                <label>PLL</label>
                <span>{isPllLocked ? "Locked" : "No Lock"}</span>
              </div>
              <div className={`status-item ${isDdrInit ? "ok" : "error"}`}>
                <label>DDR3</label>
                <span>{isDdrInit ? "Initialized" : "Not Ready"}</span>
              </div>
            </div>
            <button onClick={this.pollStatus} className="btn-info">
              Refresh Status
            </button>
          </div>

          <div className="section">
            <label>Acquisition Config</label>
            <div className="sub-label">Channel Select</div>
            <div className="channel-grid">
              {channelSelMask.map((enabled, i) => (
                <label key={i} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={() => this.handleChannelSelChange(i)}
                  />
                  CH{i}
                </label>
              ))}
            </div>
            <div className="sub-label">Number of Samples</div>
            <input
              type="number"
              value={dataNum}
              onChange={(e) => this.setState({ dataNum: e.target.value })}
            />
            <div className="sub-label">
              Sampling Rate Divider (Est: {(samplingRate / 1e6).toFixed(2)} MHz)
            </div>
            <input
              type="number"
              value={adcSpeedDiv}
              onChange={(e) => this.setState({ adcSpeedDiv: e.target.value })}
            />
          </div>

          <div className="section">
            <button className="btn-special" onClick={this.startAcquisition}>
              Start Acquisition
            </button>
          </div>

          <div className="section">
            <button onClick={() => this.setState({ messages: [] })}>
              Clear Log
            </button>
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
          <div ref={this.terminalRef} />
        </div>
      </div>
    );
  }
}
