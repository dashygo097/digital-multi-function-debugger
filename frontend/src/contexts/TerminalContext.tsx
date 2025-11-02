import React, { createContext, useContext, ReactNode } from "react";

interface Message {
  timestamp: string;
  direction: "TX" | "RX" | "INFO" | "ERROR";
  data: string;
  id: string;
}

interface PortInfo {
  usbVendorId?: number;
  usbProductId?: number;
}

interface SerialTerminalState {
  ports: SerialPort[];
  selectedPort: SerialPort | null;
  selectedPortName: string;
  selectedPortInfo: PortInfo | null;
  isConnected: boolean;
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

interface UDPTerminalState {
  messages: Message[];
}

interface TerminalContextType {
  serialTerminal: SerialTerminalState;
  udpTerminal: UDPTerminalState;
  updateSerialTerminal: (updates: Partial<SerialTerminalState>) => void;
  updateUDPTerminal: (updates: Partial<UDPTerminalState>) => void;
  resetSerialTerminal: () => void;
  resetUDPTerminal: () => void;
}

const defaultSerialState: SerialTerminalState = {
  ports: [],
  selectedPort: null,
  selectedPortName: "",
  selectedPortInfo: null,
  isConnected: false,
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
  messages: [],
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
      return item ? JSON.parse(item) : null;
    } catch (error) {
      console.error(`Error loading ${key} from localStorage:`, error);
      return null;
    }
  };

  private saveToStorage = (key: string, value: any) => {
    try {
      const serializableData = {
        ...value,
        ports: undefined,
        selectedPort: undefined,
      };
      localStorage.setItem(key, JSON.stringify(serializableData));
    } catch (error) {
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
