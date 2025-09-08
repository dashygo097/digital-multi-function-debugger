import React from "react";

import { withRouter } from "../../utils/withRouter";

interface DocPageProps {
  navigate: (path: string) => void;
}

class DocPage extends React.Component<DocPageProps> {
  constructor(props: DocPageProps) {
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

const WrappedDocPage = withRouter(DocPage);
export default WrappedDocPage;
