import React from "react";

import { withRouter } from "@utils/index";

interface NotFoundProps {
  navigate: (path: string) => void;
}

class NotFound extends React.Component<NotFoundProps> {
  constructor(props: NotFoundProps) {
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

const WrappedNotFound = withRouter(NotFound);
export default WrappedNotFound;
