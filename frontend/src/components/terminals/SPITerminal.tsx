import React, { Component, RefObject } from "react";
import { ProtocolContext } from "@contexts";
import { Message } from "@utils";

const BASE_ADDR = 0x83000;
const REGS = {
  SPI_CONFIG: BASE_ADDR + 0x00,
  SPI_CONTROL: BASE_ADDR + 0x04,
  SPI_TX_DATA: BASE_ADDR + 0x10,
  SPI_TX_CTRL: BASE_ADDR + 0x14,
  SPI_RX_DATA: BASE_ADDR + 0x20,
  SPI_RX_CTRL: BASE_ADDR + 0x24,
  SPI_STATUS: BASE_ADDR + 0x30,
  SPI_TX_COUNT: BASE_ADDR + 0x34,
  SPI_RX_COUNT: BASE_ADDR + 0x38,
  SPI_FIFO_STATUS: BASE_ADDR + 0x3c,
  SPI_PIN_STATUS: BASE_ADDR + 0x40,
};
const SYSTEM_CLOCK_HZ = 125_000_000; // Assuming a 125MHz system clock

interface SpiTerminalProps {
  className?: string;
}

interface SpiTerminalState {
  messages: Message[];
  stats: { errors: number };
  autoScroll: boolean;

  clkDiv: string;
  spiMode: number;
  msbFirst: boolean;
  isEnabled: boolean;

  txData: string;
  rxData: number[];
  bytesToRead: string;

  isBusy: boolean;
  txFifoCount: number;
  rxFifoCount: number;
  txTotalCount: number;
  rxTotalCount: number;
  pinStatus: { sck: boolean; mosi: boolean; miso: boolean; cs: boolean };
}

export class SpiTerminal extends Component<SpiTerminalProps, SpiTerminalState> {
  static contextType = ProtocolContext;
  context!: React.ContextType<typeof ProtocolContext>;

  private terminalEndRef: RefObject<HTMLDivElement>;
  private pollInterval: number | null = null;

  constructor(props: SpiTerminalProps) {
    super(props);
    this.state = {
      messages: [],
      stats: { errors: 0 },
      autoScroll: true,
      clkDiv: "250",
      spiMode: 0,
      msbFirst: true,
      isEnabled: false,
      txData: "Hello SPI!",
      rxData: [],
      bytesToRead: "10",
      isBusy: false,
      txFifoCount: 0,
      rxFifoCount: 0,
      txTotalCount: 0,
      rxTotalCount: 0,
      pinStatus: { sck: false, mosi: false, miso: false, cs: true },
    };
    this.terminalEndRef = React.createRef<HTMLDivElement>();
  }

  componentDidMount() {
    this.applyConfig(false); // Apply initial config without logging
    this.pollInterval = window.setInterval(this.pollStatus, 1000);
  }

  componentWillUnmount() {
    if (this.pollInterval) clearInterval(this.pollInterval);
  }

