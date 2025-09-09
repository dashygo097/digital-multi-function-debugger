import React from "react";

import { WithRouter, WithRouterProps } from "@utils";

class NotFound extends React.Component<WithRouterProps> {
  constructor(props: WithRouterProps) {
    super(props);
  }
  render() {
    return (
      <div className="page-not-found">
        <h1>404 - Page Not Found D:</h1>
        <p>The page you are looking for does not exist.</p>
      </div>
    );
  }
}

const WrappedNotFound = WithRouter(NotFound);
export default WrappedNotFound;
