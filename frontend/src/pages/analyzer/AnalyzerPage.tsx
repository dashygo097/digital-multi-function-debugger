import React from "react";
import { WithRouter } from "@utils";
import { AnalogAnalyzer } from "./AnalogAnalyzer";
import { DigitalAnalyzer } from "./DigitalAnalyzer";
import { useAnalyzer } from "@contexts";
import "@styles/analyzer.css";

const AnalyzerPage: React.FC = () => {
  const { analyzerType, dataSource, setAnalyzerType, setDataSource } =
    useAnalyzer();

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

  const getFooterText = () => {
    if (analyzerType === "analog") {
      return `Showing 1 analog channel from the UDP data source.`;
    }
    return `Showing 8 digital channels from the '${dataSource}' data source.`;
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
