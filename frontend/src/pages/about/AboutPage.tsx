import React from "react";

import { WithRouter, WithRouterProps } from "@utils";
import VersionInfo from "./VersionInfo";
import "@styles/about.css";

class AboutPage extends React.Component<WithRouterProps> {
  constructor(props: WithRouterProps) {
    super(props);
  }

  render() {
    return (
      <div className="about-page">
        <div className="about-content">
          <div className="about-header">
            <h1>About This Application</h1>
            <p className="description">
              Digital Multi-Function Debugger Platform
            </p>
          </div>

          {/* Main Info Card */}
          <div className="about-info">
            <h2>Project Overview</h2>
            <p>
              This is the upper computer software for the{" "}
              <strong>2025A Embedded Competition FPGA track</strong>, developed
              using modern web technologies and packaged as a desktop
              application.
            </p>

            <h2 style={{ marginTop: "32px" }}>Technology Stack</h2>
            <ul>
              <li>
                <strong>React</strong> - A JavaScript library for building user
                interfaces
              </li>
              <li>
                <strong>TypeScript</strong> - Typed superset of JavaScript for
                improved development
              </li>
              <li>
                <strong>Electron</strong> - Framework for building
                cross-platform desktop apps
              </li>
              <li>
                <strong>Web Serial API</strong> - For serial communication with
                hardware
              </li>
              <li>
                <strong>WebSocket</strong> - For real-time UDP bridge
                communication
              </li>
            </ul>

            <h2 style={{ marginTop: "32px" }}>Key Features</h2>
            <div className="feature-grid">
              <div className="feature-card">
                <h3>🔧 Serial Terminal</h3>
                <p>
                  Full-featured serial communication with configurable baud
                  rates and data formats.
                </p>
              </div>
              <div className="feature-card">
                <h3>🌐 UDP Terminal</h3>
                <p>
                  Network-based communication via WebSocket bridge for FPGA
                  interaction.
                </p>
              </div>
              <div className="feature-card">
                <h3>📊 CSR Control</h3>
                <p>
                  Control and Status Register interface for hardware
                  configuration.
                </p>
              </div>
              <div className="feature-card">
                <h3>📚 Documentation</h3>
                <p>Comprehensive user guides and API documentation built-in.</p>
              </div>
            </div>

            <h2 style={{ marginTop: "32px" }}>Developer Information</h2>
            <p>
              <strong>Developed by:</strong> @dashygo097
              <br />
              <strong>Repository:</strong>{" "}
              <a
                href="https://github.com/dashygo097/digital-multi-function-debugger"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: "#58a6ff",
                  textDecoration: "none",
                  borderBottom: "1px solid transparent",
                  transition: "all 0.2s ease",
                }}
              >
                GitHub Repository
              </a>
              <br />
            </p>
          </div>
        </div>

        {/* Version Info Panel */}
        <VersionInfo
          names={["Node.js", "Chrome", "Electron"]}
          versions={[
            window.versions.node(),
            window.versions.chrome(),
            window.versions.electron(),
          ]}
        />
      </div>
    );
  }
}

const WrappedAboutPage = WithRouter(AboutPage);
export default WrappedAboutPage;
