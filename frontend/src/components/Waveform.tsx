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
  color?: string;
  data: DataPoint[];
}

class Waveform extends React.Component<WaveformProps> {
  constructor(props: WaveformProps) {
    super(props);
  }

  render() {
    return (
      <LineChart width={700} height={300} data={this.props.data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="time" />
        <YAxis />
        <Tooltip />
        <Line
          type="monotone"
          dataKey="value"
          stroke={this.props.color || "#8884d8"}
          dot={false}
        />
      </LineChart>
    );
  }
}

export default Waveform;
export type { DataPoint };
export { MAX_POINTS };
