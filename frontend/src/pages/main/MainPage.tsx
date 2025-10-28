import React from "react";

import { WithRouter, WithRouterProps } from "@utils";
import { USBDeviceList, AnalogSignalData, SerialTerminal } from "@components";
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
        <h1>Control Panel</h1>
        <USBDeviceList className="main-usblist" />
        <SerialTerminal className="main-serialterminal" />
      </div>
    );
  }
}
const WrappedMainPage = WithRouter(MainPage);
export default WrappedMainPage;
