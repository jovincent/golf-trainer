import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { SharePage } from "./pages/SharePage";
import "./index.css";

// Tiny path router: /s/<token> renders the standalone public share view,
// everything else is the app. Keeps the project router-dependency-free.
const shareMatch = window.location.pathname.match(/^\/s\/([A-Za-z0-9_-]+)/);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {shareMatch ? <SharePage token={shareMatch[1]} /> : <App />}
  </React.StrictMode>,
);
