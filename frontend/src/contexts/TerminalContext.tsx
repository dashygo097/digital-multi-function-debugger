import React, { createContext, useContext, ReactNode } from "react";

export interface Message {
  timestamp: string;
  direction: "TX" | "RX" | "INFO" | "ERROR";
  data: string;
  id: string;
  source?: string;
  payloadHex?: string;
}

export interface PortInfo {
  usbVendorId?: number;
  usbProductId?: number;
}

export enum ConnectionState {
  DISCONNECTED = "DISCONNECTED",
  CONNECTING = "CONNECTING",
  CONNECTED = "CONNECTED",
  DISCONNECTING = "DISCONNECTING",
  RECONNECTING = "RECONNECTING",
  ERROR = "ERROR",
}

export interface SerialTerminalState {
  availablePorts: PortInfo[];
  selectedPortName: string;
  selectedPortInfo: PortInfo | null;
  connectionState: ConnectionState;
  shouldAutoReconnect: boolean;
  baudRate: number;
  messages: Message[];
  inputMode: "TEXT" | "HEX";
  lineEnding: "NONE" | "LF" | "CR" | "CRLF";
  stats: { tx: number; rx: number; errors: number };
  autoScroll: boolean;
  showHex: boolean;
  hexPrefix: "0x" | "\\x" | "";
}

export interface UDPTerminalState {
  wsConnected: boolean;
  localPort: number;
  fpgaHost: string;
  fpgaPort: number;
  isBound: boolean;
  messages: Message[];
  inputMode: "TEXT" | "HEX";
  stats: {
    tx: number;
    rx: number;
    errors: number;
    lastRxTime?: string;
  };
  autoScroll: boolean;
  showHex: boolean;
  hexPrefix: "0x" | "\\x" | "";
}

export interface TerminalContextType {
  serialTerminal: SerialTerminalState;
  udpTerminal: UDPTerminalState;
  updateSerialTerminal: (updates: Partial<SerialTerminalState>) => void;
  updateUDPTerminal: (updates: Partial<UDPTerminalState>) => void;
  resetSerialTerminal: () => void;
  resetUDPTerminal: () => void;
  udpBind: () => void;
  udpClose: () => void;
  udpSendText: (text: string) => void;
  udpSendHex: (hex: string) => void;
  serialConnect: () => Promise<void>;
  serialDisconnect: () => Promise<void>;
  serialSend: (data: string) => void;
  serialSendHex: (hex: string) => void;
  serialSendRaw: (data: Uint8Array) => void;
}

const defaultSerialState: SerialTerminalState = {
  availablePorts: [],
  selectedPortName: "",
  selectedPortInfo: null,
  connectionState: ConnectionState.DISCONNECTED,
  shouldAutoReconnect: false,
  baudRate: 115200,
  messages: [],
  inputMode: "TEXT",
  lineEnding: "NONE",
  stats: { tx: 0, rx: 0, errors: 0 },
  autoScroll: true,
  showHex: false,
  hexPrefix: "0x",
};

const defaultUDPState: UDPTerminalState = {
  wsConnected: false,
  localPort: 8888,
  fpgaHost: "127.0.0.1",
  fpgaPort: 9999,
  isBound: false,
  messages: [],
  inputMode: "TEXT",
  stats: { tx: 0, rx: 0, errors: 0 },
  autoScroll: true,
  showHex: false,
  hexPrefix: "0x",
};

export const TerminalContext = createContext<TerminalContextType | undefined>(
  undefined,
);

interface TerminalProviderProps {
  children: ReactNode;
  udpBridgeUrl?: string;
}

export class TerminalProvider extends React.Component<
  TerminalProviderProps,
  {
    serialTerminal: SerialTerminalState;
    udpTerminal: UDPTerminalState;
  }
