import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import "./admin.css";

const ZONES = [
  "Zona Norte",
  "Zona Sul,
  "Zona Leste",
  "Zona Oeste",
  "Centro",
  "Candeias do Jamari",
  "Outra cidade / Interior",
];

function toBRDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function monthDay(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function downloadCSV(filename, rows) {
  if (!rows?.length) return;

  // Excel-friendly: separador ; e BOM UTF-8
  const header = Object.keys(rows[0]);
  const lines = [
    header.join(";"),
    ...rows.map((r) =>
      header
        .map((k) => {
          const v = r[k] ?? "";
          const s = String(v).replace(/"/g, '""');
          return `"${s}"`;
        })
        .join(";")
    ),
  ];

  const csv = "\uFEFF" + lines.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

function openWhatsApp(phoneDigits, text) {
  const phone = (phoneDigits || "").replace(/\D/g, "");
  const url = `https://wa.me/55${phone}?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

function buildBirthdayMessage(name) {
  return `🎉 Feliz aniversário, ${name}! 🎉

A Igreja Batista do Amor agradece a Deus pela sua vida. Que o Senhor te conceda um novo ciclo cheio de saúde, alegria, propósito e presença dEle.

Conte com a gente. 🙏✨`;
}

function buildVisitMessage(name) {
  return `Olá, ${name}! Paz do Senhor! 🙏

Aqui é da Igreja Batista do Amor. Vimos que você tem interesse em receber uma visita pastoral.
Qual melhor dia e horário para você? 😊`;
}

function buildBaptismMessage(name) {
  return `Olá, ${name}! Paz do Senhor! 🙏

Aqui é da Igreja Batista do Amor. Vimos que você tem interesse em conversar sobre o batismo.
Podemos marcar um momento pra te explicar direitinho e tirar dúvidas? 😊`;
}

export default function AdminDashboard() {
  const [tab, setTab] = useState("visao"); // visao | pessoas | filas | anivers | config

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState({ type: "", text: "" });

  const [people, setPeople] = useState([]);
  const [ministries, setMinistries] = useState([]);
  const [cells, setCells] = useState([]);

  // map pessoa -> arrays
  const [peopleMinistries, setPeopleMinistries] = useState([]);
  const [peopleCells, setPeopleCells] = useState([]);

  // filtros rápidos
  const [quickVisit, setQuickVisit] = useState(false);
  const [quickBaptism, setQuickBaptism] = useState(false);

  // modal detalhe
  const [selectedPersonId, setSelectedPersonId] = useState(null);

  // config inputs
  const [newMinistry, setNewMinistry] = useState("");
  const [newCell, setNewCell] = useState("");

  useEffect(() => {
    refreshAll();
  }, []);

  async function refreshAll() {
    setLoading(true);
    setMsg({ type: "", text: "" });

    try {
      const [{ data: p, error: pe }, { data: m, error: me }, { data: c, error: ce }] =
        await Promise.all([
          supabase.from("people").select("*").order("created_at", { ascending: false }),
          supabase.from("ministries").select("*").order("name"),
          supabase.from("cells").select("*").order("name"),
        ]);

      if (pe || me || ce) throw pe || me || ce;

      const [{ data: pm, error: pme }, { data: pc, error: pce }] = await Promise.all([
        supabase.from("people_ministries").select("*"),
        supabase.from("people_cells").select("*"),
      ]);

      if (pme || pce) throw pme || pce;

      setPeople(p || []);
      setMinistries(m || []);
      setCells(c || []);
      setPeopleMinistries(pm || []);
      setPeopleCells(pc || []);
    } catch (err) {
      console.error(err);
      setMsg({ type: "error", text: "Erro ao carregar dados. Verifique as policies." });
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/admin";
  }

  // ====== AGREGADORES ======
  const byIdMinistry = useMemo(() => Object.fromEntries(ministries.map((x) => [x.id, x])), [ministries]);
  const byIdCell = useMemo(() => Object.fromEntries(cells.map((x) => [x.id, x])), [cells]);

  const ministriesByPerson = useMemo(() => {
    const map = {};
    for (const row of peopleMinistries) {
      map[row.person_id] = map[row.person_id] || [];
      map[row.person_id].push(row.ministry_id);
    }
    return map;
  }, [peopleMinistries]);

  const cellByPerson = useMemo(() => {
    const map = {};
    for (const row of peopleCells) {
      map[row.person_id] = row.cell_id; // uma célula
    }
    return map;
  }, [peopleCells]);

  const monthNow = new Date().getMonth() + 1;
  const birthdaysThisMonth = useMemo(() => {
    return people
      .filter((p) => {
        if (!p.birth_date) return false;
        const d = new Date(p.birth_date);
        return !Number.isNaN(d.getTime()) && d.getMonth() + 1 === monthNow;
      })
      .sort((a, b) => {
        const da = new Date(a.birth_date);
        const db = new Date(b.birth_date);
        return da.getDate() - db.getDate();
      });
  }, [people, monthNow]);

  const wantsVisitQueue = useMemo(() => people.filter((p) => p.wants_visit === true), [people]);
  const baptismQueue = useMemo(() => people.filter((p) => p.baptized === false && p.baptism_contact === true), [people]);

  const wantsMinistryQueue = useMemo(() => {
    // "fila para entrar": quem quer ministério mas não está em ministério OU marcou wants_ministry true
    return people.filter((p) => p.wants_ministry === true);
  }, [people]);

  const wantsCellQueue = useMemo(() => {
    return people.filter((p) => p.wants_cell === true);
  }, [people]);

  const countByZone = useMemo(() => {
    const map = Object.fromEntries(ZONES.map((z) => [z, 0]));
    for (const p of people) {
      if (p.zone && map[p.zone] != null) map[p.zone] += 1;
      else if (p.zone) map[p.zone] = (map[p.zone] || 0) + 1;
    }
    return map;
  }, [people]);

  const countByCell = useMemo(() => {
    const map = {};
    for (const p of people) {
      const cid = cellByPerson[p.id];
      if (!cid) continue;
      map[cid] = (map[cid] || 0) + 1;
    }
    return map;
  }, [people, cellByPerson]);

  // ====== LISTA "PESSOAS" COM FILTROS RÁPIDOS ======
  const visiblePeople = useMemo(() => {
    let list = [...people];

    if (quickVisit) list = list.filter((p) => p.wants_visit === true);
    if (quickBaptism) list = list.filter((p) => p.baptized === false && p.baptism_contact === true);

    return list;
  }, [people, quickVisit, quickBaptism]);

  const selectedPerson = useMemo(
    () => people.find((p) => p.id === selectedPersonId) || null,
    [people, selectedPersonId]
  );

  // ====== CSV EXPORTS ======
  function exportBirthdaysCSV() {
    const rows = birthdaysThisMonth.map((p) => ({
      Nome: p.name,
      WhatsApp: p.phone,
      "Nascimento (DD/MM)": monthDay(p.birth_date),
      Zona: p.zone || "",
      "Quer visita": p.wants_visit ? "SIM" : "NÃO",
    }));
    downloadCSV(`aniversariantes_${monthNow}.csv`, rows);
  }

  function exportVisitCSV() {
    const rows = wantsVisitQueue.map((p) => ({
      Nome: p.name,
      WhatsApp: p.phone,
      Zona: p.zone || "",
      Rua: p.street || "",
      Número: p.house_number || "",
      Complemento: p.complement || "",
      Bairro: p.neighborhood || "",
      Cidade: p.city || "",
      Referência: p.reference || "",
    }));
    downloadCSV(`fila_visitas.csv`, rows);
  }

  function exportBaptismCSV() {
    const rows = baptismQueue.map((p) => ({
      Nome: p.name,
      WhatsApp: p.phone,
      Zona: p.zone || "",
      "Batizado?": p.baptized ? "SIM" : "NÃO",
      "Quer conversar?": p.baptism_contact ? "SIM" : "NÃO",
    }));
    downloadCSV(`fila_batismo.csv`, rows);
  }

  function exportMinistryQueueCSV() {
    const rows = wantsMinistryQueue.map((p) => {
      const mids = ministriesByPerson[p.id] || [];
      const names = mids.map((id) => byIdMinistry[id]?.name).filter(Boolean).join(", ");
      return {
        Nome: p.name,
        WhatsApp: p.phone,
        Zona: p.zone || "",
        "Ministérios escolhidos": names,
      };
    });
    downloadCSV(`fila_ministerios.csv`, rows);
  }

  function exportCellQueueCSV() {
    const rows = wantsCellQueue.map((p) => ({
      Nome: p.name,
      WhatsApp: p.phone,
      Zona: p.zone || "",
    }));
    downloadCSV(`fila_celula.csv`, rows);
  }

  // ====== CONFIG CRUD ======
  async function addMinistry() {
    const name = newMinistry.trim();
    if (name.length < 2) return;
    setMsg({ type: "", text: "" });

    const { error } = await supabase.from("ministries").insert({ name });
    if (error) {
      console.error(error);
      setMsg({ type: "error", text: "Erro ao adicionar ministério." });
      return;
    }
    setNewMinistry("");
    refreshAll();
  }

  async function addCell() {
    const name = newCell.trim();
    if (name.length < 2) return;
    setMsg({ type: "", text: "" });

    const { error } = await supabase.from("cells").insert({ name });
    if (error) {
      console.error(error);
      setMsg({ type: "error", text: "Erro ao adicionar célula." });
      return;
    }
    setNewCell("");
    refreshAll();
  }

  async function editItem(table, id, currentName) {
    const name = prompt("Editar nome:", currentName);
    if (!name) return;
    const trimmed = name.trim();
    if (trimmed.length < 2) return;

    const { error } = await supabase.from(table).update({ name: trimmed }).eq("id", id);
    if (error) {
      console.error(error);
      setMsg({ type: "error", text: "Erro ao editar." });
      return;
    }
    refreshAll();
  }

  async function deleteItem(table, id) {
    const ok = confirm("Tem certeza que deseja apagar?");
    if (!ok) return;

    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) {
      console.error(error);
      setMsg({ type: "error", text: "Erro ao apagar (pode ter vínculos)." });
      return;
    }
    refreshAll();
  }

  // ====== RENDER ======
  return (
    <div className="dashPage">
      <div className="dashTopBar">
        <div>
          <div className="dashTitle">Dashboard</div>
          <div className="dashSub">Igreja Batista do Amor</div>
        </div>

        <div className="dashTopActions">
          <button className="ghostBtn" onClick={refreshAll} disabled={loading}>
            {loading ? "Atualizando..." : "Atualizar"}
          </button>
          <button className="ghostBtn" onClick={logout}>
            Sair
          </button>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === "visao" ? "active" : ""}`} onClick={() => setTab("visao")}>
          Visão geral
        </button>
        <button className={`tab ${tab === "pessoas" ? "active" : ""}`} onClick={() => setTab("pessoas")}>
          Pessoas
        </button>
        <button className={`tab ${tab === "filas" ? "active" : ""}`} onClick={() => setTab("filas")}>
          Filas
        </button>
        <button className={`tab ${tab === "anivers" ? "active" : ""}`} onClick={() => setTab("anivers")}>
          Aniversariantes
        </button>
        <button className={`tab ${tab === "config" ? "active" : ""}`} onClick={() => setTab("config")}>
          Config
        </button>
      </div>

      {msg.text && <div className={`dashMsg ${msg.type}`}>{msg.text}</div>}

      {/* VISÃO GERAL */}
      {tab === "visao" && (
        <>
          <div className="cards">
            <div className="card">
              <div className="cardLabel">Cadastrados</div>
              <div className="cardValue">{people.length}</div>
            </div>

            <div className="card">
              <div className="cardLabel">Querem visita</div>
              <div className="cardValue">{wantsVisitQueue.length}</div>
            </div>

            <div className="card">
              <div className="cardLabel">Aniversariantes do mês</div>
              <div className="cardValue">{birthdaysThisMonth.length}</div>
            </div>
          </div>

          <div className="panel">
            <div className="panelHead">
              <div className="panelTitle">Por zona</div>
            </div>

            <div className="zoneGrid">
              {Object.entries(countByZone).map(([z, n]) => (
                <div key={z} className="zoneItem">
                  <div className="zoneName">{z}</div>
                  <div className="zoneCount">{n}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panelHead">
              <div className="panelTitle">Pessoas por célula</div>
            </div>

            <div className="zoneGrid">
              {cells.map((c) => (
                <div key={c.id} className="zoneItem">
                  <div className="zoneName">{c.name}</div>
                  <div className="zoneCount">{countByCell[c.id] || 0}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* PESSOAS */}
      {tab === "pessoas" && (
        <div className="panel">
          <div className="panelHead row">
            <div className="panelTitle">Pessoas</div>

            <div className="quickFilters">
              <button
                className={`pill ${quickVisit ? "active" : ""}`}
                onClick={() => setQuickVisit((v) => !v)}
              >
                Quer visita
              </button>
              <button
                className={`pill ${quickBaptism ? "active" : ""}`}
                onClick={() => setQuickBaptism((v) => !v)}
              >
                Fila batismo
              </button>
            </div>
          </div>

          <div className="tableWrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>WhatsApp</th>
                  <th>Nasc.</th>
                  <th>Zona</th>
                  <th>Célula</th>
                  <th>Ministérios</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visiblePeople.map((p) => {
                  const cid = cellByPerson[p.id];
                  const cellName = cid ? byIdCell[cid]?.name : "";
                  const mids = ministriesByPerson[p.id] || [];
                  const mins = mids.map((id) => byIdMinistry[id]?.name).filter(Boolean).join(", ");

                  return (
                    <tr key={p.id}>
                      <td className="tdStrong">{p.name}</td>
                      <td>{p.phone}</td>
                      <td>{toBRDate(p.birth_date)}</td>
                      <td>{p.zone || ""}</td>
                      <td>{cellName || "-"}</td>
                      <td className="tdWrap">{mins || "-"}</td>
                      <td className="tdRight">
                        <button className="miniBtn" onClick={() => setSelectedPersonId(p.id)}>
                          Detalhes
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {!visiblePeople.length && (
                  <tr>
                    <td colSpan={7} className="empty">
                      Nenhuma pessoa encontrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* FILAS */}
      {tab === "filas" && (
        <>
          <div className="panel">
            <div className="panelHead row">
              <div className="panelTitle">Fila: Visita pastoral</div>
              <div className="panelActions">
                <button className="ghostBtn" onClick={exportVisitCSV}>Exportar CSV</button>
              </div>
            </div>

            <div className="list">
              {wantsVisitQueue.map((p) => (
                <div key={p.id} className="listItem">
                  <div>
                    <div className="liTitle">{p.name}</div>
                    <div className="liSub">
                      {p.phone} • {p.zone || ""} • {p.neighborhood ? `Bairro: ${p.neighborhood}` : "Sem endereço"}
                    </div>
                  </div>
                  <div className="liActions">
                    <button className="miniBtn" onClick={() => openWhatsApp(p.phone, buildVisitMessage(p.name))}>
                      WhatsApp
                    </button>
                    <button className="miniBtn" onClick={() => setSelectedPersonId(p.id)}>
                      Detalhes
                    </button>
                  </div>
                </div>
              ))}

              {!wantsVisitQueue.length && <div className="emptyBox">Sem fila de visita.</div>}
            </div>
          </div>

          <div className="panel">
            <div className="panelHead row">
              <div className="panelTitle">Fila: Batismo</div>
              <div className="panelActions">
                <button className="ghostBtn" onClick={exportBaptismCSV}>Exportar CSV</button>
              </div>
            </div>

            <div className="list">
              {baptismQueue.map((p) => (
                <div key={p.id} className="listItem">
                  <div>
                    <div className="liTitle">{p.name}</div>
                    <div className="liSub">{p.phone} • {p.zone || ""}</div>
                  </div>
                  <div className="liActions">
                    <button className="miniBtn" onClick={() => openWhatsApp(p.phone, buildBaptismMessage(p.name))}>
                      WhatsApp
                    </button>
                    <button className="miniBtn" onClick={() => setSelectedPersonId(p.id)}>
                      Detalhes
                    </button>
                  </div>
                </div>
              ))}

              {!baptismQueue.length && <div className="emptyBox">Sem fila de batismo.</div>}
            </div>
          </div>

          <div className="panel">
            <div className="panelHead row">
              <div className="panelTitle">Fila: Quer entrar em ministério</div>
              <div className="panelActions">
                <button className="ghostBtn" onClick={exportMinistryQueueCSV}>Exportar CSV</button>
              </div>
            </div>

            <div className="list">
              {wantsMinistryQueue.map((p) => (
                <div key={p.id} className="listItem">
                  <div>
                    <div className="liTitle">{p.name}</div>
                    <div className="liSub">{p.phone} • {p.zone || ""}</div>
                  </div>
                  <div className="liActions">
                    <button className="miniBtn" onClick={() => setSelectedPersonId(p.id)}>
                      Detalhes
                    </button>
                  </div>
                </div>
              ))}

              {!wantsMinistryQueue.length && <div className="emptyBox">Sem fila de ministério.</div>}
            </div>
          </div>

          <div className="panel">
            <div className="panelHead row">
              <div className="panelTitle">Fila: Quer entrar em célula</div>
              <div className="panelActions">
                <button className="ghostBtn" onClick={exportCellQueueCSV}>Exportar CSV</button>
              </div>
            </div>

            <div className="list">
              {wantsCellQueue.map((p) => (
                <div key={p.id} className="listItem">
                  <div>
                    <div className="liTitle">{p.name}</div>
                    <div className="liSub">{p.phone} • {p.zone || ""}</div>
                  </div>
                  <div className="liActions">
                    <button className="miniBtn" onClick={() => setSelectedPersonId(p.id)}>
                      Detalhes
                    </button>
                  </div>
                </div>
              ))}

              {!wantsCellQueue.length && <div className="emptyBox">Sem fila de célula.</div>}
            </div>
          </div>
        </>
      )}

      {/* ANIVERSARIANTES */}
      {tab === "anivers" && (
        <div className="panel">
          <div className="panelHead row">
            <div className="panelTitle">Aniversariantes do mês</div>
            <div className="panelActions">
              <button className="ghostBtn" onClick={exportBirthdaysCSV}>Exportar CSV</button>
            </div>
          </div>

          <div className="list">
            {birthdaysThisMonth.map((p) => (
              <div key={p.id} className="listItem">
                <div>
                  <div className="liTitle">{p.name}</div>
                  <div className="liSub">{monthDay(p.birth_date)} • {p.phone}</div>
                </div>
                <div className="liActions">
                  <button className="miniBtn" onClick={() => openWhatsApp(p.phone, buildBirthdayMessage(p.name))}>
                    WhatsApp
                  </button>
                  <button className="miniBtn" onClick={() => setSelectedPersonId(p.id)}>
                    Detalhes
                  </button>
                </div>
              </div>
            ))}

            {!birthdaysThisMonth.length && <div className="emptyBox">Sem aniversariantes neste mês.</div>}
          </div>
        </div>
      )}

      {/* CONFIG */}
      {tab === "config" && (
        <div className="grid2">
          <div className="panel">
            <div className="panelHead row">
              <div className="panelTitle">Ministérios</div>
              <div className="panelActions">
                <button
                  className="ghostBtn"
                  onClick={() => {
                    const rows = ministries.map((m) => ({ Nome: m.name }));
                    downloadCSV("ministerios.csv", rows);
                  }}
                >
                  Exportar CSV
                </button>
              </div>
            </div>

            <div className="addRow">
              <input
                className="textInput"
                value={newMinistry}
                onChange={(e) => setNewMinistry(e.target.value)}
                placeholder="Novo ministério (ex: Louvor)"
              />
              <button className="goldBtn" onClick={addMinistry}>
                Adicionar
              </button>
            </div>

            <div className="listCompact">
              {ministries.map((m) => (
                <div key={m.id} className="compactItem">
                  <div className="compactName">{m.name}</div>
                  <div className="compactActions">
                    <button className="miniBtn" onClick={() => editItem("ministries", m.id, m.name)}>
                      Editar
                    </button>
                    <button className="dangerBtn" onClick={() => deleteItem("ministries", m.id)}>
                      Apagar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panelHead row">
              <div className="panelTitle">Células</div>
              <div className="panelActions">
                <button
                  className="ghostBtn"
                  onClick={() => {
                    const rows = cells.map((c) => ({ Nome: c.name }));
                    downloadCSV("celulas.csv", rows);
                  }}
                >
                  Exportar CSV
                </button>
              </div>
            </div>

            <div className="addRow">
              <input
                className="textInput"
                value={newCell}
                onChange={(e) => setNewCell(e.target.value)}
                placeholder="Nova célula (ex: Célula 01 - Centro)"
              />
              <button className="goldBtn" onClick={addCell}>
                Adicionar
              </button>
            </div>

            <div className="listCompact">
              {cells.map((c) => (
                <div key={c.id} className="compactItem">
                  <div className="compactName">{c.name}</div>
                  <div className="compactActions">
                    <button className="miniBtn" onClick={() => editItem("cells", c.id, c.name)}>
                      Editar
                    </button>
                    <button className="dangerBtn" onClick={() => deleteItem("cells", c.id)}>
                      Apagar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DETALHE */}
      {selectedPerson && (
        <div className="modalBackdrop" onClick={() => setSelectedPersonId(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modalHead">
              <div>
                <div className="modalTitle">{selectedPerson.name}</div>
                <div className="modalSub">{selectedPerson.phone} • {selectedPerson.zone || ""}</div>
              </div>
              <button className="ghostBtn" onClick={() => setSelectedPersonId(null)}>Fechar</button>
            </div>

            <div className="modalGrid">
              <div className="modalBox">
                <div className="modalLabel">Célula</div>
                <div className="modalValue">
                  {cellByPerson[selectedPerson.id] ? (byIdCell[cellByPerson[selectedPerson.id]]?.name || "-") : "-"}
                </div>
              </div>

              <div className="modalBox">
                <div className="modalLabel">Ministérios</div>
                <div className="modalValue">
                  {(ministriesByPerson[selectedPerson.id] || [])
                    .map((id) => byIdMinistry[id]?.name)
                    .filter(Boolean)
                    .join(", ") || "-"}
                </div>
              </div>

              <div className="modalBox">
                <div className="modalLabel">Batismo</div>
                <div className="modalValue">
                  {selectedPerson.baptized ? "Batizado" : "Não batizado"}
                  {selectedPerson.baptized === false && selectedPerson.baptism_contact ? " • Quer conversar" : ""}
                </div>
              </div>

              <div className="modalBox">
                <div className="modalLabel">Visita pastoral</div>
                <div className="modalValue">{selectedPerson.wants_visit ? "Solicitada" : "Não solicitada"}</div>
              </div>
            </div>

            <div className="modalAddress">
              <div className="modalLabel">Endereço</div>
              {selectedPerson.address_opt_in ? (
                <div className="modalValue">
                  {selectedPerson.street || ""}, {selectedPerson.house_number || ""}{" "}
                  {selectedPerson.complement ? `(${selectedPerson.complement})` : ""}
                  <br />
                  {selectedPerson.neighborhood || ""} • {selectedPerson.city || ""}
                  {selectedPerson.reference ? <><br />Ref: {selectedPerson.reference}</> : null}
                </div>
              ) : (
                <div className="modalValue">Não informou endereço.</div>
              )}
            </div>

            <div className="modalActions">
              <button className="goldBtn" onClick={() => openWhatsApp(selectedPerson.phone, buildBirthdayMessage(selectedPerson.name))}>
                WhatsApp: Aniversário
              </button>
              <button className="goldBtn" onClick={() => openWhatsApp(selectedPerson.phone, buildVisitMessage(selectedPerson.name))}>
                WhatsApp: Visita
              </button>
              <button className="goldBtn" onClick={() => openWhatsApp(selectedPerson.phone, buildBaptismMessage(selectedPerson.name))}>
                WhatsApp: Batismo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
