import React from "react";
import { AnalogWaveformChart, SpectrumChart } from "@components";
import { useAnalyzer, useUDPContext } from "../../contexts";

const FFT_SIZE = 128;
const defaultColors = ["#00ff00", "#ff00ff", "#00ffff", "#ffff00"];

interface AnalogAnalyzerProps {
  className?: string;
  colors?: string[];
}

export const AnalogAnalyzer: React.FC<AnalogAnalyzerProps> = ({
  className,
  colors,
}) => {
  const { analog, toggleAnalogCapture, clearAnalogData, toggleSpectrum } =
    useAnalyzer();
  const { udpTerminal } = useUDPContext();
  const {
    isRunning,
    channelData,
    spectrumData,
    showSpectrum,
    sampleRate,
    activeChannels,
  } = analog;

  const isSpectrumDisabled = channelData[0].length < FFT_SIZE;

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
            disabled={isSpectrumDisabled} // *** FIX: Add disabled attribute ***
          />
          <span
            className="channel-indicator"
            style={{ backgroundColor: "#a78bfa" }}
          >
            Show Spectrum
          </span>
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
        {/* Only show spectrum if it's toggled AND not disabled */}
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

      <div className="analyzer-stats">
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
                    {(data.reduce((a, b) => a + b, 0) / data.length).toFixed(3)}
                  </strong>
                </p>
              </div>
            ),
        )}
      </div>
    </div>
  );
};
