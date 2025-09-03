import React, { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

type DataPoint = { x: number; y: number };

interface WaveformProps {
  data: DataPoint[];
  color?: string;
}

class Waveform extends React.Component<WaveformProps> {
  constructor(props: WaveformProps) {
    super(props);
  }

  render() {
    return (
      <LineChart width={300} height={180} data={this.props.data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="x"
          tickFormatter={(tick) => (tick % 10 === 0 ? tick : "")}
        />
        <YAxis />
        <Tooltip />
        <Line
          type="monotone"
          dataKey="y"
          stroke={this.props.color || "#1494fd"}
          dot={false}
        />
      </LineChart>
    );
  }
}

export default Waveform;
export type { DataPoint };
