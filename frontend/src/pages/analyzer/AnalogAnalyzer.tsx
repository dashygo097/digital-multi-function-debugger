import React from "react";
import { AnalogWaveformChart, AnalogSignalData } from "@components";
import { TerminalContext, Message } from "../../contexts/TerminalContext";

/**
 * Integrated AnalogAnalyzer (updated)
 *
 * Changes:
 * - Removed synthetic test-data generation in startCapture.
 * - startCapture now enables "isRunning" so the component will actively
 *   consume incoming UDP RX messages from TerminalContext.
 * - processContextMessages will only append incoming RX messages while isRunning === true.
 * - stopCapture disables consuming incoming UDP messages.
 *
 * Usage:
 * - Ensure UDPTerminal writes incoming UDP payloads into TerminalContext.udpTerminal.messages
 *   with direction === "RX" and message.payloadHex (preferred) or message.data containing hex.
 * - When user clicks Start, analyzer will begin converting incoming UDP hex packets into samples.
 * - Clear still clears collected waveform data.
 */

interface AnalogAnalyzerProps {
  className?: string;
  channelCount?: number;
  colors?: string[];
}

interface AnalogAnalyzerState {
  channelData: AnalogSignalData[][];
  activeChannels: boolean[];
  sampleRate: number;
  timeWindow: number;
  isRunning: boolean;
  triggerLevel: number;
  triggerChannel: number;

  // track processed UDP message ids
  processedMessageIds: Set<string>;
}

export class AnalogAnalyzer extends React.Component<
  AnalogAnalyzerProps,
  AnalogAnalyzerState
