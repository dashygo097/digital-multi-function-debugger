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

export type AnalogSignalData = { time: number; value: number };

const CustomTooltip = (
  active: boolean,
  payload: Array<{ payload: AnalogSignalData; value: number }>,
) => {
  if (active && payload && payload.length) {
    return (
      <div className="custom-tooltip">
        <p className="label">{`time: ${payload[0].payload.time}`}</p>
        <p className="intro">{`value: ${payload[0].payload.value.toFixed(3)}`}</p>
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
  constructor(props: AnalogWaveformChartProps) {
    super(props);
  }

  getMinTime() {
    let minTime: number = Number.MAX_VALUE;
    for (let i = 0; i < this.props.data.length; i++) {
      minTime = Math.min(minTime, this.props.data[i].time);
    }
    return minTime;
  }

  getMaxTime() {
    let maxTime: number = -Number.MAX_VALUE;
    for (let i = 0; i < this.props.data.length; i++) {
      maxTime = Math.max(maxTime, this.props.data[i].time);
    }
    return maxTime;
  }

  getMinValue() {
    let minValue: number = Number.MAX_VALUE;
    for (let i = 0; i < this.props.data.length; i++) {
      minValue = Math.min(minValue, this.props.data[i].value);
    }
    return minValue;
  }

  getMaxValue() {
    let maxValue: number = -Number.MAX_VALUE;
    for (let i = 0; i < this.props.data.length; i++) {
      maxValue = Math.max(maxValue, this.props.data[i].value);
    }
    return maxValue;
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
        <XAxis
          type="number"
          dataKey="time"
          domain={[this.getMinTime(), this.getMaxTime()]}
        />
        <YAxis type="number" dataKey="value" />
        <ZAxis type="number" dataKey="value" range={[20, 20]} />
        <Tooltip
          content={(props) => CustomTooltip(props.active, props.payload)}
        />
        <Line type="monotone" dataKey="value" stroke="#f4f4f4" dot={false} />
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
