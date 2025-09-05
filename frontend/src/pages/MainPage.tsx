import React from "react";

import { withRouter } from "../utils/withRouter";
import Waveform, { DataPoint } from "../components/Waveform";
import InputTracer from "../components/InputTracer";

const MAX_DATA_POINTS = 100;

interface MainPageProps {
  navigate: (path: string) => void;
}

interface MainPageState {
  data: DataPoint[];
  inputValue: string;
}

class MainPage extends React.Component<MainPageProps, MainPageState> {
  constructor(props: MainPageProps) {
    super(props);
    this.state = {
      data: [],
      inputValue: "",
    };
  }

  componentDidMount() {
    const initialData: DataPoint[] = [];
    for (let i = 0; i < 20; i++) {
      initialData.push({ x: i, y: Math.sin(i / 3) * 10 + 10 });
    }
    this.setState({ data: initialData });
  }

  handleInputChange = (value: string) => {
    this.setState({ inputValue: value });
  };

  handleInputSubmit = () => {
    const value = parseFloat(this.state.inputValue);
    if (!isNaN(value)) {
      this.addDataPoint(value);
      this.setState({ inputValue: "" });
    }
  };

  addDataPoint = (yValue: number) => {
    this.setState((prevState) => {
      const newX = prevState.data.length + 1;

      const newDataPoint: DataPoint = { x: newX, y: yValue };

      let newData = [...prevState.data, newDataPoint];

      if (newData.length > MAX_DATA_POINTS) {
        newData = newData.slice(newData.length - MAX_DATA_POINTS);
      }

      return { data: newData };
    });
  };

  render() {
    return (
      <div className="page-home">
        <h1>Waveform Example</h1>
        <Waveform data={this.state.data} />
        <InputTracer
          name="hehe"
          value={this.state.inputValue}
          onChange={this.handleInputChange}
          onSubmit={this.handleInputSubmit}
        />
      </div>
    );
  }
}
const WrappedMainPage = withRouter(MainPage);
export default WrappedMainPage;
