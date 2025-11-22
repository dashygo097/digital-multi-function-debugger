import React, { Component, RefObject } from "react";
import { ProtocolContext } from "@contexts";
import { Message } from "@utils";

const BASE_ADDR = 0x30000;
const REGS = {
  I2C_CONFIG: BASE_ADDR + 0x00,
  I2C_CONTROL: BASE_ADDR + 0x04,
  I2C_DEV_ADDR: BASE_ADDR + 0x08,
  I2C_REG_ADDR: BASE_ADDR + 0x0c,
  I2C_TRANS_CFG: BASE_ADDR + 0x10,
  I2C_TX_DATA: BASE_ADDR + 0x14,
  I2C_TX_CTRL: BASE_ADDR + 0x18,
  I2C_RX_DATA: BASE_ADDR + 0x20,
  I2C_RX_CTRL: BASE_ADDR + 0x24,
  I2C_STATUS: BASE_ADDR + 0x30,
  I2C_CNT_STATUS: BASE_ADDR + 0x34,
  I2C_FIFO_STATUS: BASE_ADDR + 0x38,
};
const SYSTEM_CLOCK_HZ = 50_000_000;

interface I2cTerminalProps {
  className?: string;
}

interface I2cTerminalState {
  messages: Message[];
  stats: { errors: number; acks: number; nacks: number };
  autoScroll: boolean;
  clkDiv: string;
  isEnabled: boolean;
  isMaster: boolean;
  use10BitAddr: boolean;
  devAddr: string;
  txData: string;
  rxCount: string;
  rxData: number[];
  isBusy: boolean;
  isDone: boolean;
  ackError: boolean;
  txFifoCount: number;
  rxFifoCount: number;
}

export class I2cTerminal extends Component<I2cTerminalProps, I2cTerminalState> {
  static contextType = ProtocolContext;
  context!: React.ContextType<typeof ProtocolContext>;

  private terminalEndRef: RefObject<HTMLDivElement>;

  constructor(props: I2cTerminalProps) {
    super(props);
    this.state = {
      messages: [],
      stats: { errors: 0, acks: 0, nacks: 0 },
      autoScroll: false,
      clkDiv: "500",
      isEnabled: false,
      isMaster: true,
      use10BitAddr: false,
      devAddr: "0x5A",
      txData: "0x01 0xAA 0xBB",
      rxCount: "2",
      rxData: [],
      isBusy: false,
      isDone: false,
      ackError: false,
      txFifoCount: 0,
      rxFifoCount: 0,
    };
    this.terminalEndRef = React.createRef<HTMLDivElement>();
  }

  componentDidMount() {
    this.applyConfig(false);
    this.refreshStatus();
  }

