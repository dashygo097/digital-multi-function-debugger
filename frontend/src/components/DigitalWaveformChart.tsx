import React from "react";

export type DigitalByteData = number; // Represents a byte (0-255)

interface DigitalWaveformChartProps {
  data: DigitalByteData[];
  className?: string;
  width?: number;
  height?: number;
  gridColor?: string;
  backgroundColor?: string;
  textColor?: string;
}

export class DigitalWaveformChart extends React.Component<DigitalWaveformChartProps> {
  private canvasRef: React.RefObject<HTMLCanvasElement>;

  static defaultProps = {
    width: 800,
    height: 240,
    gridColor: "#334155",
    backgroundColor: "#1e293b",
    textColor: "#94a3b8",
  };

  private readonly bitColors = [
    "#34d399",
    "#f87171",
    "#60a5fa",
    "#fbbf24",
    "#a78bfa",
    "#f472b6",
    "#2dd4bf",
    "#facc15",
  ];

  constructor(props: DigitalWaveformChartProps) {
    super(props);
    this.canvasRef = React.createRef();
  }

  componentDidMount() {
    this.drawWaveform();
  }
  componentDidUpdate() {
    this.drawWaveform();
  }

  private drawWaveform() {
    const canvas = this.canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height, backgroundColor, gridColor, textColor, data } = {
      ...DigitalWaveformChart.defaultProps,
      ...this.props,
    };

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    // Layout constants
    const labelWidth = 50;
    const chartWidth = width - labelWidth;
    const bitRowHeight = 60;

    // Clear canvas
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);

    // Draw labels and grid
    ctx.font = "12px monospace";
    ctx.fillStyle = textColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    for (let i = 0; i < 4; i++) {
      const y = i * bitRowHeight + bitRowHeight / 2;
      ctx.fillText(`B${3 - i}`, labelWidth / 2, y);
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(labelWidth, i * bitRowHeight);
      ctx.lineTo(width, i * bitRowHeight);
      ctx.stroke();
    }

    if (data.length === 0) return;

    // Drawing logic
    const stepX = chartWidth / data.length;
    ctx.lineWidth = 2;
    ctx.font = "10px monospace";

    for (let i = 0; i < data.length; i++) {
      const byte = data[i];
      const prevByte = i > 0 ? data[i - 1] : byte;
      const x = labelWidth + i * stepX;
      const centerX = x + stepX / 2;

      // Draw 8 bit waveforms
      for (let bit = 0; bit < 8; bit++) {
        const yOffset = (7 - bit) * bitRowHeight;
        const yHigh = yOffset + bitRowHeight * 0.25;
        const yLow = yOffset + bitRowHeight * 0.75;

        const currentBitValue = (byte >> bit) & 1;
        const prevBitValue = (prevByte >> bit) & 1;

        const y1 = prevBitValue ? yHigh : yLow;
        const y2 = currentBitValue ? yHigh : yLow;

        ctx.strokeStyle = this.bitColors[bit];
        ctx.beginPath();
        ctx.moveTo(x, y1);
        if (y1 !== y2) {
          ctx.lineTo(x, y2); // Vertical transition
        }
        ctx.lineTo(x + stepX, y2); // Horizontal line
        ctx.stroke();
      }

      // Draw Hex value
      ctx.fillStyle = "#e2e8f0";
      const hexString = byte.toString(16).padStart(2, "0").toUpperCase();
      ctx.fillText(hexString, centerX, 8 * bitRowHeight + hexRowHeight / 2);
    }
  }

  render() {
    return <canvas ref={this.canvasRef} className={this.props.className} />;
  }
}
