import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import WrappedNavBar from "./NavBar";
import WrappedMainPage from "./main/MainPage";
import WrappedAboutPage from "./about/AboutPage";
import WrappedNotFound from "./notfound/NotFound";
import WrappedDocPage from "./doc/DocPage";

const PageRouter: React.FC = () => {
  return (
    <BrowserRouter>
      <WrappedNavBar />
      <Routes>
        <Route path="/" element={<WrappedMainPage />} />
        <Route path="/doc" element={<WrappedDocPage />} />
        <Route path="/about" element={<WrappedAboutPage />} />
        <Route path="*" element={<WrappedNotFound />} />
      </Routes>
    </BrowserRouter>
  );
};

export default PageRouter;