  componentDidUpdate(_: {}, prevState: I2cTerminalState) {
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
      stats:
        direction === "ERROR"
          ? { ...p.stats, errors: p.stats.errors + 1 }
          : p.stats,
    }));
  };

  refreshStatus = async () => {
    const { readCSR } = this.context;
    this.addMessage("INFO", "Refreshing status from hardware...");
    try {
      const [status, fifoStatus] = await Promise.all([
        readCSR(REGS.I2C_STATUS.toString(16)),
        readCSR(REGS.I2C_FIFO_STATUS.toString(16)),
      ]);

      if (status !== undefined) {
        const isBusy = (status & 0x1) !== 0;
        const isDone = (status & 0x2) !== 0;
        const ackError = (status & 0x4) !== 0;

        if (this.state.isBusy && !isBusy && isDone) {
          this.addMessage(
            ackError ? "ERROR" : "INFO",
            `Transaction ${ackError ? "failed (NACK)" : "succeeded (ACK)"}.`,
          );
          this.setState((p) => ({
            stats: ackError
              ? { ...p.stats, nacks: p.stats.nacks + 1 }
              : { ...p.stats, acks: p.stats.acks + 1 },
          }));
        }
        this.setState({ isBusy, isDone, ackError });
      }
      if (fifoStatus !== undefined) {
        this.setState({
          txFifoCount: fifoStatus & 0x7ff,
          rxFifoCount: (fifoStatus >> 16) & 0x7ff,
        });
      }
    } catch (e) {
      this.addMessage("ERROR", "Failed to read status from hardware.");
    }
  };

  applyConfig = async (log = true) => {
    const { writeCSR } = this.context;
    const { isEnabled, isMaster, use10BitAddr, clkDiv } = this.state;
    if (log)
      this.addMessage(
        "TX",
        `Applying Config: SCL Freq ~${(SYSTEM_CLOCK_HZ / (Number(clkDiv) + 1) / 1000).toFixed(1)}kHz`,
      );

    await writeCSR(REGS.I2C_CONFIG.toString(16), Number(clkDiv).toString(16));
    const controlValue =
      (isEnabled ? 1 : 0) |
      (isMaster ? 1 << 1 : 0) |
      (use10BitAddr ? 1 << 2 : 0);
    await writeCSR(REGS.I2C_CONTROL.toString(16), controlValue.toString(16));
  };

  parseHexData = (data: string): number[] => {
    return data
      .split(/\s+/)
      .map((hex) => parseInt(hex))
      .filter((n) => !isNaN(n));
  };

  startTransaction = async (type: "write" | "read" | "write-read") => {
    const { writeCSR } = this.context;
    const { devAddr, txData, rxCount } = this.state;
    const deviceAddress = parseInt(devAddr);
    if (isNaN(deviceAddress)) {
      this.addMessage("ERROR", "Invalid Device Address.");
      return;
    }
    const bytesToWrite =
      type === "write" || type === "write-read"
        ? this.parseHexData(txData)
        : [];
    const bytesToRead =
      type === "read" || type === "write-read" ? parseInt(rxCount) : 0;
    if (bytesToWrite.some(isNaN)) {
      this.addMessage("ERROR", "Invalid Hex format in TX Data.");
      return;
    }

    this.addMessage(
      "TX",
      `Starting ${type.toUpperCase()} transaction with DevAddr ${devAddr}`,
    );
    if (bytesToWrite.length > 0)
      this.addMessage(
        "TX",
        `[${bytesToWrite.map((b) => "0x" + b.toString(16).padStart(2, "0")).join(" ")}]`,
      );
    if (bytesToRead > 0)
      this.addMessage("TX", `Expecting ${bytesToRead} byte(s) in response.`);

    await writeCSR(REGS.I2C_DEV_ADDR.toString(16), deviceAddress.toString(16));
    for (const byte of bytesToWrite) {
      await writeCSR(REGS.I2C_TX_DATA.toString(16), byte.toString(16));
      await writeCSR(REGS.I2C_TX_CTRL.toString(16), "1");
    }
    const transCfgValue =
      (type === "read" ? 1 << 31 : 1 << 30) |
      (bytesToRead << 8) |
      bytesToWrite.length;
    await writeCSR(REGS.I2C_TRANS_CFG.toString(16), transCfgValue.toString(16));

    this.addMessage(
      "INFO",
      "Transaction started. Use Refresh to check status and Read RX to get data.",
    );
  };

  readRxFifo = async () => {
    const { readCSR, writeCSR } = this.context;
    const { rxFifoCount } = this.state;

    if (rxFifoCount === 0) {
      this.addMessage(
        "INFO",
        "RX FIFO is empty. Refresh status to check again.",
      );
      await this.refreshStatus();
      return;
    }

    this.addMessage("INFO", `Reading ${rxFifoCount} byte(s) from RX FIFO...`);
    const received: number[] = [];
    for (let i = 0; i < rxFifoCount; i++) {
      await writeCSR(REGS.I2C_RX_CTRL.toString(16), "1");
      const data = await readCSR(REGS.I2C_RX_DATA.toString(16));
      if (data !== undefined) received.push(data);
    }
    this.setState({ rxData: received });
    this.addMessage(
      "RX",
      `[${received.map((b) => "0x" + b.toString(16).padStart(2, "0")).join(" ")}]`,
    );
    await this.refreshStatus(); // Refresh status after reading
  };

  render() {
    const {
      clkDiv,
      isEnabled,
      devAddr,
      txData,
      rxCount,
      rxData,
      isBusy,
      isDone,
      ackError,
      txFifoCount,
      rxFifoCount,
      stats,
      messages,
    } = this.state;
    const sclFreq = SYSTEM_CLOCK_HZ / (Number(clkDiv) + 1);
    const rxString = String.fromCharCode(
      ...rxData.filter((c) => c >= 32 && c < 127),
    );

    return (
      <div className={this.props.className}>
        <div className="control-panel">
          <div className="section">
            <label>Master Control</label>
            <button
              onClick={() =>
                this.setState({ isEnabled: !isEnabled }, () =>
                  this.applyConfig(),
                )
              }
              className={isEnabled ? "btn-danger" : "btn-primary"}
            >
              {isEnabled ? "Disable I2C Core" : "Enable I2C Core"}
            </button>
          </div>
          <div className="section">
            <label>
              Configuration (SCL Freq: ~{(sclFreq / 1000).toFixed(1)} kHz)
            </label>
            <label className="sub-label">Clock Divider:</label>
            <input
              type="number"
              value={clkDiv}
              onChange={(e) => this.setState({ clkDiv: e.target.value })}
            />
            <button
              className="btn-secondary"
              onClick={() => this.applyConfig()}
            >
              Apply Config
            </button>
          </div>
          <div className="section">
            <label>Transaction</label>
            <label className="sub-label">Device Address (7-bit):</label>
            <input
              value={devAddr}
              onChange={(e) => this.setState({ devAddr: e.target.value })}
              placeholder="e.g. 0x5A"
            />
            <label className="sub-label">Data to Write (Hex Bytes):</label>
            <textarea
              value={txData}
              onChange={(e) => this.setState({ txData: e.target.value })}
              placeholder="e.g. 0x01 0xAA 0xBB"
            />
            <label className="sub-label">Bytes to Read:</label>
            <input
              value={rxCount}
              onChange={(e) => this.setState({ rxCount: e.target.value })}
              placeholder="e.g. 2"
            />
            <div className="buttons-3col">
              <button
                onClick={() => this.startTransaction("write")}
                disabled={isBusy || !isEnabled}
              >
                Write
              </button>
              <button
                onClick={() => this.startTransaction("read")}
                disabled={isBusy || !isEnabled}
              >
                Read
              </button>
              <button
                onClick={() => this.startTransaction("write-read")}
                disabled={isBusy || !isEnabled}
              >
                Write-Read
              </button>
            </div>
          </div>
          <div className="section rx-display">
            <label>Received Data</label>
            <div className="buttons-2col">
              <button onClick={this.refreshStatus} className="btn-info">
                Refresh
              </button>
              <button onClick={this.readRxFifo} className="btn-success">
                Read RX
              </button>
            </div>
            <div>
              <label>Hex:</label>
              <pre>
                {rxData.map((b) => b.toString(16).padStart(2, "0")).join(" ")}
              </pre>
            </div>
            <div>
              <label>ASCII:</label>
              <pre>{rxString}</pre>
            </div>
          </div>
        </div>

        <div className="right-panel">
          <div className="status-panel">
            <div
              className={`status-item ${isBusy ? "busy" : isDone ? (ackError ? "error" : "done") : ""}`}
            >
              <label>Status</label>
              <span>
                {isBusy
                  ? "Busy"
                  : isDone
                    ? ackError
                      ? "NACK"
                      : "ACK"
                    : "Idle"}
              </span>
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
              <label>ACKs</label>
              <span>{stats.acks}</span>
            </div>
            <div className="status-item">
              <label>NACKs</label>
              <span>{stats.nacks}</span>
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
