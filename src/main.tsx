import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App";
import "./styles.css";
import "leaflet/dist/leaflet.css";
import { initPwa } from "./lib/pwa";

initPwa();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