  componentDidUpdate(_: {}, prevState: SpiTerminalState) {
    if (
      this.state.autoScroll &&
      this.state.messages.length > prevState.messages.length
    ) {
      this.terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }

  addMessage = (direction: "TX" | "RX" | "INFO" | "ERROR", data: string) => {
    this.setState((p) => ({
      messages: [
        ...p.messages,
        {
          id: `${Date.now()}-${Math.random()}`,
          timestamp: new Date().toLocaleTimeString("en-US", {
            hour12: false,
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            fractionalSecondDigits: 3,
          }),
          direction,
          data,
        },
      ],
      stats: direction === "ERROR" ? { errors: p.stats.errors + 1 } : p.stats,
    }));
  };

  pollStatus = async () => {
    const { readCSR } = this.context;
    try {
      const [status, fifoStatus, pinStatus, txCount, rxCount] =
        await Promise.all([
          readCSR(REGS.SPI_STATUS.toString(16)),
          readCSR(REGS.SPI_FIFO_STATUS.toString(16)),
          readCSR(REGS.SPI_PIN_STATUS.toString(16)),
          readCSR(REGS.SPI_TX_COUNT.toString(16)),
          readCSR(REGS.SPI_RX_COUNT.toString(16)),
        ]);

      if (
        status !== undefined &&
        fifoStatus !== undefined &&
        pinStatus !== undefined
      ) {
        this.setState({
          isBusy: (status & 0x1) !== 0,
          txFifoCount: (fifoStatus >> 2) & 0x7ff,
          rxFifoCount: (fifoStatus >> 13) & 0x7ff,
          pinStatus: {
            sck: (pinStatus & 0x1) !== 0,
            mosi: (pinStatus & 0x2) !== 0,
            miso: (pinStatus & 0x4) !== 0,
            cs: (pinStatus & 0x8) !== 0,
          },
          txTotalCount: txCount ?? this.state.txTotalCount,
          rxTotalCount: rxCount ?? this.state.rxTotalCount,
        });
      }
    } catch (e) {
      /* Fail silently */
    }
  };

  applyConfig = async (log = true) => {
    const { writeCSR } = this.context;
    const { isEnabled, spiMode, msbFirst, clkDiv } = this.state;
    if (log)
      this.addMessage(
        "TX",
        `Applying Config: Mode=${spiMode}, ${msbFirst ? "MSB" : "LSB"} First, ClockDiv=${clkDiv}`,
      );

    await writeCSR(REGS.SPI_CONFIG.toString(16), Number(clkDiv).toString(16));
    const controlValue =
      (isEnabled ? 1 : 0) | (spiMode << 1) | (msbFirst ? 1 << 3 : 0);
    await writeCSR(REGS.SPI_CONTROL.toString(16), controlValue.toString(16));
  };

  handleEnableToggle = () => {
    this.setState((p) => ({ isEnabled: !p.isEnabled }), this.applyConfig);
  };

  sendData = async () => {
    const { writeCSR } = this.context;
    const { txData } = this.state;

    const bytes = txData.startsWith("0x")
      ? txData.split(/\s+/).map((hex) => parseInt(hex))
      : txData.split("").map((char) => char.charCodeAt(0));

    if (bytes.some(isNaN)) {
      this.addMessage("ERROR", "Invalid hex format in TX data.");
      return;
    }

    this.addMessage(
      "TX",
      `Queueing ${bytes.length} bytes: [${bytes.map((b) => "0x" + b.toString(16).padStart(2, "0")).join(" ")}]`,
    );

    for (const byte of bytes) {
      await writeCSR(REGS.SPI_TX_DATA.toString(16), byte.toString(16));
      await writeCSR(REGS.SPI_TX_CTRL.toString(16), "1");
    }
    this.addMessage("TX", "Starting transmission...");
    await writeCSR(REGS.SPI_TX_CTRL.toString(16), "2");
  };

  readData = async () => {
    const { writeCSR, readCSR } = this.context;
    const byteCount = Number(this.state.bytesToRead);
    if (isNaN(byteCount) || byteCount <= 0) {
      this.addMessage("ERROR", "Invalid number of bytes to read.");
      return;
    }

    this.addMessage("TX", `Requesting ${byteCount} bytes from SPI bus...`);
    this.setState({ rxData: [] });

    await writeCSR(REGS.SPI_TX_DATA.toString(16), "0");
    for (let i = 0; i < byteCount; i++) {
      await writeCSR(REGS.SPI_TX_CTRL.toString(16), "1");
    }
    await writeCSR(REGS.SPI_TX_CTRL.toString(16), "2");

    const poll = async (resolve: any) => {
      const status = await readCSR(REGS.SPI_STATUS.toString(16));
      if (status !== undefined && (status & 0x1) === 0) {
        resolve();
      } else {
        setTimeout(() => poll(resolve), 50);
      }
    };
    await new Promise(poll);

    this.addMessage(
      "INFO",
      `Transaction finished. Reading ${byteCount} bytes from RX FIFO.`,
    );
    const receivedBytes: number[] = [];
    for (let i = 0; i < byteCount; i++) {
      await writeCSR(REGS.SPI_RX_CTRL.toString(16), "1"); // Pulse rx_fifo_rd_en
      const data = await readCSR(REGS.SPI_RX_DATA.toString(16));
      if (data !== undefined) receivedBytes.push(data);
    }

    this.setState({ rxData: receivedBytes });
    this.addMessage(
      "RX",
      `Received: [${receivedBytes.map((b) => "0x" + b.toString(16).padStart(2, "0")).join(" ")}]`,
    );
  };

  render() {
    const {
      clkDiv,
      spiMode,
      msbFirst,
      isEnabled,
      txData,
      rxData,
      bytesToRead,
      isBusy,
      txFifoCount,
      rxFifoCount,
      txTotalCount,
      rxTotalCount,
      pinStatus,
      messages,
    } = this.state;
    const spiFreq = SYSTEM_CLOCK_HZ / (2 * (Number(clkDiv) + 1));
    const rxString = String.fromCharCode(
      ...rxData.filter((c) => c >= 32 && c < 127),
    );

    return (
      <div className={this.props.className}>
        <div className="control-panel">
          <div className="section">
            <label>Master Control</label>
            <button
              onClick={this.handleEnableToggle}
              className={isEnabled ? "btn-danger" : "btn-primary"}
            >
              {isEnabled ? "Disable SPI" : "Enable SPI"}
            </button>
          </div>
          <div className="section">
            <label>
              Configuration (Est. Freq: {`${(spiFreq / 1e6).toFixed(2)} MHz`})
            </label>
            <label className="sub-label">Clock Divider:</label>
            <input
              type="number"
              value={clkDiv}
              onChange={(e) => this.setState({ clkDiv: e.target.value })}
            />
            <label className="sub-label">SPI Mode:</label>
            <select
              value={spiMode}
              onChange={(e) =>
                this.setState({ spiMode: Number(e.target.value) })
              }
            >
              <option value={0}>Mode 0 (CPOL=0, CPHA=0)</option>
              <option value={1}>Mode 1 (CPOL=0, CPHA=1)</option>
              <option value={2}>Mode 2 (CPOL=1, CPHA=0)</option>
              <option value={3}>Mode 3 (CPOL=1, CPHA=1)</option>
            </select>
            <label className="sub-label">Bit Order:</label>
            <select
              value={msbFirst ? 1 : 0}
              onChange={(e) =>
                this.setState({ msbFirst: Number(e.target.value) === 1 })
              }
            >
              <option value={1}>MSB First</option>
              <option value={0}>LSB First</option>
            </select>
            <button
              className="btn-secondary"
              onClick={() => this.applyConfig()}
            >
              Apply Config
            </button>
          </div>
          <div className="section">
            <label>Transmitter</label>
            <textarea
              value={txData}
              onChange={(e) => this.setState({ txData: e.target.value })}
              placeholder="Enter string or hex (e.g., 0xDE 0xAD)"
            />
            <button
              className="btn-special"
              onClick={this.sendData}
              disabled={!isEnabled || isBusy}
            >
              Send Data
            </button>
          </div>
          <div className="section">
            <label>Receiver</label>
            <input
              type="number"
              value={bytesToRead}
              onChange={(e) => this.setState({ bytesToRead: e.target.value })}
            />
            <button
              className="btn-special"
              onClick={this.readData}
              disabled={!isEnabled || isBusy}
            >
              Read Bytes
            </button>
            <div className="rx-display">
              <label>Hex:</label>
              <pre>
                {rxData.map((b) => b.toString(16).padStart(2, "0")).join(" ")}
              </pre>
              <label>ASCII:</label>
              <pre>{rxString}</pre>
            </div>
          </div>
        </div>

        {/* Right Panel */}
        <div className="right-panel">
          <div className="status-panel">
            <div className={`status-item ${isBusy ? "busy" : ""}`}>
              <label>Engine Status</label>
              <span>{isBusy ? "Busy" : "Idle"}</span>
            </div>
            <div className="status-item">
              <label>TX FIFO</label>
              <span>{txFifoCount}</span>
            </div>
            <div className="status-item">
              <label>RX FIFO</label>
              <span>{rxFifoCount}</span>
            </div>
            <div className="status-item">
              <label>TX Total</label>
              <span>{txTotalCount}</span>
            </div>
            <div className="status-item">
              <label>RX Total</label>
              <span>{rxTotalCount}</span>
            </div>
            <div className="status-item pin-status">
              <label>Pins</label>
              <div>
                <span className={pinStatus.cs ? "" : "active"}>CS</span>
                <span className={pinStatus.sck ? "active" : ""}>SCK</span>
                <span className={pinStatus.mosi ? "active" : ""}>MOSI</span>
                <span className={pinStatus.miso ? "active" : ""}>MISO</span>
              </div>
            </div>
          </div>
          <div className="terminal">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`message ${msg.direction.toLowerCase()}`}
              >
                <span className="timestamp">[{msg.timestamp}]</span>
                <span className="direction">{msg.direction}:</span>
                <span className="data">{msg.data}</span>
              </div>
            ))}
            <div ref={this.terminalEndRef} />
          </div>
        </div>
      </div>
    );
  }
}
