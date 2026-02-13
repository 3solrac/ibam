import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabaseClient";
import "./RegisterForm.css";
import logo from "./assets/logo.png";

export default function RegisterForm() {
  // TURNSTILE_SITE_KEY pode ficar, mas como vocês removeram cloud, não precisa usar.
  // Se não estiver usando turnstile, deixa como string vazia.
  const TURNSTILE_SITE_KEY = "";

  const [form, setForm] = useState({
    name: "",
    phone: "",
    birth_date: "",
    baptized: null, // true | false | null
    baptism_contact: null, // true | false | null

    zone: "",

    address_opt_in: false,
    wants_visit: false,

    street: "",
    house_number: "",
    complement: "",
    neighborhood: "",
    city: "Porto Velho",
    reference: "",

    in_ministry: null,
    wants_ministry: null,
    in_cell: null,
    wants_cell: null,

    // ✅ confirmações
    consent_truth: false,
    consent_data: false,
  });

  const [ministries, setMinistries] = useState([]);
  const [cells, setCells] = useState([]);

  const [selectedMinistries, setSelectedMinistries] = useState([]);
  const [selectedCell, setSelectedCell] = useState("");

  // Turnstile (se não estiver usando, fica inofensivo)
  const [captchaToken, setCaptchaToken] = useState("");
  const turnstileElRef = useRef(null);
  const widgetIdRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ type: "", text: "" });

  const showMinistryPicker = useMemo(() => {
    return (
      form.in_ministry === true ||
      (form.in_ministry === false && form.wants_ministry === true)
    );
  }, [form.in_ministry, form.wants_ministry]);

  const showCellPicker = useMemo(() => {
    return form.in_cell === true || (form.in_cell === false && form.wants_cell === true);
  }, [form.in_cell, form.wants_cell]);

  const showAddressFields = form.address_opt_in === true;

  useEffect(() => {
    loadOptions();
  }, []);

  async function loadOptions() {
    const { data: m } = await supabase.from("ministries").select("*").order("name");
    const { data: c } = await supabase.from("cells").select("*").order("name");
    setMinistries(m || []);
    setCells(c || []);
  }

  // Turnstile (opcional)
  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;

    const interval = setInterval(() => {
      if (TURNSTILE_SITE_KEY.includes("COLE_")) return;

      if (window.turnstile && turnstileElRef.current && widgetIdRef.current == null) {
        widgetIdRef.current = window.turnstile.render(turnstileElRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          callback: (token) => setCaptchaToken(token),
          "expired-callback": () => setCaptchaToken(""),
          "error-callback": () => setCaptchaToken(""),
          theme: "light",
        });
        clearInterval(interval);
      }
    }, 200);

    return () => clearInterval(interval);
  }, [TURNSTILE_SITE_KEY]);

  function normalizePhone(v) {
    return (v || "").replace(/\D/g, "").slice(0, 11);
  }

  function setBinary(field, value) {
    setForm((p) => {
      const next = { ...p, [field]: value };

      if (field === "baptized") {
        next.baptism_contact = value === false ? next.baptism_contact : null;
      }

      if (field === "in_ministry") {
        next.wants_ministry = null;
        if (value !== true) setSelectedMinistries([]);
      }
      if (field === "wants_ministry") {
        if (value !== true) setSelectedMinistries([]);
      }

      if (field === "in_cell") {
        next.wants_cell = null;
        if (value !== true) setSelectedCell("");
      }
      if (field === "wants_cell") {
        if (value !== true) setSelectedCell("");
      }

      return next;
    });
  }

  function toggleMinistry(id) {
    setSelectedMinistries((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function warn(text) {
    setMsg({ type: "warn", text });
    setLoading(false);
  }
  function err(text) {
    setMsg({ type: "error", text });
    setLoading(false);
  }
  function ok(text) {
    setMsg({ type: "ok", text });
    setLoading(false);
  }

  function resetTurnstile() {
    try {
      setCaptchaToken("");
      if (window.turnstile && widgetIdRef.current != null) {
        window.turnstile.reset(widgetIdRef.current);
      }
    } catch {}
  }

  function validateAddressIfNeeded() {
    if (!form.address_opt_in) return true;

    if (!form.street.trim()) return warn("Informe a rua.");
    if (!form.house_number.trim()) return warn("Informe o número.");
    if (!form.neighborhood.trim()) return warn("Informe o bairro.");
    if (!form.city.trim()) return warn("Informe a cidade.");
    return true;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setMsg({ type: "", text: "" });

    const phone = normalizePhone(form.phone);

    if (form.name.trim().length < 3) return warn("Digite seu nome completo.");
    if (phone.length < 10) return warn("Digite um telefone válido com DDD.");
    if (!form.birth_date) return warn("Informe sua data de nascimento.");

    if (form.zone.trim().length === 0) return warn("Selecione sua zona.");

    if (form.baptized === null) return warn("Responda se você é batizado.");
    if (form.baptized === false && form.baptism_contact === null) {
      return warn("Você tem interesse em conversar sobre o batismo?");
    }

    // visita só com endereço
    if (form.wants_visit && !form.address_opt_in) {
      return warn("Para solicitar visita, marque que deseja cadastrar o endereço.");
    }

    const okAddress = validateAddressIfNeeded();
    if (okAddress !== true) return;

    if (form.in_ministry === null) return warn("Responda sobre ministério.");
    if (form.in_ministry === false && form.wants_ministry === null) return warn("Você deseja participar de um ministério?");
    if (showMinistryPicker && selectedMinistries.length === 0) return warn("Selecione pelo menos um ministério.");

    if (form.in_cell === null) return warn("Responda sobre célula.");
    if (form.in_cell === false && form.wants_cell === null) return warn("Você deseja participar de uma célula?");
    if (showCellPicker && !selectedCell) return warn("Selecione sua célula.");

    // ✅ confirmações
    if (!form.consent_truth) return warn("Confirme que as informações são verdadeiras.");
    if (!form.consent_data) return warn("Confirme o consentimento de uso interno.");

    // Se estiver usando Turnstile, pode exigir captcha aqui.
    // Se NÃO estiver usando, deixa passar.
    if (TURNSTILE_SITE_KEY && !captchaToken) return warn("Confirme o captcha para continuar.");

    const payload = {
      token: captchaToken || null,
      form: {
        name: form.name.trim(),
        phone,
        birth_date: form.birth_date,

        baptized: form.baptized,
        baptism_contact: form.baptized === false ? form.baptism_contact : null,

        zone: form.zone.trim(),

        address_opt_in: form.address_opt_in,
        wants_visit: form.address_opt_in ? form.wants_visit : false,

        street: form.address_opt_in ? form.street.trim() : null,
        house_number: form.address_opt_in ? form.house_number.trim() : null,
        complement: form.address_opt_in ? (form.complement.trim() || null) : null,
        neighborhood: form.address_opt_in ? form.neighborhood.trim() : null,
        city: form.address_opt_in ? form.city.trim() : null,
        reference: form.address_opt_in ? (form.reference.trim() || null) : null,

        wants_ministry: showMinistryPicker,
        wants_cell: showCellPicker,

        // ✅ nomes que sua function aceita
        consent_truth: form.consent_truth,
        consent_data: form.consent_data,
      },
      selectedMinistries: showMinistryPicker ? selectedMinistries : [],
      selectedCell: showCellPicker ? selectedCell : null,
    };

    const { data, error } = await supabase.functions.invoke("public-register", { body: payload });

    if (error) {
      console.error(error);
      resetTurnstile();
      return err("Erro ao enviar. Tente novamente.");
    }
    if (!data?.ok) {
      resetTurnstile();
      return err(data?.error || "Erro ao enviar. Tente novamente.");
    }

    ok("✅ Cadastro enviado com sucesso!");
    setForm({
      name: "",
      phone: "",
      birth_date: "",
      baptized: null,
      baptism_contact: null,

      zone: "",

      address_opt_in: false,
      wants_visit: false,

      street: "",
      house_number: "",
      complement: "",
      neighborhood: "",
      city: "Porto Velho",
      reference: "",

      in_ministry: null,
      wants_ministry: null,
      in_cell: null,
      wants_cell: null,

      consent_truth: false,
      consent_data: false,
    });
    setSelectedMinistries([]);
    setSelectedCell("");
    resetTurnstile();
  }

  return (
    <div className="page">
      <header className="topHeader">
        <div className="topHeaderInner">
          <div className="brand">
            <img className="brandLogo" src={logo} alt="Igreja Batista do Amor" />
            <div className="brandText">
              <div className="brandTitle">Igreja Batista do Amor</div>
              <div className="brandSub">Cadastro de membros</div>
            </div>
          </div>

          {/* ✅ botão discreto do pastor */}
          <a className="adminBtn" href="/admin" aria-label="Acessar área administrativa">
            <span className="adminIcon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M19.4 15a7.9 7.9 0 0 0 .1-1 7.9 7.9 0 0 0-.1-1l2-1.5-2-3.5-2.4 1a8.3 8.3 0 0 0-1.7-1l-.4-2.6h-4l-.4 2.6a8.3 8.3 0 0 0-1.7 1l-2.4-1-2 3.5 2 1.5a7.9 7.9 0 0 0-.1 1 7.9 7.9 0 0 0 .1 1l-2 1.5 2 3.5 2.4-1c.5.4 1.1.7 1.7 1l.4 2.6h4l.4-2.6c.6-.3 1.2-.6 1.7-1l2.4 1 2-3.5-2-1.5Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span className="adminText">Área do pastor</span>
          </a>
        </div>
      </header>

      <div className="mainWrap">
        <form className="form" onSubmit={handleSubmit}>
          <h2 className="title">Cadastro</h2>

          <div className="field">
            <label className="label">Nome completo</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="Ex: João da Silva"
            />
          </div>

          <div className="field">
            <label className="label">Telefone (WhatsApp)</label>
            <input
              className="input"
              value={form.phone}
              onChange={(e) => setForm((p) => ({ ...p, phone: normalizePhone(e.target.value) }))}
              placeholder="Ex: 69 99999-9999"
              inputMode="numeric"
            />
          </div>

          <div className="field">
            <label className="label">Data de nascimento</label>
            <input
              className="input"
              type="date"
              value={form.birth_date}
              onChange={(e) => setForm((p) => ({ ...p, birth_date: e.target.value }))}
            />
          </div>

          {/* ZONA */}
          <section className="section">
            <div className="sectionHead">
              <div className="sectionTitle">Região</div>
              <div className="sectionHint">obrigatório</div>
            </div>

            <div className="question">
              <div className="qText">Qual zona você mora?</div>
              <select
                className="select"
                value={form.zone}
                onChange={(e) => setForm((p) => ({ ...p, zone: e.target.value }))}
              >
                <option value="">Selecionar...</option>
                <option value="Zona Norte">Zona Norte</option>
                <option value="Zona Sul">Zona Sul</option>
                <option value="Zona Leste">Zona Leste</option>
                <option value="Zona Oeste">Zona Oeste</option>
                <option value="Centro">Centro</option>
                <option value="Candeias do Jamari">Candeias do Jamari</option>
                <option value="Outra cidade / Interior">Outra cidade / Interior</option>
              </select>
            </div>
          </section>

          {/* ENDEREÇO (OPCIONAL) */}
          <section className="section">
            <div className="sectionHead">
              <div className="sectionTitle">Endereço</div>
              <div className="sectionHint">opcional</div>
            </div>

            <div className="question">
              <div className="qText">Deseja cadastrar seu endereço?</div>
              <div className="ctaNote">Ao cadastrar o endereço você tem a opção de receber visita pastoral.</div>

              <div className="segmented" style={{ marginTop: 10 }}>
                <button
                  type="button"
                  className={`segBtn ${form.address_opt_in === true ? "active" : ""}`}
                  onClick={() => setForm((p) => ({ ...p, address_opt_in: true }))}
                >
                  Sim
                </button>
                <button
                  type="button"
                  className={`segBtn ${form.address_opt_in === false ? "active" : ""}`}
                  onClick={() =>
                    setForm((p) => ({
                      ...p,
                      address_opt_in: false,
                      wants_visit: false,
                      street: "",
                      house_number: "",
                      complement: "",
                      neighborhood: "",
                      city: p.city || "Porto Velho",
                      reference: "",
                    }))
                  }
                >
                  Não quero cadastrar
                </button>
              </div>
            </div>

            {showAddressFields && (
              <>
                <div className="question">
                  <div className="qText">Quero receber visita</div>
                  <div className="segmented">
                    <button
                      type="button"
                      className={`segBtn ${form.wants_visit === true ? "active" : ""}`}
                      onClick={() => setForm((p) => ({ ...p, wants_visit: true }))}
                    >
                      Sim
                    </button>
                    <button
                      type="button"
                      className={`segBtn ${form.wants_visit === false ? "active" : ""}`}
                      onClick={() => setForm((p) => ({ ...p, wants_visit: false }))}
                    >
                      Não
                    </button>
                  </div>
                </div>

                <div className="field">
                  <label className="label">Rua</label>
                  <input className="input" value={form.street} onChange={(e) => setForm((p) => ({ ...p, street: e.target.value }))} />
                </div>

                <div className="twoCols">
                  <div className="field">
                    <label className="label">Número</label>
                    <input className="input" value={form.house_number} onChange={(e) => setForm((p) => ({ ...p, house_number: e.target.value }))} />
                  </div>

                  <div className="field">
                    <label className="label">Complemento</label>
                    <input className="input" value={form.complement} onChange={(e) => setForm((p) => ({ ...p, complement: e.target.value }))} />
                  </div>
                </div>

                <div className="twoCols">
                  <div className="field">
                    <label className="label">Bairro</label>
                    <input className="input" value={form.neighborhood} onChange={(e) => setForm((p) => ({ ...p, neighborhood: e.target.value }))} />
                  </div>

                  <div className="field">
                    <label className="label">Cidade</label>
                    <input className="input" value={form.city} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))} />
                  </div>
                </div>

                <div className="field">
                  <label className="label">Referência (opcional)</label>
                  <input
                    className="input"
                    value={form.reference}
                    onChange={(e) => setForm((p) => ({ ...p, reference: e.target.value }))}
                    placeholder="Ex: perto do mercado X"
                  />
                </div>
              </>
            )}
          </section>

          {/* BATISMO */}
          <section className="section">
            <div className="sectionHead">
              <div className="sectionTitle">Batismo</div>
              <div className="sectionHint">rápido</div>
            </div>

            <div className="question">
              <div className="qText">Você é batizado?</div>
              <div className="segmented">
                <button type="button" className={`segBtn ${form.baptized === true ? "active" : ""}`} onClick={() => setBinary("baptized", true)}>
                  Sim
                </button>
                <button type="button" className={`segBtn ${form.baptized === false ? "active" : ""}`} onClick={() => setBinary("baptized", false)}>
                  Não
                </button>
              </div>
            </div>

            {form.baptized === false && (
              <div className="question">
                <div className="qText">
                  Gostaria que a secretária entrasse em contato para conversar sobre o batismo? Você tem interesse?
                </div>
                <div className="segmented">
                  <button type="button" className={`segBtn ${form.baptism_contact === true ? "active" : ""}`} onClick={() => setBinary("baptism_contact", true)}>
                    Tenho interesse
                  </button>
                  <button type="button" className={`segBtn ${form.baptism_contact === false ? "active" : ""}`} onClick={() => setBinary("baptism_contact", false)}>
                    Agora não
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* MINISTÉRIO */}
          <section className="section">
            <div className="sectionHead">
              <div className="sectionTitle">Ministério</div>
              <div className="sectionHint">toque pra escolher</div>
            </div>

            <div className="question">
              <div className="qText">Você já faz parte de algum ministério?</div>
              <div className="segmented">
                <button type="button" className={`segBtn ${form.in_ministry === true ? "active" : ""}`} onClick={() => setBinary("in_ministry", true)}>
                  Sim
                </button>
                <button type="button" className={`segBtn ${form.in_ministry === false ? "active" : ""}`} onClick={() => setBinary("in_ministry", false)}>
                  Não
                </button>
              </div>
            </div>

            {form.in_ministry === false && (
              <div className="question">
                <div className="qText">Deseja fazer parte de um ministério?</div>
                <div className="segmented">
                  <button type="button" className={`segBtn ${form.wants_ministry === true ? "active" : ""}`} onClick={() => setBinary("wants_ministry", true)}>
                    Sim
                  </button>
                  <button type="button" className={`segBtn ${form.wants_ministry === false ? "active" : ""}`} onClick={() => setBinary("wants_ministry", false)}>
                    Não
                  </button>
                </div>
              </div>
            )}

            {showMinistryPicker && (
              <div className="chips">
                {ministries.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={`chip ${selectedMinistries.includes(m.id) ? "active" : ""}`}
                    onClick={() => toggleMinistry(m.id)}
                  >
                    {m.name}
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* CÉLULA */}
          <section className="section">
            <div className="sectionHead">
              <div className="sectionTitle">Célula</div>
              <div className="sectionHint">uma célula</div>
            </div>

            <div className="question">
              <div className="qText">Você já faz parte de uma célula?</div>
              <div className="segmented">
                <button type="button" className={`segBtn ${form.in_cell === true ? "active" : ""}`} onClick={() => setBinary("in_cell", true)}>
                  Sim
                </button>
                <button type="button" className={`segBtn ${form.in_cell === false ? "active" : ""}`} onClick={() => setBinary("in_cell", false)}>
                  Não
                </button>
              </div>
            </div>

            {form.in_cell === false && (
              <div className="question">
                <div className="qText">Deseja fazer parte de uma célula?</div>
                <div className="segmented">
                  <button type="button" className={`segBtn ${form.wants_cell === true ? "active" : ""}`} onClick={() => setBinary("wants_cell", true)}>
                    Sim
                  </button>
                  <button type="button" className={`segBtn ${form.wants_cell === false ? "active" : ""}`} onClick={() => setBinary("wants_cell", false)}>
                    Não
                  </button>
                </div>
              </div>
            )}

            {showCellPicker && (
              <select className="select" value={selectedCell} onChange={(e) => setSelectedCell(e.target.value)}>
                <option value="">Escolher...</option>
                {cells.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </section>

          {/* ✅ CONFIRMAÇÕES */}
          <section className="section">
            <div className="sectionHead">
              <div className="sectionTitle">Confirmações</div>
              <div className="sectionHint">obrigatório</div>
            </div>

            <label className="checkRow">
              <input
                type="checkbox"
                checked={form.consent_truth}
                onChange={(e) => setForm((p) => ({ ...p, consent_truth: e.target.checked }))}
              />
              <span>
                Estou ciente e afirmo que as informações passadas são verdadeiras.
              </span>
            </label>

            <label className="checkRow">
              <input
                type="checkbox"
                checked={form.consent_data}
                onChange={(e) => setForm((p) => ({ ...p, consent_data: e.target.checked }))}
              />
              <span>
                Autorizo o uso das informações para organização interna da igreja.
              </span>
            </label>
          </section>

          {/* Turnstile (opcional) */}
          {TURNSTILE_SITE_KEY && (
            <div className="turnstileWrap">
              <div ref={turnstileElRef} />
            </div>
          )}

          <button className="submitBtn" disabled={loading} type="submit">
            {loading ? "Enviando..." : "Enviar"}
          </button>

          {msg.text && <div className={`msg ${msg.type}`}>{msg.text}</div>}

          <div className="footerNote">Seus dados serão usados apenas para comunicação e organização interna da igreja.</div>
        </form>
      </div>
    </div>
  );
}
