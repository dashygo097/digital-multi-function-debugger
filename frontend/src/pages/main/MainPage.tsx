import React from "react";

import { WithRouter, WithRouterProps } from "@utils";
import {
  USBDeviceList,
  SerialPortList,
  AnalogSignalData,
  AnalogWaveformChart,
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
    return (
      <div className="main-page">
        <h1>Control Panel</h1>
        <USBDeviceList className="main-usblist" />
        <SerialPortList className="main-seriallist" />
        <AnalogWaveformChart data={this.state.data} />
      </div>
    );
  }
}
const WrappedMainPage = WithRouter(MainPage);
export default WrappedMainPage;
