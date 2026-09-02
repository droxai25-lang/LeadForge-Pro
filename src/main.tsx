import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initializeWebVitals } from "./lib/webVitals";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("LeadForge could not find the application root element.");

// Initialize Web Vitals RUM tracking
initializeWebVitals();

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
