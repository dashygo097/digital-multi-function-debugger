import React from "react";
import { Link } from "react-router-dom";

import { WithRouter, WithRouterProps } from "@utils";
import { Button, GitHubIcon } from "@components";
import NavHeader from "./NavHeader";
import "@styles/navbar.css";

interface NavBarState {
  onPage: string;
}

class NavBar extends React.Component<WithRouterProps, NavBarState> {
  constructor(props: WithRouterProps) {
    super(props);
    this.state = {
      onPage: window.location.pathname.replace("/", "") || "welcome",
    };
  }

  handleGoToWelcomeOnClick = () => {
    this.props.navigate("/");
    this.setState({ onPage: "welcome" });
  };

  handleGoToMainOnClick = () => {
    this.props.navigate("/main");
    this.setState({ onPage: "main" });
  };

  handleGoToCSROnClick = () => {
    this.props.navigate("/csr");
    this.setState({ onPage: "csr" });
  };

  handleGoToAnalyzerOnClick = () => {
    this.props.navigate("/analyzer");
    this.setState({ onPage: "analyzer" });
  };

  handleGoToDocOnClick = () => {
    this.props.navigate("/doc");
    this.setState({ onPage: "docs" });
  };

  handleGoToAboutOnClick = () => {
    this.props.navigate("/about");
    this.setState({ onPage: "about" });
  };

  render() {
    return (
      <nav className="navbar">
        <NavHeader title={this.state.onPage} subtitle="dashygo097@" />
        <Link
          to="/"
          className={`navbar-welcome ${this.state.onPage === "welcome" ? "active" : ""}`}
        >
          <Button
            onClick={this.handleGoToWelcomeOnClick}
            className="navbar-button"
          >
            Welcome
          </Button>
        </Link>
        <Link
          to="/main"
          className={`navbar-main ${this.state.onPage === "main" ? "active" : ""}`}
        >
          <Button
            onClick={this.handleGoToMainOnClick}
            className="navbar-button"
          >
            Main
          </Button>
        </Link>
        <Link
          to="/csr"
          className={`navbar-csr ${this.state.onPage === "csr" ? "active" : ""}`}
        >
          <Button onClick={this.handleGoToCSROnClick} className="navbar-button">
            CSR
          </Button>
        </Link>
        <Link
          to="/analyzer"
          className={`navbar-analyzer ${this.state.onPage === "analyzer" ? "active" : ""}`}
        >
          <Button
            onClick={this.handleGoToAnalyzerOnClick}
            className="navbar-button"
          >
            Analyzer
          </Button>
        </Link>
        <Link
          to="/doc"
          className={`navbar-doc ${this.state.onPage === "docs" ? "active" : ""}`}
        >
          <Button onClick={this.handleGoToDocOnClick} className="navbar-button">
            Docs
          </Button>
        </Link>
        <Link
          to="/about"
          className={`navbar-about ${this.state.onPage === "about" ? "active" : ""}`}
        >
          <Button
            onClick={this.handleGoToAboutOnClick}
            className="navbar-button"
          >
            About
          </Button>
        </Link>
        <GitHubIcon />
      </nav>
    );
  }
}

const WrappedNavBar = WithRouter(NavBar);
export default WrappedNavBar;
