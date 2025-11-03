import React from "react";

export type DigitalSignalData = number;

interface DigitalWaveformChartProps {
  data: DigitalSignalData[];
  className?: string;
  width?: number;
  height?: number;
  strokeColor?: string;
  strokeWidth?: number;
  gridColor?: string;
  backgroundColor?: string;
  showGrid?: boolean;
  maxValue?: number;
}

export class DigitalWaveformChart extends React.Component<DigitalWaveformChartProps> {
  private canvasRef: React.RefObject<HTMLCanvasElement>;

  static defaultProps = {
    width: 800,
    height: 100, // Default height is smaller for digital signals
    strokeColor: "#00ff00",
    strokeWidth: 2,
    gridColor: "#333333",
    backgroundColor: "#1a1a2e",
    showGrid: true,
    maxValue: 1,
  };

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

    const {
      width = 800,
      height = 100,
      strokeColor = "#00ff00",
      strokeWidth = 2,
      gridColor = "#333333",
      backgroundColor = "#1a1a2e",
      showGrid = true,
      maxValue = 1,
    } = this.props;

    // Clear canvas
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);

    if (showGrid) {
      this.drawGrid(ctx, width, height, gridColor);
    }

    if (this.props.data.length > 0) {
      this.drawDigitalSignal(
        ctx,
        width,
        height,
        strokeColor,
        strokeWidth,
        maxValue,
      );
    }
  }

  private drawGrid(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    gridColor: string,
  ) {
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 0.5;
    ctx.setLineDash([2, 4]);

    // Horizontal lines (one in the middle)
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();

    // Vertical lines
    const verticalLines = 20;
    for (let i = 1; i < verticalLines; i++) {
      const x = (width / verticalLines) * i;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  private drawDigitalSignal(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    strokeColor: string,
    strokeWidth: number,
    maxValue: number,
  ) {
    const { data } = this.props;
    if (data.length === 0) return;

    const stepX = width / Math.max(1, data.length - 1);
    const yHigh = height * 0.2; // 20% from top
    const yLow = height * 0.8; // 80% from top

    const getYPosition = (value: number) => (value > 0 ? yHigh : yLow);

    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = "butt";
    ctx.lineJoin = "miter";
    ctx.beginPath();

    // Start from the first point
    ctx.moveTo(0, getYPosition(data[0]));

    for (let i = 1; i < data.length; i++) {
      const prevValue = data[i - 1];
      const currentValue = data[i];
      const prevX = (i - 1) * stepX;
      const currentX = i * stepX;

      const y1 = getYPosition(prevValue);
      const y2 = getYPosition(currentValue);

      // Draw horizontal line for the previous segment
      ctx.lineTo(currentX, y1);

      // If value changes, draw vertical line
      if (y1 !== y2) {
        ctx.lineTo(currentX, y2);
      }
    }
    ctx.stroke();
  }

  render() {
    const { className, width = 800, height = 100 } = this.props;
    return (
      <div className={className}>
        <canvas
          ref={this.canvasRef}
          width={width}
          height={height}
          style={{ display: "block", width: "100%", height: "auto" }}
        />
      </div>
    );
  }
}
