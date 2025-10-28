import { removeAllListeners } from "node:process";
import React, { useEffect, useRef, useState } from "react";

interface Message {
  timestamp: string;
  direction: "TX" | "RX" | "INFO" | "ERROR";
  data: string;
  id: string;
}

interface SerialTerminalProps {
  className?: string;
}

export const SerialTerminal: React.FC<SerialTerminalProps> = ({
  className = "serial-terminal",
}) => {
  const [ports, setPorts] = useState<Electron.SerialPort[]>([]);
  const [selectedPort, setSelectedPort] = useState<string>("");
  const [isConnected, setIsConnected] = useState(false);
  const [baudRate, setBaudRate] = useState<number>(115200);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [inputHex, setInputHex] = useState("");
  const [lineEnding, setLineEnding] = useState<"NONE" | "LF" | "CR" | "CRLF">(
    "NONE",
  );
  const [stats, setStats] = useState({ tx: 0, rx: 0, errors: 0 });
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const portRef = useRef<SerialPort | null>(null);
  const writerRef = useRef<WritableStreamDefaultWriter<Uint8Array> | null>(
    null,
  );
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(
    null,
  );

  // Initialize
  useEffect(() => {
    refreshPorts();
    setupEventListeners();

    return () => {
      window.serialAPI?.removeAllListeners();
    };
  }, []);

  // Auto-scroll
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const setupEventListeners = () => {
    window.serialAPI?.onPortAdded(() => {
      console.log("Port added");
      refreshPorts();
    });

    window.serialAPI?.onPortRemoved(() => {
      console.log("Port removed");
      refreshPorts();
    });
  };

  const refreshPorts = async () => {
    try {
      const availablePorts = await window.serialAPI?.getPorts();
      setPorts(availablePorts || []);
      console.log("Ports:", availablePorts);
    } catch (error) {
      addMessage("ERROR", `Fetch ports error: ${error}`);
      setStats((prev) => ({ ...prev, errors: prev.errors + 1 }));
    }
  };

  const connectPort = async () => {
    if (!selectedPort) {
      addMessage("ERROR", "Select a port");
      setStats((prev) => ({ ...prev, errors: prev.errors + 1 }));
      return;
    }

    try {
      addMessage("INFO", `Connecting to ${selectedPort}...`);

      // Get all Web Serial ports
      const allPorts = await navigator.serial.getPorts();
      console.log("Web Serial ports available:", allPorts.length);

      let port: SerialPort;

      if (allPorts.length > 0) {
        port = allPorts[0];
        console.log("Using port:", port.getInfo());
      } else {
        port = await navigator.serial.requestPort({ filters: [] });
        console.log("User selected port");
      }

      // Force close if somehow open
      try {
        if (port.opened) {
          await port.close();
          await new Promise((r) => setTimeout(r, 500));
        }
      } catch (e) {
        // ignore
      }

      // Open port
      console.log("Opening port...");
      await port.open({ baudRate });
      console.log("Port open");

      portRef.current = port;

      // Get writer
      if (port.writable) {
        writerRef.current = port.writable.getWriter();
        console.log("Writer ready");
      }

      // Start reader
      if (port.readable) {
        readerRef.current = port.readable.getReader();
        console.log("Reader ready");
        readLoop();
      }

      setIsConnected(true);
      addMessage("INFO", `✓ Connected at ${baudRate} baud`);

      // Notify backend
      await window.serialAPI?.openPort(selectedPort, { baudRate });
    } catch (error) {
      console.error("Connect error:", error);
      addMessage("ERROR", `${error}`);
      setStats((prev) => ({ ...prev, errors: prev.errors + 1 }));
      setIsConnected(false);
    }
  };

  const readLoop = async () => {
    try {
      while (isConnected && readerRef.current) {
        const { done, value } = await readerRef.current.read();
        if (done) break;

        if (value) {
          const data = new TextDecoder().decode(value);
          addMessage("RX", data);
          setStats((prev) => ({ ...prev, rx: prev.rx + 1 }));
        }
      }
    } catch (error) {
      if (
        error instanceof Error &&
        (error.name === "NotAllowedError" || error.name === "AbortError")
      ) {
        return;
      }
      console.error("Read error:", error);
      addMessage("ERROR", `Read: ${error}`);
      setStats((prev) => ({ ...prev, errors: prev.errors + 1 }));
    }
  };

  const disconnectPort = async () => {
    try {
      addMessage("INFO", "Disconnecting...");

      if (readerRef.current) {
        try {
          await readerRef.current.cancel();
        } catch (e) {
          // ignore
        }
        readerRef.current = null;
      }

      if (writerRef.current) {
        try {
          await writerRef.current.releaseLock();
        } catch (e) {
          // ignore
        }
        writerRef.current = null;
      }

      if (portRef.current?.opened) {
        await portRef.current.close();
      }
      portRef.current = null;

      setIsConnected(false);
      addMessage("INFO", "Disconnected");

      await window.serialAPI?.closePort(selectedPort);
    } catch (error) {
      console.error("Disconnect error:", error);
      setIsConnected(false);
    }
  };

  const getLineEnding = (): string => {
    const endings = { NONE: "", LF: "\n", CR: "\r", CRLF: "\r\n" };
    return endings[lineEnding];
  };

  const sendText = async () => {
    if (!inputText || !isConnected || !writerRef.current) {
      addMessage("ERROR", "Not ready");
      setStats((prev) => ({ ...prev, errors: prev.errors + 1 }));
      return;
    }

    try {
      const data = inputText + getLineEnding();
      const encoded = new TextEncoder().encode(data);

      console.log("Sending:", inputText);
      console.log("Bytes:", Array.from(encoded));

      await writerRef.current.write(encoded);

      addMessage("TX", inputText);
      setStats((prev) => ({ ...prev, tx: prev.tx + 1 }));
      setInputText("");

      console.log("✓ Sent");
    } catch (error) {
      console.error("Send error:", error);
      addMessage("ERROR", `Send: ${error}`);
      setStats((prev) => ({ ...prev, errors: prev.errors + 1 }));
    }
  };

  const sendHex = async () => {
    if (!inputHex || !isConnected || !writerRef.current) {
      addMessage("ERROR", "Not ready");
      setStats((prev) => ({ ...prev, errors: prev.errors + 1 }));
      return;
    }

    try {
      const hexArray = inputHex
        .split(/\s+/)
        .filter((x) => x)
        .map((x) => parseInt(x, 16));

      if (hexArray.some(isNaN)) {
        addMessage("ERROR", "Bad hex format");
        setStats((prev) => ({ ...prev, errors: prev.errors + 1 }));
        return;
      }

      await writerRef.current.write(new Uint8Array(hexArray));

      const hexStr = hexArray
        .map((x) => "0x" + x.toString(16).padStart(2, "0"))
        .join(" ");
      addMessage("TX", `[HEX] ${hexStr}`);
      setStats((prev) => ({ ...prev, tx: prev.tx + 1 }));
      setInputHex("");

      console.log("✓ Hex sent");
    } catch (error) {
      console.error("Hex error:", error);
      addMessage("ERROR", `Hex: ${error}`);
      setStats((prev) => ({ ...prev, errors: prev.errors + 1 }));
    }
  };

  const addMessage = (
    direction: "TX" | "RX" | "INFO" | "ERROR",
    data: string,
  ) => {
    setMessages((prev) => [
      ...prev,
      {
        timestamp: new Date().toLocaleTimeString("en-US", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          fractionalSecondDigits: 3,
        }),
        direction,
        data,
        id: `${Date.now()}-${Math.random()}`,
      },
    ]);
  };

  const clearTerminal = () => {
    setMessages([]);
    setStats({ tx: 0, rx: 0, errors: 0 });
  };

  const exportLog = () => {
    const log = messages
      .map((m) => `[${m.timestamp}] ${m.direction}: ${m.data}`)
      .join("\n");

    const element = document.createElement("a");
    element.setAttribute(
      "href",
      "data:text/plain;charset=utf-8," + encodeURIComponent(log),
    );
    element.setAttribute("download", `serial-log-${Date.now()}.txt`);
    element.style.display = "none";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className={className}>
      <div className="control-panel">
        <div className="section">
          <label>Port:</label>
          <select
            value={selectedPort}
            onChange={(e) => setSelectedPort(e.target.value)}
            disabled={isConnected}
          >
            <option value="">Select...</option>
            {ports.map((p) => (
              <option key={p.portId} value={p.displayName}>
                {p.displayName}
              </option>
            ))}
          </select>
          <button onClick={refreshPorts} disabled={isConnected}>
            🔄
          </button>
        </div>

        <div className="section">
          <label>Baud:</label>
          <select
            value={baudRate}
            onChange={(e) => setBaudRate(Number(e.target.value))}
            disabled={isConnected}
          >
            <option value={9600}>9600</option>
            <option value={115200}>115200</option>
            <option value={230400}>230400</option>
          </select>
        </div>

        <div className="section">
          <label>Line End:</label>
          <select
            value={lineEnding}
            onChange={(e) => setLineEnding(e.target.value as any)}
          >
            <option value="NONE">None</option>
            <option value="LF">LF</option>
            <option value="CR">CR</option>
            <option value="CRLF">CRLF</option>
          </select>
        </div>

        <div className="buttons">
          {!isConnected ? (
            <button
              onClick={connectPort}
              className="btn-primary"
              disabled={!selectedPort}
            >
              ⚡ Connect
            </button>
          ) : (
            <button onClick={disconnectPort} className="btn-danger">
              ❌ Disconnect
            </button>
          )}
          <button onClick={clearTerminal}>🗑️ Clear</button>
          <button onClick={exportLog}>💾 Export</button>
        </div>

        <div className="stats">
          TX: <strong>{stats.tx}</strong> | RX: <strong>{stats.rx}</strong> |
          Errors: <strong>{stats.errors}</strong> | {isConnected ? "🟢" : "🔴"}
        </div>
      </div>

      <div className="terminal">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`message ${msg.direction.toLowerCase()}`}
          >
            <span className="timestamp">[{msg.timestamp}]</span>
            <span className="direction">{msg.direction}</span>
            <span className="data">{msg.data}</span>
          </div>
        ))}
        <div ref={terminalEndRef} />
      </div>

      <div className="input-section">
        <div className="text-input">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && sendText()}
            placeholder="Type..."
            disabled={!isConnected}
          />
          <button onClick={sendText} disabled={!isConnected}>
            Send
          </button>
        </div>

        <div className="hex-input">
          <input
            type="text"
            value={inputHex}
            onChange={(e) => setInputHex(e.target.value)}
            placeholder="Hex: 01 02 03"
            disabled={!isConnected}
          />
          <button onClick={sendHex} disabled={!isConnected}>
            Send Hex
          </button>
        </div>
      </div>
    </div>
  );
};
