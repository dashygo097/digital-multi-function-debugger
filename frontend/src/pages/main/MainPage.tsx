import React from "react";

import { WithRouter, WithRouterProps } from "@utils";
import { AnalogSignalData, SerialTerminal, UDPTerminal } from "@components";
import "@styles/main.css";

interface MainPageState {
  data: AnalogSignalData[];
  inputValue: string;
  isSerialTerminalCollapsed: boolean;
  isUdpTerminalCollapsed: boolean;
}

class MainPage extends React.Component<WithRouterProps, MainPageState> {
  constructor(props: WithRouterProps) {
    super(props);
    this.state = {
      data: [],
      inputValue: "",
      isSerialTerminalCollapsed: false,
      isUdpTerminalCollapsed: false,
    };
  }

  toggleSerialTerminal = () => {
    this.setState((prevState) => ({
      isSerialTerminalCollapsed: !prevState.isSerialTerminalCollapsed,
    }));
  };

  toggleUdpTerminal = () => {
    this.setState((prevState) => ({
      isUdpTerminalCollapsed: !prevState.isUdpTerminalCollapsed,
    }));
  };

  render() {
    const { isSerialTerminalCollapsed, isUdpTerminalCollapsed } = this.state;
    return (
      <div className="main-page">
        {/* Main Content */}
        <div className="main-content">
          <div className="main-header fade-in">
            <h1 className="main-title">Control Panel</h1>
            <p className="main-subtitle">System Monitoring & Communication</p>
          </div>

          <div className="terminals-wrapper slide-up">
            <div className="terminal-wrapper">
              <div
                className="terminal-header"
                onClick={this.toggleSerialTerminal}
              >
                <h2 className="terminal-heading">Serial Terminal</h2>
                <button className="terminal-toggle-btn">
                  {isSerialTerminalCollapsed ? "+" : "-"}
                </button>
              </div>
              <div
                className={`terminal-content ${isSerialTerminalCollapsed ? "collapsed" : ""}`}
              >
                <SerialTerminal className="main-serialterminal" />
              </div>
            </div>

            <div className="terminal-wrapper">
              <div className="terminal-header" onClick={this.toggleUdpTerminal}>
                <h2 className="terminal-heading">UDP Terminal</h2>
                <button className="terminal-toggle-btn">
                  {isUdpTerminalCollapsed ? "+" : "-"}
                </button>
              </div>
              <div
                className={`terminal-content ${isUdpTerminalCollapsed ? "collapsed" : ""}`}
              >
                <UDPTerminal
                  className="main-udpterminal"
                  bridgeUrl="ws://localhost:8080"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

const WrappedMainPage = WithRouter(MainPage);
export default WrappedMainPage;
