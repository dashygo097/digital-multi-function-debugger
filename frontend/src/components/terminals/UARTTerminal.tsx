import React, { Component, RefObject } from "react";
import { ProtocolContext } from "@contexts";
import { Message } from "@utils";

const BASE_ADDR = 0x24000;
const REGS = {
  UART_CONFIG: BASE_ADDR + 0x00,
  UART_PARITY_CFG: BASE_ADDR + 0x04,
  UART_FRAME_CFG: BASE_ADDR + 0x08,
  UART_TX_DATA: BASE_ADDR + 0x10,
  UART_TX_CTRL: BASE_ADDR + 0x14,
  UART_RX_DATA: BASE_ADDR + 0x20,
  UART_RX_CTRL: BASE_ADDR + 0x24,
  UART_STATUS: BASE_ADDR + 0x30,
  UART_TX_COUNT: BASE_ADDR + 0x34,
  UART_RX_COUNT: BASE_ADDR + 0x38,
  UART_FIFO_STATUS: BASE_ADDR + 0x3c,
};
const SYSTEM_CLOCK_HZ = 50_000_000;

interface UartTerminalProps {
  className?: string;
}

interface UartTerminalState {
  messages: Message[];
  stats: { errors: number };
  autoScroll: boolean;
  // Config
  baudRate: string;
  dataBits: number;
  stopBits: number;
  parity: "None" | "Even" | "Odd";
  // TX/RX
  txData: string;
  rxData: number[];
  // Status
  txBusy: boolean;
  rxBusy: boolean;
  rxError: boolean;
  txFifoCount: number;
  rxFifoCount: number;
}

export class UartTerminal extends Component<
  UartTerminalProps,
  UartTerminalState
