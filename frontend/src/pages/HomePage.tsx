import React from "react";

import { withRouter } from "../utils/withRouter";
import Waveform from "../components/Waveform";

const MAX_POINTS = 100;

interface HomePageProps {
  navigate: (path: string) => void;
}

class HomePage extends React.Component<HomePageProps> {
  timerId?: NodeJS.Timeout;
  constructor(props: HomePageProps) {
    super(props);
  }

  render() {
    return (
      <div className="page-home">
        <h1>Waveform Example</h1>
        <Waveform data={[]} />
      </div>
    );
  }
}
const WrappedHomePage = withRouter(HomePage);
export default WrappedHomePage;
