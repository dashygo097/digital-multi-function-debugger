import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

type DataPoint = { time: number; value: number };

interface WaveformProps {
  data: DataPoint[];
  color?: string;
}

class Waveform extends React.Component<WaveformProps> {
  constructor(props: WaveformProps) {
    super(props);
    this.state = {
      data: [],
    };
  }

  render() {
    return (
      <LineChart width={300} height={180} data={this.props.data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="time" />
        <YAxis />
        <Tooltip />
        <Line
          type="monotone"
          dataKey="value"
          stroke={this.props.color || "#1494fd"}
          dot={false}
        />
      </LineChart>
    );
  }
}

export default Waveform;
export type { DataPoint };
