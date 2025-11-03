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
  selectedPortName: string;
  selectedPortInfo: PortInfo | null;
  connectionState: ConnectionState;
  shouldAutoReconnect: boolean;
  baudRate: number;
  messages: Message[];
  inputText: string;
  inputHex: string;
  inputMode: "TEXT" | "HEX";
  lineEnding: "NONE" | "LF" | "CR" | "CRLF";
  stats: { tx: number; rx: number; errors: number };
  autoScroll: boolean;
  showScrollIndicator: boolean;
  newMessagesCount: number;
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
  inputText: string;
  inputHex: string;
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
}

const defaultSerialState: SerialTerminalState = {
  selectedPortName: "",
  selectedPortInfo: null,
  connectionState: ConnectionState.DISCONNECTED,
  shouldAutoReconnect: false,
  baudRate: 115200,
  messages: [],
  inputText: "",
  inputHex: "",
  inputMode: "TEXT",
  lineEnding: "NONE",
  stats: { tx: 0, rx: 0, errors: 0 },
  autoScroll: false,
  showScrollIndicator: false,
  newMessagesCount: 0,
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
  inputText: "",
  inputHex: "",
  inputMode: "TEXT",
  stats: { tx: 0, rx: 0, errors: 0 },
  autoScroll: false,
  showHex: false,
  hexPrefix: "0x",
};

const TerminalContext = createContext<TerminalContextType | undefined>(
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
      serialTerminal: savedSerial || defaultSerialState,
      udpTerminal: savedUDP || defaultUDPState,
    };
  }

  componentDidMount() {
    this.connectWebSocket();
  }

  componentWillUnmount() {
    this.disconnectWebSocket();
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
    }
  }

  private loadFromStorage = (key: string): any => {
    try {
      const item = localStorage.getItem(key);
      if (!item) return null;

      const parsed = JSON.parse(item);

      if (key === "serialTerminal" && parsed) {
        parsed.connectionState = ConnectionState.DISCONNECTED;
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
      };
      localStorage.setItem(key, JSON.stringify(serializableData));
    } catch (error) {}
  };

  updateSerialTerminal = (updates: Partial<SerialTerminalState>) => {
    this.setState(
      (prevState) => ({
        serialTerminal: { ...prevState.serialTerminal, ...updates },
      }),
      () => {
        this.saveToStorage("serialTerminal", this.state.serialTerminal);
      },
    );
  };

  updateUDPTerminal = (updates: Partial<UDPTerminalState>) => {
    this.setState(
      (prevState) => ({
        udpTerminal: { ...prevState.udpTerminal, ...updates },
      }),
      () => {
        this.saveToStorage("udpTerminal", this.state.udpTerminal);
      },
    );
  };

  resetSerialTerminal = () => {
    this.setState({ serialTerminal: defaultSerialState }, () => {
      localStorage.removeItem("serialTerminal");
    });
  };

  resetUDPTerminal = () => {
    this.setState({ udpTerminal: defaultUDPState }, () => {
      localStorage.removeItem("udpTerminal");
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
    this.updateUDPTerminal({
      messages: [...this.state.udpTerminal.messages, newMessage],
    });
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
        this.updateUDPTerminal({ isBound: true });
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
        this.updateUDPTerminal({ isBound: false });
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

export function withTerminalContext<P extends object>(
  Component: React.ComponentType<P & { terminalContext: TerminalContextType }>,
) {
  return (props: P) => (
    <TerminalContext.Consumer>
      {(context) => {
        if (!context) {
          throw new Error(
            "withTerminalContext must be used within a TerminalProvider",
          );
        }
        return <Component {...props} terminalContext={context} />;
      }}
    </TerminalContext.Consumer>
  );
}

export { TerminalContext, defaultUDPState, defaultSerialState };
