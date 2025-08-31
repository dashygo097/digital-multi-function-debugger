import React from "react";
import { Link } from "react-router-dom";

import { withRouter } from "../utils/withRouter";
import { HomeIcon, NoteIcon } from "./Icons";
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
    console.log("Navigating to home");
    this.props.navigate("/");
    this.setState({ onPage: "home" });
  };

  handleGoToAboutOnClick = () => {
    console.log("Navigating to about");
    this.props.navigate("/about");
    this.setState({ onPage: "about" });
  };

  handleGoToNotesOnClick = () => {
    console.log("Navigating to notes");
    this.props.navigate("/notes");
    this.setState({ onPage: "notes" });
  };

  render() {
    return (
      <nav className="navbar">
        <NavHeader title={this.state.onPage} subtitle="dashygo097@" />
        <Link
          to="/"
          className={`navbar-home ${this.state.onPage === "home" ? "active" : ""}`}
        >
          <Button onClick={this.handleGoToHomeOnClick}>Home</Button>
        </Link>
        <Link
          to="/about"
          className={`navbar-about ${this.state.onPage === "about" ? "active" : ""}`}
        >
          <Button onClick={this.handleGoToAboutOnClick}>About</Button>
        </Link>
      </nav>
    );
  }
}

const WrappedNavBar = withRouter(NavBar);
export default WrappedNavBar;
