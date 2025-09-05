import React from "react";

interface SelectListProps {
  label: string;
  options?: string[];
  className?: string;
}

class SelectList extends React.Component<SelectListProps> {
  constructor(props: SelectListProps) {
    super(props);
  }

  render() {
    return (
      <div>
        <label>{this.props.label}</label>
        <select>
          {this.props.options?.map((option, index) => (
            <option key={index} value={option}>
              {" "}
              {option}
            </option>
          ))}
        </select>
      </div>
    );
  }
}

export default SelectList;
