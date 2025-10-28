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
    "CRLF",
  );
  const [stats, setStats] = useState({ tx: 0, rx: 0, errors: 0 });
  const terminalEndRef = useRef<HTMLDivElement>(null);

  const portRef = useRef<Electron.SerialPort | null>(null);
  const writerRef = useRef<WritableStreamDefaultWriter<Uint8Array> | null>(
    null,
  );
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(
    null,
  );
  const shouldStopRef = useRef<boolean>(false);
  const keepReading = useRef<boolean>(false);

  useEffect(() => {
    refreshPorts();
    setupEventListeners();

    return () => {
      cleanupConnection();
      window.serialAPI?.removeAllListeners();
    };
  }, []);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const setupEventListeners = () => {
    window.serialAPI?.onPortAdded(() => {
      console.log("Port added event");
      refreshPorts();
    });

    window.serialAPI?.onPortRemoved(() => {
      console.log("Port removed event");
      refreshPorts();
    });
  };

  const refreshPorts = async () => {
    try {
      const availablePorts = await window.serialAPI?.getPorts();
      setPorts(availablePorts || []);
      console.log("Available ports:", availablePorts);
    } catch (error) {
      addMessage("ERROR", `Failed to get ports: ${error}`);
      setStats((prev) => ({ ...prev, errors: prev.errors + 1 }));
    }
  };

  const connectPort = async () => {
    if (!selectedPort) {
      addMessage("ERROR", "Please select a port first");
      setStats((prev) => ({ ...prev, errors: prev.errors + 1 }));
      return;
    }

    try {
      addMessage(
        "INFO",
        `Connecting to ${selectedPort} at ${baudRate} baud...`,
      );

      // Get all available Web Serial ports
      const allPorts = await navigator.serial.getPorts();
      console.log(`Found ${allPorts.length} authorized port(s)`);

      let port: SerialPort;

      if (allPorts.length > 0) {
        // Use the first available port
        port = allPorts[0];
        const info = port.getInfo();
        console.log("Using port:", info);

        // If port is somehow open, close it first
        try {
          await port.close();
          console.log("Closed previously open port");
          await new Promise((r) => setTimeout(r, 500));
        } catch (e) {
          // Port wasn't open, that's fine
        }
      } else {
        // Request port access from user
        console.log("Requesting port access...");
        port = await navigator.serial.requestPort({ filters: [] });
        console.log("Port access granted");
      }

      // Open the port with proper configuration
      console.log(`Opening port with baudRate: ${baudRate}...`);
      await port.open({
        baudRate: baudRate,
        dataBits: 8,
        stopBits: 1,
        parity: "none",
        flowControl: "none",
        bufferSize: 4096,
      });
      console.log("✓ Port opened");

      // Set control signals (DTR/RTS) - critical for many devices
      try {
        await port.setSignals({
          dataTerminalReady: true,
          requestToSend: true,
        });
        console.log("✓ DTR/RTS signals set");
      } catch (e) {
        console.log("Could not set signals (may not be supported):", e);
      }

      portRef.current = port;
      shouldStopRef.current = false;
      keepReading.current = true;

      // Get writer - DON'T close it until disconnect
      if (!port.writable) {
        throw new Error("Port is not writable");
      }
      writerRef.current = port.writable.getWriter();
      console.log("✓ Writer ready");

      // Get reader
      if (!port.readable) {
        throw new Error("Port is not readable");
      }
      readerRef.current = port.readable.getReader();
      console.log("✓ Reader ready");

      // Start reading
      readLoop();

      setIsConnected(true);
      addMessage("INFO", `✓ Connected at ${baudRate} baud`);

      // Notify backend (for tracking only)
      await window.serialAPI?.openPort(selectedPort, { baudRate });
    } catch (error: any) {
      console.error("Connection failed:", error);
      addMessage("ERROR", `Connection failed: ${error.message || error}`);
      setStats((prev) => ({ ...prev, errors: prev.errors + 1 }));
      await cleanupConnection();
    }
  };

  const readLoop = async () => {
    const reader = readerRef.current;
    if (!reader) {
      console.error("No reader available");
      return;
    }

    console.log("Read loop started");

    try {
      while (keepReading.current) {
        const { value, done } = await reader.read();

        if (done) {
          console.log("Reader done");
          break;
        }

        if (value && value.length > 0) {
          const text = new TextDecoder().decode(value);
          console.log("RX:", text);
          addMessage("RX", text);
          setStats((prev) => ({ ...prev, rx: prev.rx + 1 }));
        }
      }
    } catch (error: any) {
      if (shouldStopRef.current) {
        console.log("Read loop stopped by user");
        return;
      }

      if (error.name === "NetworkError" || error.name === "NotFoundError") {
        console.error("Device disconnected");
        addMessage("ERROR", "Device disconnected");
        await disconnectPort();
      } else if (error.name !== "AbortError") {
        console.error("Read error:", error);
        addMessage("ERROR", `Read error: ${error.message}`);
        setStats((prev) => ({ ...prev, errors: prev.errors + 1 }));
      }
    } finally {
      console.log("Read loop ended");
    }
  };

  const cleanupConnection = async () => {
    console.log("=== Cleanup started ===");

    shouldStopRef.current = true;
    keepReading.current = false;

    // Small delay to let read loop exit gracefully
    await new Promise((r) => setTimeout(r, 100));

    // Cancel and release reader
    if (readerRef.current) {
      try {
        await readerRef.current.cancel();
        console.log("✓ Reader canceled");
      } catch (e) {
        console.log("Reader cancel error:", e);
      }
      readerRef.current = null;
    }

    // Release writer WITHOUT closing the stream
    // This is important - closing the writer closes the underlying port!
    if (writerRef.current) {
      try {
        await writerRef.current.releaseLock();
        console.log("✓ Writer lock released");
      } catch (e) {
        console.log("Writer release error:", e);
      }
      writerRef.current = null;
    }

    // Now close the port itself
    if (portRef.current) {
      try {
        await portRef.current.close();
        console.log("✓ Port closed");
      } catch (e) {
        console.log("Port close error:", e);
      }
      portRef.current = null;
    }

    // Wait for OS to fully release the port
    await new Promise((r) => setTimeout(r, 300));

    console.log("=== Cleanup complete ===");
  };

  const disconnectPort = async () => {
    if (!isConnected) {
      return;
    }

    try {
      addMessage("INFO", "Disconnecting...");

      await cleanupConnection();

      setIsConnected(false);
      addMessage("INFO", "✓ Disconnected");

      // Notify backend
      if (selectedPort) {
        await window.serialAPI?.closePort(selectedPort);
      }
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
    const text = inputText.trim();
    if (!text) {
      return;
    }

    if (!isConnected || !writerRef.current || !portRef.current) {
      addMessage("ERROR", "Port not connected");
      setStats((prev) => ({ ...prev, errors: prev.errors + 1 }));
      return;
    }

    try {
      const dataToSend = text + getLineEnding();
      const encoded = new TextEncoder().encode(dataToSend);

      console.log(`Sending: "${text}" + ending "${lineEnding}"`);
      console.log(
        "Bytes:",
        Array.from(encoded)
          .map((b) => `0x${b.toString(16).padStart(2, "0")}`)
          .join(" "),
      );

      // Write data
      await writerRef.current.write(encoded);

      // CRITICAL: Ensure data is actually sent to device
      // Some platforms buffer writes
      console.log("✓ Data written to buffer");

      addMessage("TX", text);
      setStats((prev) => ({ ...prev, tx: prev.tx + 1 }));
      setInputText("");
    } catch (error: any) {
      console.error("Send error:", error);
      addMessage("ERROR", `Send failed: ${error.message}`);
      setStats((prev) => ({ ...prev, errors: prev.errors + 1 }));

      if (error.name === "NetworkError" || error.name === "NotFoundError") {
        addMessage("ERROR", "Device disconnected");
        await disconnectPort();
      }
    }
  };

  const sendHex = async () => {
    const hex = inputHex.trim();
    if (!hex) {
      return;
    }

    if (!isConnected || !writerRef.current || !portRef.current) {
      addMessage("ERROR", "Port not connected");
      setStats((prev) => ({ ...prev, errors: prev.errors + 1 }));
      return;
    }

    try {
      // Parse hex values
      const hexValues = hex
        .split(/[\s,]+/)
        .filter((x) => x.length > 0)
        .map((x) => {
          const cleaned = x.replace(/^0x/i, "");
          return parseInt(cleaned, 16);
        });

      if (hexValues.some(isNaN) || hexValues.some((v) => v < 0 || v > 255)) {
        addMessage(
          "ERROR",
          "Invalid hex format. Use: 01 02 03 or 0x01 0x02 0x03",
        );
        setStats((prev) => ({ ...prev, errors: prev.errors + 1 }));
        return;
      }

      const bytes = new Uint8Array(hexValues);
      console.log(
        "Sending hex:",
        Array.from(bytes)
          .map((b) => `0x${b.toString(16).padStart(2, "0")}`)
          .join(" "),
      );

      await writerRef.current.write(bytes);
      console.log("✓ Hex data sent");

      const hexDisplay = Array.from(bytes)
        .map((b) => `0x${b.toString(16).padStart(2, "0")}`)
        .join(" ");
      addMessage("TX", `[HEX] ${hexDisplay}`);
      setStats((prev) => ({ ...prev, tx: prev.tx + 1 }));
      setInputHex("");
    } catch (error: any) {
      console.error("Hex send error:", error);
      addMessage("ERROR", `Hex send failed: ${error.message}`);
      setStats((prev) => ({ ...prev, errors: prev.errors + 1 }));

      if (error.name === "NetworkError" || error.name === "NotFoundError") {
        addMessage("ERROR", "Device disconnected");
        await disconnectPort();
      }
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
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <select
              value={selectedPort}
              onChange={(e) => setSelectedPort(e.target.value)}
              disabled={isConnected}
              style={{ flex: 1 }}
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
        </div>

        <div className="section">
          <label>Baud:</label>
          <select
            value={baudRate}
            onChange={(e) => setBaudRate(Number(e.target.value))}
            disabled={isConnected}
          >
            <option value={9600}>9600</option>
            <option value={19200}>19200</option>
            <option value={38400}>38400</option>
            <option value={57600}>57600</option>
            <option value={115200}>115200</option>
            <option value={230400}>230400</option>
            <option value={460800}>460800</option>
            <option value={921600}>921600</option>
          </select>
        </div>

        <div className="section">
          <label>Line End:</label>
          <select
            value={lineEnding}
            onChange={(e) => setLineEnding(e.target.value as any)}
            disabled={!isConnected}
          >
            <option value="NONE">None</option>
            <option value="LF">LF (\n)</option>
            <option value="CR">CR (\r)</option>
            <option value="CRLF">CRLF (\r\n)</option>
          </select>
        </div>

        <div className="buttons">
          {!isConnected ? (
            <button
              onClick={connectPort}
              className="btn-primary"
              disabled={!selectedPort}
            >
              Connect
            </button>
          ) : (
            <button onClick={disconnectPort} className="btn-danger">
              Disconnect
            </button>
          )}
          <button onClick={clearTerminal}>Clear</button>
          <button onClick={exportLog}>Export</button>
        </div>

        <div className="stats">
          TX: {stats.tx} | RX: {stats.rx} | Errors: {stats.errors} |{" "}
          {isConnected ? "Connected" : "Disconnected"}
        </div>
      </div>

      <div className="terminal">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`message ${msg.direction.toLowerCase()}`}
          >
            <span className="timestamp">[{msg.timestamp}]</span>
            <span className="direction">{msg.direction}:</span>
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
            placeholder="Type message..."
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
            placeholder="Hex: 01 02 03 or 0x01 0x02 0x03"
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
