import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export type AnalogSignalData = number;

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div
        className="custom-tooltip"
        style={{ background: "#333", padding: "5px", border: "1px solid #555" }}
      >
        <p className="label">{`Index: ${payload[0].payload.index}`}</p>
        <p className="intro">{`Value: ${payload[0].value.toFixed(3)}`}</p>
      </div>
    );
  }
  return null;
};

interface AnalogWaveformChartProps {
  data: AnalogSignalData[];
  color?: string;
}

export class AnalogWaveformChart extends React.Component<AnalogWaveformChartProps> {
  render() {
    // Recharts needs an array of objects, so we map the number array
    const chartData = this.props.data.map((value, index) => ({ index, value }));
    const yMin = Math.min(...this.props.data);
    const yMax = Math.max(...this.props.data);

    return (
      <ResponsiveContainer width="100%" height={280}>
        <LineChart
          data={chartData}
          margin={{
            top: 20,
            right: 20,
            bottom: 20,
            left: 20,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#555" />
          <XAxis
            dataKey="index"
            type="number"
            domain={["dataMin", "dataMax"]}
          />
          <YAxis
            type="number"
            domain={[yMin, yMax]}
            tickFormatter={(tick) => tick.toFixed(2)}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="value"
            stroke={this.props.color || "#8884d8"}
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    );
  }
}
