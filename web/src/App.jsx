import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import ChangelogPage from "./changelog/ChangelogPage.jsx";
import Dashboard from "./dashboard/Dashboard.jsx";
import HelpPage from "./help/HelpPage.jsx";
import Landing from "./landing/Landing.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/help" element={<HelpPage />} />
        <Route path="/changelog" element={<ChangelogPage />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/dashboard/:guildId" element={<Dashboard />} />
        <Route path="/dashboard/:guildId/:section" element={<Dashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
