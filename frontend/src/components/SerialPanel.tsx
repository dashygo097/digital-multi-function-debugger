import React, { useEffect, useMemo, useState } from "react";

type PortInfo = {
  path: string;
  friendlyName?: string;
  manufacturer?: string;
  serialNumber?: string;
  vendorId?: string;
  productId?: string;
};

type LogEntry = { t: number; dir: "TX" | "RX" | "SYS"; data: string };

declare global {
  interface Window {
    versions?: {
      node: () => string;
      chrome: () => string;
      electron: () => string;
    };
    usbAPI?: { getDevices: () => Promise<any[]> };
    serialAPI?: { getPorts: () => Promise<any[]> };
    serial: {
      list: () => Promise<PortInfo[]>;
      open: (opts: {
        path: string;
        baudRate?: number;
        dataBits?: 5 | 6 | 7 | 8;
        stopBits?: 1 | 2;
        parity?: "none" | "even" | "odd" | "mark" | "space";
      }) => Promise<any>;
      write: (data: string | Uint8Array) => Promise<any>;
      drain: () => Promise<any>;
      close: () => Promise<any>;
      onData: (cb: (data: string) => void) => () => void;
      onError: (cb: (message: string) => void) => () => void;
    };
  }
}

export default function SerialPanel() {
  const [ports, setPorts] = useState<PortInfo[]>([]);
  const [selectedPath, setSelectedPath] = useState<string>("");
  const [baud, setBaud] = useState<number>(115200);
  const [isOpen, setIsOpen] = useState(false);
  const [tx, setTx] = useState("HELLO");
  const [log, setLog] = useState<LogEntry[]>([]);
  const [busy, setBusy] = useState(false);

  const pushLog = (dir: LogEntry["dir"], data: string) =>
    setLog((l) => [...l.slice(-500), { t: Date.now(), dir, data }]);

  // List ports on mount and whenever we refetch
  const refresh = async () => {
    try {
      const list = await window.serial.list();
      setPorts(list);
      // Keep selection if still present
      if (selectedPath && !list.some((p) => p.path === selectedPath)) {
        setSelectedPath("");
      }
    } catch (e: any) {
      pushLog("SYS", `List error: ${e?.message ?? e}`);
    }
  };

  useEffect(() => {
    let offData: (() => void) | null = null;
    let offErr: (() => void) | null = null;

    refresh();

    offData = window.serial.onData((data) =>
      pushLog("RX", data.toString().replace(/\r?\n$/, "")),
    );
    offErr = window.serial.onError((m) => pushLog("SYS", `Error: ${m}`));

    // Optional: refresh occasionally so newly plugged ports appear
    const timer = setInterval(() => refresh(), 3000);

    return () => {
      offData?.();
      offErr?.();
      clearInterval(timer);
    };
  }, []);

  const canOpen = useMemo(
    () => !!selectedPath && !isOpen && !busy,
    [selectedPath, isOpen, busy],
  );
  const canClose = useMemo(() => isOpen && !busy, [isOpen, busy]);
  const canSend = useMemo(
    () => isOpen && !busy && tx.length > 0,
    [isOpen, busy, tx],
  );

  const open = async () => {
    if (!selectedPath) return;
    setBusy(true);
    try {
      await window.serial.open({ path: selectedPath, baudRate: baud });
      setIsOpen(true);
      pushLog("SYS", `Opened ${selectedPath} @ ${baud} baud`);
    } catch (e: any) {
      pushLog("SYS", `Open failed: ${e?.message ?? e}`);
    } finally {
      setBusy(false);
    }
  };

  const close = async () => {
    setBusy(true);
    try {
      await window.serial.close();
      setIsOpen(false);
      pushLog("SYS", "Closed port");
    } catch (e: any) {
      pushLog("SYS", `Close failed: ${e?.message ?? e}`);
    } finally {
      setBusy(false);
    }
  };

  const sendLine = async () => {
    if (!tx) return;
    setBusy(true);
    try {
      const line = tx.endsWith("\n") ? tx : tx + "\n";
      await window.serial.write(line); // main process writes
      await window.serial.drain();
      pushLog("TX", tx);
    } catch (e: any) {
      pushLog("SYS", `Write failed: ${e?.message ?? e}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{ fontFamily: "system-ui, sans-serif", display: "grid", gap: 12 }}
    >
      <h3 style={{ margin: 0 }}>Serial Panel</h3>

      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <label>
          Port:
          <select
            value={selectedPath}
            onChange={(e) => setSelectedPath(e.target.value)}
            style={{ marginLeft: 6, minWidth: 260 }}
            disabled={isOpen || busy}
          >
            <option value="" disabled>
              {ports.length ? "Select a port" : "No ports found"}
            </option>
            {ports.map((p) => (
              <option key={p.path} value={p.path}>
                {p.friendlyName ?? p.manufacturer ?? p.path} — {p.path}
              </option>
            ))}
          </select>
        </label>

        <label>
          Baud:
          <select
            value={baud}
            onChange={(e) => setBaud(Number(e.target.value))}
            style={{ marginLeft: 6 }}
            disabled={isOpen || busy}
          >
            {[9600, 19200, 38400, 57600, 115200, 230400, 460800].map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </label>

        <button onClick={refresh} disabled={busy}>
          Refresh
        </button>
        <button onClick={open} disabled={!canOpen}>
          Open
        </button>
        <button onClick={close} disabled={!canClose}>
          Close
        </button>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={tx}
          onChange={(e) => setTx(e.target.value)}
          disabled={!isOpen || busy}
          placeholder="Type a line to send"
          style={{ flex: 1, minWidth: 240 }}
        />
        <button onClick={sendLine} disabled={!canSend}>
          Send
        </button>
      </div>

      <div
        style={{
          border: "1px solid #ccc",
          borderRadius: 6,
          padding: 8,
          maxHeight: 260,
          overflow: "auto",
          background: "#fafafa",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          fontSize: 12,
        }}
      >
        {log.map((e, i) => (
          <div key={i} style={{ whiteSpace: "pre-wrap" }}>
            [{new Date(e.t).toLocaleTimeString()}] {e.dir}: {e.data}
          </div>
        ))}
      </div>
    </div>
  );
}
