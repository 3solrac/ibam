import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import RegisterForm from "./RegisterForm.jsx";

import AdminLogin from "./pages/AdminLogin.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";
import RequireAdmin from "./pages/RequireAdmin.jsx";

import PublicHome from "./pages/PublicHome.jsx";
import PublicAgenda from "./pages/PublicAgenda.jsx";
import PublicCells from "./pages/PublicCells.jsx";

import "./App.css";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* PÚBLICO */}
        <Route path="/" element={<PublicHome />} />
        <Route path="/cadastro" element={<RegisterForm />} />
        <Route path="/agenda" element={<PublicAgenda />} />
        <Route path="/celulas" element={<PublicCells />} />

        {/* ADMIN */}
        <Route path="/admin" element={<AdminLogin />} />
        <Route
          path="/dashboard"
          element={
            <RequireAdmin>
              <AdminDashboard />
            </RequireAdmin>
          }
        />

        {/* QUALQUER COISA ERRADA => HOME */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}