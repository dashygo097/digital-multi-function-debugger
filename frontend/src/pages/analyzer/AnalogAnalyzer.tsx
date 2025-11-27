import React, { useEffect, useState, useContext } from "react";
import { AnalogWaveformChart, SpectrumChart } from "@components";
import { useAnalyzer, useProtocolContext, ProtocolContext } from "@contexts";

const FFT_SIZE = 1024;
const BASE_ADDR = 0x18000;
const RESTART_REG = BASE_ADDR + 0x14;
const defaultColors = ["#00ff00", "#ff00ff", "#00ffff", "#ffff00"];

interface AnalogAnalyzerProps {
  className?: string;
  colors?: string[];
}

export const AnalogAnalyzer: React.FC<AnalogAnalyzerProps> = ({
  className,
  colors,
}) => {
  const {
    analog,
    toggleAnalogCapture,
    clearAnalogData,
    toggleSpectrum,
    updateSampleRate,
  } = useAnalyzer();
  const { udpTerminal } = useProtocolContext();
  const protocolContext = useContext(ProtocolContext);

  const {
    isRunning,
    channelData,
    spectrumData,
    showSpectrum,
    sampleRate,
    activeChannels,
  } = analog;

  // Streaming state
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamInterval, setStreamInterval] = useState("1000");
  const [streamCount, setStreamCount] = useState(0);

  const isSpectrumDisabled = channelData[0].length < FFT_SIZE;

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

  useEffect(() => {
    const intervalId = setInterval(() => {
      updateSampleRate();
    }, 2000);

    return () => {
      clearInterval(intervalId);
    };
  }, [updateSampleRate]);

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

  const toggleStreaming = () => {
    setIsStreaming(!isStreaming);
  };

  const handleClearData = () => {
    const currentMessageIds = new Set<string>(
      udpTerminal.messages.map((msg) => msg.id).filter(Boolean) as string[],
    );
    clearAnalogData(currentMessageIds);
  };

  const handleExportData = () => {
    const csvContent = channelData
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

  const getChannelColor = (idx: number): string =>
    colors?.[idx] || defaultColors[idx % defaultColors.length];

  const totalSamples = channelData.reduce(
    (sum, channel, idx) => (activeChannels[idx] ? sum + channel.length : sum),
    0,
  );

  return (
    <div className={`analog-analyzer ${className || ""}`}>
      <div className="analyzer-controls">
        <button
          className={`control-button ${isRunning ? "active" : ""}`}
          onClick={toggleAnalogCapture}
        >
          {isRunning ? "Stop Capture" : "Start Capture"}
        </button>
        <button className="control-button" onClick={handleClearData}>
          Clear
        </button>
        <button className="control-button" onClick={handleExportData}>
          Export CSV
        </button>
        <label
          className={`channel-toggle ${isSpectrumDisabled ? "disabled" : ""}`}
          title={
            isSpectrumDisabled
              ? `Requires at least ${FFT_SIZE} samples`
              : "Toggle Spectrum Display"
          }
        >
          <input
            type="checkbox"
            checked={showSpectrum}
            onChange={toggleSpectrum}
            disabled={isSpectrumDisabled}
          />
          <span
            className="channel-indicator"
            style={{ backgroundColor: "#a78bfa" }}
          >
            Show Spectrum
          </span>
        </label>
      </div>

      {/* Streaming controls - only in Analog Analyzer */}
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
      </div>

      <div className="waveform-container">
        {channelData.map(
          (data, idx) =>
            activeChannels[idx] && (
              <div key={idx} className="waveform-channel">
                <h3 className="channel-title">Time Domain Waveform</h3>
                <AnalogWaveformChart data={data} color={getChannelColor(idx)} />
              </div>
            ),
        )}
        {showSpectrum && !isSpectrumDisabled && (
          <div className="waveform-channel">
            <SpectrumChart
              data={spectrumData}
              sampleRate={sampleRate}
              fftSize={FFT_SIZE}
            />
          </div>
        )}
      </div>

      <div className="analyzer-footer">
        <div className="analyzer-stats-left">
          {channelData.map(
            (data, idx) =>
              activeChannels[idx] &&
              data.length > 0 && (
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
                      {(data.reduce((a, b) => a + b, 0) / data.length).toFixed(
                        3,
                      )}
                    </strong>
                  </p>
                </div>
              ),
          )}
        </div>
        <div className="analyzer-stats-right">
          <div className="channel-stats">
            <h4>Global Stats</h4>
            <p>
              Capture Status:{" "}
              <strong style={{ color: isRunning ? "#50fa7b" : "#f5576c" }}>
                {isRunning ? "Running" : "Stopped"}
              </strong>
            </p>
            <p>
              Total Samples: <strong>{totalSamples}</strong>
            </p>
            <p>
              Sample Rate: <strong>{sampleRate} Hz</strong>
            </p>
            <p>
              Spectrum:{" "}
              <strong>
                {showSpectrum && !isSpectrumDisabled ? "Visible" : "Hidden"}
              </strong>
            </p>
            {isStreaming && (
              <p>
                Streaming:{" "}
                <strong style={{ color: "#50fa7b" }}>
                  ON ({streamInterval}ms, {streamCount} requests)
                </strong>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
