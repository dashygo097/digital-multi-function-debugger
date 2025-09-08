import React from "react";
import "../../styles/about.css";

interface VersionInfoProps {
  names: string[];
  versions: string[];
}

class VersionInfo extends React.Component<VersionInfoProps> {
  constructor(props: VersionInfoProps) {
    super(props);
  }

  render() {
    return (
      <div className="about-versions">
        {this.props.names.map((name, index) => (
          <div key={index}>
            {this.props.names[index]} (v{this.props.versions[index]})
          </div>
        ))}
      </div>
    );
  }
}

export default VersionInfo;
