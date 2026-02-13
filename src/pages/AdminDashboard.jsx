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
  const header = Object.keys(rows[0]);
  const lines = [
    header.join(";"),
    ...rows.map((r) =>
      header.map((k) => {
          const v = r[k] ?? "";
          const s = String(v).replace(/"/g, '""');
          return `"${s}"`;
        }).join(";")
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

  // Modais
  const [selectedPersonId, setSelectedPersonId] = useState(null);
  
  // Estado para abrir modal de grupo (Zona, Célula ou Ministério)
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
    for (const row of peopleCells) map[row.person_id] = row.cell_id;
    return map;
  }, [peopleCells]);

  const monthNow = new Date().getMonth() + 1;
  const birthdaysThisMonth = useMemo(() => {
    return people.filter((p) => {
        if (!p.birth_date) return false;
        const d = new Date(p.birth_date);
        return !Number.isNaN(d.getTime()) && d.getMonth() + 1 === monthNow;
      }).sort((a, b) => new Date(a.birth_date).getDate() - new Date(b.birth_date).getDate());
  }, [people, monthNow]);

  const wantsVisitQueue = useMemo(() => people.filter((p) => p.wants_visit === true), [people]);
  const baptismQueue = useMemo(() => people.filter((p) => p.baptized === false && p.baptism_contact === true), [people]);
  const wantsMinistryQueue = useMemo(() => people.filter((p) => p.wants_ministry === true), [people]);
  const wantsCellQueue = useMemo(() => people.filter((p) => p.wants_cell === true), [people]);

  // Contagens
  const countByZone = useMemo(() => {
    const map = Object.fromEntries(ZONES.map((z) => [z, 0]));
    for (const p of people) {
      if (p.zone) map[p.zone] = (map[p.zone] || 0) + 1;
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

  const countByMinistry = useMemo(() => {
    const map = {};
    for (const row of peopleMinistries) {
       map[row.ministry_id] = (map[row.ministry_id] || 0) + 1;
    }
    return map;
  }, [peopleMinistries]);

  // ====== LOGICA DO MODAL DE GRUPO ======
  const groupMembers = useMemo(() => {
    if (!selectedGroup) return [];
    if (selectedGroup.type === 'zone') return people.filter(p => p.zone === selectedGroup.name);
    if (selectedGroup.type === 'cell') return people.filter(p => cellByPerson[p.id] === selectedGroup.id);
    if (selectedGroup.type === 'ministry') {
      const pIds = peopleMinistries.filter(pm => pm.ministry_id === selectedGroup.id).map(pm => pm.person_id);
      return people.filter(p => pIds.includes(p.id));
    }
    return [];
  }, [selectedGroup, people, cellByPerson, peopleMinistries]);

  // ====== LISTA PESSOAS VISIVEIS ======
  const visiblePeople = useMemo(() => {
    let list = [...people];
    if (quickVisit) list = list.filter((p) => p.wants_visit === true);
    if (quickBaptism) list = list.filter((p) => p.baptized === false && p.baptism_contact === true);
    return list;
  }, [people, quickVisit, quickBaptism]);

  const selectedPerson = useMemo(() => people.find((p) => p.id === selectedPersonId) || null, [people, selectedPersonId]);

  // ====== CSV EXPORTS ======
  function exportBirthdaysCSV() {
    const rows = birthdaysThisMonth.map((p) => ({ Nome: p.name, WhatsApp: p.phone, "Nascimento": monthDay(p.birth_date), Zona: p.zone }));
    downloadCSV(`aniversariantes_${monthNow}.csv`, rows);
  }
  function exportVisitCSV() {
    const rows = wantsVisitQueue.map((p) => ({ Nome: p.name, WhatsApp: p.phone, Zona: p.zone, Rua: p.street, Bairro: p.neighborhood }));
    downloadCSV(`fila_visitas.csv`, rows);
  }
  function exportBaptismCSV() {
    const rows = baptismQueue.map((p) => ({ Nome: p.name, WhatsApp: p.phone, Zona: p.zone, "Quer conversar?": "SIM" }));
    downloadCSV(`fila_batismo.csv`, rows);
  }
  function exportMinistryQueueCSV() {
    const rows = wantsMinistryQueue.map((p) => ({ Nome: p.name, WhatsApp: p.phone, Zona: p.zone }));
    downloadCSV(`fila_ministerios.csv`, rows);
  }
  function exportCellQueueCSV() {
    const rows = wantsCellQueue.map((p) => ({ Nome: p.name, WhatsApp: p.phone, Zona: p.zone }));
    downloadCSV(`fila_celula.csv`, rows);
  }

  // ====== ACTIONS ======
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
        <div><div className="dashTitle">Dashboard</div><div className="dashSub">Igreja Batista do Amor</div></div>
        <div className="dashTopActions">
          <button className="ghostBtn" onClick={refreshAll} disabled={loading}>{loading ? "..." : "Atualizar"}</button>
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
            <div className="card"><div className="cardLabel">Cadastrados</div><div className="cardValue">{people.length}</div></div>
            <div className="card"><div className="cardLabel">Querem visita</div><div className="cardValue">{wantsVisitQueue.length}</div></div>
            <div className="card"><div className="cardLabel">Anivers. do mês</div><div className="cardValue">{birthdaysThisMonth.length}</div></div>
          </div>

          <div className="panel">
            <div className="panelHead"><div className="panelTitle">Por Zona (toque para ver)</div></div>
            <div className="zoneGrid">
              {Object.entries(countByZone).map(([z, n]) => (
                <div key={z} className="zoneItem clickable" onClick={() => setSelectedGroup({ type: 'zone', name: z, id: z })}>
                  <div className="zoneName">{z}</div>
                  <div className="zoneCount">{n}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid2">
             <div className="panel">
                <div className="panelHead"><div className="panelTitle">Por Célula</div></div>
                <div className="zoneGrid compactGrid">
                  {cells.map((c) => (
                    <div key={c.id} className="zoneItem clickable" onClick={() => setSelectedGroup({ type: 'cell', name: c.name, id: c.id })}>
                      <div className="zoneName">{c.name}</div>
                      <div className="zoneCount">{countByCell[c.id] || 0}</div>
                    </div>
                  ))}
                </div>
             </div>
             <div className="panel">
                <div className="panelHead"><div className="panelTitle">Por Ministério</div></div>
                <div className="zoneGrid compactGrid">
                  {ministries.map((m) => (
                    <div key={m.id} className="zoneItem clickable" onClick={() => setSelectedGroup({ type: 'ministry', name: m.name, id: m.id })}>
                      <div className="zoneName">{m.name}</div>
                      <div className="zoneCount">{countByMinistry[m.id] || 0}</div>
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
              <button className={`pill ${quickVisit ? "active" : ""}`} onClick={() => setQuickVisit(v => !v)}>Quer visita</button>
              <button className={`pill ${quickBaptism ? "active" : ""}`} onClick={() => setQuickBaptism(v => !v)}>Fila batismo</button>
            </div>
          </div>
          <div className="tableWrap">
            <table className="table">
              <thead><tr><th>Nome</th><th>WhatsApp</th><th>Zona</th><th>Célula</th><th>Ministérios</th><th></th></tr></thead>
              <tbody>
                {visiblePeople.map((p) => {
                  const cellName = cellByPerson[p.id] ? byIdCell[cellByPerson[p.id]]?.name : "";
                  const mins = (ministriesByPerson[p.id] || []).map(id => byIdMinistry[id]?.name).filter(Boolean).join(", ");
                  return (
                    <tr key={p.id}>
                      <td className="tdStrong">{p.name}</td><td>{p.phone}</td><td>{p.zone || ""}</td><td>{cellName || "-"}</td><td className="tdWrap">{mins || "-"}</td>
                      <td className="tdRight"><button className="miniBtn" onClick={() => setSelectedPersonId(p.id)}>Detalhes</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "filas" && (
        <>
          <div className="panel"><div className="panelHead row"><div className="panelTitle">Visita pastoral</div><button className="ghostBtn" onClick={exportVisitCSV}>CSV</button></div>
          <div className="list">{wantsVisitQueue.map(p => <div key={p.id} className="listItem"><div><div className="liTitle">{p.name}</div><div className="liSub">{p.phone} • {p.zone}</div></div><div className="liActions"><button className="miniBtn" onClick={() => openWhatsApp(p.phone, buildVisitMessage(p.name))}>WhatsApp</button><button className="miniBtn" onClick={() => setSelectedPersonId(p.id)}>Detalhes</button></div></div>)}</div></div>

          <div className="panel"><div className="panelHead row"><div className="panelTitle">Batismo</div><button className="ghostBtn" onClick={exportBaptismCSV}>CSV</button></div>
          <div className="list">{baptismQueue.map(p => <div key={p.id} className="listItem"><div><div className="liTitle">{p.name}</div><div className="liSub">{p.phone}</div></div><div className="liActions"><button className="miniBtn" onClick={() => openWhatsApp(p.phone, buildBaptismMessage(p.name))}>WhatsApp</button><button className="miniBtn" onClick={() => setSelectedPersonId(p.id)}>Detalhes</button></div></div>)}</div></div>
          
          <div className="panel"><div className="panelHead row"><div className="panelTitle">Quer Ministério</div><button className="ghostBtn" onClick={exportMinistryQueueCSV}>CSV</button></div>
          <div className="list">{wantsMinistryQueue.map(p => <div key={p.id} className="listItem"><div><div className="liTitle">{p.name}</div><div className="liSub">{p.phone}</div></div><div className="liActions"><button className="miniBtn" onClick={() => setSelectedPersonId(p.id)}>Detalhes</button></div></div>)}</div></div>

          <div className="panel"><div className="panelHead row"><div className="panelTitle">Quer Célula</div><button className="ghostBtn" onClick={exportCellQueueCSV}>CSV</button></div>
          <div className="list">{wantsCellQueue.map(p => <div key={p.id} className="listItem"><div><div className="liTitle">{p.name}</div><div className="liSub">{p.phone}</div></div><div className="liActions"><button className="miniBtn" onClick={() => setSelectedPersonId(p.id)}>Detalhes</button></div></div>)}</div></div>
        </>
      )}

      {tab === "anivers" && (
        <div className="panel"><div className="panelHead row"><div className="panelTitle">Aniversariantes</div><button className="ghostBtn" onClick={exportBirthdaysCSV}>CSV</button></div>
        <div className="list">{birthdaysThisMonth.map(p => <div key={p.id} className="listItem"><div><div className="liTitle">{p.name}</div><div className="liSub">{monthDay(p.birth_date)} • {p.phone}</div></div><div className="liActions"><button className="miniBtn" onClick={() => openWhatsApp(p.phone, buildBirthdayMessage(p.name))}>WhatsApp</button><button className="miniBtn" onClick={() => setSelectedPersonId(p.id)}>Detalhes</button></div></div>)}</div></div>
      )}

      {tab === "config" && (
        <div className="grid2">
          <div className="panel">
            <div className="panelHead row"><div className="panelTitle">Ministérios</div></div>
            <div className="addRow"><input className="textInput" value={newMinistry} onChange={(e) => setNewMinistry(e.target.value)} placeholder="Novo ministério..." /><button className="goldBtn" onClick={addMinistry}>Add</button></div>
            <div className="listCompact">{ministries.map(m => <div key={m.id} className="compactItem"><div className="compactName">{m.name}</div><div className="compactActions"><button className="miniBtn" onClick={() => editItem("ministries", m.id, m.name)}>Edit</button><button className="dangerBtn" onClick={() => deleteItem("ministries", m.id)}>Del</button></div></div>)}</div>
          </div>
          <div className="panel">
            <div className="panelHead row"><div className="panelTitle">Células</div></div>
            <div className="addRow"><input className="textInput" value={newCell} onChange={(e) => setNewCell(e.target.value)} placeholder="Nova célula..." /><button className="goldBtn" onClick={addCell}>Add</button></div>
            <div className="listCompact">{cells.map(c => <div key={c.id} className="compactItem"><div className="compactName">{c.name}</div><div className="compactActions"><button className="miniBtn" onClick={() => editItem("cells", c.id, c.name)}>Edit</button><button className="dangerBtn" onClick={() => deleteItem("cells", c.id)}>Del</button></div></div>)}</div>
          </div>
        </div>
      )}

      {/* MODAL PESSOA INDIVIDUAL - COM OS BOTÕES DE VOLTA! */}
      {selectedPerson && (
        <div className="modalBackdrop" onClick={() => setSelectedPersonId(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modalHead"><div><div className="modalTitle">{selectedPerson.name}</div><div className="modalSub">{selectedPerson.phone}</div></div><button className="ghostBtn" onClick={() => setSelectedPersonId(null)}>Fechar</button></div>
            <div className="modalGrid">
               <div className="modalBox"><div className="modalLabel">Célula</div><div className="modalValue">{cellByPerson[selectedPerson.id] ? (byIdCell[cellByPerson[selectedPerson.id]]?.name || "-") : "-"}</div></div>
               <div className="modalBox"><div className="modalLabel">Ministérios</div><div className="modalValue">{(ministriesByPerson[selectedPerson.id] || []).map(id => byIdMinistry[id]?.name).join(", ") || "-"}</div></div>
            </div>
            <div className="modalAddress"><div className="modalLabel">Endereço</div><div className="modalValue">{selectedPerson.street ? `${selectedPerson.street}, ${selectedPerson.house_number} - ${selectedPerson.neighborhood}` : "Sem endereço"}</div></div>
            
            {/* AQUI ESTÃO ELES DE VOLTA 👇 */}
            <div className="modalActions">
              <button className="goldBtn" onClick={() => openWhatsApp(selectedPerson.phone, buildBirthdayMessage(selectedPerson.name))}>
                🎉 Feliz Aniversário
              </button>
              <button className="goldBtn" onClick={() => openWhatsApp(selectedPerson.phone, buildVisitMessage(selectedPerson.name))}>
                ☕ Marcar Visita
              </button>
              <button className="goldBtn" onClick={() => openWhatsApp(selectedPerson.phone, buildBaptismMessage(selectedPerson.name))}>
                💧 Sobre Batismo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE GRUPO (LISTA QUEM FAZ PARTE) */}
      {selectedGroup && (
        <div className="modalBackdrop" onClick={() => setSelectedGroup(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modalHead">
              <div>
                <div className="modalTitle">Membros: {selectedGroup.name}</div>
                <div className="modalSub">Total: {groupMembers.length} pessoas</div>
              </div>
              <button className="ghostBtn" onClick={() => setSelectedGroup(null)}>Fechar</button>
            </div>

            <div className="list" style={{maxHeight: '60vh', overflowY: 'auto'}}>
              {groupMembers.map(p => (
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