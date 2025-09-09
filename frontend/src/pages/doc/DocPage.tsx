import React from "react";

import { WithRouter, WithRouterProps } from "@utils";
import { MarkDownEditor } from "./MarkDownEditor";

class DocPage extends React.Component<WithRouterProps> {
  constructor(props: WithRouterProps) {
    super(props);
  }

  render() {
    return (
      <div className="doc-page">
        <h1>Documentations</h1>
        <MarkDownEditor />
      </div>
    );
  }
}

const WrappedDocPage = WithRouter(DocPage);
export default WrappedDocPage;
