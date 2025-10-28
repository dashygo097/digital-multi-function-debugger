const dgram = require("dgram");
const WebSocket = require("ws");

class UDPBridge {
  constructor(wsPort = 8080) {
    this.wsPort = wsPort;
    this.udpSocket = null;
    this.wss = null;
    this.clients = new Set();
    this.udpConfig = {
      localPort: 0,
      remoteHost: "",
      remotePort: 0,
      isBound: false,
    };
  }

  start() {
    // Create WebSocket server
    this.wss = new WebSocket.Server({ port: this.wsPort });
    console.log(`WebSocket server listening on port ${this.wsPort}`);

    this.wss.on("connection", (ws) => {
      console.log("Client connected");
      this.clients.add(ws);

      ws.on("message", (message) => {
        try {
          const data = JSON.parse(message);
          this.handleMessage(ws, data);
        } catch (error) {
          this.sendError(ws, `Invalid message: ${error.message}`);
        }
      });

      ws.on("close", () => {
        console.log("Client disconnected");
        this.clients.delete(ws);
      });

      ws.on("error", (error) => {
        console.error("WebSocket error:", error);
        this.clients.delete(ws);
      });

      // Send initial status
      this.sendStatus(ws);
    });
  }

  handleMessage(ws, data) {
    const { type, payload } = data;

    switch (type) {
      case "BIND":
        this.bindUDP(ws, payload.localPort);
        break;

      case "SEND":
        this.sendUDP(ws, payload);
        break;

      case "SET_REMOTE":
        this.setRemote(ws, payload.host, payload.port);
        break;

      case "CLOSE":
        this.closeUDP(ws);
        break;

      case "SET_BROADCAST":
        this.setBroadcast(ws, payload.enabled);
        break;

      case "GET_STATUS":
        this.sendStatus(ws);
        break;

      default:
        this.sendError(ws, `Unknown message type: ${type}`);
    }
  }

  bindUDP(ws, localPort) {
    try {
      if (this.udpSocket) {
        this.udpSocket.close();
      }

      this.udpSocket = dgram.createSocket("udp4");

      this.udpSocket.on("message", (msg, rinfo) => {
        const data = {
          type: "RECEIVE",
          payload: {
            data: Array.from(msg),
            remoteAddress: rinfo.address,
            remotePort: rinfo.port,
            timestamp: new Date().toISOString(),
          },
        };

        // Broadcast to all connected WebSocket clients
        this.broadcast(data);
      });

      this.udpSocket.on("error", (err) => {
        this.sendError(ws, `UDP Error: ${err.message}`);
        this.closeUDP(ws);
      });

      this.udpSocket.bind(localPort, () => {
        this.udpConfig.localPort = localPort;
        this.udpConfig.isBound = true;
        console.log(`UDP socket bound to port ${localPort}`);

        this.send(ws, {
          type: "BIND_SUCCESS",
          payload: { localPort },
        });
      });
    } catch (error) {
      this.sendError(ws, `Bind failed: ${error.message}`);
    }
  }

  sendUDP(ws, payload) {
    if (!this.udpSocket || !this.udpConfig.isBound) {
      this.sendError(ws, "UDP socket not bound");
      return;
    }

    if (!this.udpConfig.remoteHost || !this.udpConfig.remotePort) {
      this.sendError(ws, "Remote host/port not set");
      return;
    }

    const { data } = payload;
    const buffer = Buffer.from(data);

    this.udpSocket.send(
      buffer,
      this.udpConfig.remotePort,
      this.udpConfig.remoteHost,
      (err) => {
        if (err) {
          this.sendError(ws, `Send failed: ${err.message}`);
        } else {
          this.send(ws, {
            type: "SEND_SUCCESS",
            payload: {
              bytes: buffer.length,
              timestamp: new Date().toISOString(),
            },
          });
        }
      },
    );
  }

  setRemote(ws, host, port) {
    this.udpConfig.remoteHost = host;
    this.udpConfig.remotePort = port;
    console.log(`Remote set to ${host}:${port}`);

    this.send(ws, {
      type: "REMOTE_SET",
      payload: { host, port },
    });
  }

  setBroadcast(ws, enabled) {
    if (!this.udpSocket) {
      this.sendError(ws, "UDP socket not created");
      return;
    }

    try {
      this.udpSocket.setBroadcast(enabled);
      this.send(ws, {
        type: "BROADCAST_SET",
        payload: { enabled },
      });
    } catch (error) {
      this.sendError(ws, `Broadcast failed: ${error.message}`);
    }
  }

  closeUDP(ws) {
    if (this.udpSocket) {
      this.udpSocket.close();
      this.udpSocket = null;
      this.udpConfig.isBound = false;
      console.log("UDP socket closed");

      this.send(ws, {
        type: "CLOSE_SUCCESS",
        payload: {},
      });
    }
  }

  sendStatus(ws) {
    this.send(ws, {
      type: "STATUS",
      payload: {
        isBound: this.udpConfig.isBound,
        localPort: this.udpConfig.localPort,
        remoteHost: this.udpConfig.remoteHost,
        remotePort: this.udpConfig.remotePort,
      },
    });
  }

  send(ws, data) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }

  broadcast(data) {
    const message = JSON.stringify(data);
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  sendError(ws, message) {
    this.send(ws, {
      type: "ERROR",
      payload: { message },
    });
  }
}

// Start the bridge
const bridge = new UDPBridge(8080);
bridge.start();

console.log("UDP Bridge started");
console.log("WebSocket: ws://localhost:8080");
console.log("Waiting for connections...");
