import React from "react";

import { withRouter } from "../utils/withRouter";
import Waveform from "../components/Waveform";
import InputTracer from "../components/InputTracer";

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
        <InputTracer name="hehe" />
      </div>
    );
  }
}
const WrappedHomePage = withRouter(HomePage);
export default WrappedHomePage;
