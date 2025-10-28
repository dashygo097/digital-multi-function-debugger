interface Window {
  versiobs: {
    node: () => process.versions.node;
    chrome: () => process.versions.chrome;
    electron: () => process.versions.electron;
  };
  usbAPI: {
    getDevices: () => Promise<Electron.USBDevice[]>;
  };

  udpAPI: {
    create: () => Promise<number>;
    bind: (socketId: number, port: number) => Promise<void>;
    send: (
      socketId: number,
      data: number[],
      host: string,
      port: number,
    ) => Promise<void>;
    close: (socketId: number) => Promise<void>;
    setBroadcast: (socketId: number, enabled: boolean) => Promise<void>;
    joinMulticast: (socketId: number, group: string) => Promise<void>;
    leaveMulticast: (socketId: number, group: string) => Promise<void>;
    onReceive: (callback: (info: any) => void) => void;
    onError: (callback: (error: string) => void) => void;
    removeAllListeners: () => void;
  };
}
