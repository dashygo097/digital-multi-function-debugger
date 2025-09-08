import React from "react";

interface SelectListProps {
  options?: string[];
  className?: string;
  onChange?: (value: string) => void;
}

class SelectList extends React.Component<SelectListProps> {
  constructor(props: SelectListProps) {
    super(props);
  }

  handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    console.log(event.target.value);
  }

  render() {
    return (
      <select className={this.props.className} onChange={this.handleChange}>
        {this.props.options?.map((option, index) => (
          <option key={index} value={option}>
            {" "}
            {option}
          </option>
        ))}
      </select>
    );
  }
}

export default SelectList;
