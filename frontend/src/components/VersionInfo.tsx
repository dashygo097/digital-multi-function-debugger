import React from "react";
import "../styles/version.css";

interface VersionInfoProps {
  name: string;
  version: string;
}

class VersionInfo extends React.Component<VersionInfoProps> {
  constructor(props: VersionInfoProps) {
    super(props);
  }

  render() {
    return (
      <div className="info-version">
        {this.props.name} - v{this.props.version}
      </div>
    );
  }
}

export default VersionInfo;
