import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../supabaseClient";
import "./public.css";

const SECRETARIA_WPP = "69981316195";

function openSecretariaWhatsApp(message) {
  const phone = SECRETARIA_WPP.replace(/\D/g, "");
  const url = `https://wa.me/55${phone}?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

function formatBRDate(isoDate) {
  if (!isoDate) return "";
  const [y, m, d] = String(isoDate).split("-");
  if (!y || !m || !d) return "";
  return `${d}/${m}/${y}`;
}

export default function PublicAgenda() {
  const [events, setEvents] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return events;
    return events.filter((ev) => {
      const blob = `${ev.title || ""} ${ev.location || ""} ${ev.notes || ""}`.toLowerCase();
      return blob.includes(s);
    });
  }, [events, q]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);

      const todayISO = new Date().toISOString().slice(0, 10);

      const { data } = await supabase
        .from("events")
        .select("id,title,start_date,end_date,time,location,price,notes")
        .eq("is_public", true)
        .gte("start_date", todayISO)
        .order("start_date", { ascending: true });

      if (!mounted) return;
      setEvents(data || []);
      setLoading(false);
    }

    load();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="public-page">
      <header className="public-header">
        <div className="public-header__inner">
          <div className="brand">
            <div className="brand__title">Agenda</div>
            <div className="brand__subtitle">Eventos e atividades • IBAM</div>
          </div>

          <div className="public-header__actions">
            <Link className="btn btn--ghost" to="/">
              ← Home
            </Link>
          </div>
        </div>
      </header>

      <main className="public-container">
        <div className="toolbar">
          <input
            className="input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar evento por nome/local…"
          />
          <Link className="btn" to="/cadastro">
            Fazer cadastro
          </Link>
        </div>

        {loading ? (
          <div className="muted">Carregando…</div>
        ) : filtered.length ? (
          <div className="list">
            {filtered.map((ev) => (
              <div key={ev.id} className="list__item">
                <div className="list__main">
                  <div className="list__title">{ev.title}</div>
                  <div className="list__meta">
                    {formatBRDate(ev.start_date)}
                    {ev.end_date ? ` até ${formatBRDate(ev.end_date)}` : ""}
                    {ev.time ? ` • ${ev.time}` : ""}
                    {ev.location ? ` • ${ev.location}` : ""}
                    {ev.price ? ` • ${ev.price}` : ""}
                  </div>
                  {ev.notes ? <div className="list__notes">{ev.notes}</div> : null}
                </div>

                <button
                  className="btn btn--small"
                  type="button"
                  onClick={() =>
                    openSecretariaWhatsApp(
                      `Olá, secretaria IBAM! Eu queria detalhes do evento: "${ev.title}".`
                    )
                  }
                >
                  Pedir detalhes
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="muted">
            Ainda não há eventos futuros cadastrados.
          </div>
        )}

        <div className="section__foot">
          <button
            className="btn btn--ghost"
            type="button"
            onClick={() =>
              openSecretariaWhatsApp(
                "Olá, secretaria IBAM! Quero saber a agenda completa da igreja."
              )
            }
          >
            Falar com a secretaria
          </button>
        </div>
      </main>
    </div>
  );
}