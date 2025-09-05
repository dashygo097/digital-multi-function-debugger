import React from "react";
import { Link } from "react-router-dom";

import { withRouter } from "../utils/withRouter";
import Button from "./Button";
import NavHeader from "./NavHeader";
import GitHubIcon from "./GithubIcon";
import "../styles/navbar.css";

interface NavBarProps {
  navigate: (path: string) => void;
}
interface NavBarState {
  onPage: string;
}

class NavBar extends React.Component<NavBarProps, NavBarState> {
  constructor(props: NavBarProps) {
    super(props);
    this.state = {
      onPage: window.location.pathname.replace("/", "") || "home",
    };
  }

  handleGoToMainOnClick = () => {
    this.props.navigate("/");
    this.setState({ onPage: "main" });
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
          className={`navbar-home ${this.state.onPage === "main" ? "active" : ""}`}
        >
          <Button
            onClick={this.handleGoToMainOnClick}
            className="navbar-button"
          >
            Main
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

const WrappedNavBar = withRouter(NavBar);
export default WrappedNavBar;
