import React from "react";

import { withRouter } from "../utils/withRouter";

interface HomePageProps {
  navigate: (path: string) => void;
}

class HomePage extends React.Component<HomePageProps> {
  constructor(props: HomePageProps) {
    super(props);
  }

  render() {
    return (
      <div className="page-home">
        <h1>Welcome Home!</h1>
        <p style={{ fontSize: "1.1rem", maxWidth: "600px" }}>Welcome!</p>
      </div>
    );
  }
}
const WrappedHomePage = withRouter(HomePage);
export default WrappedHomePage;
