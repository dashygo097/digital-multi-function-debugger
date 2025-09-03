import React from "react";

interface InputTracerProps {
  name: string;
  className?: string;
  value?: string;
  placeholder?: string;
  onChange?: (value: string) => void;
}

class InputTracer extends React.Component<InputTracerProps> {
  private inputRef: React.RefObject<HTMLInputElement>;
  constructor(props: InputTracerProps) {
    super(props);
    this.state = {
      focused: false,
    };
    this.inputRef = React.createRef();
  }

  handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (this.props.onChange) {
      this.props.onChange(event.target.value);
    }
  };

  handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      const prev = this.inputRef.current?.value || "";
      this.clearValue();
      return prev;
    }
  };

  clearValue() {
    if (this.inputRef.current) {
      this.inputRef.current.value = "";
    }
  }

  render() {
    return (
      <input
        ref={this.inputRef}
        name={this.props.name}
        value={this.props.value}
        placeholder={this.props.placeholder}
        onChange={this.handleChange}
        onKeyDown={this.handleKeyDown}
      />
    );
  }
}

export default InputTracer;
