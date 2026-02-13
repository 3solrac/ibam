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
        {/* Rota principal (O formulário de cadastro) */}
        <Route path="/" element={<RegisterForm />} />

        {/* Rotas administrativas */}
        <Route path="/admin" element={<AdminLogin />} />

        <Route
          path="/dashboard"
          element={
            <RequireAdmin>
              <AdminDashboard />
            </RequireAdmin>
          }
        />

        {/* Redireciona qualquer link errado para a home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}