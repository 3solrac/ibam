import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabaseClient";
import "./RegisterForm.css";
import logo from "./assets/logo.png";

export default function RegisterForm() {
  const TURNSTILE_SITE_KEY = ""; // Cole sua chave aqui se tiver

  const [form, setForm] = useState({
    name: "", phone: "", birth_date: "", baptized: null, baptism_contact: null,
    zone: "", address_opt_in: false, wants_visit: false,
    street: "", house_number: "", complement: "", neighborhood: "", city: "Porto Velho", reference: "",
    in_ministry: null, wants_ministry: null, in_cell: null, wants_cell: null,
    consent_truth: false, consent_data: false,
  });

  const [ministries, setMinistries] = useState([]);
  const [cells, setCells] = useState([]);
  const [selectedMinistries, setSelectedMinistries] = useState([]);
  const [selectedCell, setSelectedCell] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const turnstileElRef = useRef(null);
  const widgetIdRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ type: "", text: "" });

  const showMinistryPicker = useMemo(() => form.in_ministry === true || (form.in_ministry === false && form.wants_ministry === true), [form.in_ministry, form.wants_ministry]);
  const showCellPicker = useMemo(() => form.in_cell === true || (form.in_cell === false && form.wants_cell === true), [form.in_cell, form.wants_cell]);
  const showAddressFields = form.address_opt_in === true;

  useEffect(() => { loadOptions(); }, []);
  async function loadOptions() {
    const { data: m } = await supabase.from("ministries").select("*").order("name");
    const { data: c } = await supabase.from("cells").select("*").order("name");
    setMinistries(m || []);
    setCells(c || []);
  }

  // Hook do Turnstile
  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    const interval = setInterval(() => {
      if (TURNSTILE_SITE_KEY.includes("COLE_")) return;
      if (window.turnstile && turnstileElRef.current && widgetIdRef.current == null) {
        widgetIdRef.current = window.turnstile.render(turnstileElRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          callback: (t) => setCaptchaToken(t),
          "expired-callback": () => setCaptchaToken(""),
          "error-callback": () => setCaptchaToken(""),
          theme: "light",
        });
        clearInterval(interval);
      }
    }, 200);
    return () => clearInterval(interval);
  }, [TURNSTILE_SITE_KEY]);

  function normalizePhone(v) { return (v || "").replace(/\D/g, "").slice(0, 11); }
  
  function setBinary(field, value) {
    setForm((p) => {
      const next = { ...p, [field]: value };
      if (field === "baptized") next.baptism_contact = value === false ? next.baptism_contact : null;
      if (field === "in_ministry") { next.wants_ministry = null; if (value !== true) setSelectedMinistries([]); }
      if (field === "wants_ministry") { if (value !== true) setSelectedMinistries([]); }
      if (field === "in_cell") { next.wants_cell = null; if (value !== true) setSelectedCell(""); }
      if (field === "wants_cell") { if (value !== true) setSelectedCell(""); }
      return next;
    });
  }

  function toggleMinistry(id) { setSelectedMinistries((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]); }

  function warn(text) { setMsg({ type: "warn", text }); setLoading(false); window.scrollTo(0, document.body.scrollHeight); }
  function err(text) { setMsg({ type: "error", text }); setLoading(false); window.scrollTo(0, document.body.scrollHeight); }
  function ok(text) { setMsg({ type: "ok", text }); setLoading(false); window.scrollTo(0, document.body.scrollHeight); }
  function resetTurnstile() { try { setCaptchaToken(""); if (window.turnstile && widgetIdRef.current) window.turnstile.reset(widgetIdRef.current); } catch {} }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true); setMsg({ type: "", text: "" });
    const phone = normalizePhone(form.phone);

    if (form.name.trim().length < 3) return warn("Digite seu nome completo.");
    if (phone.length < 10) return warn("Digite um telefone válido.");
    if (!form.birth_date) return warn("Informe sua data de nascimento.");
    if (form.zone.trim().length === 0) return warn("Selecione sua zona.");
    if (form.baptized === null) return warn("Responda sobre o batismo.");
    if (form.baptized === false && form.baptism_contact === null) return warn("Informe se tem interesse no batismo.");
    if (form.wants_visit && !form.address_opt_in) return warn("Para visita, cadastre o endereço.");
    if (form.address_opt_in && (!form.street.trim() || !form.house_number.trim() || !form.neighborhood.trim())) return warn("Preencha o endereço completo.");
    if (form.in_ministry === null) return warn("Responda sobre ministério.");
    if (form.in_ministry === false && form.wants_ministry === null) return warn("Responda se deseja participar de um ministério.");
    if (showMinistryPicker && selectedMinistries.length === 0) return warn("Selecione um ministério.");
    if (form.in_cell === null) return warn("Responda sobre célula.");
    if (form.in_cell === false && form.wants_cell === null) return warn("Responda se deseja participar de uma célula.");
    if (showCellPicker && !selectedCell) return warn("Selecione sua célula.");
    if (!form.consent_truth || !form.consent_data) return warn("Confirme as declarações finais.");
    if (TURNSTILE_SITE_KEY && !captchaToken) return warn("Confirme o captcha.");

    const payload = {
      token: captchaToken || null,
      form: { ...form, phone, name: form.name.trim() }, // Simplificado
      selectedMinistries: showMinistryPicker ? selectedMinistries : [],
      selectedCell: showCellPicker ? selectedCell : null,
    };

    const { data, error } = await supabase.functions.invoke("public-register", { body: payload });
    if (error || !data?.ok) { console.error(error); resetTurnstile(); return err(data?.error || "Erro ao enviar."); }

    ok("✅ Cadastro enviado com sucesso!");
    setForm({ name: "", phone: "", birth_date: "", baptized: null, baptism_contact: null, zone: "", address_opt_in: false, wants_visit: false, street: "", house_number: "", complement: "", neighborhood: "", city: "Porto Velho", reference: "", in_ministry: null, wants_ministry: null, in_cell: null, wants_cell: null, consent_truth: false, consent_data: false });
    setSelectedMinistries([]); setSelectedCell(""); resetTurnstile();
  }

  return (
    <div className="page-container">
      {/* --- CABEÇALHO ÚNICO --- */}
      <header className="main-header">
        <div className="header-content">
          <div className="logo-area">
            {/* O Logo agora fica pequeno e alinhado aqui */}
            <img src={logo} alt="Igreja Batista do Amor" className="header-logo" />
            <div className="church-info">
              <span className="church-name">Igreja Batista do Amor</span>
              <span className="church-sub">Cadastro 2026</span>
            </div>
          </div>

          <a href="/admin" className="pastor-btn">
            ⚙️ <span className="btn-text">Área do Pastor</span>
          </a>
        </div>
      </header>

      {/* --- FORMULÁRIO --- */}
      <div className="form-wrapper">
        <form className="form-card" onSubmit={handleSubmit}>
          <h2>Ficha de Membro</h2>
          
          <div className="input-block">
            <label>Nome completo</label>
            <input 
              value={form.name} 
              onChange={(e) => setForm({...form, name: e.target.value})}
              placeholder="Ex: João da Silva"
            />
          </div>

          <div className="row-2">
            <div className="input-block">
              <label>Telefone (WhatsApp)</label>
              <input 
                value={form.phone} 
                onChange={(e) => setForm({...form, phone: normalizePhone(e.target.value)})}
                placeholder="(69) 99999-9999"
                inputMode="numeric"
              />
            </div>
            <div className="input-block">
              <label>Nascimento</label>
              <input 
                type="date"
                value={form.birth_date} 
                onChange={(e) => setForm({...form, birth_date: e.target.value})}
              />
            </div>
          </div>

          <div className="input-block">
            <label>Onde você mora?</label>
            <select value={form.zone} onChange={(e) => setForm({...form, zone: e.target.value})}>
              <option value="">Selecione...</option>
              <option value="Zona Norte">Zona Norte</option>
              <option value="Zona Sul">Zona Sul</option>
              <option value="Zona Leste">Zona Leste</option>
              <option value="Zona Oeste">Zona Oeste</option>
              <option value="Centro">Centro</option>
              <option value="Candeias do Jamari">Candeias do Jamari</option>
              <option value="Outra cidade / Interior">Outra cidade / Interior</option>
            </select>
          </div>

          {/* ENDEREÇO */}
          <div className="section-box">
            <div className="section-header">Endereço (Opcional)</div>
            <p className="q-text">Deseja cadastrar endereço completo?</p>
            <div className="toggle-row">
              <button type="button" className={`toggle-btn ${form.address_opt_in ? 'active' : ''}`} onClick={() => setForm({...form, address_opt_in: true})}>Sim</button>
              <button type="button" className={`toggle-btn ${!form.address_opt_in ? 'active' : ''}`} onClick={() => setForm({...form, address_opt_in: false})}>Não</button>
            </div>

            {showAddressFields && (
              <div className="fade-in">
                 <div className="input-block" style={{marginTop: 15}}>
                    <label>Aceita visita pastoral?</label>
                    <div className="toggle-row">
                      <button type="button" className={`toggle-btn ${form.wants_visit ? 'active' : ''}`} onClick={() => setForm({...form, wants_visit: true})}>Sim</button>
                      <button type="button" className={`toggle-btn ${!form.wants_visit ? 'active' : ''}`} onClick={() => setForm({...form, wants_visit: false})}>Não</button>
                    </div>
                 </div>
                 <div className="input-block"><label>Rua</label><input value={form.street} onChange={(e) => setForm({...form, street: e.target.value})} /></div>
                 <div className="row-2">
                    <div className="input-block"><label>Número</label><input value={form.house_number} onChange={(e) => setForm({...form, house_number: e.target.value})} /></div>
                    <div className="input-block"><label>Bairro</label><input value={form.neighborhood} onChange={(e) => setForm({...form, neighborhood: e.target.value})} /></div>
                 </div>
                 <div className="input-block"><label>Referência</label><input value={form.reference} onChange={(e) => setForm({...form, reference: e.target.value})} /></div>
              </div>
            )}
          </div>

          {/* BATISMO */}
          <div className="section-box">
             <div className="section-header">Batismo</div>
             <p className="q-text">Você é batizado nas águas?</p>
             <div className="toggle-row">
                <button type="button" className={`toggle-btn ${form.baptized === true ? 'active' : ''}`} onClick={() => setBinary('baptized', true)}>Sim</button>
                <button type="button" className={`toggle-btn ${form.baptized === false ? 'active' : ''}`} onClick={() => setBinary('baptized', false)}>Não</button>
             </div>
             {form.baptized === false && (
                <div className="sub-q">
                   <p className="q-text">Quer saber mais sobre batismo?</p>
                   <div className="toggle-row">
                      <button type="button" className={`toggle-btn ${form.baptism_contact === true ? 'active' : ''}`} onClick={() => setBinary('baptism_contact', true)}>Sim</button>
                      <button type="button" className={`toggle-btn ${form.baptism_contact === false ? 'active' : ''}`} onClick={() => setBinary('baptism_contact', false)}>Não</button>
                   </div>
                </div>
             )}
          </div>

          {/* MINISTÉRIO */}
          <div className="section-box">
             <div className="section-header">Ministério</div>
             <p className="q-text">Já serve em algum ministério?</p>
             <div className="toggle-row">
                <button type="button" className={`toggle-btn ${form.in_ministry === true ? 'active' : ''}`} onClick={() => setBinary('in_ministry', true)}>Sim</button>
                <button type="button" className={`toggle-btn ${form.in_ministry === false ? 'active' : ''}`} onClick={() => setBinary('in_ministry', false)}>Não</button>
             </div>
             {form.in_ministry === false && (
                <div className="sub-q">
                   <p className="q-text">Deseja servir?</p>
                   <div className="toggle-row">
                      <button type="button" className={`toggle-btn ${form.wants_ministry === true ? 'active' : ''}`} onClick={() => setBinary('wants_ministry', true)}>Sim</button>
                      <button type="button" className={`toggle-btn ${form.wants_ministry === false ? 'active' : ''}`} onClick={() => setBinary('wants_ministry', false)}>Não</button>
                   </div>
                </div>
             )}
             {showMinistryPicker && (
                <div className="chips-area">
                   {ministries.map(m => (
                      <button key={m.id} type="button" className={`chip ${selectedMinistries.includes(m.id) ? 'active' : ''}`} onClick={() => toggleMinistry(m.id)}>{m.name}</button>
                   ))}
                </div>
             )}
          </div>

          {/* CÉLULA */}
          <div className="section-box">
             <div className="section-header">Célula</div>
             <p className="q-text">Participa de célula?</p>
             <div className="toggle-row">
                <button type="button" className={`toggle-btn ${form.in_cell === true ? 'active' : ''}`} onClick={() => setBinary('in_cell', true)}>Sim</button>
                <button type="button" className={`toggle-btn ${form.in_cell === false ? 'active' : ''}`} onClick={() => setBinary('in_cell', false)}>Não</button>
             </div>
             {form.in_cell === false && (
                <div className="sub-q">
                   <p className="q-text">Deseja participar?</p>
                   <div className="toggle-row">
                      <button type="button" className={`toggle-btn ${form.wants_cell === true ? 'active' : ''}`} onClick={() => setBinary('wants_cell', true)}>Sim</button>
                      <button type="button" className={`toggle-btn ${form.wants_cell === false ? 'active' : ''}`} onClick={() => setBinary('wants_cell', false)}>Não</button>
                   </div>
                </div>
             )}
             {showCellPicker && (
                <select value={selectedCell} onChange={(e) => setSelectedCell(e.target.value)} style={{marginTop: 10}}>
                   <option value="">Escolha a célula...</option>
                   {cells.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
             )}
          </div>

          {/* FINAL */}
          <div className="terms">
             <label><input type="checkbox" checked={form.consent_truth} onChange={(e) => setForm({...form, consent_truth: e.target.checked})} /> As informações são verdadeiras.</label>
             <label><input type="checkbox" checked={form.consent_data} onChange={(e) => setForm({...form, consent_data: e.target.checked})} /> Autorizo uso eclesiástico.</label>
          </div>

          {TURNSTILE_SITE_KEY && <div ref={turnstileElRef} className="captcha-box" />}

          <button className="submit-btn" disabled={loading} type="submit">{loading ? "Enviando..." : "ENVIAR CADASTRO"}</button>
          
          {msg.text && <div className={`msg-box ${msg.type}`}>{msg.text}</div>}
        </form>
      </div>
    </div>
  );
}