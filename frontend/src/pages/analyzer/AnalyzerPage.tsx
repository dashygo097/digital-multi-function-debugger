import React, { useState, useEffect, useContext } from "react";
import { WithRouter } from "@utils";
import { AnalogAnalyzer } from "./AnalogAnalyzer";
import { DigitalAnalyzer } from "./DigitalAnalyzer";
import { useAnalyzer, ProtocolContext } from "@contexts";
import "@styles/analyzer.css";

const BASE_ADDR = 0x18000;
const RESTART_REG = BASE_ADDR + 0x14;

const AnalyzerPage: React.FC = () => {
  const { analyzerType, dataSource, setAnalyzerType, setDataSource } =
    useAnalyzer();
  const protocolContext = useContext(ProtocolContext);

  const [isStreaming, setIsStreaming] = useState(false);
  const [streamInterval, setStreamInterval] = useState("1000");
  const [streamCount, setStreamCount] = useState(0);

  // Streaming interval effect
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    if (isStreaming) {
      console.log(`[Streaming] Started with ${streamInterval}ms interval`);
      setStreamCount(0);

      // Send initial restart
      sendRestartCSR();

      // Set up interval for continuous restart requests
      intervalId = setInterval(
        () => {
          sendRestartCSR();
        },
        parseInt(streamInterval) || 1000,
      );
    } else {
      console.log("[Streaming] Stopped");
    }

    // Cleanup function
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
        console.log("[Streaming] Interval cleared");
      }
    };
  }, [isStreaming, streamInterval]);

  const sendRestartCSR = async () => {
    if (!protocolContext?.writeCSR) {
      console.error("[Streaming] Protocol context not available");
      return;
    }

    const { writeCSR } = protocolContext;

    try {
      // Send restart pulse to trigger acquisition
      await writeCSR(RESTART_REG.toString(16), "1");

      setStreamCount((prev) => prev + 1);
      console.log(`[Streaming] Restart request #${streamCount + 1} sent`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      console.error("[Streaming] Error sending restart request:", errorMsg);
    }
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
    setDataSource(e.target.value as "serial" | "udp");
  };

  const toggleStreaming = () => {
    setIsStreaming(!isStreaming);
  };

  const handleManualTrigger = () => {
    console.log("[Manual] Sending single restart request");
    sendRestartCSR();
  };

  const getFooterText = () => {
    const streamingStatus = isStreaming
      ? ` | Streaming: ON (${streamInterval}ms, ${streamCount} requests)`
      : " | Streaming: OFF";

    if (analyzerType === "analog") {
      return `Showing 1 analog channel from the UDP data source${streamingStatus}`;
    }
    return `Showing 8 digital channels from the '${dataSource}' data source${streamingStatus}`;
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
                <option value="serial">Serial</option>
              </select>
            </label>
          </div>

          <div className="config-group streaming-controls">
            <label className="streaming-checkbox">
              <input
                type="checkbox"
                checked={isStreaming}
                onChange={toggleStreaming}
              />
              <span>Enable Streaming Mode</span>
            </label>
            <label className="streaming-interval">
              Interval (ms):
              <input
                type="number"
                value={streamInterval}
                onChange={(e) => setStreamInterval(e.target.value)}
                disabled={!isStreaming}
                min="100"
                max="10000"
                step="100"
              />
            </label>
            <button
              className="manual-trigger-btn"
              onClick={handleManualTrigger}
              disabled={isStreaming}
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

// Export the page component directly. The provider will be handled at a higher level.
export default WithRouter(AnalyzerPage);
