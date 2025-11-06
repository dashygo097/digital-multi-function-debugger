import React, { Component, RefObject } from "react";
import { ProtocolContext } from "@contexts";
import { Message } from "@utils";

const N = 32; // Width of the phase accumulator
const SYSTEM_CLOCK_HZ = 50_000_000;
const TWO_POW_N = Math.pow(2, N);

// Register addresses
const REGS = {
  WAVE_SEL: 0x1801c,
  FREQ_CONTROL: 0x18020,
  ENABLE: 0x18018,
};

const WAVEFORM_MAP: { [key: string]: number } = {
  Sine: 0,
  Square: 1,
  Triangle: 2,
  Sawtooth: 3,
  Pulse: 4,
};

interface WaveSelTerminalProps {
  className?: string;
}

interface WaveSelTerminalState {
  messages: Message[];
  stats: { errors: number };
  selectedWaveform: string;
  autoScroll: boolean;
  frequency: string;
}

export class WaveSelTerminal extends Component<
  WaveSelTerminalProps,
  WaveSelTerminalState
> {
  static contextType = ProtocolContext;
  context!: React.ContextType<typeof ProtocolContext>;

  private terminalRef: RefObject<HTMLDivElement>;

  constructor(props: WaveSelTerminalProps) {
    super(props);
    this.state = {
      messages: [],
      stats: { errors: 0 },
      selectedWaveform: "Sine",
      autoScroll: true,
      frequency: "1000",
    };
    this.terminalRef = React.createRef<HTMLDivElement>();
  }

  componentDidUpdate(_: {}, prevState: WaveSelTerminalState) {
    if (
      this.state.autoScroll &&
      this.state.messages.length > prevState.messages.length
    ) {
      this.terminalRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }

  addMessage = (direction: "TX" | "INFO" | "ERROR", data: string) => {
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

  handleFrequencyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({ frequency: e.target.value });
  };

  handleWaveformSelect = (waveform: string) => {
    this.setState({ selectedWaveform: waveform });
  };

  startGenerator = async () => {
    const { writeCSR } = this.context;
    const { frequency, selectedWaveform } = this.state;
    const freqHz = parseFloat(frequency);

    if (isNaN(freqHz) || freqHz < 0) {
      this.addMessage("ERROR", "Invalid frequency entered.");
      return;
    }

    const phaseIncrement = Math.round((freqHz * TWO_POW_N) / SYSTEM_CLOCK_HZ);
    const waveformId = WAVEFORM_MAP[selectedWaveform];

    this.addMessage(
      "TX",
      `Starting Generator: ${selectedWaveform} @ ${freqHz} Hz`,
    );
    this.addMessage("INFO", `Calculated Phase Increment: ${phaseIncrement}`);

    await writeCSR(REGS.WAVE_SEL.toString(16), waveformId.toString(16));
    await writeCSR(REGS.FREQ_CONTROL.toString(16), phaseIncrement.toString(16));
    await writeCSR(REGS.ENABLE.toString(16), "1");

    this.addMessage("INFO", "Start pulse sent to hardware.");
  };

  stopGenerator = async () => {
    const { writeCSR } = this.context;
    this.addMessage("TX", "Stopping Waveform Generator...");
    await writeCSR(REGS.ENABLE.toString(16), "0");
    this.addMessage("INFO", "Stop pulse sent to hardware.");
  };

  render() {
    const { className } = this.props;
    const { selectedWaveform, frequency, messages, autoScroll, stats } =
      this.state;

    return (
      <div className={`main-wavesel ${className}`}>
        <div className="control-panel">
          <div className="section">
            <label>Master Control</label>
            <div className="buttons-2col">
              <button onClick={this.startGenerator} className="btn-primary">
                Start Generator
              </button>
              <button onClick={this.stopGenerator} className="btn-danger">
                Stop Generator
              </button>
            </div>
          </div>

          <div className="section">
            <label>Waveform Type</label>
            <div className="waveform-buttons">
              {Object.keys(WAVEFORM_MAP).map((wave) => (
                <button
                  key={wave}
                  className={selectedWaveform === wave ? "active" : ""}
                  onClick={() => this.handleWaveformSelect(wave)}
                >
                  {wave}
                </button>
              ))}
            </div>
          </div>

          <div className="section">
            <label>Frequency</label>
            <div className="freq-input">
              <input
                type="number"
                value={frequency}
                onChange={this.handleFrequencyChange}
              />
              <span>Hz</span>
            </div>
          </div>

          <div className="section">
            <button
              onClick={() =>
                this.setState({ messages: [], stats: { errors: 0 } })
              }
            >
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
