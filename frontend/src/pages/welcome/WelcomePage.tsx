import React from "react";
import { WithRouter, WithRouterProps } from "@utils";
import "@styles/welcome.css";

interface WelcomePageState {
  currentTime: string;
  animationComplete: boolean;
}

class WelcomePage extends React.Component<WithRouterProps, WelcomePageState> {
  private timeInterval: NodeJS.Timeout | null = null;

  constructor(props: WithRouterProps) {
    super(props);
    this.state = {
      currentTime: this.formatTime(new Date()),
      animationComplete: false,
    };
  }

  componentDidMount() {
    // Update time every second
    this.timeInterval = setInterval(() => {
      this.setState({ currentTime: this.formatTime(new Date()) });
    }, 1000);

    // Mark animation as complete after initial animations
    setTimeout(() => {
      this.setState({ animationComplete: true });
    }, 1500);
  }

  componentWillUnmount() {
    if (this.timeInterval) {
      clearInterval(this.timeInterval);
    }
  }

  private formatTime = (date: Date): string => {
    return date.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  private navigateTo = (path: string) => {
    this.props.navigate(path);
  };

  render() {
    const { currentTime, animationComplete } = this.state;

    return (
      <div className="welcome-page">
        {/* Animated Background */}
        <div className="background-animation">
          <div className="grid-overlay"></div>
          <div className="gradient-orb orb-1"></div>
          <div className="gradient-orb orb-2"></div>
          <div className="gradient-orb orb-3"></div>
        </div>

        {/* Main Content */}
        <div className="welcome-content">
          {/* Header Section */}
          <div className="welcome-header fade-in">
            <div className="logo-section">
              <h1 className="app-title">FPGA Control Center</h1>
            </div>
            <p className="app-subtitle">
              2025A Embedded Competition - FPGA Track
            </p>
            <div className="tech-stack">
              <span className="tech-badge">React</span>
              <span className="tech-badge">TypeScript</span>
              <span className="tech-badge">Electron</span>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="stats-section slide-up">
            <div className="stat-card">
              <div className="stat-icon">⏰</div>
              <div className="stat-info">
                <div className="stat-label">Current Time</div>
                <div className="stat-value">{currentTime}</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">👤</div>
              <div className="stat-info">
                <div className="stat-label">Developer</div>
                <div className="stat-value">dashygo097</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">📅</div>
              <div className="stat-info">
                <div className="stat-label">Competition Year</div>
                <div className="stat-value">2025A</div>
              </div>
            </div>
          </div>

          {/* Navigation Cards */}
          <div className={`nav-grid ${animationComplete ? "show" : ""}`}>
            <div className="nav-card" onClick={() => this.navigateTo("/main")}>
              <div className="nav-card-icon">🎛️</div>
              <h3>Control Panel</h3>
              <p>Serial & UDP terminal control</p>
              <div className="nav-card-arrow">→</div>
            </div>

            <div className="nav-card" onClick={() => this.navigateTo("/csr")}>
              <div className="nav-card-icon">🔧</div>
              <h3>CSR Control</h3>
              <p>Register read/write operations</p>
              <div className="nav-card-arrow">→</div>
            </div>

            <div className="nav-card" onClick={() => this.navigateTo("/docs")}>
              <div className="nav-card-icon">📚</div>
              <h3>Documentation</h3>
              <p>Memory map & register reference</p>
              <div className="nav-card-arrow">→</div>
            </div>
          </div>

          {/* Footer */}
          <div className="welcome-footer fade-in-delay">
            <div className="footer-info">
              <p className="footer-text">
                Upper Computer Software for FPGA Development & Testing
              </p>
              <p className="footer-copyright">
                © 2025 dashygo097 | Built with ❤️ for Embedded Competition
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

const WrappedWelcomePage = WithRouter(WelcomePage);
export default WrappedWelcomePage;
