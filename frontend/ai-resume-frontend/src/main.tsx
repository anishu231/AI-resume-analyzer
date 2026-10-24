// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
// Ensure the DOM is ready before rendering
const rootElement = document.getElementById("root");

if (!rootElement) {
  console.error("❌ Root element not found. Check your index.html.");
} else {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
      <ToastContainer
        position="top-right"
        autoClose={3000} />
    </React.StrictMode>
  );
}