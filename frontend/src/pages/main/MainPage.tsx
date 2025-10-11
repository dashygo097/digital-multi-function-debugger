import React from "react";

import { WithRouter, WithRouterProps } from "@utils";
import {
  USBDeviceList,
  SerialPortList,
  AnalogSignalData,
  AnalogWaveformChart,
  DigitalSignalData,
  DigitalWaveformChart,
} from "@components";
import "@styles/main.css";

const MAX_DATA_POINTS = 10;

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
    const sampleData: DigitalSignalData[] = [
      { time: 0, value: 11 },
      { time: 1, value: 28 },
      { time: 2, value: 12 },
      { time: 3, value: 28 },
      { time: 4, value: 20 },
      { time: 5, value: 12 },
      { time: 6, value: 20 },
      { time: 7, value: 11 },
      { time: 8, value: 20 },
      { time: 9, value: 10 },
    ];
    return (
      <div className="main-page">
        <h1>Control Panel</h1>
        <USBDeviceList className="main-usblist" />
        <SerialPortList className="main-seriallist" />
        <AnalogWaveformChart data={this.state.data} />
        <DigitalWaveformChart
          data={sampleData}
          width={600}
          height={150}
          strokeColor="#ff6b6b"
          backgroundColor="#1a1a1a"
          className="my-waveform"
        />
      </div>
    );
  }
}
const WrappedMainPage = WithRouter(MainPage);
export default WrappedMainPage;
