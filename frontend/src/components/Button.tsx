import React from "react";
import "../styles/button.css";

interface ButtonProps {
  children?: React.ReactNode;
  icon?: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
  className?: string;
}

interface ButtonState {
  disabled?: boolean;
  active?: boolean;
  loading?: boolean;
}

class Button extends React.Component<ButtonProps, ButtonState> {
  constructor(props: ButtonProps) {
    super(props);
    this.state = {};
  }

  render() {
    return (
      <button
        type={this.props.type || "button"}
        className={this.props.className}
        onClick={this.props.onClick}
        disabled={this.state.disabled}
      >
        {this.state.loading ? (
          "Loading..."
        ) : (
          <>
            {this.props.icon}
            {this.props.children}
          </>
        )}
      </button>
    );
  }
}

export default Button;
