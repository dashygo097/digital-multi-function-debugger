import React, { ReactNode, useContext, createContext } from "react";
import { Message } from "@utils";

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

export interface SerialState {
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

export const defaultSerialState: SerialState = {
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
  autoScroll: false,
  showHex: true,
  hexPrefix: "0x",
};

export interface SerialContextType {
  serialTerminal: SerialState;
  updateSerialTerminal: (updates: Partial<SerialState>) => void;
  resetSerialTerminal: () => void;
  serialConnect: () => Promise<void>;
  serialDisconnect: () => Promise<void>;
  serialSend: (data: string) => void;
  serialSendHex: (hex: string) => void;
  serialSendRaw: (data: Uint8Array) => void;
}

export const SerialContext = createContext<SerialContextType | undefined>(
  undefined,
);

interface SerialProviderProps {
  children: ReactNode;
}

export class SerialProvider extends React.Component<
  SerialProviderProps,
  { serialTerminal: SerialState }
> {
  private ports: SerialPort[] = [];
  private port: SerialPort | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private readLoopPromise: Promise<void> | null = null;
  private portRefreshInterval: number | null = null;
  private reconnectTimer: number | null = null;

  constructor(props: SerialProviderProps) {
    super(props);
    const savedSerial = this.loadFromStorage("serialTerminal");
    this.state = {
      serialTerminal: { ...defaultSerialState, ...savedSerial },
    };
  }

  componentDidMount() {
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
        availablePorts: key === "serialTerminal" ? [] : undefined,
        messages: [],
      };
      localStorage.setItem(key, JSON.stringify(serializableData));
    } catch (error) {}
  };

  updateSerialTerminal = (updates: Partial<SerialState>) => {
    this.setState(
      (prevState) => ({
        serialTerminal: { ...prevState.serialTerminal, ...updates },
      }),
      () => this.saveToStorage("serialTerminal", this.state.serialTerminal),
    );
  };

  resetSerialTerminal = () => {
    this.serialDisconnect();
    this.setState({ serialTerminal: defaultSerialState }, () => {
      localStorage.removeItem("serialTerminal");
      this.serialRefreshPorts();
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

  render() {
    const contextValue: SerialContextType = {
      serialTerminal: this.state.serialTerminal,
      resetSerialTerminal: this.resetSerialTerminal,
      updateSerialTerminal: this.updateSerialTerminal,
      serialConnect: this.serialConnect,
      serialDisconnect: this.serialDisconnect,
      serialSend: this.serialSend,
      serialSendHex: this.serialSendHex,
      serialSendRaw: this.serialSendRaw,
    };
    return (
      <SerialContext.Provider value={contextValue}>
        {this.props.children}
      </SerialContext.Provider>
    );
  }
}

export const useSerialContext = () => {
  const context = useContext(SerialContext);
  if (!context) {
    throw new Error("useSerialContext must be used within a SerialProvider");
  }
  return context;
};
