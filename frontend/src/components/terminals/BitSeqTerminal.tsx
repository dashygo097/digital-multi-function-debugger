import React, { Component, RefObject } from "react";
import { ProtocolContext } from "@contexts";
import { Message } from "@utils";

const BASE_ADDR = 0x20000;
const REGS = {
  CONTROL: BASE_ADDR + 0x00,
  STATUS: BASE_ADDR + 0x04,
  ARM_MASK: BASE_ADDR + 0x08,
  START_CH: BASE_ADDR + 0x0c,
  STOP_CH: BASE_ADDR + 0x10,
  WR_CONTROL: BASE_ADDR + 0x14,
  WR_ADDR: BASE_ADDR + 0x18,
  WR_DATA: BASE_ADDR + 0x1c,
  LEN_BASE: BASE_ADDR + 0x20,
  RATE_DIV_BASE: BASE_ADDR + 0x40,
  PHASE_OFF_BASE: BASE_ADDR + 0x60,
};
const NUM_CHANNELS = 8;

interface BitseqTerminalProps {
  className?: string;
}

interface ChannelConfig {
  length: string;
  rateDiv: string;
  phaseOff: string;
  sequence: string;
}

interface BitseqTerminalState {
  messages: Message[];
  stats: { errors: number };
  autoScroll: boolean;

  syncEnable: boolean;
  armMask: boolean[];
  playingStatus: boolean[];

  selectedChannel: number;
  channelConfigs: ChannelConfig[];
}

export class BitseqLooperTerminal extends Component<
  BitseqTerminalProps,
  BitseqTerminalState
