import React from "react";

import { withRouter } from "../utils/withRouter";
import VersionInfo from "../components/VersionInfo";

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
        <p>
          这是2025a嵌赛FPGA赛道的上位机软件，使用React+TypeScript+Electron编写。
        </p>
        <p>
          <VersionInfo />
        </p>
      </div>
    );
  }
}

const WrappedAboutPage = withRouter(AboutPage);
export default WrappedAboutPage;
