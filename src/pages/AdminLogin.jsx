import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import "./AdminLogin.css";
import logo from "../assets/logo.png";

export default function AdminLogin() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ type: "", text: "" });

  const disabled = useMemo(() => {
    return loading || email.trim().length < 5 || password.trim().length < 6;
  }, [loading, email, password]);

  function ok(text) {
    setMsg({ type: "ok", text });
    setLoading(false);
  }

  function warn(text) {
    setMsg({ type: "warn", text });
    setLoading(false);
  }

  function err(text) {
    setMsg({ type: "error", text });
    setLoading(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setMsg({ type: "", text: "" });

    const eMail = email.trim().toLowerCase();
    const pass = password.trim();

    if (!eMail.includes("@") || eMail.length < 6) return warn("Digite um e-mail válido.");
    if (pass.length < 6) return warn("Digite uma senha válida.");

    const { data, error } = await supabase.auth.signInWithPassword({
      email: eMail,
      password: pass,
    });

    if (error) {
      console.error(error);
      return err("E-mail ou senha incorretos.");
    }

    if (!data?.session) {
      return err("Não foi possível autenticar. Tente novamente.");
    }

    ok("✅ Acesso liberado! Entrando...");
    setTimeout(() => navigate("/dashboard", { replace: true }), 350);
  }

  return (
    <div className="adminPage">
      <div className="adminGlow" />

      <div className="adminCard" role="region" aria-label="Acesso administrativo">
        <div className="adminHeader">
          <img className="adminLogo" src={logo} alt="Igreja Batista do Amor" />
          <div className="adminHeaderText">
            <div className="adminTitle">Igreja Batista do Amor</div>
            <div className="adminSub">Acesso administrativo (Pastor & Admin)</div>
          </div>
        </div>

        <form className="adminForm" onSubmit={handleSubmit}>
          <div className="adminField">
            <label className="adminLabel">E-mail</label>
            <input
              className="adminInput"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ex: pastor@ibam.com"
              autoComplete="email"
            />
          </div>

          <div className="adminField">
            <label className="adminLabel">Senha</label>

            <div className="adminPassWrap">
              <input
                className="adminInput adminPassInput"
                type={showPass ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
              />

              <button
                className="adminPassBtn"
                type="button"
                onClick={() => setShowPass((p) => !p)}
                aria-label={showPass ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPass ? "Ocultar" : "Mostrar"}
              </button>
            </div>
          </div>

          <button className="adminSubmit" disabled={disabled} type="submit">
            {loading ? "Entrando..." : "Entrar"}
          </button>

          {msg.text && <div className={`adminMsg ${msg.type}`}>{msg.text}</div>}

          <div className="adminFooterNote">
            Uso restrito. Se você não for da liderança, volte para a página inicial.
          </div>

          <button
            type="button"
            className="adminBack"
            onClick={() => navigate("/", { replace: true })}
          >
            ← Voltar para o início
          </button>
        </form>
      </div>
    </div>
  );
}