> {
  static contextType = ProtocolContext;
  context!: React.ContextType<typeof ProtocolContext>;

  private terminalEndRef: RefObject<HTMLDivElement>;

  constructor(props: UartTerminalProps) {
    super(props);
    this.state = {
      messages: [],
      stats: { errors: 0 },
      autoScroll: false,
      baudRate: "115200",
      dataBits: 8,
      stopBits: 1,
      parity: "None",
      txData: "Hello, UART!",
      rxData: [],
      txBusy: false,
      rxBusy: false,
      rxError: false,
      txFifoCount: 0,
      rxFifoCount: 0,
    };
    this.terminalEndRef = React.createRef<HTMLDivElement>();
  }

  componentDidMount() {
    this.applyConfig(false);
    this.updateStatusAndData();
  }

  componentDidUpdate(_: {}, prevState: UartTerminalState) {
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

  updateStatusAndData = async () => {
    const { readCSR } = this.context;
    this.addMessage("INFO", "Refreshing status from hardware...");
    try {
      const [status, fifoStatus] = await Promise.all([
        readCSR(REGS.UART_STATUS.toString(16)),
        readCSR(REGS.UART_FIFO_STATUS.toString(16)),
      ]);

      if (status !== undefined) {
        const rxError = (status & 0x4) !== 0;
        if (rxError && !this.state.rxError)
          this.addMessage("ERROR", "Parity or Frame error detected on RX.");
        this.setState({
          txBusy: (status & 0x1) !== 0,
          rxBusy: (status & 0x2) !== 0,
          rxError,
        });
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

  readRxFifo = async () => {
    const { readCSR, writeCSR } = this.context;
    const { rxFifoCount } = this.state;

    if (rxFifoCount === 0) {
      this.addMessage("INFO", "RX FIFO is empty. Nothing to read.");
      // We can also refresh status here to be sure
      await this.updateStatusAndData();
      return;
    }

    this.addMessage("INFO", `Reading ${rxFifoCount} byte(s) from RX FIFO...`);
    const receivedBytes: number[] = [];
    for (let i = 0; i < rxFifoCount; i++) {
      await writeCSR(REGS.UART_RX_CTRL.toString(16), "1");
      const data = await readCSR(REGS.UART_RX_DATA.toString(16));
      if (data !== undefined) receivedBytes.push(data);
    }

    if (receivedBytes.length > 0) {
      this.setState((p) => ({ rxData: [...p.rxData, ...receivedBytes] }));
      const ascii = String.fromCharCode(...receivedBytes);
      this.addMessage(
        "RX",
        `[${receivedBytes.map((b) => "0x" + b.toString(16).padStart(2, "0")).join(" ")}] "${ascii}"`,
      );
    }

    await this.updateStatusAndData();
  };

  applyConfig = async (log = true) => {
    const { writeCSR } = this.context;
    const { baudRate, dataBits, stopBits, parity } = this.state;
    if (log)
      this.addMessage(
        "TX",
        `Applying Config: ${baudRate}, ${dataBits}N${stopBits}`,
      );

    const clkDiv = Math.round(SYSTEM_CLOCK_HZ / Number(baudRate)) - 1;
    await writeCSR(REGS.UART_CONFIG.toString(16), clkDiv.toString(16));

    const parityEn = parity !== "None" ? 1 : 0;
    const parityType = parity === "Odd" ? 1 : parity === "Even" ? 2 : 0;
    const parityValue = (parityType << 1) | parityEn;
    await writeCSR(REGS.UART_PARITY_CFG.toString(16), parityValue.toString(16));

    const dataBitMap = { 5: 0, 6: 1, 7: 2, 8: 3 };
    const stopBitMap = { 1: 0, 2: 1 };
    const dataBitVal = dataBitMap[dataBits as keyof typeof dataBitMap] ?? 3;
    const stopBitVal = stopBitMap[stopBits as keyof typeof stopBitMap] ?? 0;
    const frameValue = (stopBitVal << 2) | dataBitVal;
    await writeCSR(REGS.UART_FRAME_CFG.toString(16), frameValue.toString(16));
  };

  sendData = async () => {
    const { writeCSR } = this.context;
    const { txData } = this.state;

    const bytes = txData.startsWith("0x")
      ? txData
          .split(/\s+/)
          .map((hex) => parseInt(hex))
          .filter((n) => !isNaN(n))
      : txData.split("").map((char) => char.charCodeAt(0));

    this.addMessage("TX", `Queueing ${bytes.length} bytes for transmission.`);

    for (const byte of bytes) {
      await writeCSR(REGS.UART_TX_DATA.toString(16), byte.toString(16));
      await writeCSR(REGS.UART_TX_CTRL.toString(16), "1");
    }
    await writeCSR(REGS.UART_TX_CTRL.toString(16), "2");
    this.setState({ txData: "" });
  };

  render() {
    const {
      baudRate,
      dataBits,
      stopBits,
      parity,
      txData,
      rxData,
      txBusy,
      rxBusy,
      rxError,
      txFifoCount,
      rxFifoCount,
      messages,
    } = this.state;
    const rxString = String.fromCharCode(
      ...rxData.filter((c) => c >= 32 && c < 127),
    );

    return (
      <div className={this.props.className}>
        <div className="control-panel">
          <div className="section">
            <label>Configuration</label>
            <div className="config-grid">
              <div>
                <label className="sub-label">Baud Rate</label>
                <input
                  value={baudRate}
                  onChange={(e) => this.setState({ baudRate: e.target.value })}
                />
              </div>
              <div>
                <label className="sub-label">Data Bits</label>
                <select
                  value={dataBits}
                  onChange={(e) =>
                    this.setState({ dataBits: Number(e.target.value) })
                  }
                >
                  <option>8</option>
                  <option>7</option>
                </select>
              </div>
              <div>
                <label className="sub-label">Parity</label>
                <select
                  value={parity}
                  onChange={(e) =>
                    this.setState({ parity: e.target.value as any })
                  }
                >
                  <option>None</option>
                  <option>Even</option>
                  <option>Odd</option>
                </select>
              </div>
              <div>
                <label className="sub-label">Stop Bits</label>
                <select
                  value={stopBits}
                  onChange={(e) =>
                    this.setState({ stopBits: Number(e.target.value) })
                  }
                >
                  <option>1</option>
                  <option>2</option>
                </select>
              </div>
            </div>
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
              disabled={txBusy}
            >
              Send
            </button>
          </div>
          <div className="section rx-display">
            <label>Received Data Preview</label>
            <pre>{rxString.slice(-200)}</pre>
          </div>
          <div className="section">
            <div className="buttons-3col">
              <button onClick={this.updateStatusAndData} className="btn-info">
                Refresh
              </button>
              <button onClick={this.readRxFifo} className="btn-success">
                Read
              </button>
              <button
                onClick={() =>
                  this.setState({
                    rxData: [],
                    messages: this.state.messages.filter(
                      (m) => m.direction !== "RX",
                    ),
                  })
                }
                className="btn-danger"
              >
                Clear RX
              </button>
            </div>
          </div>
        </div>

        <div className="right-panel">
          <div className="status-panel">
            <div className={`status-item ${txBusy ? "busy" : ""}`}>
              <label>TX Status</label>
              <span>{txBusy ? "Busy" : "Idle"}</span>
            </div>
            <div className={`status-item ${rxBusy ? "busy" : ""}`}>
              <label>RX Status</label>
              <span>{rxBusy ? "Busy" : "Idle"}</span>
            </div>
            <div className={`status-item ${rxError ? "error" : ""}`}>
              <label>RX Error</label>
              <span>{rxError ? "ERR" : "OK"}</span>
            </div>
            <div className="status-item">
              <label>TX FIFO</label>
              <span>{txFifoCount}</span>
            </div>
            <div className="status-item">
              <label>RX FIFO</label>
              <span>{rxFifoCount}</span>
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
