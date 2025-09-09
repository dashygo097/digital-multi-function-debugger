import React from "react";

interface SelectListProps {
  options?: string[];
  className?: string;
}

export class SelectList extends React.Component<SelectListProps> {
  constructor(props: SelectListProps) {
    super(props);
  }

  render() {
    return (
      <select className={this.props.className}>
        {this.props.options?.map((option, index) => (
          <option key={index} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }
}
