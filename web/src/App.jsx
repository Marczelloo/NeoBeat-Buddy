import { BrowserRouter, Route, Routes } from "react-router-dom";
import ChangelogPage from "./changelog/ChangelogPage.jsx";
import Dashboard from "./dashboard/Dashboard.jsx";
import HelpPage from "./help/HelpPage.jsx";
import NotFound from "./site/NotFound.jsx";
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
        {/* A bad address says so. Silently redirecting home threw the typo
            away, so nobody found out what they had got wrong. */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
