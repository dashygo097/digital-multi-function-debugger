import React from "react";
import { WithRouter, WithRouterProps } from "@utils";
import { AnalogAnalyzer } from "./AnalogAnalyzer";
import { DigitalAnalyzer } from "./DigitalAnalyzer";
import "@styles/analyzer.css";

interface AnalyzerPageState {
  analyzerType: "analog" | "digital";
  dataSource: "serial" | "udp";
}

class AnalyzerPage extends React.Component<WithRouterProps, AnalyzerPageState> {
  constructor(props: WithRouterProps) {
    super(props);
    this.state = {
      analyzerType: "analog",
      dataSource: "udp", // Default to UDP
    };
  }

  componentDidUpdate(prevProps: WithRouterProps, prevState: AnalyzerPageState) {
    // If the user switches to 'analog' mode, force the data source to 'udp'.
    if (
      this.state.analyzerType === "analog" &&
      this.state.dataSource !== "udp"
    ) {
      this.setState({ dataSource: "udp" });
    }
  }

  handleAnalyzerTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newType = e.target.value as "analog" | "digital";
    this.setState({ analyzerType: newType });
  };

  handleDataSourceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    this.setState({ dataSource: e.target.value as "serial" | "udp" });
  };

  render() {
    const { analyzerType, dataSource } = this.state;
    const isDataSourceDisabled = analyzerType === "analog";

    const getFooterText = () => {
      if (analyzerType === "analog") {
        return `Showing 1 analog channel from the UDP data source.`;
      }
      return `Showing 8 digital channels (bits 0-7) from the '${dataSource}' data source.`;
    };

    return (
      <div className="analyzer-page">
        <div className="background-animation">
          <div className="gradient-orb orb-1"></div>
          <div className="gradient-orb orb-2"></div>
          <div className="gradient-orb orb-3"></div>
        </div>
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
                <select
                  value={analyzerType}
                  onChange={this.handleAnalyzerTypeChange}
                >
                  <option value="analog">Analog</option>
                  <option value="digital">Digital</option>
                </select>
              </label>
              <label>
                Data Source:
                <select
                  value={dataSource}
                  onChange={this.handleDataSourceChange}
                  disabled={isDataSourceDisabled}
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
              <DigitalAnalyzer
                className="main-analyzer"
                dataSource={dataSource}
              />
            )}
          </div>

          <div className="analyzer-footer">
            <p className="footer-info">{getFooterText()}</p>
          </div>
        </div>
      </div>
    );
  }
}

const WrappedAnalyzerPage = WithRouter(AnalyzerPage);
export default WrappedAnalyzerPage;