> {
  static contextType = TerminalContext;
  context!: React.ContextType<typeof TerminalContext>;

  private readonly defaultColors = [
    "#00ff00", // Green
    "#ff00ff", // Magenta
    "#00ffff", // Cyan
    "#ffff00", // Yellow
    "#ff8800", // Orange
    "#8800ff", // Purple
    "#ff0088", // Pink
    "#00ff88", // Teal
  ];

  constructor(props: AnalogAnalyzerProps) {
    super(props);
    // Force single channel as requested
    const channelCount = 1;
    this.state = {
      channelData: Array(channelCount)
        .fill(null)
        .map(() => []),
      activeChannels: Array(channelCount).fill(true),
      sampleRate: 1000, // Hz
      timeWindow: 1.0, // seconds
      isRunning: false,
      triggerLevel: 0.5,
      triggerChannel: 0,
      processedMessageIds: new Set<string>(),
    };
  }

  componentDidMount() {
    // Process any existing messages but only append if isRunning
    this.processContextMessages();
  }

  componentWillUnmount() {
    // no synthetic interval to clear anymore
  }

  componentDidUpdate(
    prevProps: AnalogAnalyzerProps,
    prevState: AnalogAnalyzerState,
  ) {
    // process new context messages when context or running state changes
    if (this.state.isRunning !== prevState.isRunning) {
      // when starting, attempt to process any backlog immediately
      if (this.state.isRunning) {
        this.processContextMessages();
      }
    }
    // always try to process context messages when new messages appear in context
    this.processContextMessages();
  }

  // Process UDP messages from context
  private processContextMessages = () => {
    try {
      const ctx = this.context;
      if (!this.state.isRunning) return; // only consume when running
      if (!ctx || !ctx.udpTerminal || !Array.isArray(ctx.udpTerminal.messages))
        return;

      const msgs: Message[] = ctx.udpTerminal.messages;

      // process only new RX messages and ignore INFO/ERROR/TX
      for (const m of msgs) {
        if (!m || !m.id) continue;
        if (this.state.processedMessageIds.has(m.id)) continue;
        if (m.direction !== "RX") {
          // still mark it processed so we won't revisit it
          this.setState((prev) => {
            const newSet = new Set(prev.processedMessageIds);
            newSet.add(m.id);
            return { processedMessageIds: newSet };
          });
          continue;
        }

        // prefer canonical payloadHex if present
        let payload = (m as any).payloadHex ?? m.data ?? "";
        // strip leading "[...]" if present
        payload = payload.replace(/^\s*\[[^\]]+\]\s*/, "");

        // Feed it to the addHexPacket routine
        this.addHexPacket(payload);

        // mark processed
        this.setState((prev) => {
          const newSet = new Set(prev.processedMessageIds);
          newSet.add(m.id);
          return { processedMessageIds: newSet };
        });
      }
    } catch (e) {
      // don't break UI on parse errors
      // eslint-disable-next-line no-console
      console.warn("AnalogAnalyzer: failed to process context messages", e);
    }
  };

  // START/STOP now control whether analyzer consumes incoming UDP data
  startCapture = () => {
    if (this.state.isRunning) return;
    // Clear processed ids to allow re-processing of new messages, keep old data by default
    this.setState({ isRunning: true }, () => {
      // Attempt immediate processing of any messages waiting in context
      this.processContextMessages();
    });
  };

  stopCapture = () => {
    if (!this.state.isRunning) return;
    this.setState({ isRunning: false });
  };

  clearData = () => {
    this.setState({
      channelData: this.state.channelData.map(() => []),
      processedMessageIds: new Set<string>(), // allow messages to be re-processed if desired
    });
  };

  toggleChannel = (channelIdx: number) => {
    const newActiveChannels = [...this.state.activeChannels];
    newActiveChannels[channelIdx] = !newActiveChannels[channelIdx];
    this.setState({ activeChannels: newActiveChannels });
  };

  handleSampleRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value) && value > 0) {
      this.setState({ sampleRate: value });
    }
  };

  handleTimeWindowChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value) && value > 0) {
      this.setState({ timeWindow: value });
    }
  };

  handleTriggerLevelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value)) {
      this.setState({ triggerLevel: value });
    }
  };

  exportData = () => {
    const csvContent = this.state.channelData
      .map((channel, idx) => {
        const header = `Channel ${idx}\nTime,Value\n`;
        const rows = channel.map((d) => `${d.time},${d.value}`).join("\n");
        return header + rows;
      })
      .join("\n\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `analog_data_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  getChannelColor = (idx: number): string => {
    return (
      this.props.colors?.[idx] ||
      this.defaultColors[idx % this.defaultColors.length]
    );
  };

  /**
   * Public method to ingest a hex string (e.g. "01 02 FF 0A" or "0x01,0x02,FF,0A" or "\x01\x02")
   * Converts each byte into a numeric value in range 0..255 and appends to the single channel with timestamps.
   * Keeps only samples within the configured timeWindow.
   */
  public addHexPacket = (hexString: string) => {
    if (!hexString || hexString.trim().length === 0) return;

    try {
      // If \x.. pattern present, extract all hex pairs following \x
      const backslashMatches = Array.from(
        hexString.matchAll(/\\x([0-9a-fA-F]{2})/g),
      ).map((m) => m[1]);
      let hexPairs: string[] = [];

      if (backslashMatches.length > 0) {
        hexPairs = backslashMatches;
      } else {
        const cleaned = hexString
          .replace(/0x/gi, "")
          .replace(/\\x/gi, "")
          .replace(/[,;]/g, " ")
          .trim();

        if (
          /^[0-9a-fA-F]+$/.test(cleaned) &&
          cleaned.length % 2 === 0 &&
          cleaned.indexOf(" ") === -1
        ) {
          hexPairs = cleaned.match(/.{1,2}/g) || [];
        } else {
          hexPairs = cleaned
            .split(/\s+/)
            .map((t) => t.trim())
            .filter((t) => t.length > 0)
            .map((t) => (t.length === 1 ? "0" + t : t))
            .map((t) => t.slice(-2));
        }
      }

      const now = performance.now() / 1000; // seconds with fraction
      const samples = hexPairs
        .map((hp) => parseInt(hp, 16))
        .filter((n) => !Number.isNaN(n) && n >= 0 && n <= 255);

      if (samples.length === 0) return;

      const dt = 1 / Math.max(1, this.state.sampleRate);

      this.setState((prev) => {
        const ch = prev.channelData[0] ? [...prev.channelData[0]] : [];

        let startTime = now;
        if (ch.length > 0) {
          startTime = ch[ch.length - 1].time + dt;
        } else {
          startTime = now - dt * (samples.length - 1);
        }

        for (let i = 0; i < samples.length; i++) {
          const t = startTime + i * dt;
          const v = samples[i];
          ch.push({ time: t, value: v });
        }

        const latestTime = ch.length > 0 ? ch[ch.length - 1].time : now;
        const minTime = latestTime - prev.timeWindow;
        const pruned = ch.filter((d) => d.time >= minTime);

        const newChannelData = prev.channelData.map((c, idx) =>
          idx === 0 ? pruned : c,
        );

        return {
          ...prev,
          channelData: newChannelData,
        };
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("Failed to parse hex packet:", e);
    }
  };

  render() {
    const { className } = this.props;
    const channelCount = this.state.channelData.length;

    return (
      <div className={`analog-analyzer ${className || ""}`}>
        {/* Control Panel */}
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

          <div className="control-group">
            <label>
              Sample Rate (Hz):
              <input
                type="number"
                value={this.state.sampleRate}
                onChange={this.handleSampleRateChange}
                disabled={this.state.isRunning}
                min="1"
                max="100000"
              />
            </label>

            <label>
              Time Window (s):
              <input
                type="number"
                value={this.state.timeWindow}
                onChange={this.handleTimeWindowChange}
                disabled={this.state.isRunning}
                min="0.1"
                max="60"
                step="0.1"
              />
            </label>

            <label>
              Trigger Level:
              <input
                type="number"
                value={this.state.triggerLevel}
                onChange={this.handleTriggerLevelChange}
                min="-1"
                max="1"
                step="0.1"
              />
            </label>
          </div>

          {/* Channel Enable/Disable */}
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

        {/* Waveform Display */}
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

        {/* Statistics */}
        <div className="analyzer-stats">
          {this.state.channelData.map((data, idx) =>
            this.state.activeChannels[idx] && data.length > 0 ? (
              <div key={idx} className="channel-stats">
                <h4>CH{idx + 1} Stats</h4>
                <p>
                  Samples: <strong>{data.length}</strong>
                </p>
                <p>
                  Min:{" "}
                  <strong>
                    {Math.min(...data.map((d) => d.value)).toFixed(3)}
                  </strong>
                </p>
                <p>
                  Max:{" "}
                  <strong>
                    {Math.max(...data.map((d) => d.value)).toFixed(3)}
                  </strong>
                </p>
                <p>
                  Avg:{" "}
                  <strong>
                    {(
                      data.reduce((sum, d) => sum + d.value, 0) / data.length
                    ).toFixed(3)}
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
