import React, { ReactNode, useContext } from "react";
import {
  ProtocolProvider,
  ProtocolContext,
  ProtocolContextType,
} from "./ProtocolContext";

export type AppContextType = ProtocolContextType;

export const AppContext = React.createContext<AppContextType | null>(null);

const AppContextProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const protocolContext = useContext(ProtocolContext);

  if (!protocolContext) {
    return null;
  }

  const combinedValue: AppContextType = {
    ...protocolContext,
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
      <AppContextProvider>{children}</AppContextProvider>
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
