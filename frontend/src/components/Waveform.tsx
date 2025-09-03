import React from "react";
import {
  ScatterChart,
  Scatter,
  Line,
  XAxis,
  YAxis,
  ZAxis,
  Brush,
  CartesianGrid,
  Tooltip,
} from "recharts";

type DataPoint = { x: number; y: number };

interface WaveformProps {
  data: DataPoint[];
  color?: string;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="custom-tooltip">
        <p className="label">{`x: ${payload[0].payload.x}`}</p>
        <p className="intro">{`y: ${payload[0].payload.y.toFixed(3)}`}</p>
      </div>
    );
  }
  return null;
};

class Waveform extends React.Component<WaveformProps> {
  constructor(props: WaveformProps) {
    super(props);
  }

  render() {
    return (
      <ScatterChart
        width={480}
        height={280}
        data={this.props.data}
        margin={{
          top: 20,
          right: 20,
          bottom: 20,
          left: 20,
        }}
      >
        <CartesianGrid />
        <XAxis type="number" dataKey="x" />
        <YAxis type="number" dataKey="y" />
        <ZAxis type="number" dataKey="y" range={[20, 20]} />
        <Tooltip content={<CustomTooltip />} />
        <Line type="monotone" dataKey="y" stroke="#f4f4f4" dot={false} />
        <Scatter
          type="monotone"
          stroke={this.props.color || "#f4f4f4"}
          line={{ strokeWidth: 2 }}
        />
        <Brush />
      </ScatterChart>
    );
  }
}

export default Waveform;
export type { DataPoint };
