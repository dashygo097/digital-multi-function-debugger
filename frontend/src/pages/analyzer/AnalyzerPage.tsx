import React from "react";
import { WithRouter, WithRouterProps } from "@utils";
import { AnalogAnalyzer } from "./AnalogAnalyzer";
import "@styles/analyzer.css";

interface AnalyzerPageState {
  channelCount: number;
}

class AnalyzerPage extends React.Component<WithRouterProps, AnalyzerPageState> {
  constructor(props: WithRouterProps) {
    super(props);
    this.state = {
      channelCount: 1,
    };
  }

  handleChannelCountChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    this.setState({ channelCount: parseInt(e.target.value) });
  };

  render() {
    return (
      <div className="analyzer-page">
        {/* Main Content */}
        <div className="analyzer-content">
          <div className="analyzer-header fade-in">
            <h1 className="analyzer-title">Analog Signal Analyzer</h1>
            <p className="analyzer-subtitle">
              Multi-Channel Oscilloscope & Data Logger
            </p>
          </div>

          <div className="analyzer-config slide-up">
            <div className="config-group">
              <label>
                Channels:
                <select
                  value={this.state.channelCount}
                  onChange={this.handleChannelCountChange}
                >
                  <option value="1">1 Channel</option>
                  <option value="2">2 Channels</option>
                  <option value="4">4 Channels</option>
                  <option value="8">8 Channels</option>
                </select>
              </label>
            </div>
          </div>

          <div className="analyzer-wrapper slide-up">
            <AnalogAnalyzer
              className="main-analyzer"
              channelCount={this.state.channelCount}
            />
          </div>
        </div>
      </div>
    );
  }
}

const WrappedAnalyzerPage = WithRouter(AnalyzerPage);
export default WrappedAnalyzerPage;
