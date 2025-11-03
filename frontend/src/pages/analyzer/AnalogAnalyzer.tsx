import React from "react";
import {
  AnalogWaveformChart,
  AnalogSignalData,
  SpectrumChart,
} from "@components";
import { TerminalContext, Message } from "../../contexts/TerminalContext";
import { FFT } from "@utils";

const MAX_SAMPLES = 2048;
const FFT_SIZE = 128;

interface AnalogAnalyzerProps {
  className?: string;
  colors?: string[];
}

interface AnalogAnalyzerState {
  channelData: AnalogSignalData[][];
  spectrumData: number[];
  activeChannels: boolean[];
  isRunning: boolean;
  showSpectrum: boolean;
  processedMessageIds: Set<string>;
  sampleRate: number;
}

export class AnalogAnalyzer extends React.Component<
  AnalogAnalyzerProps,
  AnalogAnalyzerState
> {
  static contextType = TerminalContext;
  context!: React.ContextType<typeof TerminalContext>;

  private fft: FFT;
  private readonly defaultColors = ["#00ff00", "#ff00ff", "#00ffff", "#ffff00"];

  constructor(props: AnalogAnalyzerProps) {
    super(props);
    this.fft = new FFT(FFT_SIZE);
    this.state = {
      channelData: [[]],
      spectrumData: [],
      activeChannels: [true],
      isRunning: false,
      showSpectrum: false,
      processedMessageIds: new Set<string>(),
      sampleRate: 44100,
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
          processedMessageIds: new Set(prev.processedMessageIds).add(m.id!),
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

  private getSpectrum = (data: number[]): number[] => {
    if (data.length < FFT_SIZE) {
      return [];
    }
    const signalSlice = data.slice(-FFT_SIZE);
    return this.fft.calculate(signalSlice);
  };

  startCapture = () => this.setState({ isRunning: true });
  stopCapture = () => this.setState({ isRunning: false });

  clearData = () => {
    const currentMessageIds = new Set<string>(
      this.context?.udpTerminal?.messages.map((msg) => msg.id).filter(Boolean),
    );
    this.setState({
      channelData: [[]],
      spectrumData: [],
      processedMessageIds: currentMessageIds,
    });
  };

  toggleSpectrum = () => {
    this.setState((prevState) => {
      const willShow = !prevState.showSpectrum;
      let newSpectrumData = prevState.spectrumData;

      if (willShow) {
        // If turning on, calculate spectrum from current data
        newSpectrumData = this.getSpectrum(prevState.channelData[0]);
      }

      return {
        showSpectrum: willShow,
        spectrumData: newSpectrumData,
      };
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
      const samples =
        hexString
          .replace(/0x|\\x/gi, "")
          .replace(/[,;\s]/g, "")
          .match(/.{1,2}/g)
          ?.map((hp) => parseInt(hp, 16))
          .filter((n) => !isNaN(n) && n >= 0 && n <= 255) || [];

      if (samples.length === 0) return;

      this.setState((prev) => {
        const combinedData = [...prev.channelData[0], ...samples];
        const truncatedData = combinedData.slice(-MAX_SAMPLES);

        const newSpectrumData = prev.showSpectrum
          ? this.getSpectrum(truncatedData)
          : prev.spectrumData;

        return {
          channelData: [truncatedData],
          spectrumData: newSpectrumData,
        };
      });
    } catch (e) {
      console.warn("Failed to parse hex packet:", e);
    }
  };

  render() {
    const { className } = this.props;
    const {
      isRunning,
      activeChannels,
      channelData,
      showSpectrum,
      spectrumData,
      sampleRate,
    } = this.state;

    return (
      <div className={`analog-analyzer ${className || ""}`}>
        <div className="analyzer-controls">
          <div className="control-group">
            <button
              className={`control-button ${isRunning ? "active" : ""}`}
              onClick={isRunning ? this.stopCapture : this.startCapture}
            >
              {isRunning ? "Stop" : "Start"}
            </button>
            <button className="control-button" onClick={this.clearData}>
              Clear
            </button>
            <button className="control-button" onClick={this.exportData}>
              Export CSV
            </button>
          </div>
          <div className="control-group">
            <label className="channel-toggle">
              <input
                type="checkbox"
                checked={showSpectrum}
                onChange={this.toggleSpectrum}
              />
              <span
                className="channel-indicator"
                style={{ backgroundColor: "#a78bfa" }}
              >
                Show Spectrum
              </span>
            </label>
          </div>
        </div>

        <div className="waveform-container">
          {channelData.map((data, idx) =>
            activeChannels[idx] ? (
              <div key={idx} className="waveform-channel">
                <h3 className="channel-title">Time Domain Waveform</h3>
                <AnalogWaveformChart
                  data={data}
                  color={this.getChannelColor(idx)}
                />
              </div>
            ) : null,
          )}
          {showSpectrum && (
            <div className="waveform-channel">
              <SpectrumChart
                data={spectrumData}
                sampleRate={sampleRate}
                fftSize={FFT_SIZE}
              />
            </div>
          )}
        </div>

        <div className="analyzer-stats">
          {channelData.map((data, idx) =>
            activeChannels[idx] && data.length > 0 ? (
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
