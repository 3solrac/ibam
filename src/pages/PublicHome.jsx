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
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return "";
  // date vem como YYYY-MM-DD, então esse "new Date" pode variar por fuso.
  // O jeito mais seguro é formatar manual:
  const [y, m, day] = String(isoDate).split("-");
  if (!y || !m || !day) return "";
  return `${day}/${m}/${y}`;
}

export default function PublicHome() {
  const [cells, setCells] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const previewCells = useMemo(() => cells.slice(0, 6), [cells]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);

      const todayISO = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

      const [{ data: c }, { data: e }] = await Promise.all([
        supabase
          .from("cells")
          .select("id,name,leaders,zone,neighborhood,is_active")
          .eq("is_active", true)
          .order("name", { ascending: true }),

        supabase
          .from("events")
          .select("id,title,start_date,end_date,time,location,price")
          .eq("is_public", true)
          .gte("start_date", todayISO)
          .order("start_date", { ascending: true })
          .limit(3),
      ]);

      if (!mounted) return;

      setCells(c || []);
      setEvents(e || []);
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
            <div className="brand__title">Igreja Batista do Amor</div>
            <div className="brand__subtitle">Porto Velho • IBAM</div>
          </div>

          <div className="public-header__actions">
            <Link className="btn btn--ghost" to="/admin">
              Secretaria (Login)
            </Link>
          </div>
        </div>
      </header>

      <main className="public-container">
        <section className="hero">
          <h1 className="hero__title">Bem-vindo 👋</h1>
          <p className="hero__text">
            Aqui você encontra o cadastro, a agenda e as células ativas. Tudo
            simples, rápido e funcionando no celular e no computador.
          </p>

          <div className="grid grid--4">
            <Link className="cardlink" to="/cadastro">
              <div className="cardlink__title">Fazer cadastro</div>
              <div className="cardlink__desc">Ficha de membro (IBAM)</div>
            </Link>

            <Link className="cardlink" to="/agenda">
              <div className="cardlink__title">Ver agenda</div>
              <div className="cardlink__desc">Próximos eventos e atividades</div>
            </Link>

            <Link className="cardlink" to="/celulas">
              <div className="cardlink__title">Encontrar célula</div>
              <div className="cardlink__desc">Células ativas por zona/bairro</div>
            </Link>

            <button
              className="cardlink cardlink--button"
              onClick={() =>
                openSecretariaWhatsApp(
                  "Olá, secretaria IBAM! Eu queria falar com vocês."
                )
              }
              type="button"
            >
              <div className="cardlink__title">Falar com a secretaria</div>
              <div className="cardlink__desc">WhatsApp: (69) 98131-6195</div>
            </button>
          </div>
        </section>

        <section className="section">
          <div className="section__head">
            <h2 className="section__title">Próximos eventos</h2>
            <Link className="link" to="/agenda">
              Ver agenda completa →
            </Link>
          </div>

          {loading ? (
            <div className="muted">Carregando…</div>
          ) : events.length ? (
            <div className="list">
              {events.map((ev) => (
                <div key={ev.id} className="list__item">
                  <div className="list__main">
                    <div className="list__title">{ev.title}</div>
                    <div className="list__meta">
                      {formatBRDate(ev.start_date)}
                      {ev.time ? ` • ${ev.time}` : ""}
                      {ev.location ? ` • ${ev.location}` : ""}
                      {ev.price ? ` • ${ev.price}` : ""}
                    </div>
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
            <div className="muted">Sem eventos futuros cadastrados.</div>
          )}
        </section>

        <section className="section">
          <div className="section__head">
            <h2 className="section__title">Células ativas</h2>
            <Link className="link" to="/celulas">
              Ver todas →
            </Link>
          </div>

          {loading ? (
            <div className="muted">Carregando…</div>
          ) : cells.length ? (
            <div className="grid grid--3">
              {previewCells.map((c) => (
                <div key={c.id} className="card">
                  <div className="card__title">{c.name}</div>
                  <div className="card__meta">
                    {c.leaders ? `Líderes: ${c.leaders}` : "Líderes: —"}
                    <br />
                    {c.zone ? `Zona: ${c.zone}` : "Zona: —"}
                    {c.neighborhood ? ` • Bairro: ${c.neighborhood}` : ""}
                  </div>
                  <button
                    className="btn btn--small"
                    type="button"
                    onClick={() =>
                      openSecretariaWhatsApp(
                        `Olá, secretaria IBAM! Eu queria saber mais detalhes sobre a célula "${c.name}" (${c.zone || "sem zona"}${
                          c.neighborhood ? `, ${c.neighborhood}` : ""
                        }).`
                      )
                    }
                  >
                    Entrar em contato
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="muted">Ainda não há células cadastradas.</div>
          )}

          <div className="section__foot">
            <Link className="btn" to="/celulas">
              Ver lista completa de células
            </Link>
          </div>
        </section>

        <footer className="public-footer">
          <div className="muted">
            IBAM • Cadastro, agenda e células • 2026
          </div>
        </footer>
      </main>
    </div>
  );
}