> {
  private ports: SerialPort[] = [];
  private port: SerialPort | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private readLoopPromise: Promise<void> | null = null;
  private portRefreshInterval: number | null = null;
  private ws: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  static defaultProps = {
    udpBridgeUrl: "ws://localhost:8080",
  };

  constructor(props: TerminalProviderProps) {
    super(props);
    const savedSerial = this.loadFromStorage("serialTerminal");
    const savedUDP = this.loadFromStorage("udpTerminal");
    this.state = {
      serialTerminal: { ...defaultSerialState, ...savedSerial },
      udpTerminal: { ...defaultUDPState, ...savedUDP },
    };
  }

  componentDidMount() {
    this.connectWebSocket();
    this.serialRefreshPorts();
    this.portRefreshInterval = window.setInterval(
      this.serialRefreshPorts,
      2000,
    );
    navigator.serial?.addEventListener(
      "disconnect",
      this.handleSerialDisconnectEvent,
    );
  }

  componentWillUnmount() {
    this.disconnectWebSocket();
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
    }
    if (this.portRefreshInterval) {
      clearInterval(this.portRefreshInterval);
    }
    this.serialDisconnect();
    navigator.serial?.removeEventListener(
      "disconnect",
      this.handleSerialDisconnectEvent,
    );
  }

  private loadFromStorage = (key: string): any => {
    try {
      const item = localStorage.getItem(key);
      if (!item) return null;
      const parsed = JSON.parse(item);
      if (key === "serialTerminal" && parsed) {
        parsed.connectionState = ConnectionState.DISCONNECTED;
        parsed.availablePorts = [];
      }
      if (key === "udpTerminal" && parsed) {
        parsed.wsConnected = false;
        parsed.isBound = false;
      }
      return parsed;
    } catch (error) {
      return null;
    }
  };

  private saveToStorage = (key: string, value: any) => {
    try {
      const serializableData = {
        ...value,
        connectionState:
          key === "serialTerminal" ? ConnectionState.DISCONNECTED : undefined,
        wsConnected: key === "udpTerminal" ? false : undefined,
        isBound: key === "udpTerminal" ? false : undefined,
        availablePorts: key === "serialTerminal" ? [] : undefined,
        messages: [],
      };
      localStorage.setItem(key, JSON.stringify(serializableData));
    } catch (error) {}
  };

  updateSerialTerminal = (updates: Partial<SerialTerminalState>) => {
    this.setState(
      (prevState) => ({
        serialTerminal: { ...prevState.serialTerminal, ...updates },
      }),
      () => this.saveToStorage("serialTerminal", this.state.serialTerminal),
    );
  };

  updateUDPTerminal = (updates: Partial<UDPTerminalState>) => {
    this.setState(
      (prevState) => ({
        udpTerminal: { ...prevState.udpTerminal, ...updates },
      }),
      () => this.saveToStorage("udpTerminal", this.state.udpTerminal),
    );
  };

  resetSerialTerminal = () => {
    this.serialDisconnect();
    this.setState({ serialTerminal: defaultSerialState }, () => {
      localStorage.removeItem("serialTerminal");
      this.serialRefreshPorts();
    });
  };

  resetUDPTerminal = () => {
    this.disconnectWebSocket();
    this.setState({ udpTerminal: defaultUDPState }, () => {
      localStorage.removeItem("udpTerminal");
    });
  };

  private addSerialMessage = (
    direction: "TX" | "RX" | "INFO" | "ERROR",
    data: string,
    payloadHex?: string,
  ) => {
    const newMessage: Message = {
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
      payloadHex,
    };
    this.setState((prevState) => {
      const { messages, stats } = prevState.serialTerminal;
      const newMessages = [...messages, newMessage];
      const newStats = { ...stats };
      if (direction === "TX") newStats.tx++;
      if (direction === "RX") newStats.rx++;
      if (direction === "ERROR") newStats.errors++;
      return {
        serialTerminal: {
          ...prevState.serialTerminal,
          messages: newMessages,
          stats: newStats,
        },
      };
    });
  };

  private addUDPMessage = (
    direction: "TX" | "RX" | "INFO" | "ERROR",
    data: string,
    source?: string,
    payloadHex?: string,
  ) => {
    const newMessage: Message = {
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
      source,
      payloadHex,
    };
    this.setState((prevState) => ({
      udpTerminal: {
        ...prevState.udpTerminal,
        messages: [...prevState.udpTerminal.messages, newMessage],
      },
    }));
  };

  private getPortIdentifier = (portInfo: PortInfo): string => {
    if (!portInfo.usbVendorId || !portInfo.usbProductId) {
      return "Unknown Port";
    }
    return `VID_0x${portInfo.usbVendorId.toString(16).padStart(4, "0")}_PID_0x${portInfo.usbProductId.toString(16).padStart(4, "0")}`;
  };

  private serialRefreshPorts = async () => {
    if (!navigator.serial) return;
    try {
      const currentPorts = await navigator.serial.getPorts();
      if (currentPorts.length !== this.ports.length) {
        this.ports = currentPorts;
        const availablePorts = this.ports.map((p) => p.getInfo());
        this.updateSerialTerminal({
          availablePorts: availablePorts.map((p) => ({
            usbVendorId: p.usbVendorId,
            usbProductId: p.usbProductId,
          })),
        });
      }
    } catch (error) {
      this.addSerialMessage("ERROR", "Could not get saved serial ports.");
    }
  };

  serialConnect = async () => {
    const { selectedPortName, baudRate } = this.state.serialTerminal;
    if (!selectedPortName) {
      try {
        const newPort = await navigator.serial.requestPort();
        await this.serialRefreshPorts();
        const newPortInfo = newPort.getInfo();
        const newPortId = this.getPortIdentifier(newPortInfo);
        this.updateSerialTerminal({ selectedPortName: newPortId });
        const portToConnect = (await navigator.serial.getPorts()).find(
          (p) => this.getPortIdentifier(p.getInfo()) === newPortId,
        );
        if (portToConnect) {
          this.port = portToConnect;
        } else {
          throw new Error("Newly requested port not found.");
        }
      } catch (error: any) {
        if (error.name !== "NotFoundError") {
          this.addSerialMessage(
            "ERROR",
            `Failed to request port: ${error.message}`,
          );
        }
        return;
      }
    } else {
      this.port =
        this.ports.find(
          (p) => this.getPortIdentifier(p.getInfo()) === selectedPortName,
        ) || null;
    }

    if (!this.port) {
      this.addSerialMessage(
        "ERROR",
        "Selected port not found. Please re-select or request a new one.",
      );
      return;
    }

    try {
      this.updateSerialTerminal({
        connectionState: ConnectionState.CONNECTING,
      });
      await this.port.open({ baudRate });
      this.writer = this.port.writable!.getWriter();
      this.reader = this.port.readable!.getReader();
      this.updateSerialTerminal({
        connectionState: ConnectionState.CONNECTED,
        selectedPortInfo: this.port.getInfo(),
      });
      this.addSerialMessage(
        "INFO",
        `Connected to port ${this.getPortIdentifier(this.port.getInfo())}`,
      );
      this.readLoopPromise = this.readLoop();
    } catch (error: any) {
      this.updateSerialTerminal({ connectionState: ConnectionState.ERROR });
      this.addSerialMessage("ERROR", `Failed to connect: ${error.message}`);
      this.port = null;
    }
  };

  private readLoop = async () => {
    try {
      while (this.port?.readable) {
        const { value, done } = await this.reader!.read();
        if (done) break;
        const payloadHex = Array.from(value)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join(" ");
        const { showHex, hexPrefix } = this.state.serialTerminal;
        const displayData = showHex
          ? Array.from(value)
              .map((b) => `${hexPrefix}${b.toString(16).padStart(2, "0")}`)
              .join(" ")
          : new TextDecoder().decode(value);
        this.addSerialMessage("RX", displayData, payloadHex);
      }
    } catch (error: any) {
      this.addSerialMessage("ERROR", `Read error: ${error.message}`);
    } finally {
      this.reader?.releaseLock();
    }
  };

  private handleSerialDisconnectEvent = (event: Event) => {
    if (this.port && event.target === this.port) {
      this.addSerialMessage("INFO", "Serial port disconnected externally.");
      this.serialDisconnect(true);
      this.serialRefreshPorts();
    }
  };

  serialDisconnect = async (isExternal = false) => {
    if (
      this.state.serialTerminal.connectionState === ConnectionState.DISCONNECTED
    )
      return;
    if (!isExternal) {
      this.updateSerialTerminal({
        connectionState: ConnectionState.DISCONNECTING,
      });
    }
    if (this.reader) {
      try {
        await this.reader.cancel();
      } catch (error) {}
    }
    if (this.writer) {
      try {
        await this.writer.close();
      } catch (error) {}
    }
    if (this.port && !isExternal) {
      try {
        await this.port.close();
      } catch (error) {}
    }
    this.port = null;
    this.reader = null;
    this.writer = null;
    this.updateSerialTerminal({
      connectionState: ConnectionState.DISCONNECTED,
      selectedPortInfo: null,
    });
  };

  serialSend = async (data: string) => {
    if (!this.writer || !data) return;
    try {
      const lineEndingMap = { NONE: "", LF: "\n", CR: "\r", CRLF: "\r\n" };
      const dataWithLineEnding =
        data + lineEndingMap[this.state.serialTerminal.lineEnding];
      const encoded = new TextEncoder().encode(dataWithLineEnding);
      await this.writer.write(encoded);
      this.addSerialMessage("TX", data);
    } catch (error: any) {
      this.addSerialMessage("ERROR", `Send error: ${error.message}`);
    }
  };

  serialSendHex = async (hex: string) => {
    if (!this.writer || !hex) return;
    try {
      const hexValues = hex
        .split(/[\s,]+/)
        .filter((x) => x)
        .map((x) => parseInt(x.replace(/^0x/i, "").replace(/^\\x/i, ""), 16));
      if (hexValues.some(isNaN) || hexValues.some((v) => v < 0 || v > 255)) {
        this.addSerialMessage("ERROR", "Invalid hex format.");
        return;
      }
      const data = new Uint8Array(hexValues);
      await this.writer.write(data);
      const hexDisplay = hexValues
        .map((b) => `0x${b.toString(16).padStart(2, "0")}`)
        .join(" ");
      this.addSerialMessage("TX", `[HEX] ${hexDisplay}`);
    } catch (error: any) {
      this.addSerialMessage("ERROR", `Hex send failed: ${error.message}`);
    }
  };

  serialSendRaw = async (data: Uint8Array) => {
    if (!this.writer) {
      this.addSerialMessage("ERROR", "Not connected.");
      return;
    }
    try {
      await this.writer.write(data);
      const hexDisplay = Array.from(data)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(" ");
      this.addSerialMessage("TX", `[RAW] ${hexDisplay}`);
    } catch (error: any) {
      this.addSerialMessage("ERROR", `Raw send error: ${error.message}`);
    }
  };

  private connectWebSocket = () => {
    const { udpBridgeUrl } = this.props;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;
    try {
      this.addUDPMessage(
        "INFO",
        `Connecting to UDP bridge at ${udpBridgeUrl}...`,
      );
      this.ws = new WebSocket(udpBridgeUrl!);
      this.ws.onopen = () => {
        this.updateUDPTerminal({ wsConnected: true });
        this.addUDPMessage("INFO", "✓ Connected to UDP bridge");
        this.sendWSMessage({ type: "GET_STATUS", payload: {} });
      };
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleWSMessage(data);
        } catch (error) {}
      };
      this.ws.onerror = () => {
        this.addUDPMessage("ERROR", "WebSocket connection error");
        this.updateUDPTerminal({
          stats: {
            ...this.state.udpTerminal.stats,
            errors: this.state.udpTerminal.stats.errors + 1,
          },
        });
      };
      this.ws.onclose = () => {
        this.updateUDPTerminal({ wsConnected: false, isBound: false });
        this.addUDPMessage("INFO", "Disconnected from UDP bridge");
        if (this.reconnectTimer) window.clearTimeout(this.reconnectTimer);
        this.reconnectTimer = window.setTimeout(this.connectWebSocket, 3000);
      };
    } catch (error: any) {
      this.addUDPMessage("ERROR", `Connection failed: ${error.message}`);
    }
  };

  private disconnectWebSocket = () => {
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  };

  private sendWSMessage = (data: any) => {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      this.addUDPMessage("ERROR", "WebSocket not connected");
    }
  };

  private handleWSMessage = (data: any) => {
    const { type, payload } = data;
    switch (type) {
      case "STATUS":
        this.updateUDPTerminal({
          isBound: payload.isBound,
          localPort: payload.localPort || this.state.udpTerminal.localPort,
          fpgaHost: payload.remoteHost || this.state.udpTerminal.fpgaHost,
          fpgaPort: payload.remotePort || this.state.udpTerminal.fpgaPort,
        });
        break;
      case "BIND_SUCCESS":
        this.updateUDPTerminal({
          isBound: true,
          messages: [], // Clear messages on new bind
          stats: { tx: 0, rx: 0, errors: 0 }, // Reset stats
        });
        this.addUDPMessage("INFO", `✓ Bound to port ${payload.localPort}`);
        break;
      case "REMOTE_SET":
        this.addUDPMessage(
          "INFO",
          `✓ Remote set to ${payload.host}:${payload.port}`,
        );
        break;
      case "SEND_SUCCESS":
        this.updateUDPTerminal({
          stats: {
            ...this.state.udpTerminal.stats,
            tx: this.state.udpTerminal.stats.tx + 1,
          },
        });
        break;
      case "RECEIVE":
        this.handleUDPReceive(payload);
        break;
      case "CLOSE_SUCCESS":
        this.updateUDPTerminal({
          isBound: false,
          messages: [], // Clear messages on close
          stats: { tx: 0, rx: 0, errors: 0 }, // Reset stats
        });
        this.addUDPMessage("INFO", "✓ UDP socket closed");
        break;
      case "BROADCAST_SET":
        this.addUDPMessage(
          "INFO",
          `Broadcast ${payload.enabled ? "enabled" : "disabled"}`,
        );
        break;
      case "ERROR":
        this.addUDPMessage("ERROR", payload.message);
        this.updateUDPTerminal({
          stats: {
            ...this.state.udpTerminal.stats,
            errors: this.state.udpTerminal.stats.errors + 1,
          },
        });
        break;
      default:
        break;
    }
  };

  private handleUDPReceive = (payload: any) => {
    const { data, remoteAddress, remotePort } = payload;
    const bytes = new Uint8Array(data);
    const text = new TextDecoder().decode(bytes);
    const source = `${remoteAddress}:${remotePort}`;
    const payloadHex = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(" ");
    const displayText = this.state.udpTerminal.showHex
      ? Array.from(bytes)
          .map(
            (b) =>
              `${this.state.udpTerminal.hexPrefix}${b.toString(16).padStart(2, "0")}`,
          )
          .join(" ")
      : text;
    this.addUDPMessage("RX", displayText, source, payloadHex);
    this.updateUDPTerminal({
      stats: {
        ...this.state.udpTerminal.stats,
        rx: this.state.udpTerminal.stats.rx + 1,
        lastRxTime: new Date().toLocaleTimeString(),
      },
    });
  };

  udpBind = () => {
    if (!this.state.udpTerminal.wsConnected) {
      this.addUDPMessage("ERROR", "Not connected to bridge");
      return;
    }
    this.addUDPMessage(
      "INFO",
      `Binding to port ${this.state.udpTerminal.localPort}...`,
    );
    this.sendWSMessage({
      type: "BIND",
      payload: { localPort: this.state.udpTerminal.localPort },
    });
    this.sendWSMessage({
      type: "SET_REMOTE",
      payload: {
        host: this.state.udpTerminal.fpgaHost,
        port: this.state.udpTerminal.fpgaPort,
      },
    });
  };

  udpClose = () => {
    this.addUDPMessage("INFO", "Closing UDP socket...");
    this.sendWSMessage({ type: "CLOSE", payload: {} });
  };

  udpSendText = (text: string) => {
    const { fpgaHost, fpgaPort, isBound } = this.state.udpTerminal;
    if (!isBound) {
      this.addUDPMessage("ERROR", "UDP not bound");
      return;
    }
    if (!text) return;
    const encoded = new TextEncoder().encode(text);
    this.sendWSMessage({
      type: "SEND",
      payload: { data: Array.from(encoded) },
    });
    this.addUDPMessage("TX", text, `${fpgaHost}:${fpgaPort}`);
  };

  udpSendHex = (hex: string) => {
    const { fpgaHost, fpgaPort, isBound } = this.state.udpTerminal;
    if (!isBound) {
      this.addUDPMessage("ERROR", "UDP not bound");
      return;
    }
    if (!hex) return;
    try {
      const hexValues = hex
        .split(/[\s,]+/)
        .filter((x) => x.length > 0)
        .map((x) => {
          const cleaned = x.replace(/^0x/i, "").replace(/^\\x/i, "");
          return parseInt(cleaned, 16);
        });
      if (hexValues.some(isNaN) || hexValues.some((v) => v < 0 || v > 255)) {
        this.addUDPMessage(
          "ERROR",
          "Invalid hex format. Use: 01 02 03 or 0x01 0x02 0x03",
        );
        return;
      }
      this.sendWSMessage({ type: "SEND", payload: { data: hexValues } });
      const hexDisplay = hexValues
        .map((b) => `0x${b.toString(16).padStart(2, "0")}`)
        .join(" ");
      this.addUDPMessage(
        "TX",
        `[HEX] ${hexDisplay}`,
        `${fpgaHost}:${fpgaPort}`,
      );
    } catch (error: any) {
      this.addUDPMessage("ERROR", `Hex send failed: ${error.message}`);
    }
  };

  render() {
    const contextValue: TerminalContextType = {
      serialTerminal: this.state.serialTerminal,
      udpTerminal: this.state.udpTerminal,
      updateSerialTerminal: this.updateSerialTerminal,
      updateUDPTerminal: this.updateUDPTerminal,
      resetSerialTerminal: this.resetSerialTerminal,
      resetUDPTerminal: this.resetUDPTerminal,
      udpBind: this.udpBind,
      udpClose: this.udpClose,
      udpSendText: this.udpSendText,
      udpSendHex: this.udpSendHex,
      serialConnect: this.serialConnect,
      serialDisconnect: this.serialDisconnect,
      serialSend: this.serialSend,
      serialSendHex: this.serialSendHex,
      serialSendRaw: this.serialSendRaw,
    };
    return (
      <TerminalContext.Provider value={contextValue}>
        {this.props.children}
      </TerminalContext.Provider>
    );
  }
}

export const useTerminalContext = () => {
  const context = useContext(TerminalContext);
  if (!context) {
    throw new Error(
      "useTerminalContext must be used within a TerminalProvider",
    );
  }
  return context;
};
