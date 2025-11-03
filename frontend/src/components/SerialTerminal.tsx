import React from "react";
import {
  useTerminalContext,
  ConnectionState,
  PortInfo,
} from "../contexts/TerminalContext";

export const SerialTerminal: React.FC<{ className?: string }> = ({
  className = "serial-terminal",
}) => {
  const context = useTerminalContext();
  const {
    serialTerminal,
    updateSerialTerminal,
    resetSerialTerminal,
    serialConnect,
    serialDisconnect,
    serialSend,
    serialSendHex,
  } = context;
  const terminalEndRef = React.useRef<HTMLDivElement>(null);

  const [inputText, setInputText] = React.useState("");
  const [inputHex, setInputHex] = React.useState("");

  React.useEffect(() => {
    if (serialTerminal.autoScroll) {
      terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [serialTerminal.messages, serialTerminal.autoScroll]);

  const handleSend = () => {
    if (serialTerminal.inputMode === "TEXT") {
      serialSend(inputText);
      setInputText("");
    } else {
      serialSendHex(inputHex);
      setInputHex("");
    }
  };

  const clearTerminal = () => {
    updateSerialTerminal({
      messages: [],
      stats: { tx: 0, rx: 0, errors: 0 },
    });
  };

  const getPortIdentifier = (portInfo: PortInfo): string => {
    if (!portInfo.usbVendorId || !portInfo.usbProductId) {
      return "Unknown Port";
    }
    return `VID_0x${portInfo.usbVendorId.toString(16).padStart(4, "0")}_PID_0x${portInfo.usbProductId.toString(16).padStart(4, "0")}`;
  };

  const isConnected =
    serialTerminal.connectionState === ConnectionState.CONNECTED;

  return (
    <div className={`terminal-container ${className}`}>
      <div className="control-panel">
        <div className="section">
          <span
            className={`status-indicator ${isConnected ? "connected" : "disconnected"}`}
          >
            ● {serialTerminal.connectionState}
          </span>
          {serialTerminal.selectedPortInfo && isConnected && (
            <span className="port-info">
              ({getPortIdentifier(serialTerminal.selectedPortInfo)})
            </span>
          )}
        </div>
        <div className="section">
          <label>Available Ports:</label>
          <div className="port-selector">
            <select
              value={serialTerminal.selectedPortName}
              onChange={(e) =>
                updateSerialTerminal({ selectedPortName: e.target.value })
              }
              disabled={isConnected}
            >
              <option value="">-- Request or Select a Port --</option>
              {serialTerminal.availablePorts.map((port, index) => {
                const id = getPortIdentifier(port);
                return (
                  <option key={index} value={id}>
                    {id}
                  </option>
                );
              })}
            </select>
          </div>
        </div>
        <div className="section">
          <label>Baud Rate:</label>
          <select
            value={serialTerminal.baudRate}
            onChange={(e) =>
              updateSerialTerminal({ baudRate: Number(e.target.value) })
            }
            disabled={isConnected}
          >
            <option value="9600">9600</option>
            <option value="19200">19200</option>
            <option value="38400">38400</option>
            <option value="57600">57600</option>
            <option value="115200">115200</option>
          </select>
        </div>
        <div className="section">
          <label>Line Ending (for Text mode):</label>
          <select
            value={serialTerminal.lineEnding}
            onChange={(e) =>
              updateSerialTerminal({ lineEnding: e.target.value as any })
            }
          >
            <option value="NONE">None</option>
            <option value="LF">LF (\n)</option>
            <option value="CR">CR (\r)</option>
            <option value="CRLF">CRLF (\r\n)</option>
          </select>
        </div>
        <div className="section">
          <label>I/O Settings</label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={serialTerminal.showHex}
              onChange={(e) =>
                updateSerialTerminal({ showHex: e.target.checked })
              }
            />
            Show RX as Hex
          </label>
          <select
            value={serialTerminal.inputMode}
            onChange={(e) =>
              updateSerialTerminal({ inputMode: e.target.value as any })
            }
            disabled={!isConnected}
          >
            <option value="TEXT">Input as Text</option>
            <option value="HEX">Input as Hex</option>
          </select>
        </div>
        <div className="buttons">
          {!isConnected ? (
            <button onClick={serialConnect} className="btn-primary">
              {serialTerminal.selectedPortName ? "Connect" : "Request Port"}
            </button>
          ) : (
            <button
              onClick={() => serialDisconnect(false)}
              className="btn-danger"
            >
              Disconnect
            </button>
          )}
          <button onClick={clearTerminal}>Clear</button>
          <button onClick={resetSerialTerminal}>Reset</button>
        </div>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={serialTerminal.autoScroll}
            onChange={(e) =>
              updateSerialTerminal({ autoScroll: e.target.checked })
            }
          />
          Auto-scroll
        </label>
        <div className="stats">
          TX: {serialTerminal.stats.tx} | RX: {serialTerminal.stats.rx} |
          Errors: {serialTerminal.stats.errors}
        </div>
      </div>

      <div className="terminal">
        {serialTerminal.messages.map((msg) => (
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
            value={serialTerminal.inputMode === "TEXT" ? inputText : inputHex}
            onChange={(e) => {
              if (serialTerminal.inputMode === "TEXT") {
                setInputText(e.target.value);
              } else {
                setInputHex(e.target.value);
              }
            }}
            onKeyPress={(e) => e.key === "Enter" && handleSend()}
            placeholder={
              serialTerminal.inputMode === "TEXT"
                ? "Type message and press Enter..."
                : "Enter hex bytes separated by space (e.g., 48 65 6C 6C 6F)"
            }
            disabled={!isConnected}
          />
          <button
            onClick={handleSend}
            disabled={!isConnected}
            className="btn-send"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};
