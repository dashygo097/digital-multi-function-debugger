import React from "react";

interface ButtonProps {
  children?: React.ReactNode;
  type?: "button" | "submit" | "reset";
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
}

interface ButtonState {
  loading: boolean;
}

export class Button extends React.Component<ButtonProps, ButtonState> {
  constructor(props: ButtonProps) {
    super(props);
    this.state = {
      loading: false,
    };
  }

  handleClick = () => {
    if (this.props.onClick) {
      this.setState({ loading: true });
      Promise.resolve(this.props.onClick()).finally(() => {
        this.setState({ loading: false });
      });
    }
  };

  render() {
    return (
      <button
        type={this.props.type || "button"}
        className={this.props.className}
        onClick={this.handleClick}
        disabled={this.props.disabled || this.state.loading}
      >
        <>{this.props.children}</>
      </button>
    );
  }
}
