import React from "react";

import { WithRouter, WithRouterProps } from "@utils";
import {
  AnalogSignalData,
  SerialTerminal,
  UDPTerminal,
  PWMTerminal,
  CollapsiblePanel,
  SignalMeasureTerminal,
  BitseqLooperTerminal,
  SpiTerminal,
  I2cTerminal,
  UartTerminal,
  WaveSelTerminal,
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
        <div className="main-content">
          <div className="main-header fade-in">
            <h1 className="main-title">Control Panel</h1>
            <p className="main-subtitle">System Monitoring & Communication</p>
          </div>

          <div className="terminals-wrapper slide-up">
            <CollapsiblePanel title="MAIN Terminal">
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

            <CollapsiblePanel title="Signal Measure Terminal">
              <SignalMeasureTerminal className="main-signalterminal" />
            </CollapsiblePanel>

            <CollapsiblePanel title="Bit Sequence Terminal">
              <BitseqLooperTerminal className="main-bitseqterminal" />
            </CollapsiblePanel>

            <CollapsiblePanel title="UART Terminal">
              <UartTerminal className="main-uartterminal" />
            </CollapsiblePanel>

            <CollapsiblePanel title="WaveSel Terminal">
              <WaveSelTerminal className="main-wavesel" />
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
