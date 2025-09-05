import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import WrappedNavBar from "../components/NavBar";
import WrappedMainPage from "./MainPage";
import WrappedAboutPage from "./AboutPage";
import WrappedNotFound from "./NotFound";
import WrappedDocPage from "./DocPage";

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
