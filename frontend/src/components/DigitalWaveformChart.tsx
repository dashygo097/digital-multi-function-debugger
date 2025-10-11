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
  valueLabelsColor?: string;
  maxValue?: number;
}

export class DigitalWaveformChart extends React.Component<DigitalWaveformChartProps> {
  private canvasRef: React.RefObject<HTMLCanvasElement>;

  static defaultProps = {
    width: 800,
    height: 300,
    strokeColor: "#00ff00",
    strokeWidth: 2,
    gridColor: "#333333",
    backgroundColor: "#000000",
    showGrid: true,
    showValueLabels: true,
    valueLabelsColor: "#ffffff",
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
      height = 300,
      strokeColor = "#00ff00",
      strokeWidth = 2,
      gridColor = "#333333",
      backgroundColor = "#000000",
      showGrid = true,
      maxValue,
    } = this.props;

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);

    if (showGrid) {
      this.drawGrid(ctx, width, height, gridColor);
    }

    this.drawDigitalSignal(
      ctx,
      width,
      height,
      strokeColor,
      strokeWidth,
      maxValue,
    );
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

    const horizontalLines = 8;
    for (let i = 1; i < horizontalLines; i++) {
      const y = (height / horizontalLines) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    const verticalLines = 12;
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
    maxValue?: number,
  ) {
    const { data } = this.props;
    if (data.length < 2) return;

    const minValue = 0;
    const actualMaxValue =
      maxValue || Math.max(...data.map((point) => point.value));
    const valueRange = actualMaxValue - minValue;

    const minTime = Math.min(...data.map((point) => point.time));
    const maxTime = Math.max(...data.map((point) => point.time));
    const timeRange = maxTime - minTime;

    const getYPosition = (value: number) => {
      const normalizedValue = (value - minValue) / valueRange;
      return height - (normalizedValue * height * 0.9 + height * 0.05); // 5% padding top and bottom
    };

    const getXPosition = (time: number) => {
      return ((time - minTime) / timeRange) * width;
    };

    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (let i = 0; i < data.length - 1; i++) {
      const currentPoint = data[i];
      const nextPoint = data[i + 1];

      const x1 = getXPosition(currentPoint.time);
      const x2 = getXPosition(nextPoint.time);
      const y1 = getYPosition(currentPoint.value);
      const y2 = getYPosition(nextPoint.value);

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
    const lastX = getXPosition(lastPoint.time);
    const lastY = getYPosition(lastPoint.value);

    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(width, lastY);
    ctx.stroke();
  }

  render() {
    const { className, width = 800, height = 300 } = this.props;

    return (
      <div className={className}>
        <canvas
          ref={this.canvasRef}
          width={width}
          height={height}
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
