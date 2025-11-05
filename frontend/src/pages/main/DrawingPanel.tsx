import React, { RefObject } from "react";
import { SerialContext } from "@contexts";

interface DrawingPanelProps {
  className: string;
  width?: number;
  height?: number;
}

interface DrawingPanelState {
  isDrawing: boolean;
  waveform: number[];
  frequency: string;
}

export class DrawingPanel extends React.Component<
  DrawingPanelProps,
  DrawingPanelState
> {
  static contextType = SerialContext;
  context!: React.ContextType<typeof SerialContext>;

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
      frequency: "1000",
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
        ctx.fillStyle = "#1a1a2e";
        ctx.fillRect(0, 0, width!, height!);
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
    ctx.strokeStyle = "#50fa7b";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";

    ctx.beginPath();
    ctx.moveTo(this.lastX, this.lastY);
    ctx.lineTo(x, y);
    ctx.stroke();

    const startX = Math.floor(Math.min(this.lastX, x));
    const endX = Math.ceil(Math.max(this.lastX, x));
    const newWaveform = [...this.state.waveform];

    for (let i = startX; i <= endX; i++) {
      if (i >= 0 && i < width!) {
        const t = endX - startX === 0 ? 1 : (i - startX) / (endX - startX);
        const interpolatedY = this.lastY + (y - this.lastY) * t;
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

  handleSend = async () => {
    if (!this.context) {
      console.error(
        "SerialContext not found. Component might not be wrapped in SerialProvider.",
      );
      return;
    }
    const { writeCSR } = this.context;

    const dacData = this.state.waveform.map((val) =>
      Math.round((val + 1) * 127.5),
    );
    const frequency = Number(this.state.frequency) || 0;

    await writeCSR("0x3400C", "FF");
    await writeCSR("0x34008", frequency.toString(16));

    for (let i = 0; i < dacData.length; i += 2) {
      await writeCSR("0x34010", dacData[i].toString(16));
      await writeCSR("0x34014", "1");
    }
    await writeCSR("0x34000", "1");

    console.log("Finished sending waveform and configuration to DAC.");
  };

  handleFrequencyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({ frequency: e.target.value });
  };

  render() {
    const { className, width, height } = this.props;
    return (
      <div className={`${className} drawing-panel-container`}>
        <div className="drawing-area">
          <h3 className="drawing-panel-title">Custom Waveform Drawer</h3>
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
        </div>
        <div className="drawing-panel-right-controls">
          <div className="control-group">
            <label htmlFor="frequency-input">Frequency (Hz)</label>
            <input
              id="frequency-input"
              type="number"
              value={this.state.frequency}
              onChange={this.handleFrequencyChange}
              className="control-input"
              placeholder="e.g., 1000"
            />
          </div>
          <div className="control-button-group">
            <button onClick={this.handleSend} className="control-button">
              Send to DAC
            </button>
            <button
              onClick={this.clearCanvas}
              className="control-button clear-btn"
            >
              Clear
            </button>
          </div>
        </div>
      </div>
    );
  }
}
