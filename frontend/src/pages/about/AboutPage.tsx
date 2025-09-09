import React from "react";

import { withRouter } from "@utils/index";
import VersionInfo from "./VersionInfo";

interface AboutPageProps {
  navigate: (path: string) => void;
}

class AboutPage extends React.Component<AboutPageProps> {
  constructor(props: AboutPageProps) {
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

const WrappedAboutPage = withRouter(AboutPage);
export default WrappedAboutPage;
