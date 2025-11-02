import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/index.css";

import PageRouter from "./pages/PageRouter";
import { TerminalProvider } from "./contexts/TerminalContext";

interface AppProps {
  placeholder?: string;
}

class App extends React.Component<AppProps> {
  constructor(props: AppProps) {
    super(props);
  }

  render() {
    return (
      <TerminalProvider>
        <div className="App">
          <PageRouter />
        </div>
      </TerminalProvider>
    );
  }
}

export default App;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
