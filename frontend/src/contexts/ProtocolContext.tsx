import React, { ReactNode, useContext } from "react";
import {
  SerialProvider,
  SerialContext,
  SerialContextType,
} from "./SerialContext";
import { UDPProvider, UDPContext, UDPContextType } from "./UDPContext";

export interface ProtocolContextType
  extends SerialContextType,
    UDPContextType {}

export const ProtocolContext = React.createContext<ProtocolContextType | null>(
  null,
);

const ProtocolContextProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const serialContext = useContext(SerialContext);
  const udpContext = useContext(UDPContext);

  if (!serialContext || !udpContext) {
    return null;
  }

  const combinedValue: ProtocolContextType = {
    ...serialContext,
    ...udpContext,
  };

  return (
    <ProtocolContext.Provider value={combinedValue}>
      {children}
    </ProtocolContext.Provider>
  );
};

interface ProtocolProviderProps {
  children: ReactNode;
  udpBridgeUrl?: string;
}

export const ProtocolProvider: React.FC<ProtocolProviderProps> = ({
  children,
  udpBridgeUrl,
}) => {
  return (
    <SerialProvider>
      <UDPProvider udpBridgeUrl={udpBridgeUrl}>
        <ProtocolContextProvider>{children}</ProtocolContextProvider>
      </UDPProvider>
    </SerialProvider>
  );
};

export const useProtocolContext = () => {
  const context = useContext(ProtocolContext);
  if (!context) {
    throw new Error(
      "useProtocolContext must be used within a ProtocolProvider",
    );
  }
  return context;
};
