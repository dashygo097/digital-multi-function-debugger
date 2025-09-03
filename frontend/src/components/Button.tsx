import React from "react";

interface ButtonProps {
  children?: React.ReactNode;
  type?: "button" | "submit" | "reset";
  className?: string;
  onClick?: () => void;
}

class Button extends React.Component<ButtonProps> {
  constructor(props: ButtonProps) {
    super(props);
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
      >
        <>{this.props.children}</>
      </button>
    );
  }
}

export default Button;
