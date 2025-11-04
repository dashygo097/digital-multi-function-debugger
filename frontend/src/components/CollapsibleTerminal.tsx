import React, { Component, ReactNode } from "react";

interface CollapsiblePanelProps {
  title: string;
  children: ReactNode;
  initialCollapsed?: boolean;
}

interface CollapsiblePanelState {
  isCollapsed: boolean;
}

export class CollapsiblePanel extends Component<
  CollapsiblePanelProps,
  CollapsiblePanelState
> {
  constructor(props: CollapsiblePanelProps) {
    super(props);
    this.state = {
      isCollapsed: props.initialCollapsed || false,
    };
  }

  toggleCollapse = () => {
    this.setState((prevState) => ({
      isCollapsed: !prevState.isCollapsed,
    }));
  };

  render() {
    const { title, children } = this.props;
    const { isCollapsed } = this.state;

    return (
      <div className="terminal-wrapper">
        <div className="terminal-header" onClick={this.toggleCollapse}>
          <h2 className="terminal-heading">{title}</h2>
          <button className="terminal-toggle-btn">
            {isCollapsed ? "+" : "-"}
          </button>
        </div>
        <div className={`terminal-content ${isCollapsed ? "collapsed" : ""}`}>
          {children}
        </div>
      </div>
    );
  }
}
