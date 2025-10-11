import React from "react";

export type DigitalSignalData = {
  time: number;
  value: number;
};

class DigitalWaveformChartProps {
  data: DigitalSignalData[];
  className?: string;
  width?: number;
  height?: number;
  strokeColor?: string;
  strokeWidth?: number;
  gridColor?: string;
  backgroundColor?: string;
  showGrid?: boolean;
}

export class DigitalWaveformChart extends React.Component<DigitalWaveformChartProps> {
  private canvasRef: React.RefObject<HTMLCanvasElement>;

  static defaultProps = {
    width: 800,
    height: 200,
    strokeColor: "#00ff00",
    strokeWidth: 2,
    gridColor: "#333333",
    backgroundColor: "#000000",
    showGrid: true,
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
    if (!canvas || !this.props.data.length) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const {
      width = 800,
      height = 200,
      strokeColor = "#00ff00",
      strokeWidth = 2,
      gridColor = "#333333",
      backgroundColor = "#000000",
      showGrid = true,
    } = this.props;

    // Clear canvas
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);

    if (showGrid) {
      this.drawGrid(ctx, width, height, gridColor);
    }

    this.drawDigitalSignal(ctx, width, height, strokeColor, strokeWidth);
  }

  private drawGrid(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    gridColor: string,
  ) {
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);

    const horizontalLines = 4;
    for (let i = 1; i < horizontalLines; i++) {
      const y = (height / horizontalLines) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    const verticalLines = 8;
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
  ) {
    const { data } = this.props;
    if (data.length < 2) return;

    const minTime = Math.min(...data.map((point) => point.time));
    const maxTime = Math.max(...data.map((point) => point.time));
    const timeRange = maxTime - minTime;

    const signalLevels = [...new Set(data.map((point) => point.value))].sort();
    const levelHeight = height / (signalLevels.length || 1);

    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (let i = 0; i < data.length - 1; i++) {
      const currentPoint = data[i];
      const nextPoint = data[i + 1];

      const x1 = ((currentPoint.time - minTime) / timeRange) * width;
      const x2 = ((nextPoint.time - minTime) / timeRange) * width;

      const currentLevelIndex = signalLevels.indexOf(currentPoint.value);
      const nextLevelIndex = signalLevels.indexOf(nextPoint.value);

      const y1 = height - (currentLevelIndex * levelHeight + levelHeight / 2);
      const y2 = height - (nextLevelIndex * levelHeight + levelHeight / 2);

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y1);
      ctx.stroke();

      if (currentPoint.value !== nextPoint.value) {
        ctx.beginPath();
        ctx.moveTo(x2, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    }

    const lastPoint = data[data.length - 1];
    const lastX = ((lastPoint.time - minTime) / timeRange) * width;
    const lastLevelIndex = signalLevels.indexOf(lastPoint.value);
    const lastY = height - (lastLevelIndex * levelHeight + levelHeight / 2);

    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(width, lastY);
    ctx.stroke();
  }

  render() {
    return (
      <div className={this.props.className}>
        <canvas
          ref={this.canvasRef}
          width={this.props.width}
          height={this.props.height}
          style={{
            display: "block",
            border: "1px solid #444",
            borderRadius: "4px",
          }}
        />
      </div>
    );
  }
}
