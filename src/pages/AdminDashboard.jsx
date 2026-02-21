import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import "./admin.css";

const ZONES = [
  "Zona Norte",
  "Zona Sul",
  "Zona Leste",
  "Zona Oeste",
  "Centro",
  "Candeias do Jamari",
  "Outra cidade / Interior",
];

const MONTHS = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez"
];

// Formata data para BR
function toBRDate(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const dd = String(d.getDate() + 1).padStart(2, "0"); // seu ajuste simples (mantive)
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

// Calcula idade
function getAge(iso) {
  if (!iso) return "";
  const birth = new Date(iso);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return `${age} anos`;
}

function monthDay(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getDate() + 1).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function downloadCSV(filename, rows) {
  if (!rows?.length) return;
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
  return `🎉 Feliz aniversário, ${name}! 🎉\n\nA Igreja Batista do Amor agradece a Deus pela sua vida. Que o Senhor te conceda um novo ciclo cheio de saúde, alegria, propósito e presença dEle.\n\nConte com a gente. 🙏✨`;
}
function buildVisitMessage(name) {
  return `Olá, ${name}! Paz do Senhor! 🙏\n\nAqui é da Igreja Batista do Amor. Vimos que você tem interesse em receber uma visita pastoral.\nQual melhor dia e horário para você? 😊`;
}
function buildBaptismMessage(name) {
  return `Olá, ${name}! Paz do Senhor! 🙏\n\nAqui é da Igreja Batista do Amor. Vimos que você tem interesse em conversar sobre o batismo.\nPodemos marcar um momento pra te explicar direitinho e tirar dúvidas? 😊`;
}

export default function AdminDashboard() {
  const [tab, setTab] = useState("visao");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState({ type: "", text: "" });

  const [people, setPeople] = useState([]);
  const [ministries, setMinistries] = useState([]);
  const [cells, setCells] = useState([]);
  const [peopleMinistries, setPeopleMinistries] = useState([]);
  const [peopleCells, setPeopleCells] = useState([]);

  // Filtros rápidos
  const [quickVisit, setQuickVisit] = useState(false);
  const [quickBaptism, setQuickBaptism] = useState(false);
  const [quickWantsMinistry, setQuickWantsMinistry] = useState(false);
  const [quickWantsCell, setQuickWantsCell] = useState(false);

  // ANIVERSÁRIOS
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());

  // Modais
  const [selectedPersonId, setSelectedPersonId] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);

  // Inputs Config
  const [newMinistry, setNewMinistry] = useState("");
  const [newCell, setNewCell] = useState("");

  useEffect(() => { refreshAll(); }, []);

  async function refreshAll() {
    setLoading(true); setMsg({ type: "", text: "" });
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

      setPeople(p || []); setMinistries(m || []); setCells(c || []);
      setPeopleMinistries(pm || []); setPeopleCells(pc || []);
    } catch (err) {
      console.error(err);
      setMsg({ type: "error", text: "Erro ao carregar dados." });
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/admin";
  }

  // ====== MAPAS BASE ======
  const byIdPerson = useMemo(() => Object.fromEntries(people.map((x) => [x.id, x])), [people]);
  const byIdMinistry = useMemo(() => Object.fromEntries(ministries.map((x) => [x.id, x])), [ministries]);
  const byIdCell = useMemo(() => Object.fromEntries(cells.map((x) => [x.id, x])), [cells]);

  // Pessoa -> [ministry_id]
  const ministriesByPerson = useMemo(() => {
    const map = {};
    for (const row of peopleMinistries) {
      map[row.person_id] = map[row.person_id] || [];
      map[row.person_id].push(row.ministry_id);
    }
    return map;
  }, [peopleMinistries]);

  // Pessoa -> cell_id
  const cellByPerson = useMemo(() => {
    const map = {};
    for (const row of peopleCells) map[row.person_id] = row.cell_id;
    return map;
  }, [peopleCells]);

  // ====== SEPARAÇÃO: ATUAL vs INTERESSE ======
  // Regra: wants_ministry/wants_cell define se vínculo é "interesse" ou "participação atual"
  const currentMinistriesByPerson = useMemo(() => {
    const map = {};
    for (const pid of Object.keys(ministriesByPerson)) {
      const p = byIdPerson[pid];
      if (!p) continue;
      if (p.wants_ministry === true) continue; // interesse, não atual
      map[pid] = ministriesByPerson[pid];
    }
    return map;
  }, [ministriesByPerson, byIdPerson]);

  const wantedMinistriesByPerson = useMemo(() => {
    const map = {};
    for (const pid of Object.keys(ministriesByPerson)) {
      const p = byIdPerson[pid];
      if (!p) continue;
      if (p.wants_ministry !== true) continue;
      map[pid] = ministriesByPerson[pid];
    }
    return map;
  }, [ministriesByPerson, byIdPerson]);

  const currentCellByPerson = useMemo(() => {
    const map = {};
    for (const pid of Object.keys(cellByPerson)) {
      const p = byIdPerson[pid];
      if (!p) continue;
      if (p.wants_cell === true) continue; // interesse
      map[pid] = cellByPerson[pid];
    }
    return map;
  }, [cellByPerson, byIdPerson]);

  const wantedCellByPerson = useMemo(() => {
    const map = {};
    for (const pid of Object.keys(cellByPerson)) {
      const p = byIdPerson[pid];
      if (!p) continue;
      if (p.wants_cell !== true) continue;
      map[pid] = cellByPerson[pid];
    }
    return map;
  }, [cellByPerson, byIdPerson]);

  function ministryNames(ids) {
    return (ids || [])
      .map((id) => byIdMinistry[id]?.name)
      .filter(Boolean)
      .join(", ");
  }
  function cellName(id) {
    return id ? (byIdCell[id]?.name || "") : "";
  }

  // ====== FILAS ======
  const wantsVisitQueue = useMemo(() => people.filter((p) => p.wants_visit === true), [people]);
  const baptismQueue = useMemo(() => people.filter((p) => p.baptized === false && p.baptism_contact === true), [people]);

  const wantsMinistryQueue = useMemo(() => people.filter((p) => p.wants_ministry === true), [people]);
  const wantsCellQueue = useMemo(() => people.filter((p) => p.wants_cell === true), [people]);

  // ====== ANIVERSÁRIOS ======
  const birthdaysFiltered = useMemo(() => {
    return people
      .filter((p) => {
        if (!p.birth_date) return false;
        const d = new Date(p.birth_date);
        return !Number.isNaN(d.getTime()) && d.getMonth() === selectedMonth;
      })
      .sort((a, b) => new Date(a.birth_date).getDate() - new Date(b.birth_date).getDate());
  }, [people, selectedMonth]);

  const countByMonth = useMemo(() => {
    const counts = new Array(12).fill(0);
    people.forEach((p) => {
      if (!p.birth_date) return;
      const d = new Date(p.birth_date);
      if (!Number.isNaN(d.getTime())) counts[d.getMonth()]++;
    });
    return counts;
  }, [people]);

  // ====== CONTAGENS ======
  const countByZone = useMemo(() => {
    const map = Object.fromEntries(ZONES.map((z) => [z, 0]));
    for (const p of people) {
      if (p.zone) map[p.zone] = (map[p.zone] || 0) + 1;
    }
    return map;
  }, [people]);

  // ATUAL: célula
  const countByCellCurrent = useMemo(() => {
    const map = {};
    for (const p of people) {
      const cid = currentCellByPerson[p.id];
      if (!cid) continue;
      map[cid] = (map[cid] || 0) + 1;
    }
    return map;
  }, [people, currentCellByPerson]);

  // INTERESSE: célula
  const countByCellWanted = useMemo(() => {
    const map = {};
    for (const p of wantsCellQueue) {
      const cid = wantedCellByPerson[p.id];
      if (!cid) continue;
      map[cid] = (map[cid] || 0) + 1;
    }
    return map;
  }, [wantsCellQueue, wantedCellByPerson]);

  // ATUAL: ministério
  const countByMinistryCurrent = useMemo(() => {
    const map = {};
    for (const pid of Object.keys(currentMinistriesByPerson)) {
      const ids = currentMinistriesByPerson[pid] || [];
      for (const mid of ids) map[mid] = (map[mid] || 0) + 1;
    }
    return map;
  }, [currentMinistriesByPerson]);

  // INTERESSE: ministério
  const countByMinistryWanted = useMemo(() => {
    const map = {};
    for (const pid of Object.keys(wantedMinistriesByPerson)) {
      const ids = wantedMinistriesByPerson[pid] || [];
      for (const mid of ids) map[mid] = (map[mid] || 0) + 1;
    }
    return map;
  }, [wantedMinistriesByPerson]);

  // ====== ALERTA "TUMULTUADO" ======
  const pendingMinistry = wantsMinistryQueue.length;
  const pendingCell = wantsCellQueue.length;
  const pendingTotal = pendingMinistry + pendingCell;

  const alertLevel = useMemo(() => {
    if (pendingTotal >= 30) return { label: "TUMULTUADO", tone: "danger" };
    if (pendingTotal >= 10) return { label: "ATENÇÃO", tone: "warn" };
    return { label: "OK", tone: "ok" };
  }, [pendingTotal]);

  // ====== MODAL GRUPO ======
  const groupMembers = useMemo(() => {
    if (!selectedGroup) return [];
    if (selectedGroup.type === "zone") return people.filter((p) => p.zone === selectedGroup.name);

    if (selectedGroup.type === "cell_current") {
      return people.filter((p) => currentCellByPerson[p.id] === selectedGroup.id);
    }
    if (selectedGroup.type === "cell_wanted") {
      return people.filter((p) => wantedCellByPerson[p.id] === selectedGroup.id);
    }

    if (selectedGroup.type === "ministry_current") {
      const pIds = [];
      for (const pid of Object.keys(currentMinistriesByPerson)) {
        if ((currentMinistriesByPerson[pid] || []).includes(selectedGroup.id)) pIds.push(pid);
      }
      return people.filter((p) => pIds.includes(p.id));
    }
    if (selectedGroup.type === "ministry_wanted") {
      const pIds = [];
      for (const pid of Object.keys(wantedMinistriesByPerson)) {
        if ((wantedMinistriesByPerson[pid] || []).includes(selectedGroup.id)) pIds.push(pid);
      }
      return people.filter((p) => pIds.includes(p.id));
    }
    return [];
  }, [
    selectedGroup,
    people,
    currentCellByPerson,
    wantedCellByPerson,
    currentMinistriesByPerson,
    wantedMinistriesByPerson
  ]);

  // ====== LISTA PESSOAS VISÍVEIS ======
  const visiblePeople = useMemo(() => {
    let list = [...people];
    if (quickVisit) list = list.filter((p) => p.wants_visit === true);
    if (quickBaptism) list = list.filter((p) => p.baptized === false && p.baptism_contact === true);
    if (quickWantsMinistry) list = list.filter((p) => p.wants_ministry === true);
    if (quickWantsCell) list = list.filter((p) => p.wants_cell === true);
    return list;
  }, [people, quickVisit, quickBaptism, quickWantsMinistry, quickWantsCell]);

  const selectedPerson = useMemo(
    () => people.find((p) => p.id === selectedPersonId) || null,
    [people, selectedPersonId]
  );

  // ====== CSV EXPORTS ======
  function exportBirthdaysCSV() {
    const monthName = MONTHS[selectedMonth];
    const rows = birthdaysFiltered.map((p) => ({
      Nome: p.name,
      WhatsApp: p.phone,
      Nascimento: monthDay(p.birth_date),
      Zona: p.zone,
    }));
    downloadCSV(`aniversariantes_${monthName}.csv`, rows);
  }

  function exportVisitCSV() {
    const rows = wantsVisitQueue.map((p) => ({
      Nome: p.name,
      WhatsApp: p.phone,
      Zona: p.zone,
      Rua: p.street,
      Bairro: p.neighborhood,
    }));
    downloadCSV(`fila_visitas.csv`, rows);
  }

  function exportBaptismCSV() {
    const rows = baptismQueue.map((p) => ({
      Nome: p.name,
      WhatsApp: p.phone,
      Zona: p.zone,
      "Quer conversar?": "SIM",
    }));
    downloadCSV(`fila_batismo.csv`, rows);
  }

  function exportMinistryQueueCSV() {
    const rows = wantsMinistryQueue.map((p) => ({
      Nome: p.name,
      WhatsApp: p.phone,
      Zona: p.zone,
      "Quer servir em": ministryNames(wantedMinistriesByPerson[p.id]) || "-",
    }));
    downloadCSV(`fila_ministerios.csv`, rows);
  }

  function exportCellQueueCSV() {
    const rows = wantsCellQueue.map((p) => ({
      Nome: p.name,
      WhatsApp: p.phone,
      Zona: p.zone,
      "Quer entrar na célula": cellName(wantedCellByPerson[p.id]) || "-",
    }));
    downloadCSV(`fila_celula.csv`, rows);
  }

  // ====== ACTIONS CONFIG ======
  async function addMinistry() {
    const name = newMinistry.trim();
    if (name.length < 2) return;
    const { error } = await supabase.from("ministries").insert({ name });
    if (error) return setMsg({ type: "error", text: "Erro ao adicionar." });
    setNewMinistry(""); refreshAll();
  }
  async function addCell() {
    const name = newCell.trim();
    if (name.length < 2) return;
    const { error } = await supabase.from("cells").insert({ name });
    if (error) return setMsg({ type: "error", text: "Erro ao adicionar." });
    setNewCell(""); refreshAll();
  }
  async function editItem(table, id, currentName) {
    const name = prompt("Editar nome:", currentName);
    if (!name || name.trim().length < 2) return;
    const { error } = await supabase.from(table).update({ name: name.trim() }).eq("id", id);
    if (error) return setMsg({ type: "error", text: "Erro ao editar." });
    refreshAll();
  }
  async function deleteItem(table, id) {
    if (!confirm("Tem certeza?")) return;
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) return setMsg({ type: "error", text: "Erro ao apagar." });
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
            {loading ? "..." : "Atualizar"}
          </button>
          <button className="ghostBtn" onClick={logout}>Sair</button>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === "visao" ? "active" : ""}`} onClick={() => setTab("visao")}>Visão geral</button>
        <button className={`tab ${tab === "pessoas" ? "active" : ""}`} onClick={() => setTab("pessoas")}>Pessoas</button>
        <button className={`tab ${tab === "filas" ? "active" : ""}`} onClick={() => setTab("filas")}>Filas</button>
        <button className={`tab ${tab === "anivers" ? "active" : ""}`} onClick={() => setTab("anivers")}>Aniversariantes</button>
        <button className={`tab ${tab === "config" ? "active" : ""}`} onClick={() => setTab("config")}>Config</button>
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
              <div className="cardLabel">Pendências (Min/Cél)</div>
              <div className="cardValue">{pendingTotal}</div>
            </div>

            <div className="card">
              <div className="cardLabel">Status pendências</div>
              <div className="cardValue">
                {alertLevel.label}
              </div>
              <div className="cardLabel" style={{ marginTop: 6 }}>
                Min: {pendingMinistry} • Cél: {pendingCell}
              </div>
            </div>

            <div className="card">
              <div className="cardLabel">Anivers. {MONTHS[new Date().getMonth()]}</div>
              <div className="cardValue">{countByMonth[new Date().getMonth()]}</div>
            </div>
          </div>

          <div className="panel">
            <div className="panelHead">
              <div className="panelTitle">Por Zona (toque para ver)</div>
            </div>
            <div className="zoneGrid">
              {Object.entries(countByZone).map(([z, n]) => (
                <div
                  key={z}
                  className="zoneItem clickable"
                  onClick={() => setSelectedGroup({ type: "zone", name: z, id: z })}
                >
                  <div className="zoneName">{z}</div>
                  <div className="zoneCount">{n}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid2">
            {/* ATUAIS */}
            <div className="panel">
              <div className="panelHead">
                <div className="panelTitle">Por Célula (ATUAIS)</div>
              </div>
              <div className="zoneGrid compactGrid">
                {cells.map((c) => (
                  <div
                    key={c.id}
                    className="zoneItem clickable"
                    onClick={() => setSelectedGroup({ type: "cell_current", name: c.name, id: c.id })}
                  >
                    <div className="zoneName">{c.name}</div>
                    <div className="zoneCount">{countByCellCurrent[c.id] || 0}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="panel">
              <div className="panelHead">
                <div className="panelTitle">Por Ministério (ATUAIS)</div>
              </div>
              <div className="zoneGrid compactGrid">
                {ministries.map((m) => (
                  <div
                    key={m.id}
                    className="zoneItem clickable"
                    onClick={() => setSelectedGroup({ type: "ministry_current", name: m.name, id: m.id })}
                  >
                    <div className="zoneName">{m.name}</div>
                    <div className="zoneCount">{countByMinistryCurrent[m.id] || 0}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* INTERESSES */}
          <div className="grid2">
            <div className="panel">
              <div className="panelHead">
                <div className="panelTitle">Interesse por Célula (QUER ENTRAR)</div>
              </div>
              <div className="zoneGrid compactGrid">
                {cells.map((c) => (
                  <div
                    key={c.id}
                    className="zoneItem clickable"
                    onClick={() => setSelectedGroup({ type: "cell_wanted", name: c.name, id: c.id })}
                  >
                    <div className="zoneName">{c.name}</div>
                    <div className="zoneCount">{countByCellWanted[c.id] || 0}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="panel">
              <div className="panelHead">
                <div className="panelTitle">Interesse por Ministério (QUER SERVIR)</div>
              </div>
              <div className="zoneGrid compactGrid">
                {ministries.map((m) => (
                  <div
                    key={m.id}
                    className="zoneItem clickable"
                    onClick={() => setSelectedGroup({ type: "ministry_wanted", name: m.name, id: m.id })}
                  >
                    <div className="zoneName">{m.name}</div>
                    <div className="zoneCount">{countByMinistryWanted[m.id] || 0}</div>
                  </div>
                ))}
              </div>
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
              <button className={`pill ${quickVisit ? "active" : ""}`} onClick={() => setQuickVisit((v) => !v)}>Quer visita</button>
              <button className={`pill ${quickBaptism ? "active" : ""}`} onClick={() => setQuickBaptism((v) => !v)}>Fila batismo</button>
              <button className={`pill ${quickWantsMinistry ? "active" : ""}`} onClick={() => setQuickWantsMinistry((v) => !v)}>Quer ministério</button>
              <button className={`pill ${quickWantsCell ? "active" : ""}`} onClick={() => setQuickWantsCell((v) => !v)}>Quer célula</button>
            </div>
          </div>

          <div className="tableWrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>WhatsApp</th>
                  <th>Zona</th>
                  <th>Célula (atual)</th>
                  <th>Célula (quer entrar)</th>
                  <th>Ministérios (atuais)</th>
                  <th>Ministérios (quer servir)</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visiblePeople.map((p) => {
                  const cellCurrent = cellName(currentCellByPerson[p.id]) || "-";
                  const cellWanted = cellName(wantedCellByPerson[p.id]) || "-";

                  const minsCurrent = ministryNames(currentMinistriesByPerson[p.id]) || "-";
                  const minsWanted = ministryNames(wantedMinistriesByPerson[p.id]) || "-";

                  return (
                    <tr key={p.id}>
                      <td className="tdStrong">{p.name}</td>
                      <td>{p.phone}</td>
                      <td>{p.zone || ""}</td>
                      <td>{cellCurrent}</td>
                      <td>{cellWanted}</td>
                      <td className="tdWrap">{minsCurrent}</td>
                      <td className="tdWrap">{minsWanted}</td>
                      <td className="tdRight">
                        <button className="miniBtn" onClick={() => setSelectedPersonId(p.id)}>Detalhes</button>
                      </td>
                    </tr>
                  );
                })}
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
              <div className="panelTitle">Visita pastoral</div>
              <button className="ghostBtn" onClick={exportVisitCSV}>CSV</button>
            </div>
            <div className="list">
              {wantsVisitQueue.map((p) => (
                <div key={p.id} className="listItem">
                  <div>
                    <div className="liTitle">{p.name}</div>
                    <div className="liSub">{p.phone} • {p.zone}</div>
                  </div>
                  <div className="liActions">
                    <button className="miniBtn" onClick={() => openWhatsApp(p.phone, buildVisitMessage(p.name))}>WhatsApp</button>
                    <button className="miniBtn" onClick={() => setSelectedPersonId(p.id)}>Detalhes</button>
                  </div>
                </div>
              ))}
              {!wantsVisitQueue.length && <div className="emptyBox">Sem pendências de visita.</div>}
            </div>
          </div>

          <div className="panel">
            <div className="panelHead row">
              <div className="panelTitle">Batismo</div>
              <button className="ghostBtn" onClick={exportBaptismCSV}>CSV</button>
            </div>
            <div className="list">
              {baptismQueue.map((p) => (
                <div key={p.id} className="listItem">
                  <div>
                    <div className="liTitle">{p.name}</div>
                    <div className="liSub">{p.phone}</div>
                  </div>
                  <div className="liActions">
                    <button className="miniBtn" onClick={() => openWhatsApp(p.phone, buildBaptismMessage(p.name))}>WhatsApp</button>
                    <button className="miniBtn" onClick={() => setSelectedPersonId(p.id)}>Detalhes</button>
                  </div>
                </div>
              ))}
              {!baptismQueue.length && <div className="emptyBox">Sem pendências de batismo.</div>}
            </div>
          </div>

          <div className="panel">
            <div className="panelHead row">
              <div className="panelTitle">Quer Ministério</div>
              <button className="ghostBtn" onClick={exportMinistryQueueCSV}>CSV</button>
            </div>
            <div className="list">
              {wantsMinistryQueue.map((p) => {
                const wants = ministryNames(wantedMinistriesByPerson[p.id]) || "Não escolheu (ainda)";
                return (
                  <div key={p.id} className="listItem">
                    <div>
                      <div className="liTitle">{p.name}</div>
                      <div className="liSub">{p.phone} • {p.zone || "-"} • <b>Quer servir:</b> {wants}</div>
                    </div>
                    <div className="liActions">
                      <button className="miniBtn" onClick={() => setSelectedPersonId(p.id)}>Detalhes</button>
                    </div>
                  </div>
                );
              })}
              {!wantsMinistryQueue.length && <div className="emptyBox">Sem pedidos de ministério.</div>}
            </div>
          </div>

          <div className="panel">
            <div className="panelHead row">
              <div className="panelTitle">Quer Célula</div>
              <button className="ghostBtn" onClick={exportCellQueueCSV}>CSV</button>
            </div>
            <div className="list">
              {wantsCellQueue.map((p) => {
                const wants = cellName(wantedCellByPerson[p.id]) || "Não escolheu (ainda)";
                return (
                  <div key={p.id} className="listItem">
                    <div>
                      <div className="liTitle">{p.name}</div>
                      <div className="liSub">{p.phone} • {p.zone || "-"} • <b>Quer entrar:</b> {wants}</div>
                    </div>
                    <div className="liActions">
                      <button className="miniBtn" onClick={() => setSelectedPersonId(p.id)}>Detalhes</button>
                    </div>
                  </div>
                );
              })}
              {!wantsCellQueue.length && <div className="emptyBox">Sem pedidos de célula.</div>}
            </div>
          </div>
        </>
      )}

      {/* ANIVERSARIANTES */}
      {tab === "anivers" && (
        <div className="panel">
          <div className="panelHead row">
            <div className="panelTitle">Aniversariantes: {MONTHS[selectedMonth]}</div>
            <div className="panelActions">
              <button className="ghostBtn" onClick={exportBirthdaysCSV}>
                Exportar CSV ({MONTHS[selectedMonth]})
              </button>
            </div>
          </div>

          <div className="monthSelector">
            {MONTHS.map((m, idx) => (
              <button
                key={m}
                className={`monthBtn ${selectedMonth === idx ? "active" : ""}`}
                onClick={() => setSelectedMonth(idx)}
              >
                {m} <span className="monthCount">{countByMonth[idx]}</span>
              </button>
            ))}
          </div>

          <div className="list">
            {birthdaysFiltered.map((p) => (
              <div key={p.id} className="listItem">
                <div>
                  <div className="liTitle">{p.name}</div>
                  <div className="liSub">Dia {new Date(p.birth_date).getDate() + 1} • {p.phone}</div>
                </div>
                <div className="liActions">
                  <button className="miniBtn" onClick={() => openWhatsApp(p.phone, buildBirthdayMessage(p.name))}>WhatsApp</button>
                  <button className="miniBtn" onClick={() => setSelectedPersonId(p.id)}>Detalhes</button>
                </div>
              </div>
            ))}

            {!birthdaysFiltered.length && (
              <div className="emptyBox">Ninguém faz aniversário em {MONTHS[selectedMonth]}.</div>
            )}
          </div>
        </div>
      )}

      {/* CONFIG */}
      {tab === "config" && (
        <div className="grid2">
          <div className="panel">
            <div className="panelHead row"><div className="panelTitle">Ministérios</div></div>
            <div className="addRow">
              <input className="textInput" value={newMinistry} onChange={(e) => setNewMinistry(e.target.value)} placeholder="Novo ministério..." />
              <button className="goldBtn" onClick={addMinistry}>Add</button>
            </div>
            <div className="listCompact">
              {ministries.map((m) => (
                <div key={m.id} className="compactItem">
                  <div className="compactName">{m.name}</div>
                  <div className="compactActions">
                    <button className="miniBtn" onClick={() => editItem("ministries", m.id, m.name)}>Edit</button>
                    <button className="dangerBtn" onClick={() => deleteItem("ministries", m.id)}>Del</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panelHead row"><div className="panelTitle">Células</div></div>
            <div className="addRow">
              <input className="textInput" value={newCell} onChange={(e) => setNewCell(e.target.value)} placeholder="Nova célula..." />
              <button className="goldBtn" onClick={addCell}>Add</button>
            </div>
            <div className="listCompact">
              {cells.map((c) => (
                <div key={c.id} className="compactItem">
                  <div className="compactName">{c.name}</div>
                  <div className="compactActions">
                    <button className="miniBtn" onClick={() => editItem("cells", c.id, c.name)}>Edit</button>
                    <button className="dangerBtn" onClick={() => deleteItem("cells", c.id)}>Del</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL PESSOA */}
      {selectedPerson && (
        <div className="modalBackdrop" onClick={() => setSelectedPersonId(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modalHead">
              <div>
                <div className="modalTitle">{selectedPerson.name}</div>
                <div className="modalSub">{selectedPerson.phone} • {selectedPerson.zone}</div>
              </div>
              <button className="ghostBtn" onClick={() => setSelectedPersonId(null)}>Fechar</button>
            </div>

            <div className="modalGrid">
              <div className="modalBox">
                <div className="modalLabel">Nascimento</div>
                <div className="modalValue">
                  {toBRDate(selectedPerson.birth_date)}{" "}
                  <small style={{ color: "#888" }}>({getAge(selectedPerson.birth_date)})</small>
                </div>
              </div>

              <div className="modalBox">
                <div className="modalLabel">Situação Batismo</div>
                <div className="modalValue">
                  {selectedPerson.baptized ? (
                    <span style={{ color: "#4caf50" }}>✅ Batizado</span>
                  ) : (
                    <>
                      {"Não batizado"}
                      {selectedPerson.baptism_contact && (
                        <div style={{ color: "#ffa726", fontSize: "0.9em" }}>⚠️ Quer conversar</div>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="modalBox">
                <div className="modalLabel">Célula</div>
                <div className="modalValue">
                  {selectedPerson.wants_cell ? (
                    <>
                      {"Não participa"}
                      <div style={{ color: "#ffa726", fontSize: "0.9em" }}>
                        ⚠️ Quer entrar: {cellName(wantedCellByPerson[selectedPerson.id]) || "não escolheu"}
                      </div>
                    </>
                  ) : (
                    cellName(currentCellByPerson[selectedPerson.id]) || "Não participa"
                  )}
                </div>
              </div>

              <div className="modalBox">
                <div className="modalLabel">Ministérios</div>
                <div className="modalValue">
                  {selectedPerson.wants_ministry ? (
                    <>
                      {"Não serve"}
                      <div style={{ color: "#ffa726", fontSize: "0.9em" }}>
                        ⚠️ Quer servir: {ministryNames(wantedMinistriesByPerson[selectedPerson.id]) || "não escolheu"}
                      </div>
                    </>
                  ) : (
                    ministryNames(currentMinistriesByPerson[selectedPerson.id]) || "Não serve"
                  )}
                </div>
              </div>
            </div>

            <div className="modalAddress">
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <div className="modalLabel">Endereço Completo</div>
                {selectedPerson.wants_visit ? (
                  <div style={{ background: "rgba(191,126,30,0.3)", color: "#eba036", padding: "2px 8px", borderRadius: 4, fontSize: "0.75rem", fontWeight: "bold" }}>
                    QUER VISITA
                  </div>
                ) : (
                  <div style={{ color: "#555", fontSize: "0.75rem" }}>Não solicitou visita</div>
                )}
              </div>

              {selectedPerson.address_opt_in ? (
                <div className="modalValue">
                  {selectedPerson.street}, {selectedPerson.house_number}{" "}
                  {selectedPerson.complement && <span>• {selectedPerson.complement}</span>}
                  <br />
                  {selectedPerson.neighborhood} • {selectedPerson.city}
                  {selectedPerson.reference && (
                    <div style={{ marginTop: 5, color: "#aaa", fontSize: "0.9em" }}>
                      Ref: {selectedPerson.reference}
                    </div>
                  )}
                </div>
              ) : (
                <div className="modalValue" style={{ color: "#666" }}>Endereço não cadastrado.</div>
              )}
            </div>

            <div className="modalActions">
              <button className="goldBtn" onClick={() => openWhatsApp(selectedPerson.phone, buildBirthdayMessage(selectedPerson.name))}>🎉 Aniversário</button>
              <button className="goldBtn" onClick={() => openWhatsApp(selectedPerson.phone, buildVisitMessage(selectedPerson.name))}>☕ Visita</button>
              <button className="goldBtn" onClick={() => openWhatsApp(selectedPerson.phone, buildBaptismMessage(selectedPerson.name))}>💧 Batismo</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE GRUPO */}
      {selectedGroup && (
        <div className="modalBackdrop" onClick={() => setSelectedGroup(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modalHead">
              <div>
                <div className="modalTitle">
                  Pessoas: {selectedGroup.name}
                </div>
                <div className="modalSub">Total: {groupMembers.length} pessoas</div>
              </div>
              <button className="ghostBtn" onClick={() => setSelectedGroup(null)}>Fechar</button>
            </div>

            <div className="list" style={{ maxHeight: "60vh", overflowY: "auto" }}>
              {groupMembers.map((p) => (
                <div key={p.id} className="listItem">
                  <div>
                    <div className="liTitle">{p.name}</div>
                    <div className="liSub">{p.phone}</div>
                  </div>
                  <div className="liActions">
                    <button className="miniBtn" onClick={() => setSelectedPersonId(p.id)}>Ver Perfil</button>
                  </div>
                </div>
              ))}
              {groupMembers.length === 0 && <div className="emptyBox">Ninguém neste grupo ainda.</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}