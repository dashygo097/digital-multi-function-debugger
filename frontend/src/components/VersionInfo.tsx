import React from "react";
import "../styles/info.css";

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
      <div className="info-version">
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
