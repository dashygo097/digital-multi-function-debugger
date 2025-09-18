import React from "react";

export type DigitalSignal = {
  time: number;
  value: number;
};

class DigitalWaveformChartProps {
  data: DigitalSignal[];
  className?: string;
}

export class DigitalWaveformChart extends React.Component<DigitalWaveformChartProps> {
  constructor(props: DigitalWaveformChartProps) {
    super(props);
  }

  render() {
    return <div></div>;
  }
}
