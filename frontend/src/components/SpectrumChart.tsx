import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface SpectrumChartProps {
  data: number[];
  sampleRate: number;
  fftSize: number;
  color?: string;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div
        className="custom-tooltip"
        style={{
          background: "#333",
          padding: "5px 10px",
          border: "1px solid #555",
          borderRadius: "4px",
        }}
      >
        <p className="label">{`Frequency: ${label.toFixed(2)} Hz`}</p>
        <p className="intro">{`Magnitude: ${payload[0].value.toFixed(4)}`}</p>
      </div>
    );
  }
  return null;
};

export const SpectrumChart: React.FC<SpectrumChartProps> = ({
  data,
  sampleRate,
  fftSize,
  color = "#a78bfa",
}) => {
  if (!data || data.length === 0) return null;

  const frequencyStep = sampleRate / fftSize;
  const chartData = data.map((magnitude, index) => ({
    frequency: index * frequencyStep,
    magnitude: magnitude,
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart
        data={chartData}
        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
      >
        <XAxis
          dataKey="frequency"
          type="number"
          domain={[0, sampleRate / 2]}
          tickFormatter={(freq) => `${(freq / 1000).toFixed(1)}k`}
          label={{
            value: "Frequency (kHz)",
            position: "insideBottom",
            offset: -5,
          }}
        />
        <YAxis
          scale="log"
          domain={[0.001, "dataMax"]}
          allowDataOverflow
          label={{
            value: "Magnitude (log)",
            angle: -90,
            position: "insideLeft",
          }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="magnitude" fill={color} />
      </BarChart>
    </ResponsiveContainer>
  );
};
