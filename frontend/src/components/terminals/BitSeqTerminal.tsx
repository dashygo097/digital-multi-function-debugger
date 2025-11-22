import React, { Component, RefObject } from "react";
import { ProtocolContext } from "@contexts";
import { Message } from "@utils";

const BASE_ADDR = 0x20000;
const REGS = {
  STATUS: BASE_ADDR + 0x04,
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
          rateDiv: "1000",
          phaseOff: "0",
          sequence: "0",
        })),
    };
    this.terminalEndRef = React.createRef<HTMLDivElement>();
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

  handleArmMaskChange = async (index: number) => {
    const newArmMask = [...this.state.armMask];
    newArmMask[index] = !newArmMask[index];
    this.setState({ armMask: newArmMask });

    const maskValue = newArmMask.reduce(
      (acc, val, i) => acc | (val ? 1 << i : 0),
      0,
    );
    this.addMessage(
      "TX",
      `Set Arm Mask to 0b${maskValue.toString(2).padStart(8, "0")}`,
    );
  };

  handleStartChannels = async () => {
    const armMask = [...this.state.armMask];

    const maskValue = armMask.reduce(
      (acc, val, i) => acc | (val ? 1 << i : 0),
      0,
    );

    await this.context.writeCSR(REGS.STOP_CH.toString(16), "FF");
    await this.context.writeCSR(
      REGS.START_CH.toString(16),
      maskValue.toString(16),
    );

    const newPlayingStatus = armMask.map((armed) => armed);
    this.setState({ playingStatus: newPlayingStatus });

    this.addMessage(
      "TX",
      "Starting Channels with Arm Mask 0b" +
        maskValue.toString(2).padStart(8, "0"),
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

    const newPlayingStatus = [...this.state.playingStatus];
    newPlayingStatus[channel] = reg === "START_CH";
    this.setState({ playingStatus: newPlayingStatus });
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

  getSequenceLength = (channel: number): number => {
    const sequence = this.state.channelConfigs[channel].sequence.replace(
      /[^01]/g,
      "",
    );
    return sequence.length;
  };

  applyChannelConfig = async () => {
    const { writeCSR } = this.context;
    const { selectedChannel, channelConfigs } = this.state;
    const config = channelConfigs[selectedChannel];

    // Get actual sequence length
    const sequenceLength = this.getSequenceLength(selectedChannel);

    if (sequenceLength === 0) {
      this.addMessage(
        "ERROR",
        "Sequence is empty. Please enter a valid bit sequence.",
      );
      return;
    }

    this.addMessage(
      "TX",
      `Applying config to Channel ${selectedChannel} (Length: ${sequenceLength})`,
    );

    // Write length based on actual sequence
    await writeCSR(
      (REGS.LEN_BASE + selectedChannel * 4).toString(16),
      sequenceLength.toString(16),
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
    );

    if (sequence.length === 0) {
      this.addMessage(
        "ERROR",
        "Sequence is empty. Please enter a valid bit sequence.",
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

  applyAndWriteSequence = async () => {
    await this.applyChannelConfig();
    await this.writeSequenceToBRAM();
  };

  render() {
    const { className } = this.props;
    const { armMask, playingStatus, selectedChannel, channelConfigs } =
      this.state;
    const currentConfig = channelConfigs[selectedChannel];
    const currentLength = this.getSequenceLength(selectedChannel);

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
            <label> Start </label>
            <button className="btn-primary" onClick={this.handleStartChannels}>
              Start Channels
            </button>
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
            <label>Sequence Length: {currentLength} bits</label>
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
            <button
              className="btn-special"
              onClick={this.applyAndWriteSequence}
            >
              Apply Config & Write to BRAM
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
