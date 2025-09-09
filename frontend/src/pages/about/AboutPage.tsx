import React from "react";

import { WithRouter, WithRouterProps } from "@utils";
import VersionInfo from "./VersionInfo";

class AboutPage extends React.Component<WithRouterProps> {
  constructor(props: WithRouterProps) {
    super(props);
  }

  render() {
    return (
      <div className="about-page">
        <h1>About This App</h1>
        <p className="about-info">
          This is the upper computer software for the 2025A Embedded Competition
          FPGA track, developed using React + TypeScript + Electron.
        </p>
        <VersionInfo
          names={["Node.js", "Chrome", "Electron"]}
          versions={[
            window.versions.node(),
            window.versions.chrome(),
            window.versions.electron(),
          ]}
        />
      </div>
    );
  }
}

const WrappedAboutPage = WithRouter(AboutPage);
export default WrappedAboutPage;
