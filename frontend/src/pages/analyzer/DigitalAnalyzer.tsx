import React from "react";
import { DigitalWaveformChart } from "@components";
import { useAnalyzer, useUDPContext, useSerialContext } from "@contexts";

interface DigitalAnalyzerProps {
  className?: string;
}

export const DigitalAnalyzer: React.FC<DigitalAnalyzerProps> = ({
  className,
}) => {
  const { digital, dataSource, toggleDigitalCapture, clearDigitalData } =
    useAnalyzer();
  const { isRunning, byteData } = digital;

  const { udpTerminal } = useUDPContext();
  const { serialTerminal } = useSerialContext();

  const handleClearData = () => {
    let currentMessageIds = new Set<string>();

    if (dataSource === "udp") {
      currentMessageIds = new Set<string>(
        udpTerminal.messages.map((msg) => msg.id).filter(Boolean) as string[],
      );
    } else if (dataSource === "serial" && serialTerminal) {
      currentMessageIds = new Set<string>(
        serialTerminal.messages
          .map((msg) => msg.id)
          .filter(Boolean) as string[],
      );
    }

    clearDigitalData(currentMessageIds);
  };

  return (
    <div className={`digital-analyzer ${className || ""}`}>
      <div className="analyzer-controls">
        <div className="control-group">
          <button
            className={`control-button ${isRunning ? "active" : ""}`}
            onClick={toggleDigitalCapture}
          >
            {isRunning ? "Stop Capture" : "Start Capture"}
          </button>
          <button className="control-button" onClick={handleClearData}>
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
};
