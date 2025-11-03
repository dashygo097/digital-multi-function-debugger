import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import WrappedNavBar from "./NavBar";
import WrappedWelcomePage from "./welcome/WelcomePage";
import WrappedMainPage from "./main/MainPage";
import WrappedCSRPage from "./csr/CSRPage";
import WrappedAboutPage from "./about/AboutPage";
import WrappedNotFound from "./notfound/NotFound";
import WrappedDocPage from "./doc/DocPage";
import WrappedAnalyzerPage from "./analyzer/AnalyzerPage";

const PageRouter: React.FC = () => {
  return (
    <BrowserRouter>
      <WrappedNavBar />
      <Routes>
        <Route path="/" element={<WrappedWelcomePage />} />
        <Route path="/main" element={<WrappedMainPage />} />
        <Route path="/csr" element={<WrappedCSRPage />} />
        <Route path="/analyzer" element={<WrappedAnalyzerPage />} />
        <Route path="/doc" element={<WrappedDocPage />} />
        <Route path="/about" element={<WrappedAboutPage />} />
        <Route path="*" element={<WrappedNotFound />} />
      </Routes>
    </BrowserRouter>
  );
};

export default PageRouter;
