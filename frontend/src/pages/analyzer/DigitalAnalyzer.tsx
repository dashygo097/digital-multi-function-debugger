import React from "react";
import { DigitalWaveformChart, DigitalSignalData } from "@components";
import { TerminalContext } from "../../contexts/TerminalContext";

const MAX_SAMPLES = 1024;

interface DigitalAnalyzerProps {
  className?: string;
  dataSource?: "serial" | "udp";
}

interface DigitalAnalyzerState {
  channelData: DigitalSignalData[][];
  activeChannels: boolean[];
  isRunning: boolean;
  processedMessageIds: Set<string>;
}

export class DigitalAnalyzer extends React.Component<
  DigitalAnalyzerProps,
  DigitalAnalyzerState
> {
  static contextType = TerminalContext;
  context!: React.ContextType<typeof TerminalContext>;

  private readonly defaultColors = [
    "#34d399",
    "#f87171",
    "#60a5fa",
    "#fbbf24",
    "#a78bfa",
    "#f472b6",
    "#2dd4bf",
    "#facc15",
  ];

  constructor(props: DigitalAnalyzerProps) {
    super(props);
    const channelCount = 8;
    this.state = {
      channelData: Array(channelCount)
        .fill(null)
        .map(() => []),
      activeChannels: Array(channelCount).fill(true),
      isRunning: false,
      processedMessageIds: new Set<string>(),
    };
  }

  componentDidUpdate() {
    if (this.state.isRunning) {
      this.processContextMessages();
    }
  }

  private processContextMessages = () => {
    try {
      const { dataSource = "udp" } = this.props;
      const ctx = this.context;
      const messages =
        dataSource === "udp"
          ? ctx?.udpTerminal?.messages
          : ctx?.serialTerminal?.messages;

      if (!this.state.isRunning || !messages) return;

      for (const m of messages) {
        if (!m?.id || this.state.processedMessageIds.has(m.id)) continue;

        this.setState((prev) => ({
          processedMessageIds: new Set(prev.processedMessageIds).add(m.id),
        }));

        if (m.direction === "RX" && m.payloadHex) {
          this.addHexPacket(m.payloadHex);
        }
      }
    } catch (e) {
      console.warn("DigitalAnalyzer: failed to process context messages", e);
    }
  };

  startCapture = () => {
    this.setState({ isRunning: true }, this.processContextMessages);
  };

  stopCapture = () => {
    this.setState({ isRunning: false });
  };

  clearData = () => {
    const { dataSource = "udp" } = this.props;
    const ctx = this.context;
    const messages =
      dataSource === "udp"
        ? ctx?.udpTerminal?.messages
        : ctx?.serialTerminal?.messages;
    const currentMessageIds = new Set<string>();

    if (messages) {
      for (const msg of messages) {
        if (msg.id) {
          currentMessageIds.add(msg.id);
        }
      }
    }

    this.setState({
      channelData: this.state.channelData.map(() => []),
      processedMessageIds: currentMessageIds,
    });
  };

  toggleChannel = (channelIdx: number) => {
    this.setState((prev) => {
      const newActiveChannels = [...prev.activeChannels];
      newActiveChannels[channelIdx] = !newActiveChannels[channelIdx];
      return { activeChannels: newActiveChannels };
    });
  };

  getChannelColor = (idx: number): string => {
    return this.defaultColors[idx % this.defaultColors.length];
  };

  public addHexPacket = (hexString: string) => {
    if (!hexString || !hexString.trim()) return;

    try {
      const bytes = hexString.split(/\s+/).map((hp) => parseInt(hp, 16));

      this.setState((prev) => {
        const newChannelData = [...prev.channelData.map((ch) => [...ch])];

        for (const byte of bytes) {
          if (isNaN(byte)) continue;
          for (let i = 0; i < 8; i++) {
            const bit = (byte >> i) & 1;
            newChannelData[i].push(bit);
            if (newChannelData[i].length > MAX_SAMPLES) {
              newChannelData[i].shift();
            }
          }
        }
        return { channelData: newChannelData };
      });
    } catch (e) {
      console.warn("Failed to parse hex packet for digital analyzer:", e);
    }
  };

  render() {
    const { className } = this.props;
    const { isRunning, activeChannels, channelData } = this.state;

    return (
      <div className={`analog-analyzer ${className || ""}`}>
        <div className="analyzer-controls">
          <div className="control-group">
            <button
              className={`control-button ${isRunning ? "active" : ""}`}
              onClick={isRunning ? this.stopCapture : this.startCapture}
            >
              {isRunning ? "Stop Capture" : "Start Capture"}
            </button>
            <button className="control-button" onClick={this.clearData}>
              Clear Data
            </button>
          </div>
          <div className="channel-toggles">
            {activeChannels.map((isActive, idx) => (
              <label key={idx} className="channel-toggle">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={() => this.toggleChannel(idx)}
                />
                <span
                  className="channel-indicator"
                  style={{ backgroundColor: this.getChannelColor(idx) }}
                >
                  Bit {idx}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="waveform-container">
          {channelData.map((data, idx) =>
            activeChannels[idx] ? (
              <div key={idx} className="waveform-channel">
                <h3 className="channel-title">Bit {idx}</h3>
                <DigitalWaveformChart
                  data={data}
                  color={this.getChannelColor(idx)}
                />
              </div>
            ) : null,
          )}
        </div>
      </div>
    );
  }
}
