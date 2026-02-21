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

export default function PublicCells() {
  const [cells, setCells] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return cells;
    return cells.filter((c) => {
      const blob = `${c.name || ""} ${c.leaders || ""} ${c.zone || ""} ${
        c.neighborhood || ""
      }`.toLowerCase();
      return blob.includes(s);
    });
  }, [cells, q]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from("cells")
        .select(
          "id,name,leaders,whatsapp,zone,neighborhood,weekday,time,address,is_active"
        )
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (!mounted) return;
      setCells(data || []);
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
            <div className="brand__title">Células ativas</div>
            <div className="brand__subtitle">IBAM • Porto Velho</div>
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
            placeholder="Buscar por nome, líder, zona, bairro…"
          />
          <Link className="btn" to="/cadastro">
            Fazer cadastro
          </Link>
        </div>

        {loading ? (
          <div className="muted">Carregando…</div>
        ) : filtered.length ? (
          <div className="grid grid--2">
            {filtered.map((c) => (
              <div key={c.id} className="card">
                <div className="card__title">{c.name}</div>
                <div className="card__meta">
                  <strong>Líderes:</strong> {c.leaders || "—"}
                  <br />
                  <strong>Zona:</strong> {c.zone || "—"}
                  {c.neighborhood ? ` • ${c.neighborhood}` : ""}
                  <br />
                  <strong>Dia/Hora:</strong>{" "}
                  {`${c.weekday || "—"}${c.time ? ` • ${c.time}` : ""}`}
                  <br />
                  <strong>Endereço:</strong> {c.address || "—"}
                </div>

                <div className="row row--gap">
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
                    Pedir detalhes
                  </button>

                  <button
                    className="btn btn--small btn--ghost"
                    type="button"
                    onClick={() =>
                      openSecretariaWhatsApp(
                        `Olá, secretaria IBAM! Quero entrar numa célula. Tenho interesse na "${c.name}".`
                      )
                    }
                  >
                    Quero participar
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="muted">Nenhuma célula encontrada.</div>
        )}
      </main>
    </div>
  );
}