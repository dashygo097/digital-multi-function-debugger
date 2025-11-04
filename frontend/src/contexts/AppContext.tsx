import React, { ReactNode, useContext } from "react";
import {
  ProtocolProvider,
  ProtocolContext,
  ProtocolContextType,
} from "./ProtocolContext";
import {
  AnalyzerProvider,
  AnalyzerContext,
  AnalyzerContextType,
} from "./AnalyzerContext";

export type AppContextType = ProtocolContextType & AnalyzerContextType;

export const AppContext = React.createContext<AppContextType | null>(null);

const AppContextProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const protocolContext = useContext(ProtocolContext);
  const analyzerContext = useContext(AnalyzerContext);

  if (!protocolContext || !analyzerContext) {
    return null;
  }

  const combinedValue: AppContextType = {
    ...protocolContext,
    ...analyzerContext,
  };

  return (
    <AppContext.Provider value={combinedValue}>{children}</AppContext.Provider>
  );
};

interface AppProviderProps {
  children: ReactNode;
  udpBridgeUrl?: string;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  return (
    <ProtocolProvider>
      <AnalyzerProvider>
        <AppContextProvider>{children}</AppContextProvider>
      </AnalyzerProvider>
    </ProtocolProvider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error(
      "useTerminalContext must be used within a TerminalProvider",
    );
  }
  return context;
};
