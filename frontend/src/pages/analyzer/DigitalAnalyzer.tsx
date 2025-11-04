import React from "react";
import { DigitalWaveformChart, DigitalByteData } from "@components";
import { SerialContext } from "../../contexts";

const MAX_SAMPLES = 256; // Keep the last 256 bytes

interface DigitalAnalyzerProps {
  className?: string;
  dataSource?: "serial" | "udp";
}

interface DigitalAnalyzerState {
  byteData: DigitalByteData[];
  isRunning: boolean;
  processedMessageIds: Set<string>;
}

export class DigitalAnalyzer extends React.Component<
  DigitalAnalyzerProps,
  DigitalAnalyzerState
> {
  static contextType = SerialContext;
  context!: React.ContextType<typeof SerialContext>;

  constructor(props: DigitalAnalyzerProps) {
    super(props);
    this.state = {
      byteData: [],
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

  startCapture = () => this.setState({ isRunning: true });
  stopCapture = () => this.setState({ isRunning: false });

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
        if (msg.id) currentMessageIds.add(msg.id);
      }
    }

    this.setState({
      byteData: [],
      processedMessageIds: currentMessageIds,
    });
  };

  public addHexPacket = (hexString: string) => {
    if (!hexString || !hexString.trim()) return;
    try {
      const bytes = hexString
        .split(/\s+/)
        .map((hp) => parseInt(hp, 16))
        .filter((n) => !isNaN(n));
      if (bytes.length === 0) return;

      this.setState((prev) => ({
        byteData: [...prev.byteData, ...bytes].slice(-MAX_SAMPLES),
      }));
    } catch (e) {
      console.warn("Failed to parse hex packet for digital analyzer:", e);
    }
  };

  render() {
    const { className } = this.props;
    const { isRunning, byteData } = this.state;

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
        </div>

        <div className="waveform-container">
          <div className="waveform-channel">
            <DigitalWaveformChart data={byteData} />
          </div>
        </div>
      </div>
    );
  }
}
