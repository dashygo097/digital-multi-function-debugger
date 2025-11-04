import React, { RefObject } from "react";

interface DrawingPanelProps {
  className: string;
  onWaveformReady: (data: number[]) => void;
  width?: number;
  height?: number;
}

interface DrawingPanelState {
  isDrawing: boolean;
  waveform: number[];
}

export class DrawingPanel extends React.Component<
  DrawingPanelProps,
  DrawingPanelState
> {
  private canvasRef: RefObject<HTMLCanvasElement>;
  private lastX = 0;
  private lastY = 0;

  static defaultProps = {
    width: 512,
    height: 256,
  };

  constructor(props: DrawingPanelProps) {
    super(props);
    this.canvasRef = React.createRef<HTMLCanvasElement>();
    this.state = {
      isDrawing: false,
      waveform: new Array(this.props.width!).fill(0),
    };
  }

  componentDidMount() {
    this.clearCanvas();
  }

  clearCanvas = () => {
    const { width, height } = this.props;
    const canvas = this.canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#1a1a2e"; // Dark background
        ctx.fillRect(0, 0, width!, height!);
        // Draw center line guide
        ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(0, height! / 2);
        ctx.lineTo(width!, height! / 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    this.setState({ waveform: new Array(width!).fill(0) });
  };

  getMousePos = (canvas: HTMLCanvasElement, evt: React.MouseEvent) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: evt.clientX - rect.left,
      y: evt.clientY - rect.top,
    };
  };

  startDrawing = (e: React.MouseEvent) => {
    const canvas = this.canvasRef.current;
    if (!canvas) return;
    const { x, y } = this.getMousePos(canvas, e);
    this.setState({ isDrawing: true });
    [this.lastX, this.lastY] = [x, y];
  };

  draw = (e: React.MouseEvent) => {
    if (!this.state.isDrawing || !this.canvasRef.current) return;
    const canvas = this.canvasRef.current;
    const { width, height } = this.props;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { x, y } = this.getMousePos(canvas, e);
    ctx.strokeStyle = "#50fa7b"; // Lime green for drawing
    ctx.lineWidth = 2;
    ctx.lineCap = "round";

    ctx.beginPath();
    ctx.moveTo(this.lastX, this.lastY);
    ctx.lineTo(x, y);
    ctx.stroke();

    // Update waveform data based on drawing
    const startX = Math.floor(Math.min(this.lastX, x));
    const endX = Math.ceil(Math.max(this.lastX, x));
    const newWaveform = [...this.state.waveform];

    for (let i = startX; i <= endX; i++) {
      if (i >= 0 && i < width!) {
        const t = endX - startX === 0 ? 1 : (i - startX) / (endX - startX);
        const interpolatedY = this.lastY + (y - this.lastY) * t;
        // Normalize Y to be between -1 and 1
        const normalizedY = -((interpolatedY - height! / 2) / (height! / 2));
        newWaveform[i] = Math.max(-1, Math.min(1, normalizedY));
      }
    }

    this.setState({ waveform: newWaveform });
    [this.lastX, this.lastY] = [x, y];
  };

  stopDrawing = () => {
    this.setState({ isDrawing: false });
  };

  handleSend = () => {
    const { onWaveformReady } = this.props;
    // Convert waveform from [-1, 1] to whatever format is needed, e.g., [0, 65535] for a 16-bit DAC
    const dacData = this.state.waveform.map((val) =>
      Math.round((val + 1) * 32767.5),
    );
    onWaveformReady(dacData);
    console.log("Waveform data sent:", dacData);
  };

  render() {
    const { className, width, height } = this.props;
    return (
      <div className={className}>
        <canvas
          ref={this.canvasRef}
          width={width}
          height={height}
          className="drawing-canvas"
          onMouseDown={this.startDrawing}
          onMouseMove={this.draw}
          onMouseUp={this.stopDrawing}
          onMouseLeave={this.stopDrawing}
        />
        <div className="drawing-panel-controls">
          <button onClick={this.clearCanvas} className="control-button">
            Clear
          </button>
          <button onClick={this.handleSend} className="control-button">
            Send to DAC
          </button>
        </div>
      </div>
    );
  }
}
