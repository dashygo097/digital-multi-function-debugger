import React from "react";
import { AnalogWaveformChart, AnalogSignalData } from "@components";

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
}

export class AnalogAnalyzer extends React.Component<
  AnalogAnalyzerProps,
  AnalogAnalyzerState
> {
  private intervalId: NodeJS.Timeout | null = null;
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
    const channelCount = props.channelCount || 4;
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
    };
  }

  componentWillUnmount() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  startCapture = () => {
    if (this.state.isRunning) return;

    this.setState({
      isRunning: true,
      channelData: this.state.channelData.map(() => []),
    });

    const sampleInterval = 1000 / this.state.sampleRate;
    let time = 0;

    this.intervalId = setInterval(() => {
      const newChannelData = this.state.channelData.map((channel, idx) => {
        // Generate test signal: mix of sine waves
        const value =
          Math.sin(2 * Math.PI * (1 + idx) * time) * 0.5 +
          Math.sin(2 * Math.PI * (10 + idx * 2) * time) * 0.3 +
          (Math.random() - 0.5) * 0.1;

        const newData: AnalogSignalData[] = [...channel, { time, value }];

        // Keep only data within time window
        const minTime = time - this.state.timeWindow;
        return newData.filter((d) => d.time >= minTime);
      });

      this.setState({ channelData: newChannelData });
      time += sampleInterval / 1000;

      // Stop after 10 seconds
      if (time > 10) {
        this.stopCapture();
      }
    }, sampleInterval);
  };

  stopCapture = () => {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.setState({ isRunning: false });
  };

  clearData = () => {
    this.setState({
      channelData: this.state.channelData.map(() => []),
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
