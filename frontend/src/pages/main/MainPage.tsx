import React from "react";

import { WithRouter, WithRouterProps } from "@utils";
import { AnalogSignalData, SerialTerminal, UDPTerminal } from "@components";
import "@styles/main.css";

interface MainPageState {
  data: AnalogSignalData[];
  inputValue: string;
}

class MainPage extends React.Component<WithRouterProps, MainPageState> {
  constructor(props: WithRouterProps) {
    super(props);
    this.state = {
      data: [],
      inputValue: "",
    };
  }

  render() {
    return (
      <div className="main-page">
        {/* Animated Background */}
        <div className="background-animation">
          <div className="gradient-orb orb-1"></div>
          <div className="gradient-orb orb-2"></div>
          <div className="gradient-orb orb-3"></div>
        </div>

        {/* Main Content */}
        <div className="main-content">
          <div className="main-header fade-in">
            <h1 className="main-title">Control Panel</h1>
            <p className="main-subtitle">System Monitoring & Communication</p>
          </div>

          <div className="terminals-wrapper slide-up">
            <div className="terminal-wrapper">
              <h2 className="terminal-heading">Serial Terminal</h2>
              <SerialTerminal className="main-serialterminal" />
            </div>

            <div className="terminal-wrapper">
              <h2 className="terminal-heading">UDP Terminal</h2>
              <UDPTerminal
                className="main-udpterminal"
                bridgeUrl="ws://localhost:8080"
              />
            </div>
          </div>
        </div>
      </div>
    );
  }
}

const WrappedMainPage = WithRouter(MainPage);
export default WrappedMainPage;
