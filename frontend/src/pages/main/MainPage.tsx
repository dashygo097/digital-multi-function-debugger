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

  private openCSRWindow = () => {
    if (window.electron) {
      window.electron.ipcRenderer.send("open-csr-window");
    } else {
      alert("CSR Control window requires Electron");
    }
  };

  render() {
    return (
      <div className="main-page">
        <div className="main-header">
          <h1>Control Panel</h1>
          <button onClick={this.openCSRWindow} className="btn-csr-window">
            🎛️ Open CSR Control
          </button>
        </div>
        <SerialTerminal className="main-serialterminal" />
        <UDPTerminal
          className="main-udpterminal"
          bridgeUrl="ws://localhost:8080"
        />
      </div>
    );
  }
}
const WrappedMainPage = WithRouter(MainPage);
export default WrappedMainPage;
