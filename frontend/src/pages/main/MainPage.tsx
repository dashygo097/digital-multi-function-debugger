import React from "react";

import { WithRouter, WithRouterProps } from "@utils";
import {
  AnalogSignalData,
  SerialTerminal,
  UDPTerminal,
  PWMTerminal,
  CollapsiblePanel,
} from "@components";
import "@styles/main.css";
import { DrawingPanel } from "./DrawingPanel";

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
        {/* Main Content */}
        <div className="main-content">
          <div className="main-header fade-in">
            <h1 className="main-title">Control Panel</h1>
            <p className="main-subtitle">System Monitoring & Communication</p>
          </div>

          <div className="terminals-wrapper slide-up">
            <CollapsiblePanel title="Serial Terminal">
              <SerialTerminal className="main-serialterminal" />
            </CollapsiblePanel>

            <CollapsiblePanel title="UDP Terminal">
              <UDPTerminal
                className="main-udpterminal"
                bridgeUrl="ws://localhost:8080"
              />
            </CollapsiblePanel>

            <CollapsiblePanel title="PWM Terminal">
              <PWMTerminal className="main-pwmterminal" />
            </CollapsiblePanel>

            <CollapsiblePanel title="Custom Waveform Drawer">
              <DrawingPanel
                className="main-drawingpanel"
                onWaveformReady={(waveform) => {
                  console.log("Waveform ready:", waveform);
                }}
              />
            </CollapsiblePanel>
          </div>
        </div>
      </div>
    );
  }
}

const WrappedMainPage = WithRouter(MainPage);
export default WrappedMainPage;
