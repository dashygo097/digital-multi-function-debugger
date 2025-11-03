import React, { createContext, useContext, ReactNode } from "react";

export interface Message {
  timestamp: string;
  direction: "TX" | "RX" | "INFO" | "ERROR";
  data: string;
  id: string;
  source?: string;
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
  // Connection
  wsConnected: boolean;
  localPort: number;
  fpgaHost: string;
  fpgaPort: number;
  isBound: boolean;

  // Messages
  messages: Message[];
  inputText: string;
  inputHex: string;
  inputMode: "TEXT" | "HEX";

  // Stats
  stats: {
    tx: number;
    rx: number;
    errors: number;
    lastRxTime?: string;
  };

  // Settings
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
}

export class TerminalProvider extends React.Component<
  TerminalProviderProps,
  {
    serialTerminal: SerialTerminalState;
    udpTerminal: UDPTerminalState;
  }
> {
  constructor(props: TerminalProviderProps) {
    super(props);

    const savedSerial = this.loadFromStorage("serialTerminal");
    const savedUDP = this.loadFromStorage("udpTerminal");

    this.state = {
      serialTerminal: savedSerial || defaultSerialState,
      udpTerminal: savedUDP || defaultUDPState,
    };
  }

  private loadFromStorage = (key: string): any => {
    try {
      const item = localStorage.getItem(key);
      if (!item) return null;

      const parsed = JSON.parse(item);

      // Reset connection-related runtime fields (can't persist sockets)
      if (key === "serialTerminal" && parsed) {
        parsed.connectionState = ConnectionState.DISCONNECTED;
      }
      if (key === "udpTerminal" && parsed) {
        parsed.wsConnected = false;
        parsed.isBound = false;
      }

      return parsed;
    } catch (error) {
      // keep defaults on parse error
      // eslint-disable-next-line no-console
      console.error(`Error loading ${key} from localStorage:`, error);
      return null;
    }
  };

  private saveToStorage = (key: string, value: any) => {
    try {
      // Only save serializable/settings data and avoid persisting live connection state
      const serializableData = {
        ...value,
        connectionState:
          key === "serialTerminal" ? ConnectionState.DISCONNECTED : undefined,
        wsConnected: key === "udpTerminal" ? false : undefined,
        isBound: key === "udpTerminal" ? false : undefined,
      };
      localStorage.setItem(key, JSON.stringify(serializableData));
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`Error saving ${key} to localStorage:`, error);
    }
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

  render() {
    const contextValue: TerminalContextType = {
      serialTerminal: this.state.serialTerminal,
      udpTerminal: this.state.udpTerminal,
      updateSerialTerminal: this.updateSerialTerminal,
      updateUDPTerminal: this.updateUDPTerminal,
      resetSerialTerminal: this.resetSerialTerminal,
      resetUDPTerminal: this.resetUDPTerminal,
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
