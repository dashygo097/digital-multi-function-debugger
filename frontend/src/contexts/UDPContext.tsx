import React, { createContext, useContext, ReactNode } from "react";
import { Message } from "@utils";

export interface UDPState {
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

export interface UDPContextType {
  udpTerminal: UDPState;
  updateUDPTerminal: (updates: Partial<UDPState>) => void;
  resetUDPTerminal: () => void;
  udpBind: () => void;
  udpClose: () => void;
  udpSendText: (text: string) => void;
  udpSendHex: (hex: string) => void;
}

export const defaultUDPState: UDPState = {
  wsConnected: false,
  localPort: 8888,
  fpgaHost: "127.0.0.1",
  fpgaPort: 9999,
  isBound: false,
  messages: [],
  inputMode: "TEXT",
  stats: { tx: 0, rx: 0, errors: 0 },
  autoScroll: false,
  showHex: true,
  hexPrefix: "0x",
};

export const UDPContext = createContext<UDPContextType | undefined>(undefined);

interface UDPProviderProps {
  children: ReactNode;
  udpBridgeUrl?: string;
}

export class UDPProvider extends React.Component<
  UDPProviderProps,
  {
    udpTerminal: UDPState;
  }
> {
  private ws: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  static defaultProps = {
    udpBridgeUrl: "ws://localhost:8080",
  };

  constructor(props: UDPProviderProps) {
    super(props);
    const savedUDP = this.loadFromStorage("udpTerminal");
    this.state = {
      udpTerminal: { ...defaultUDPState, ...savedUDP },
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
        wsConnected: key === "udpTerminal" ? false : undefined,
        isBound: key === "udpTerminal" ? false : undefined,
        messages: [],
      };
      localStorage.setItem(key, JSON.stringify(serializableData));
    } catch (error) {}
  };

  updateUDPTerminal = (updates: Partial<UDPState>) => {
    this.setState(
      (prevState) => ({
        udpTerminal: { ...prevState.udpTerminal, ...updates },
      }),
      () => this.saveToStorage("udpTerminal", this.state.udpTerminal),
    );
  };

  resetUDPTerminal = () => {
    this.disconnectWebSocket();
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
    this.setState((prevState) => ({
      udpTerminal: {
        ...prevState.udpTerminal,
        messages: [...prevState.udpTerminal.messages, newMessage],
      },
    }));
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
    const contextValue: UDPContextType = {
      udpTerminal: this.state.udpTerminal,
      updateUDPTerminal: this.updateUDPTerminal,
      resetUDPTerminal: this.resetUDPTerminal,
      udpBind: this.udpBind,
      udpClose: this.udpClose,
      udpSendText: this.udpSendText,
      udpSendHex: this.udpSendHex,
    };
    return (
      <UDPContext.Provider value={contextValue}>
        {this.props.children}
      </UDPContext.Provider>
    );
  }
}

export const useUDPContext = () => {
  const context = useContext(UDPContext);
  if (!context) {
    throw new Error("useUDPContext must be used within a UDPProvider");
  }
  return context;
};
