import React from "react";
import { AnalogWaveformChart, AnalogSignalData } from "@components";
import { TerminalContext, Message } from "../../contexts/TerminalContext";

const MAX_SAMPLES = 2048;

interface AnalogAnalyzerProps {
  className?: string;
  colors?: string[];
}

interface AnalogAnalyzerState {
  channelData: AnalogSignalData[][];
  activeChannels: boolean[];
  isRunning: boolean;
  processedMessageIds: Set<string>;
}

export class AnalogAnalyzer extends React.Component<
  AnalogAnalyzerProps,
  AnalogAnalyzerState
> {
  static contextType = TerminalContext;
  context!: React.ContextType<typeof TerminalContext>;

  private readonly defaultColors = [
    "#00ff00",
    "#ff00ff",
    "#00ffff",
    "#ffff00",
    "#ff8800",
    "#8800ff",
    "#ff0088",
    "#00ff88",
  ];

  constructor(props: AnalogAnalyzerProps) {
    super(props);
    const channelCount = 1;
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
      const ctx = this.context;
      if (!this.state.isRunning || !ctx?.udpTerminal?.messages) return;

      const msgs: Message[] = ctx.udpTerminal.messages;

      for (const m of msgs) {
        if (!m?.id || this.state.processedMessageIds.has(m.id)) continue;

        this.setState((prev) => ({
          processedMessageIds: new Set(prev.processedMessageIds).add(m.id),
        }));

        if (m.direction === "RX") {
          const payload = (m as any).payloadHex ?? m.data ?? "";
          const cleanedPayload = payload.replace(/^\s*\[[^\]]+\]\s*/, "");
          this.addHexPacket(cleanedPayload);
        }
      }
    } catch (e) {
      console.warn("AnalogAnalyzer: failed to process context messages", e);
    }
  };

  startCapture = () => {
    if (this.state.isRunning) return;
    this.setState({ isRunning: true }, this.processContextMessages);
  };

  stopCapture = () => {
    if (!this.state.isRunning) return;
    this.setState({ isRunning: false });
  };

  clearData = () => {
    const ctx = this.context;
    const currentMessageIds = new Set<string>();
    if (ctx?.udpTerminal?.messages) {
      for (const msg of ctx.udpTerminal.messages) {
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

  exportData = () => {
    const csvContent = this.state.channelData
      .map((channel, idx) => {
        const header = `Channel ${idx + 1}\nIndex,Value\n`;
        const rows = channel.map((d, i) => `${i},${d}`).join("\n");
        return header + rows;
      })
      .join("\n\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `analog_data_${new Date().toISOString()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  getChannelColor = (idx: number): string => {
    return (
      this.props.colors?.[idx] ||
      this.defaultColors[idx % this.defaultColors.length]
    );
  };

  public addHexPacket = (hexString: string) => {
    if (!hexString || !hexString.trim()) return;

    try {
      const hexPairs =
        hexString
          .replace(/0x|\\x/gi, "")
          .replace(/[,;\s]/g, "")
          .match(/.{1,2}/g) || [];

      const samples = hexPairs
        .map((hp) => parseInt(hp, 16))
        .filter((n) => !Number.isNaN(n) && n >= 0 && n <= 255);

      if (samples.length === 0) return;

      this.setState((prev) => {
        const currentChannelData = prev.channelData[0] || [];
        const combinedData = [...currentChannelData, ...samples];
        const truncatedData = combinedData.slice(-MAX_SAMPLES);

        const newChannelData = [truncatedData];

        return { channelData: newChannelData };
      });
    } catch (e) {
      console.warn("Failed to parse hex packet:", e);
    }
  };

  render() {
    const { className } = this.props;
    const channelCount = this.state.channelData.length;

    return (
      <div className={`analog-analyzer ${className || ""}`}>
        <div className="analyzer-controls">
          <div className="control-group">
            <button
              className={`control-button ${this.state.isRunning ? "active" : ""}`}
              onClick={
                this.state.isRunning ? this.stopCapture : this.startCapture
              }
            >
              {this.state.isRunning ? "Stop" : "Start"}
            </button>
            <button className="control-button" onClick={this.clearData}>
              Clear
            </button>
            <button className="control-button" onClick={this.exportData}>
              Export CSV
            </button>
          </div>
          <div className="channel-toggles">
            {Array.from({ length: channelCount }).map((_, idx) => (
              <label key={idx} className="channel-toggle">
                <input
                  type="checkbox"
                  checked={this.state.activeChannels[idx]}
                  onChange={() => this.toggleChannel(idx)}
                />
                <span
                  className="channel-indicator"
                  style={{ backgroundColor: this.getChannelColor(idx) }}
                >
                  CH{idx + 1}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="waveform-container">
          {this.state.channelData.map((data, idx) =>
            this.state.activeChannels[idx] ? (
              <div key={idx} className="waveform-channel">
                <h3 className="channel-title">Channel {idx + 1}</h3>
                <AnalogWaveformChart
                  data={data}
                  color={this.getChannelColor(idx)}
                />
              </div>
            ) : null,
          )}
        </div>

        <div className="analyzer-stats">
          {this.state.channelData.map((data, idx) =>
            this.state.activeChannels[idx] && data.length > 0 ? (
              <div key={idx} className="channel-stats">
                <h4>CH{idx + 1} Stats</h4>
                <p>
                  Samples: <strong>{data.length}</strong>
                </p>
                <p>
                  Min: <strong>{Math.min(...data).toFixed(3)}</strong>
                </p>
                <p>
                  Max: <strong>{Math.max(...data).toFixed(3)}</strong>
                </p>
                <p>
                  Avg:{" "}
                  <strong>
                    {(data.reduce((a, b) => a + b, 0) / data.length).toFixed(3)}
                  </strong>
                </p>
              </div>
            ) : null,
          )}
        </div>
      </div>
    );
  }
}

export default AnalogAnalyzer;
