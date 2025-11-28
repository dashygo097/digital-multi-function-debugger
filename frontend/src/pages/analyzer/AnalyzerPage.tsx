import React, { useContext } from "react";
import { WithRouter } from "@utils";
import { AnalogAnalyzer } from "./AnalogAnalyzer";
import { DigitalAnalyzer } from "./DigitalAnalyzer";
import { useAnalyzer, ProtocolContext, useSerialContext } from "@contexts";
import "@styles/analyzer.css";

const BASE_ADDR = 0x18000;
const RESTART_REG = BASE_ADDR + 0x14;

const AnalyzerPage: React.FC = () => {
  const {
    analyzerType,
    dataSource,
    setAnalyzerType,
    setDataSource,
    clearDigitalData,
  } = useAnalyzer();
  const protocolContext = useContext(ProtocolContext);
  const { serialTerminal } = useSerialContext();

  const sendRestartCSR = async () => {
    if (!protocolContext?.writeCSR) {
      console.error("[Manual Trigger] Protocol context not available");
      return;
    }

    const { writeCSR, readCSR } = protocolContext;

    try {
      if (dataSource == "udp") {
        await writeCSR(RESTART_REG.toString(16), "1");
      } else {
        await writeCSR("0x3800C", "2");
        await writeCSR("0x3800C", "1");
        for (let i = 0; i < 256; i++) {
          await readCSR("0x38000");
        }
        const currentMessageIds = new Set<string>(
          serialTerminal.messages
            .map((msg) => msg.id)
            .filter(Boolean) as string[],
        );

        clearDigitalData(currentMessageIds);
      }
      console.log("[Manual Trigger] Restart request sent");
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      console.error(
        "[Manual Trigger] Error sending restart request:",
        errorMsg,
      );
    }
  };

  const handleManualTrigger = () => {
    console.log("[Manual] Sending single restart request");
    sendRestartCSR();
  };

  const handleAnalyzerTypeChange = (
    e: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    const newType = e.target.value as "analog" | "digital";
    setAnalyzerType(newType);
    if (newType === "analog") {
      setDataSource("udp");
    }
  };

  const handleDataSourceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setDataSource(e.target.value as "ila" | "udp");
  };

  const getFooterText = () => {
    if (analyzerType === "analog") {
      return `Showing 1 analog channel from the UDP data source`;
    }
    return `Showing 4 digital channels from the '${dataSource}' data source`;
  };

  return (
    <div className="analyzer-page">
      <div className="analyzer-content">
        <div className="analyzer-header fade-in">
          <h1 className="analyzer-title">Signal Analyzer</h1>
          <p className="analyzer-subtitle">
            Live Oscilloscope & Logic Analyzer
          </p>
        </div>

        <div className="analyzer-config slide-up">
          <div className="config-group">
            <label>
              Analyzer Type:
              <select value={analyzerType} onChange={handleAnalyzerTypeChange}>
                <option value="analog">Analog</option>
                <option value="digital">Digital</option>
              </select>
            </label>
            <label>
              Data Source:
              <select
                value={dataSource}
                onChange={handleDataSourceChange}
                disabled={analyzerType === "analog"}
              >
                <option value="udp">UDP</option>
                <option value="ila">ILA</option>
              </select>
            </label>
            <button
              className="manual-trigger-btn"
              onClick={handleManualTrigger}
            >
              Manual Trigger
            </button>
          </div>
        </div>

        <div className="analyzer-wrapper slide-up">
          {analyzerType === "analog" ? (
            <AnalogAnalyzer className="main-analyzer" />
          ) : (
            <DigitalAnalyzer className="main-analyzer" />
          )}
        </div>

        <div className="analyzer-footer">
          <p className="footer-info">{getFooterText()}</p>
        </div>
      </div>
    </div>
  );
};

export default WithRouter(AnalyzerPage);
