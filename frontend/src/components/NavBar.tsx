import React from "react";
import { Link } from "react-router-dom";

import { withRouter } from "../utils/withRouter";
import Button from "./Button";
import NavHeader from "./NavHeader";
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

  handleGoToHomeOnClick = () => {
    this.props.navigate("/");
    this.setState({ onPage: "home" });
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
          className={`navbar-home ${this.state.onPage === "home" ? "active" : ""}`}
        >
          <Button
            onClick={this.handleGoToHomeOnClick}
            className="navbar-button"
          >
            Home
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
      </nav>
    );
  }
}

const WrappedNavBar = withRouter(NavBar);
export default WrappedNavBar;
