import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import RegisterForm from "./RegisterForm.jsx";
import AdminLogin from "./pages/AdminLogin.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";
import RequireAdmin from "./pages/RequireAdmin.jsx";
import "./App.css";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RegisterForm />} />

        <Route path="/admin" element={<AdminLogin />} />

        <Route
          path="/dashboard"
          element={
            <RequireAdmin>
              <AdminDashboard />
            </RequireAdmin>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
