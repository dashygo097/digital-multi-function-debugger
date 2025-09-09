import React from "react";

import { WithRouter, WithRouterProps } from "@utils";

class DocPage extends React.Component<WithRouterProps> {
  constructor(props: WithRouterProps) {
    super(props);
  }

  render() {
    return (
      <div className="doc-page">
        <h1>Documentations</h1>
      </div>
    );
  }
}

const WrappedDocPage = WithRouter(DocPage);
export default WrappedDocPage;
