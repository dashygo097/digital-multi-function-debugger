import React from "react";
import "@styles/navbar.css";

interface NavHeaderProps {
  title: string;
  subtitle?: string;
}

class NavHeader extends React.Component<NavHeaderProps> {
  constructor(props: NavHeaderProps) {
    super(props);
  }
  render() {
    return (
      <header className="navbar-header">
        <div className="navbar-header-title">{this.props.title}</div>
        {this.props.subtitle && (
          <div className="navbar-header-subtitle">{this.props.subtitle}</div>
        )}
      </header>
    );
  }
}

export default NavHeader;
