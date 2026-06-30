import React, { useEffect, useState } from "react";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { LandingScreen } from "./screens/LandingScreen.jsx";
import { UploadScreen } from "./screens/UploadScreen.jsx";
import { ProcessingScreen } from "./screens/ProcessingScreen.jsx";
import { DocumentScreen } from "./screens/DocumentScreen.jsx";
import { BulkUploadScreen } from "./screens/BulkUploadScreen.jsx";
import { QueueDashboardScreen } from "./screens/QueueDashboardScreen.jsx";
import { isMockMode, onMockActivated } from "./api/client.js";

function MockBanner() {
  const [active, setActive] = useState(isMockMode);

  useEffect(() => {
    if (active) return;
    return onMockActivated(() => setActive(true));
  }, [active]);

  if (!active) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: "#b45309",
        color: "#fff",
        textAlign: "center",
        padding: "10px 16px",
        fontSize: 13,
        fontWeight: 700,
        letterSpacing: "0.04em",
        boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
      }}
    >
      DEMO MODE — backend unreachable, showing static mock data. Start the backend server and reload to use live data.
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <MockBanner />
      <Routes>
        <Route path="/" element={<LandingScreen />} />
        <Route path="/upload" element={<UploadScreen />} />
        <Route path="/bulk" element={<BulkUploadScreen />} />
        <Route path="/processing/:id" element={<ProcessingScreen />} />
        <Route path="/document/:id" element={<DocumentScreen />} />
        <Route path="/batch/:id" element={<QueueDashboardScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
