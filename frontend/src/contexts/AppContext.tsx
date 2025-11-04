import React, { ReactNode, useContext } from "react";
import {
  SerialProvider,
  SerialContext,
  SerialContextType,
} from "./SerialContext";
import { UDPProvider, UDPContext, UDPContextType } from "./UDPContext";

export interface AppContextType extends SerialContextType, UDPContextType {}

export const AppContext = React.createContext<AppContextType | null>(null);

const AppContextProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const serialContext = useContext(SerialContext);
  const udpContext = useContext(UDPContext);

  if (!serialContext || !udpContext) {
    return null;
  }

  const combinedValue: AppContextType = {
    ...serialContext,
    ...udpContext,
  };

  return (
    <AppContext.Provider value={combinedValue}>{children}</AppContext.Provider>
  );
};

interface AppProviderProps {
  children: ReactNode;
  udpBridgeUrl?: string;
}

export const AppProvider: React.FC<AppProviderProps> = ({
  children,
  udpBridgeUrl,
}) => {
  return (
    <SerialProvider>
      <UDPProvider udpBridgeUrl={udpBridgeUrl}>
        <AppContextProvider>{children}</AppContextProvider>
      </UDPProvider>
    </SerialProvider>
  );
};

export const useTerminalContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error(
      "useTerminalContext must be used within a TerminalProvider",
    );
  }
  return context;
};