> {
  static contextType = ProtocolContext;
  context!: React.ContextType<typeof ProtocolContext>;

  private terminalEndRef: RefObject<HTMLDivElement>;
  private pollInterval: number | null = null;

  constructor(props: BitseqTerminalProps) {
    super(props);
    this.state = {
      messages: [],
      stats: { errors: 0 },
      autoScroll: false,
      syncEnable: false,
      armMask: Array(NUM_CHANNELS).fill(false),
      playingStatus: Array(NUM_CHANNELS).fill(false),
      selectedChannel: 0,
      channelConfigs: Array(NUM_CHANNELS)
        .fill(0)
        .map(() => ({
          length: "16",
          rateDiv: "1000",
          phaseOff: "0",
          sequence: "0",
        })),
    };
    this.terminalEndRef = React.createRef<HTMLDivElement>();
  }

  componentDidMount() {
    this.pollInterval = window.setInterval(this.pollPlayingStatus, 1000);
  }

  componentWillUnmount() {
    if (this.pollInterval) clearInterval(this.pollInterval);
  }

  componentDidUpdate(_: {}, prevState: BitseqTerminalState) {
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

  pollPlayingStatus = async () => {
    const { readCSR } = this.context;
    try {
      const status = await readCSR(REGS.STATUS.toString(16));
      if (status !== undefined) {
        const newPlayingStatus = Array.from(
          { length: NUM_CHANNELS },
          (_, i) => (status & (1 << i)) !== 0,
        );
        this.setState({ playingStatus: newPlayingStatus });
      }
    } catch (e) {
      /* Fail silently during polling */
    }
  };

  handleGlobalControlWrite = async (bit: 0 | 1 | 2, enable?: boolean) => {
    const { writeCSR } = this.context;
    const value = enable !== undefined ? (enable ? 1 : 0) : 1 << bit;
    let regValue = 0;
    if (bit === 0 && enable !== undefined) {
      regValue = enable ? 1 : 0;
    } else {
      regValue = 1 << bit;
    }
    await writeCSR(REGS.CONTROL.toString(16), regValue.toString(16));
    const action =
      bit === 1
        ? "Arm Load"
        : bit === 2
          ? "Group Start"
          : `Sync Enable: ${enable}`;
    this.addMessage("TX", `Global Control: ${action}`);
  };

  handleArmMaskChange = async (index: number) => {
    const newArmMask = [...this.state.armMask];
    newArmMask[index] = !newArmMask[index];
    this.setState({ armMask: newArmMask });

    const maskValue = newArmMask.reduce(
      (acc, val, i) => acc | (val ? 1 << i : 0),
      0,
    );
    await this.context.writeCSR(
      REGS.ARM_MASK.toString(16),
      maskValue.toString(16),
    );
    this.addMessage(
      "TX",
      `Set Arm Mask to 0b${maskValue.toString(2).padStart(8, "0")}`,
    );
  };

  handleChannelControl = async (
    reg: "START_CH" | "STOP_CH",
    channel: number,
  ) => {
    const { writeCSR } = this.context;
    const addr = reg === "START_CH" ? REGS.START_CH : REGS.STOP_CH;
    const value = 1 << channel;
    await writeCSR(addr.toString(16), value.toString(16));
    this.addMessage(
      "TX",
      `${reg === "START_CH" ? "Starting" : "Stopping"} Channel ${channel}`,
    );
  };

  handleChannelConfigChange = (field: keyof ChannelConfig, value: string) => {
    const { selectedChannel, channelConfigs } = this.state;
    const newConfigs = [...channelConfigs];
    newConfigs[selectedChannel] = {
      ...newConfigs[selectedChannel],
      [field]: value,
    };
    this.setState({ channelConfigs: newConfigs });
  };

  applyChannelConfig = async () => {
    const { writeCSR } = this.context;
    const { selectedChannel, channelConfigs } = this.state;
    const config = channelConfigs[selectedChannel];

    this.addMessage("TX", `Applying config to Channel ${selectedChannel}`);
    await writeCSR(
      (REGS.LEN_BASE + selectedChannel * 4).toString(16),
      Number(config.length).toString(16),
    );
    await writeCSR(
      (REGS.RATE_DIV_BASE + selectedChannel * 4).toString(16),
      Number(config.rateDiv).toString(16),
    );
    await writeCSR(
      (REGS.PHASE_OFF_BASE + selectedChannel * 4).toString(16),
      Number(config.phaseOff).toString(16),
    );
  };

  writeSequenceToBRAM = async () => {
    const { writeCSR } = this.context;
    const { selectedChannel, channelConfigs } = this.state;
    const sequence = channelConfigs[selectedChannel].sequence.replace(
      /[^01]/g,
      "",
    ); // Sanitize
    const sequenceLength = Number(channelConfigs[selectedChannel].length);

    if (sequence.length > sequenceLength) {
      this.addMessage(
        "ERROR",
        `Sequence length (${sequence.length}) exceeds configured length (${sequenceLength}).`,
      );
      return;
    }

    this.addMessage(
      "TX",
      `Writing ${sequence.length}-bit sequence to Channel ${selectedChannel} BRAM...`,
    );

    const wrControlValue = (1 << 7) | selectedChannel; // wr_en=1, wr_ch=selectedChannel
    await writeCSR(REGS.WR_CONTROL.toString(16), wrControlValue.toString(16));

    for (let i = 0; i < sequence.length; i++) {
      await writeCSR(REGS.WR_ADDR.toString(16), i.toString(16));
      await writeCSR(REGS.WR_DATA.toString(16), sequence[i]);
    }

    // Disable write
    await writeCSR(REGS.WR_CONTROL.toString(16), "0");
    this.addMessage(
      "INFO",
      `BRAM write complete for Channel ${selectedChannel}.`,
    );
  };

  render() {
    const { className } = this.props;
    const {
      syncEnable,
      armMask,
      playingStatus,
      selectedChannel,
      channelConfigs,
    } = this.state;
    const currentConfig = channelConfigs[selectedChannel];

    return (
      <div className={className}>
        <div className="control-panel">
          <div className="section">
            <label>Playing Status</label>
            <div className="status-grid">
              {playingStatus.map((p, i) => (
                <span key={i} className={`status-dot ${p ? "playing" : ""}`}>
                  CH{i}
                </span>
              ))}
            </div>
          </div>
          <div className="section">
            <label>Global Control</label>
            <div className="checkbox-label">
              <input
                type="checkbox"
                checked={syncEnable}
                onChange={(e) => {
                  this.setState({ syncEnable: e.target.checked });
                  this.handleGlobalControlWrite(0, e.target.checked);
                }}
              />
              Sync Enable
            </div>
            <div className="buttons-2col">
              <button onClick={() => this.handleGlobalControlWrite(1)}>
                Arm Load
              </button>
              <button onClick={() => this.handleGlobalControlWrite(2)}>
                Group Start
              </button>
            </div>
          </div>
          <div className="section">
            <label>Arm Mask</label>
            <div className="status-grid">
              {armMask.map((armed, i) => (
                <label key={i} className="checkbox-label small">
                  <input
                    type="checkbox"
                    checked={armed}
                    onChange={() => this.handleArmMaskChange(i)}
                  />
                  CH{i}
                </label>
              ))}
            </div>
          </div>
          <div className="section">
            <label>Channel Config (CH{selectedChannel})</label>
            <select
              value={selectedChannel}
              onChange={(e) =>
                this.setState({ selectedChannel: Number(e.target.value) })
              }
            >
              {Array.from({ length: NUM_CHANNELS }, (_, i) => (
                <option key={i} value={i}>
                  Channel {i}
                </option>
              ))}
            </select>
            <label>Length:</label>
            <input
              type="number"
              value={currentConfig.length}
              onChange={(e) =>
                this.handleChannelConfigChange("length", e.target.value)
              }
            />
            <label>Rate Divider:</label>
            <input
              type="number"
              value={currentConfig.rateDiv}
              onChange={(e) =>
                this.handleChannelConfigChange("rateDiv", e.target.value)
              }
            />
            <label>Phase Offset:</label>
            <input
              type="number"
              value={currentConfig.phaseOff}
              onChange={(e) =>
                this.handleChannelConfigChange("phaseOff", e.target.value)
              }
            />
            <button className="btn-secondary" onClick={this.applyChannelConfig}>
              Apply Config
            </button>
          </div>
          <div className="section">
            <label>Channel Control (CH{selectedChannel})</label>
            <div className="buttons-2col">
              <button
                className="btn-primary"
                onClick={() =>
                  this.handleChannelControl("START_CH", selectedChannel)
                }
              >
                Start CH{selectedChannel}
              </button>
              <button
                className="btn-danger"
                onClick={() =>
                  this.handleChannelControl("STOP_CH", selectedChannel)
                }
              >
                Stop CH{selectedChannel}
              </button>
            </div>
          </div>
        </div>

        <div className="right-panel">
          <div className="section sequence-editor">
            <label>Sequence Editor (CH{selectedChannel})</label>
            <textarea
              value={currentConfig.sequence}
              onChange={(e) =>
                this.handleChannelConfigChange("sequence", e.target.value)
              }
              placeholder="Enter bit sequence (e.g., 11001100...)"
            />
            <button className="btn-special" onClick={this.writeSequenceToBRAM}>
              Write Sequence to BRAM
            </button>
          </div>
          <div className="terminal">
            {this.state.messages.map((msg) => (
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
      </div>
    );
  }
}
