import React from "react";
import { WithRouter, WithRouterProps } from "@utils";
import { AnalogAnalyzer } from "./AnalogAnalyzer";
import "@styles/analyzer.css";

interface AnalyzerPageState {}

class AnalyzerPage extends React.Component<WithRouterProps, AnalyzerPageState> {
  constructor(props: WithRouterProps) {
    super(props);
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
            <p className="analyzer-subtitle">Oscilloscope & Data Logger</p>
          </div>

          <div className="analyzer-wrapper slide-up">
            <AnalogAnalyzer className="main-analyzer" />
          </div>
        </div>
      </div>
    );
  }
}

const WrappedAnalyzerPage = WithRouter(AnalyzerPage);
export default WrappedAnalyzerPage;
