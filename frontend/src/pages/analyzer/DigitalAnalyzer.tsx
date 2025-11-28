import React, { useState, useContext } from "react";
import { DigitalWaveformChart } from "@components";
import {
  useAnalyzer,
  useUDPContext,
  useSerialContext,
  ProtocolContext,
} from "@contexts";

const BASE_ADDR = 0x38000;
const CLOCK_DIV_REG = BASE_ADDR + 0x10;
const SYSTEM_CLOCK_HZ = 50_000_000;

interface DigitalAnalyzerProps {
  className?: string;
}

export const DigitalAnalyzer: React.FC<DigitalAnalyzerProps> = ({
  className,
}) => {
  const { digital, dataSource, clearDigitalData } = useAnalyzer();
  const { isRunning, byteData } = digital;
  const { udpTerminal } = useUDPContext();
  const { serialTerminal } = useSerialContext();
  const protocolContext = useContext(ProtocolContext);

  // Clock divider state
  const [clkDiv, setClkDiv] = useState("250");

  const handleClearData = () => {
    let currentMessageIds = new Set<string>();
    if (dataSource === "udp") {
      currentMessageIds = new Set<string>(
        udpTerminal.messages.map((msg) => msg.id).filter(Boolean) as string[],
      );
    } else if (dataSource === "ila" && serialTerminal) {
      currentMessageIds = new Set<string>(
        serialTerminal.messages
          .map((msg) => msg.id)
          .filter(Boolean) as string[],
      );
    }
    for (const id of currentMessageIds) {
      console.log("Clearing message ID:", id);
    }
    clearDigitalData(currentMessageIds);

    console.log(byteData);
  };

  const applyClockDiv = async () => {
    if (!protocolContext?.writeCSR) {
      console.error("[Clock Div] Protocol context not available");
      return;
    }

    const { writeCSR } = protocolContext;
    const divValue = Number(clkDiv);

    if (isNaN(divValue) || divValue < 0) {
      console.error("[Clock Div] Invalid clock divider value");
      return;
    }

    try {
      await writeCSR(CLOCK_DIV_REG.toString(16), divValue.toString(16));
      console.log(`[Clock Div] Applied clock divider: ${divValue}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      console.error("[Clock Div] Error applying clock divider:", errorMsg);
    }
  };

  // Calculate sample frequency
  const sampleFreq = SYSTEM_CLOCK_HZ / (Number(clkDiv) + 1);

  return (
    <div className={`digital-analyzer ${className || ""}`}>
      {/* Combined Controls and Clock Configuration */}
      <div className="config-group clock-config">
        <label className="clock-label">
          Clock Divider:
          <input
            type="number"
            value={clkDiv}
            onChange={(e) => setClkDiv(e.target.value)}
            min="0"
            max="65535"
            className="clock-input"
          />
        </label>
        <button className="control-button apply-btn" onClick={applyClockDiv}>
          Apply Clock
        </button>
        <button className="control-button clear-btn" onClick={handleClearData}>
          Clear Data
        </button>
      </div>

      <div className="waveform-container">
        <div className="waveform-channel">
          <DigitalWaveformChart data={byteData} />
        </div>
      </div>
    </div>
  );
};
