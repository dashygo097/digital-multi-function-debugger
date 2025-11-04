import React from "react";
import { useUDPContext } from "../contexts";

export const UDPTerminal: React.FC<{ className?: string }> = ({
  className = "udp-terminal",
}) => {
  const context = useUDPContext();
  const {
    udpTerminal,
    updateUDPTerminal,
    resetUDPTerminal,
    udpBind,
    udpClose,
    udpSendText,
    udpSendHex,
  } = context;
  const terminalEndRef = React.useRef<HTMLDivElement>(null);

  const [inputText, setInputText] = React.useState("");
  const [inputHex, setInputHex] = React.useState("");

  React.useEffect(() => {
    if (udpTerminal.autoScroll) {
      terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [udpTerminal.messages, udpTerminal.autoScroll]);

  const handleSend = () => {
    if (udpTerminal.inputMode === "TEXT") {
      udpSendText(inputText);
      setInputText("");
    } else {
      udpSendHex(inputHex);
      setInputHex("");
    }
  };

  const clearTerminal = () => {
    updateUDPTerminal({
      messages: [],
      stats: { tx: 0, rx: 0, errors: 0, lastRxTime: undefined },
    });
  };

  const exportLog = () => {
    const log = udpTerminal.messages
      .map((m) => {
        const source = m.source ? ` [${m.source}]` : "";
        return `[${m.timestamp}] ${m.direction}${source}: ${m.data}`;
      })
      .join("\n");

    const element = document.createElement("a");
    element.setAttribute(
      "href",
      "data:text/plain;charset=utf-8," + encodeURIComponent(log),
    );
    element.setAttribute("download", `fpga-udp-log-${Date.now()}.txt`);
    element.style.display = "none";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className={`terminal-container ${className}`}>
      <div className="control-panel">
        <div className="section">
          <span
            className={`status-indicator ${udpTerminal.wsConnected ? "connected" : "disconnected"}`}
          >
            {udpTerminal.wsConnected
              ? "● Bridge Connected"
              : "○ Bridge Disconnected"}
          </span>
        </div>

        <div className="section">
          <label>Local Port:</label>
          <input
            type="number"
            value={udpTerminal.localPort}
            onChange={(e) =>
              updateUDPTerminal({ localPort: Number(e.target.value) })
            }
            disabled={udpTerminal.isBound}
            min={1}
            max={65535}
          />
        </div>

        <div className="section">
          <label>FPGA IP:</label>
          <input
            type="text"
            value={udpTerminal.fpgaHost}
            onChange={(e) => updateUDPTerminal({ fpgaHost: e.target.value })}
            disabled={udpTerminal.isBound}
            placeholder="192.168.1.100"
          />
          <label>FPGA Port:</label>
          <input
            type="number"
            value={udpTerminal.fpgaPort}
            onChange={(e) =>
              updateUDPTerminal({ fpgaPort: Number(e.target.value) })
            }
            disabled={udpTerminal.isBound}
            min={1}
            max={65535}
          />
        </div>

        <div className="section">
          <label>I/O Settings</label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={udpTerminal.showHex}
              onChange={(e) => updateUDPTerminal({ showHex: e.target.checked })}
            />
            Show RX as Hex
          </label>
          {udpTerminal.showHex && (
            <select
              value={udpTerminal.hexPrefix}
              onChange={(e) =>
                updateUDPTerminal({ hexPrefix: e.target.value as any })
              }
            >
              <option value="0x">0x Prefix</option>
              <option value="\x">\x Prefix</option>
              <option value="">No Prefix</option>
            </select>
          )}
          <select
            value={udpTerminal.inputMode}
            onChange={(e) =>
              updateUDPTerminal({ inputMode: e.target.value as any })
            }
            disabled={!udpTerminal.isBound}
          >
            <option value="TEXT">Input as Text</option>
            <option value="HEX">Input as Hex</option>
          </select>
        </div>

        <div className="buttons">
          {!udpTerminal.isBound ? (
            <button
              onClick={udpBind}
              className="btn-primary"
              disabled={!udpTerminal.wsConnected}
            >
              Bind
            </button>
          ) : (
            <button onClick={udpClose} className="btn-danger">
              Unbind
            </button>
          )}
          <button onClick={clearTerminal}>Clear</button>
          <button onClick={exportLog}>Export Log</button>
          <button onClick={resetUDPTerminal}>Reset</button>
        </div>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={udpTerminal.autoScroll}
            onChange={(e) =>
              updateUDPTerminal({ autoScroll: e.target.checked })
            }
          />
          Auto-scroll
        </label>
        <div className="stats">
          TX: {udpTerminal.stats.tx} | RX: {udpTerminal.stats.rx} | Errors:{" "}
          {udpTerminal.stats.errors}
          {udpTerminal.stats.lastRxTime &&
            ` | Last RX: ${udpTerminal.stats.lastRxTime}`}
        </div>
      </div>

      <div className="terminal">
        {udpTerminal.messages.map((msg) => (
          <div
            key={msg.id}
            className={`message ${msg.direction.toLowerCase()}`}
          >
            <span className="timestamp">[{msg.timestamp}]</span>
            <span className="direction">{msg.direction}:</span>
            {msg.source && <span className="source">[{msg.source}]</span>}
            <span className="data">{msg.data}</span>
          </div>
        ))}
        <div ref={terminalEndRef} />
      </div>

      <div className="input-section">
        <div className="text-input">
          <input
            type="text"
            value={udpTerminal.inputMode === "TEXT" ? inputText : inputHex}
            onChange={(e) => {
              if (udpTerminal.inputMode === "TEXT")
                setInputText(e.target.value);
              else setInputHex(e.target.value);
            }}
            onKeyPress={(e) => e.key === "Enter" && handleSend()}
            placeholder={
              udpTerminal.inputMode === "TEXT"
                ? "Type message to send..."
                : "Hex: 01 02 03 or 0x01 0x02 0x03"
            }
            disabled={!udpTerminal.isBound}
          />
          <button
            onClick={handleSend}
            disabled={!udpTerminal.isBound}
            className="btn-send"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};
