import React, { useState, useRef, useEffect, useCallback } from "react";
import * as XLSX from "xlsx";

// ─── Supabase Config ──────────────────────────────────────────────────────────
const SUPA_URL = "https://mtvhbpyjxqfqbosuronn.supabase.co";
const SUPA_KEY = "sb_publishable_W1knQodagUJ-kfqMQV2z1w_UFGI7PIK";

async function supaFetch(path, opts = {}) {
  const res = await fetch(`${SUPA_URL}/rest/v1${path}`, {
    ...opts,
    headers: {
      "apikey": SUPA_KEY,
      "Authorization": `Bearer ${SUPA_KEY}`,
      "Content-Type": "application/json",
      "Prefer": opts.prefer || "return=representation",
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

const db = {
  getSchulungen: () => supaFetch("/schulungen?order=created_at.desc"),
  getMitarbeiter: () => supaFetch("/mitarbeiter?order=team.asc,name.asc"),
  insertSchulung: (s) => supaFetch("/schulungen", { method: "POST", body: JSON.stringify(toDb(s)) }),
  updateSchulung: (id, s) => supaFetch(`/schulungen?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(toDb(s)) }),
  deleteSchulung: (id) => supaFetch(`/schulungen?id=eq.${id}`, { method: "DELETE", prefer: "return=minimal" }),
  insertMitarbeiter: (m) => supaFetch("/mitarbeiter", { method: "POST", body: JSON.stringify(m) }),
  updateMitarbeiter: (id, m) => supaFetch(`/mitarbeiter?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(m) }),
  deleteMitarbeiter: (id) => supaFetch(`/mitarbeiter?id=eq.${id}`, { method: "DELETE", prefer: "return=minimal" }),
};

// DB-Format Konvertierung
function toDb(s) {
  return {
    titel: s.titel, org_name: s.orgName, dok_nr: s.dokNr, version: s.version,
    status: s.status, gueltig_ab: s.gueltigAb, naechste_pruefung: s.naechstePruefung,
    erstellt_durch: s.erstelltDurch, freigegeben_von: s.freigegebenVon,
    geltungsbereich: s.geltungsbereich, bezugsdokumente: s.bezugsdokumente,
    kategorie: s.kategorie, pflicht: s.pflicht, bestehensgrenze: s.bestehensgrenze,
    max_punkte: s.maxPunkte, dauer: s.dauer, grundsatz: s.grundsatz,
    lernziele: s.lernziele, module: s.module, checkliste: s.checkliste,
    fragen: s.fragen, empfaenger: s.empfaenger || [], nachweise: s.nachweise || {},
  };
}

function fromDb(r) {
  return {
    id: r.id, titel: r.titel, orgName: r.org_name, dokNr: r.dok_nr,
    version: r.version, status: r.status, gueltigAb: r.gueltig_ab,
    naechstePruefung: r.naechste_pruefung, erstelltDurch: r.erstellt_durch,
    freigegebenVon: r.freigegeben_von, geltungsbereich: r.geltungsbereich,
    bezugsdokumente: r.bezugsdokumente, kategorie: r.kategorie,
    pflicht: r.pflicht, bestehensgrenze: r.bestehensgrenze, maxPunkte: r.max_punkte,
    dauer: r.dauer, grundsatz: r.grundsatz, lernziele: r.lernziele,
    module: r.module || [], checkliste: r.checkliste || [],
    fragen: r.fragen || [], empfaenger: r.empfaenger || [], nachweise: r.nachweise || {},
  };
}

// ─── Theme ────────────────────────────────────────────────────────────────────
const C = {
  bg: "#f3f6fb", white: "#fff", blue: "#2459b8", blueDim: "#eef5ff",
  blueBorder: "#bed0ed", text: "#172033", muted: "#5f6d82",
  border: "#d7e0ec", inputBorder: "#cbd6e6",
  good: { bg:"#eefaf2", border:"#b8e2c7", text:"#0f5331" },
  bad:  { bg:"#fff1f0", border:"#ffccc7", text:"#842029" },
  warn: { bg:"#fff7e8", border:"#ffd99c", text:"#543600" },
};

const KATEGORIEN = ["Pflege","Medizin","Recht & Compliance","QM","Kommunikation","Notfallmanagement"];
const ROLLEN = ["Arzt","Ärztin","Pflegefachkraft","Koordination","Verwaltung","Leitung"];

// ─── Styles ───────────────────────────────────────────────────────────────────
const css = {
  section: { background:C.white, border:`1px solid ${C.border}`, borderRadius:16, padding:20, margin:"14px 0", boxShadow:"0 8px 22px rgba(16,24,40,.06)" },
  inp: { width:"100%", fontSize:15, padding:11, border:`1px solid ${C.inputBorder}`, borderRadius:11, background:C.white, color:C.text, boxSizing:"border-box", fontFamily:"inherit" },
  lbl: { display:"block", fontWeight:700, marginBottom:5, fontSize:14 },
  btn: { appearance:"none", border:0, borderRadius:12, background:C.blue, color:C.white, padding:"11px 16px", fontWeight:700, fontSize:15, cursor:"pointer" },
  btnSec: { appearance:"none", borderRadius:12, background:C.blueDim, color:"#1f365f", border:`1px solid ${C.border}`, padding:"11px 16px", fontWeight:700, fontSize:14, cursor:"pointer" },
  btnDanger: { background:C.bad.bg, color:C.bad.text, border:`1px solid ${C.bad.border}`, borderRadius:10, padding:"7px 12px", fontWeight:700, fontSize:13, cursor:"pointer", appearance:"none" },
  good: { background:C.good.bg, border:`1px solid ${C.good.border}`, color:C.good.text, padding:"13px 16px", borderRadius:13, fontSize:14 },
  bad:  { background:C.bad.bg,  border:`1px solid ${C.bad.border}`,  color:C.bad.text,  padding:"13px 16px", borderRadius:13, fontSize:14 },
  notice: { background:C.warn.bg, border:`1px solid ${C.warn.border}`, color:C.warn.text, padding:"13px 16px", borderRadius:13, fontSize:14 },
  module: { borderLeft:`5px solid ${C.blue}`, paddingLeft:14, margin:"16px 0" },
  badge: { display:"inline-block", background:C.blueDim, color:C.blue, padding:"6px 12px", borderRadius:999, fontWeight:700, fontSize:12 },
  docmeta: { display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginTop:12, fontSize:13 },
  docmetaCell: { border:`1px solid ${C.border}`, background:"#fbfcff", borderRadius:9, padding:"8px 10px" },
  qBox: { border:`1px solid ${C.border}`, background:"#fbfcff", borderRadius:13, padding:"13px 15px", marginBottom:13 },
  confirmBox: { display:"flex", gap:10, alignItems:"flex-start", border:`1px solid ${C.border}`, background:"#fbfcff", borderRadius:12, padding:12, margin:"8px 0" },
  progress: { height:9, background:"#e7edf7", borderRadius:999, overflow:"hidden", marginTop:10 },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function callAI(system, user) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:2000, system, messages:[{role:"user",content:user}] }),
  });
  const d = await res.json();
  return d.content?.find(b=>b.type==="text")?.text || "";
}

function proofCode(kuerzel) {
  const d = new Date().toISOString().replace(/[-:.TZ]/g,"").slice(0,14);
  return (kuerzel||"XX").toUpperCase().slice(0,3) + "-" + d + "-" + Math.random().toString(36).slice(2,6).toUpperCase();
}

function Modal({ onClose, children, wide }) {
  return (
    <div onClick={onClose} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.45)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,backdropFilter:"blur(3px)" }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:C.white,borderRadius:18,padding:28,width:wide?"94%":"90%",maxWidth:wide?1000:700,maxHeight:"92vh",overflowY:"auto",position:"relative",boxShadow:"0 24px 64px rgba(0,0,0,.18)" }}>
        <button onClick={onClose} style={{ position:"absolute",top:13,right:16,background:"none",border:"none",fontSize:20,color:C.muted,cursor:"pointer",lineHeight:1 }}>✕</button>
        {children}
      </div>
    </div>
  );
}

function AIBtn({ onClick, loading, label }) {
  return <button onClick={onClick} disabled={loading} style={{ ...css.btnSec, fontSize:13, padding:"7px 14px", opacity:loading?.65:1, display:"flex", alignItems:"center", gap:6 }}><span>{loading?"⏳":"✦"}</span>{loading?"KI generiert…":label}</button>;
}

function Spinner() {
  return <div style={{ display:"flex", alignItems:"center", justifyContent:"center", padding:60, color:C.muted, fontSize:15 }}>⏳ Lade Daten...</div>;
}

// ─── Schulungs-Player ─────────────────────────────────────────────────────────
function SchulungsPlayer({ sc, onClose, onNachweis }) {
  const [tab, setTab] = useState("start");
  const [answers, setAnswers] = useState({});
  const [score, setScore] = useState(null);
  const [wrongList, setWrongList] = useState([]);
  const [proofUnlocked, setProofUnlocked] = useState(false);
  const [form, setForm] = useState({ name:"", rolle:"", email:"", datum:new Date().toISOString().slice(0,10), sig:"", offen:"" });
  const [checks, setChecks] = useState({ c1:false,c2:false,c3:false,c4:false });
  const [submitResult, setSubmitResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const fragen = sc.fragen || [];
  const grenze = sc.bestehensgrenze || 16;
  const maxP = sc.maxPunkte || fragen.length;
  const answeredCount = fragen.filter((_,i)=>answers[i]!==undefined).length;
  let pct = 5 + (answeredCount / Math.max(fragen.length,1)) * 60;
  if (score !== null && score >= grenze) pct = 90;
  if (submitResult?.ok) pct = 100;

  const gradeQuiz = () => {
    const unanswered = fragen.map((_,i)=>i).filter(i=>answers[i]===undefined);
    if (unanswered.length) { alert("Bitte alle Fragen beantworten. Offen: " + unanswered.map(i=>i+1).join(", ")); return; }
    let s = 0; const wrong = [];
    fragen.forEach((f,i)=>{ if(Number(answers[i])===f.c) s++; else wrong.push({n:i+1,c:String.fromCharCode(65+f.c)}); });
    setScore(s); setWrongList(wrong);
    if (s >= grenze) { setProofUnlocked(true); setTab("nachweis"); }
  };

  const submitProof = async () => {
    if (!form.name||!form.rolle||!form.datum||!form.sig) { alert("Bitte Name, Funktion, Datum und digitale Namensbestätigung ausfüllen."); return; }
    if (!checks.c1||!checks.c2||!checks.c3||!checks.c4) { alert("Bitte alle Bestätigungen ankreuzen."); return; }
    setSubmitting(true);
    const code = proofCode(form.name.split(" ").map(w=>w[0]).join(""));
    const nachweis = { ...form, code, score, maxP, grenze, ts:new Date().toLocaleString("de-DE"), dokNr:sc.dokNr, version:sc.version };
    await onNachweis(sc.id, nachweis);
    setSubmitResult({ ok:true, code });
    setSubmitting(false);
  };

  const tabs = [["start","Start"],["schulung","Schulung"],["checklisten","Checklisten"],["quiz","Quiz"],["nachweis","Nachweis"]];

  return (
    <div style={{ fontFamily:"Arial,Helvetica,sans-serif", color:C.text, lineHeight:1.55, fontSize:16 }}>
      <div style={{ marginBottom:4 }}>
        <div style={{ fontSize:10, color:C.blue, fontWeight:700, letterSpacing:2, textTransform:"uppercase", marginBottom:6 }}>{sc.orgName || "Palliativ Netzwerk Rhein-Maas GmbH & Co. KG"}</div>
        <h2 style={{ margin:"0 0 2px", fontSize:22 }}>{sc.titel}</h2>
        <span style={css.badge}>Dauer: {sc.dauer||"ca. 20-30 Min."} · Bestanden ab {grenze}/{maxP}</span>
        <div style={css.docmeta}>
          <div style={css.docmetaCell}><strong>Dok.-Nr.:</strong><br/>{sc.dokNr}</div>
          <div style={css.docmetaCell}><strong>Version:</strong><br/>{sc.version}</div>
          <div style={css.docmetaCell}><strong>Status:</strong><br/>{sc.status}</div>
          <div style={css.docmetaCell}><strong>Freigabe:</strong><br/>{sc.freigegebenVon||"–"}</div>
        </div>
        <nav style={{ display:"flex", gap:8, flexWrap:"wrap", marginTop:12 }}>
          {tabs.map(([id,label])=>(
            <button key={id} onClick={()=>{ if(id==="nachweis"&&!proofUnlocked)return; setTab(id); }}
              style={{ textDecoration:"none", color:tab===id?C.white:C.blue, border:`1px solid ${C.blueBorder}`, borderRadius:999, padding:"7px 12px", background:tab===id?C.blue:C.white, fontWeight:700, fontSize:14, cursor:(id==="nachweis"&&!proofUnlocked)?"not-allowed":"pointer", opacity:(id==="nachweis"&&!proofUnlocked)?.45:1, appearance:"none" }}>
              {label}
            </button>
          ))}
        </nav>
        <div style={css.progress}><div style={{ height:"100%", background:C.blue, width:`${pct}%`, transition:"width .4s ease", borderRadius:999 }} /></div>
      </div>

      {tab==="start" && (
        <div>
          <div style={css.section}>
            <h2>Start</h2>
            <p>Diese Unterweisung ist als gelenktes internes Schulungsdokument nach DIN EN 15224 aufgebaut.</p>
            <div style={css.notice}><strong>Grundsatz:</strong> {sc.grundsatz}</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginTop:14, fontSize:13 }}>
              {[["Geltungsbereich",sc.geltungsbereich],["Bezugsdokumente",sc.bezugsdokumente],["Erstellt durch",sc.erstelltDurch],["Gültig ab",sc.gueltigAb],["Lernziele",sc.lernziele],["Nächste Prüfung",sc.naechstePruefung]].map(([k,v])=>(
                <div key={k} style={{ border:`1px solid ${C.border}`, background:"#fbfcff", borderRadius:9, padding:"8px 11px" }}>
                  <strong>{k}:</strong><br/><span style={{ color:C.muted }}>{v||"–"}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ textAlign:"right" }}><button onClick={()=>setTab("schulung")} style={css.btn}>Zur Schulung →</button></div>
        </div>
      )}

      {tab==="schulung" && (
        <div>
          <div style={css.section}>
            <h2>Schulung</h2>
            {(sc.module||[]).map((m,i)=>(
              <div key={i} style={css.module}>
                <h3 style={{ margin:"0 0 8px", fontSize:18 }}>{m.titel}</h3>
                <p style={{ margin:0, whiteSpace:"pre-wrap" }}>{m.inhalt}</p>
              </div>
            ))}
          </div>
          <div style={{ textAlign:"right" }}><button onClick={()=>setTab("checklisten")} style={css.btn}>Zu den Checklisten →</button></div>
        </div>
      )}

      {tab==="checklisten" && (
        <div>
          <div style={css.section}>
            <h2>Checklisten</h2>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:10 }}>
              {(sc.checkliste||[]).map((item,i)=>(
                <div key={i} style={{ border:`1px solid ${C.border}`, background:"#fbfcff", borderRadius:12, padding:12, fontSize:14 }}>☑ {item}</div>
              ))}
            </div>
          </div>
          <div style={{ textAlign:"right" }}><button onClick={()=>setTab("quiz")} style={css.btn}>Zum Quiz →</button></div>
        </div>
      )}

      {tab==="quiz" && (
        <div>
          <div style={css.section}>
            <h2>Quiz</h2>
            <p>Ab <strong>{grenze} von {maxP} Punkten</strong> bestanden.</p>
            {fragen.map((f,i)=>(
              <div key={i} style={css.qBox}>
                <h3 style={{ margin:"0 0 10px", fontSize:17 }}>{i+1}. {f.q}</h3>
                <select value={answers[i]??""} onChange={e=>setAnswers(a=>({...a,[i]:e.target.value}))} style={css.inp}>
                  <option value="">Bitte auswählen</option>
                  {f.a.map((opt,j)=><option key={j} value={j}>{String.fromCharCode(65+j)}: {opt}</option>)}
                </select>
              </div>
            ))}
            <div style={{ display:"flex", gap:10, marginTop:14 }}>
              <button onClick={gradeQuiz} style={css.btn}>Quiz auswerten</button>
              <button onClick={()=>{ setAnswers({}); setScore(null); setWrongList([]); }} style={css.btnSec}>Zurücksetzen</button>
            </div>
            {score !== null && (
              <div style={{ marginTop:16 }}>
                <div style={{ ...(score>=grenze?css.good:css.bad), fontSize:18, fontWeight:700 }}>{score} von {maxP} Punkten · {score>=grenze?"Bestanden":"Nicht bestanden"}</div>
                {wrongList.length>0 && <div style={{ marginTop:10 }}><h3>Hinweise</h3><ul>{wrongList.map(w=><li key={w.n}>Frage {w.n}: richtige Antwort {w.c}</li>)}</ul></div>}
                {score>=grenze && <div style={{ marginTop:12, textAlign:"right" }}><button onClick={()=>setTab("nachweis")} style={css.btn}>Zum Nachweis →</button></div>}
              </div>
            )}
          </div>
        </div>
      )}

      {tab==="nachweis" && (
        <div>
          <div style={css.section}>
            <h2>Nachweis</h2>
            {!proofUnlocked ? (
              <div style={css.notice}>Noch nicht freigeschaltet. Bitte zuerst das Quiz mit mindestens {grenze} von {maxP} Punkten bestehen.</div>
            ) : submitResult?.ok ? (
              <div style={css.good}><strong>Nachweis gespeichert.</strong><br/>Prüfcode: <strong>{submitResult.code}</strong><br/>Ihr Nachweis wurde zentral erfasst.</div>
            ) : (
              <>
                <div style={css.good}>Prüfung bestanden. Bitte Angaben ausfüllen.</div>
                <h3>Angaben</h3>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                  {[["name","Name","text"],["rolle","Funktion","text"],["email","E-Mail","email"],["datum","Datum","date"]].map(([k,l,t])=>(
                    <div key={k}><label style={css.lbl}>{l}</label><input type={t} value={form[k]} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))} style={css.inp} /></div>
                  ))}
                </div>
                <h3>Bestätigungen</h3>
                {[["c1","Ich habe die Schulung vollständig bearbeitet."],["c2","Ich habe die Inhalte verstanden."],["c3","Ich kenne meine Handlungspflichten bei Unsicherheit oder Abweichung."],["c4","Ich habe keine Patientendaten eingetragen."]].map(([k,txt])=>(
                  <label key={k} style={{ ...css.confirmBox, cursor:"pointer" }}>
                    <input type="checkbox" checked={checks[k]} onChange={e=>setChecks(c=>({...c,[k]:e.target.checked}))} style={{ width:22,height:22,flexShrink:0,marginTop:2,accentColor:C.blue }} />
                    <span>{txt}</span>
                  </label>
                ))}
                <h3>Digitale Bestätigung</h3>
                <div style={css.notice}>Der Nachweis enthält Name, Funktion, Datum, Thema, Quiz-Ergebnis, Prüfcode und Dokumentenversion.</div>
                <label style={{ ...css.lbl, marginTop:12 }}>Vollständiger Name als digitale Bestätigung</label>
                <input type="text" value={form.sig} onChange={e=>setForm(f=>({...f,sig:e.target.value}))} style={css.inp} placeholder="Vor- und Nachname eingeben" />
                <label style={{ ...css.lbl, marginTop:12 }}>Offene Fragen / Bemerkungen</label>
                <textarea value={form.offen} onChange={e=>setForm(f=>({...f,offen:e.target.value}))} style={{ ...css.inp, minHeight:80, resize:"vertical" }} />
                <div style={{ marginTop:16 }}>
                  <button onClick={submitProof} disabled={submitting} style={{ ...css.btn, opacity:submitting?.65:1 }}>{submitting?"Wird gespeichert…":"Nachweis absenden"}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      <p style={{ textAlign:"center", color:C.muted, fontSize:12, marginTop:16 }}>{sc.dokNr} · Version {sc.version} · {sc.status} · Gültig ab {sc.gueltigAb}</p>
    </div>
  );
}

// ─── Schulung Form ────────────────────────────────────────────────────────────
function SchulungForm({ schulung, onSave, onClose }) {
  const isNew = !schulung;
  const [form, setForm] = useState(schulung || {
    titel:"", orgName:"Palliativ Netzwerk Rhein-Maas GmbH & Co. KG",
    dokNr:"", version:"1.0", status:"Entwurf",
    gueltigAb:new Date().toISOString().slice(0,10), naechstePruefung:"",
    erstelltDurch:"", freigegebenVon:"", geltungsbereich:"", bezugsdokumente:"",
    kategorie:"Pflege", pflicht:false, dauer:"ca. 20-30 Min.",
    bestehensgrenze:16, maxPunkte:20, grundsatz:"", lernziele:"",
    module:[], checkliste:[], fragen:[],
  });
  const [ai, setAi] = useState(false);
  const [aiErr, setAiErr] = useState("");
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const generateAI = async () => {
    if (!form.titel.trim()) { setAiErr("Bitte zuerst Titel eingeben."); return; }
    setAi(true); setAiErr("");
    try {
      const raw = await callAI(
        `Du bist QM-Beauftragter bei Palliativnetzwerk Rhein-Maas (SAPV). Erstelle vollstaendige Schulungsinhalte als JSON. Nur gueltiges JSON, kein Markdown.
Format: {"lernziele":"string","grundsatz":"string","geltungsbereich":"string","bezugsdokumente":"string","module":[{"titel":"string","inhalt":"string"}],"checkliste":["string"],"fragen":[{"q":"string","a":["string","string","string"],"c":0}]}
Genau 4 Module, 7-8 Checkpunkte, 20 Fragen. Letzter Checkpunkt immer: Keine Patientendaten eingetragen.`,
        `Schulung: "${form.titel}" | Kategorie: ${form.kategorie} | SAPV-Kontext Kreis Kleve und Moers.`
      );
      const parsed = JSON.parse(raw.replace(/```json|```/g,"").trim());
      setForm(f=>({...f, lernziele:parsed.lernziele||f.lernziele, grundsatz:parsed.grundsatz||f.grundsatz, geltungsbereich:parsed.geltungsbereich||f.geltungsbereich, bezugsdokumente:parsed.bezugsdokumente||f.bezugsdokumente, module:parsed.module||[], checkliste:parsed.checkliste||[], fragen:parsed.fragen||[] }));
    } catch(e) { setAiErr("Fehler beim Generieren. Bitte erneut versuchen."); }
    setAi(false);
  };

  const setMod = (i,k,v) => setForm(f=>{ const m=[...f.module]; m[i]={...m[i],[k]:v}; return {...f,module:m}; });
  const setFr  = (i,k,v) => setForm(f=>{ const q=[...f.fragen]; q[i]={...q[i],[k]:v}; return {...f,fragen:q}; });
  const setAns = (fi,ai2,v) => setForm(f=>{ const q=[...f.fragen]; const a=[...q[fi].a]; a[ai2]=v; q[fi]={...q[fi],a}; return {...f,fragen:q}; });
  const setChk = (i,v) => setForm(f=>{ const c=[...f.checkliste]; c[i]=v; return {...f,checkliste:c}; });

  return (
    <div style={{ fontFamily:"Arial,Helvetica,sans-serif", color:C.text }}>
      <h2 style={{ margin:"0 0 18px", fontSize:20 }}>{isNew?"Neue Schulung anlegen":"Schulung bearbeiten"}</h2>
      <div style={css.section}>
        <h3 style={{ margin:"0 0 14px", fontSize:17 }}>Dokumentenlenkung (DIN EN 15224)</h3>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          {[["titel","Titel"],["dokNr","Dok.-Nr."],["version","Version"],["freigegebenVon","Freigabe durch"],["gueltigAb","Gültig ab"],["naechstePruefung","Nächste Prüfung"],["erstelltDurch","Erstellt durch"],["dauer","Dauer"]].map(([k,l])=>(
            <div key={k}><label style={css.lbl}>{l}</label><input value={form[k]||""} onChange={e=>set(k,e.target.value)} style={css.inp} /></div>
          ))}
          <div><label style={css.lbl}>Kategorie</label><select value={form.kategorie} onChange={e=>set("kategorie",e.target.value)} style={css.inp}>{KATEGORIEN.map(k=><option key={k}>{k}</option>)}</select></div>
          <div><label style={css.lbl}>Status</label><select value={form.status} onChange={e=>set("status",e.target.value)} style={css.inp}><option>Entwurf</option><option>Freigegeben</option><option>Archiviert</option></select></div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, gridColumn:"span 2" }}>
            <div><label style={css.lbl}>Bestehensgrenze</label><input type="number" value={form.bestehensgrenze} onChange={e=>set("bestehensgrenze",Number(e.target.value))} style={css.inp} /></div>
            <div><label style={css.lbl}>Max. Punkte</label><input type="number" value={form.maxPunkte} onChange={e=>set("maxPunkte",Number(e.target.value))} style={css.inp} /></div>
          </div>
        </div>
        <div style={{ marginTop:12 }}><label style={css.lbl}>Geltungsbereich</label><input value={form.geltungsbereich||""} onChange={e=>set("geltungsbereich",e.target.value)} style={css.inp} /></div>
        <div style={{ marginTop:8 }}><label style={css.lbl}>Bezugsdokumente</label><input value={form.bezugsdokumente||""} onChange={e=>set("bezugsdokumente",e.target.value)} style={css.inp} /></div>
        <label style={{ display:"flex", alignItems:"center", gap:10, marginTop:14, cursor:"pointer" }}>
          <input type="checkbox" checked={form.pflicht} onChange={e=>set("pflicht",e.target.checked)} style={{ width:18,height:18,accentColor:C.blue }} />
          <strong>Pflichtschulung</strong>
        </label>
      </div>

      <div style={{ ...css.notice, display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <span>✦ KI generiert Inhalt, Module, Checkliste und 20 Quiz-Fragen</span>
        <AIBtn onClick={generateAI} loading={ai} label="Alles generieren" />
      </div>
      {aiErr && <p style={{ color:C.bad.text, fontSize:13 }}>{aiErr}</p>}

      <div style={css.section}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <div><label style={css.lbl}>Grundsatz</label><textarea value={form.grundsatz||""} onChange={e=>set("grundsatz",e.target.value)} style={{ ...css.inp, minHeight:70, resize:"vertical" }} /></div>
          <div><label style={css.lbl}>Lernziele</label><textarea value={form.lernziele||""} onChange={e=>set("lernziele",e.target.value)} style={{ ...css.inp, minHeight:70, resize:"vertical" }} /></div>
        </div>
      </div>

      <div style={css.section}>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:12 }}>
          <h3 style={{ margin:0, fontSize:17 }}>Module</h3>
          <button onClick={()=>set("module",[...form.module,{titel:"",inhalt:""}])} style={{ ...css.btnSec, padding:"6px 12px", fontSize:13 }}>+ Modul</button>
        </div>
        {form.module.map((m,i)=>(
          <div key={i} style={{ borderLeft:`4px solid ${C.blue}`, paddingLeft:14, marginBottom:14 }}>
            <div style={{ display:"flex", gap:8, marginBottom:6 }}>
              <input value={m.titel} onChange={e=>setMod(i,"titel",e.target.value)} style={{ ...css.inp, fontWeight:700, marginBottom:0, flex:1 }} placeholder={`Modul ${i+1}`} />
              <button onClick={()=>set("module",form.module.filter((_,j)=>j!==i))} style={css.btnDanger}>✕</button>
            </div>
            <textarea value={m.inhalt} onChange={e=>setMod(i,"inhalt",e.target.value)} style={{ ...css.inp, minHeight:70, resize:"vertical" }} />
          </div>
        ))}
      </div>

      <div style={css.section}>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:12 }}>
          <h3 style={{ margin:0, fontSize:17 }}>Checkliste</h3>
          <button onClick={()=>set("checkliste",[...form.checkliste,""])} style={{ ...css.btnSec, padding:"6px 12px", fontSize:13 }}>+ Punkt</button>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
          {form.checkliste.map((c,i)=>(
            <div key={i} style={{ display:"flex", gap:6 }}>
              <input value={c} onChange={e=>setChk(i,e.target.value)} style={{ ...css.inp, marginBottom:0 }} />
              <button onClick={()=>set("checkliste",form.checkliste.filter((_,j)=>j!==i))} style={css.btnDanger}>✕</button>
            </div>
          ))}
        </div>
      </div>

      <div style={css.section}>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:12 }}>
          <h3 style={{ margin:0, fontSize:17 }}>Quiz-Fragen ({form.fragen.length})</h3>
          <button onClick={()=>set("fragen",[...form.fragen,{q:"",a:["","",""],c:0}])} style={{ ...css.btnSec, padding:"6px 12px", fontSize:13 }}>+ Frage</button>
        </div>
        {form.fragen.map((f,fi)=>(
          <div key={fi} style={{ border:`1px solid ${C.border}`, borderRadius:12, padding:"12px 14px", marginBottom:12 }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
              <strong>Frage {fi+1}</strong>
              <button onClick={()=>set("fragen",form.fragen.filter((_,j)=>j!==fi))} style={css.btnDanger}>✕</button>
            </div>
            <input value={f.q} onChange={e=>setFr(fi,"q",e.target.value)} style={{ ...css.inp, fontWeight:600, marginBottom:10 }} placeholder="Frage eingeben…" />
            {(f.a||[]).map((ans,ai2)=>(
              <div key={ai2} style={{ display:"flex", gap:8, alignItems:"center", marginBottom:7 }}>
                <input type="radio" name={`c_${fi}`} checked={Number(f.c)===ai2} onChange={()=>setFr(fi,"c",ai2)} style={{ width:18,height:18,accentColor:C.blue,flexShrink:0 }} />
                <input value={ans} onChange={e=>setAns(fi,ai2,e.target.value)} style={{ ...css.inp, marginBottom:0 }} placeholder={`Antwort ${String.fromCharCode(65+ai2)}`} />
              </div>
            ))}
          </div>
        ))}
      </div>

      {form.status==="Freigegeben" && <div style={{ ...css.notice, marginBottom:14 }}>⚠️ Freigegebene Schulungen: Caritas-Partnerteam ebenfalls informieren und Vier-Augen-Check vor Freigabe.</div>}
      <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:18 }}>
        <button onClick={onClose} style={css.btnSec}>Abbrechen</button>
        <button onClick={()=>onSave(form)} style={css.btn}>{isNew?"Anlegen":"Speichern"}</button>
      </div>
    </div>
  );
}

// ─── Send Modal ───────────────────────────────────────────────────────────────
function SendModal({ sc, ma, onClose, onSend }) {
  const [sel, setSel] = useState(new Set(sc.empfaenger||[]));
  const [msg, setMsg] = useState(`Liebe Kolleginnen und Kollegen,\n\nbitte bearbeitet die Selbstlern-Unterweisung "${sc.titel}"${sc.pflicht?" (Pflichtschulung)":""}.\n\nNach Abschluss bitte den digitalen Nachweis absenden.\n\nViele Grüße`);
  const [aiL, setAiL] = useState(false);
  const toggle = id=>{const n=new Set(sel);n.has(id)?n.delete(id):n.add(id);setSel(n);};
  const toggleTeam = team=>{const ids=ma.filter(m=>m.team===team).map(m=>m.id);const all=ids.every(id=>sel.has(id));const n=new Set(sel);ids.forEach(id=>all?n.delete(id):n.add(id));setSel(n);};
  const genMsg=async()=>{ setAiL(true); const t=await callAI("Kurze Teams-Nachricht fuer SAPV-Team. Nur Text.",`Einladung zur Selbstlern-Unterweisung "${sc.titel}"${sc.pflicht?", Pflichtschulung":""}. Freundlich, knapp.`).catch(()=>""); if(t)setMsg(t); setAiL(false); };
  const hasCaritas=[...sel].some(id=>ma.find(m=>m.id===id)?.team==="Caritas");
  return (
    <div style={{ fontFamily:"Arial,Helvetica,sans-serif", color:C.text }}>
      <h2 style={{ margin:"0 0 4px", fontSize:20 }}>Schulung versenden</h2>
      <p style={{ color:C.muted, margin:"0 0 18px", fontSize:14 }}>{sc.titel} · {sc.dokNr}</p>
      <div style={{ display:"flex", gap:8, marginBottom:10 }}>
        {["PNRM","Caritas"].map(t=><button key={t} onClick={()=>toggleTeam(t)} style={{ ...css.btnSec, padding:"6px 12px", fontSize:12 }}>Alle {t}</button>)}
        <button onClick={()=>setSel(new Set(ma.map(m=>m.id)))} style={{ ...css.btnSec, padding:"6px 12px", fontSize:12 }}>Alle</button>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:14 }}>
        {ma.map(m=>(
          <label key={m.id} style={{ display:"flex", alignItems:"center", gap:10, border:`1px solid ${sel.has(m.id)?C.blue:C.border}`, background:sel.has(m.id)?C.blueDim:"#fbfcff", borderRadius:11, padding:"9px 13px", cursor:"pointer" }}>
            <input type="checkbox" checked={sel.has(m.id)} onChange={()=>toggle(m.id)} style={{ accentColor:C.blue, width:17, height:17 }} />
            <div><div style={{ fontWeight:700, fontSize:13 }}>{m.name}</div><div style={{ fontSize:11, color:C.muted }}>{m.rolle} · {m.team}</div></div>
          </label>
        ))}
      </div>
      {hasCaritas && <div style={{ ...css.notice, marginBottom:14 }}>⚠️ Caritas-Partnerteam einbezogen — bitte sicherstellen, dass die Schulung dort ebenfalls kommuniziert wird.</div>}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
        <label style={css.lbl}>Teams-Nachricht</label>
        <AIBtn onClick={genMsg} loading={aiL} label="Formulieren" />
      </div>
      <textarea value={msg} onChange={e=>setMsg(e.target.value)} style={{ ...css.inp, minHeight:100, resize:"vertical" }} />
      <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:14 }}>
        <button onClick={onClose} style={css.btnSec}>Abbrechen</button>
        <button onClick={()=>onSend(sc.id,[...sel],msg)} disabled={!sel.size} style={{ ...css.btn, opacity:sel.size?1:.5 }}>An {sel.size} Person{sel.size!==1?"en":""} senden</button>
      </div>
    </div>
  );
}

// ─── Nachweis Modal ───────────────────────────────────────────────────────────
function NachweisModal({ sc, ma, onClose }) {
  const empf=(sc.empfaenger||[]).map(id=>ma.find(m=>m.id===id)).filter(Boolean);
  const nw=sc.nachweise||{};
  const done=empf.filter(m=>nw[m.id]); const open=empf.filter(m=>!nw[m.id]);
  const exportXls=()=>{const rows=empf.map(m=>{const n=nw[m.id];return{Schulung:sc.titel,"Dok-Nr":sc.dokNr,Version:sc.version,Name:m.name,Team:m.team,Rolle:m.rolle,Bestanden:n?"Ja":"Ausstehend",Datum:n?.ts||"–",Punkte:n?`${n.score}/${n.maxP}`:"–",Prüfcode:n?.code||"–"};});const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows),"Nachweise");XLSX.writeFile(wb,`Nachweise_${sc.dokNr}_${new Date().toISOString().slice(0,10)}.xlsx`);};
  return (
    <div style={{ fontFamily:"Arial,Helvetica,sans-serif", color:C.text }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 }}>
        <div><h2 style={{ margin:"0 0 4px", fontSize:20 }}>Nachweise</h2><p style={{ color:C.muted, margin:0, fontSize:14 }}>{sc.titel}</p></div>
        <button onClick={exportXls} style={{ ...css.btnSec, fontSize:13 }}>Export</button>
      </div>
      <div style={{ display:"flex", gap:12, marginBottom:20 }}>
        {[["Versendet",empf.length,C.muted],["Bestanden",done.length,C.good.text],["Ausstehend",open.length,C.warn.text]].map(([l,v,col])=>(
          <div key={l} style={{ flex:1, background:C.white, border:`1px solid ${C.border}`, borderRadius:12, padding:"12px 16px", textAlign:"center" }}>
            <div style={{ fontSize:24, fontWeight:700, color:col }}>{v}</div>
            <div style={{ fontSize:12, color:C.muted }}>{l}</div>
          </div>
        ))}
      </div>
      {open.length>0&&<><div style={{ fontSize:12,fontWeight:700,color:C.warn.text,letterSpacing:1,textTransform:"uppercase",marginBottom:8 }}>Ausstehend</div>{open.map(m=><div key={m.id} style={{ ...css.section,display:"flex",justifyContent:"space-between",padding:"11px 15px",marginBottom:7 }}><div><strong>{m.name}</strong><span style={{ color:C.muted,fontSize:12,marginLeft:10 }}>{m.rolle} · {m.team}</span></div><span style={{ color:C.muted,fontSize:13 }}>Noch nicht abgeschlossen</span></div>)}</>}
      {done.length>0&&<><div style={{ fontSize:12,fontWeight:700,color:C.good.text,letterSpacing:1,textTransform:"uppercase",margin:"16px 0 8px" }}>Abgeschlossen</div>{done.map(m=>{const n=nw[m.id];return(<div key={m.id} style={{ background:C.good.bg,border:`1px solid ${C.good.border}`,borderRadius:12,padding:"11px 15px",marginBottom:7,display:"flex",justifyContent:"space-between" }}><div><strong>{m.name}</strong><span style={{ color:C.muted,fontSize:12,marginLeft:10 }}>{m.rolle}</span></div><div style={{ textAlign:"right",fontSize:12,color:C.good.text }}>✓ {n.score}/{n.maxP} · {n.ts}<br/><span style={{ color:C.muted,fontFamily:"monospace",fontSize:11 }}>{n.code}</span></div></div>);})}</>}
    </div>
  );
}

// ─── Mitarbeiter ──────────────────────────────────────────────────────────────
function MitarbeiterView({ ma, setMa, showToast }) {
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const fileRef = useRef();
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editing==="neu") {
        const newMa = { ...form, id:`k_${Date.now()}` };
        await db.insertMitarbeiter(newMa);
        setMa(m=>[...m, newMa]);
        showToast("Hinzugefügt.");
      } else {
        await db.updateMitarbeiter(form.id, form);
        setMa(m=>m.map(x=>x.id===editing?form:x));
        showToast("Gespeichert.");
      }
      setEditing(null);
    } catch(e) { showToast("Fehler beim Speichern.", "warn"); }
    setSaving(false);
  };

  const del = async (id) => {
    if (!window.confirm("Wirklich löschen?")) return;
    await db.deleteMitarbeiter(id);
    setMa(m=>m.filter(x=>x.id!==id));
    showToast("Gelöscht.");
  };

  const importCSV = e => {
    const file=e.target.files[0]; if(!file)return;
    const r=new FileReader();
    r.onload=async ev=>{ 
      const wb=XLSX.read(ev.target.result,{type:"binary"}); 
      const rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]); 
      const imp=rows.map((r,i)=>({id:`imp_${Date.now()}_${i}`,name:r.Name||r.name||"",rolle:r.Rolle||r.rolle||"Pflegefachkraft",team:r.Team||r.team||"PNRM",email:r.Email||r.email||""})).filter(m=>m.name); 
      const existing = new Set(ma.map(x=>x.name.toLowerCase()));
      const news = imp.filter(x=>!existing.has(x.name.toLowerCase()));
      for (const m of news) { await db.insertMitarbeiter(m); }
      setMa(m=>[...m,...news]); 
      showToast(`${news.length} neue importiert.`); 
    };
    r.readAsBinaryString(file); e.target.value="";
  };

  return (
    <div style={{ fontFamily:"Arial,Helvetica,sans-serif" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
        <h2 style={{ margin:0, fontSize:20 }}>Mitarbeiter</h2>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={()=>fileRef.current.click()} style={{ ...css.btnSec, fontSize:13, padding:"8px 13px" }}>Import</button>
          <input ref={fileRef} type="file" accept=".xlsx,.csv" onChange={importCSV} style={{ display:"none" }} />
          <button onClick={()=>{ setEditing("neu"); setForm({id:`k_${Date.now()}`,name:"",rolle:ROLLEN[0],team:"PNRM",email:""}); }} style={{ ...css.btn, fontSize:13, padding:"8px 14px" }}>+ Neu</button>
        </div>
      </div>
      {editing && (
        <div style={{ ...css.section, marginBottom:18 }}>
          <h3 style={{ margin:"0 0 14px", fontSize:16 }}>{editing==="neu"?"Neue Person":"Bearbeiten"}</h3>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            {[["name","Name"],["email","E-Mail"]].map(([k,l])=><div key={k}><label style={css.lbl}>{l}</label><input value={form[k]||""} onChange={e=>set(k,e.target.value)} style={css.inp} /></div>)}
            <div><label style={css.lbl}>Rolle</label><select value={form.rolle||""} onChange={e=>set("rolle",e.target.value)} style={css.inp}>{ROLLEN.map(r=><option key={r}>{r}</option>)}</select></div>
            <div><label style={css.lbl}>Team</label><select value={form.team||"PNRM"} onChange={e=>set("team",e.target.value)} style={css.inp}><option>PNRM</option><option>Caritas</option></select></div>
          </div>
          <div style={{ display:"flex", gap:8, marginTop:10 }}>
            <button onClick={()=>setEditing(null)} style={css.btnSec}>Abbrechen</button>
            <button onClick={save} disabled={saving} style={{ ...css.btn, opacity:saving?.65:1 }}>{saving?"Speichert…":"Speichern"}</button>
          </div>
        </div>
      )}
      {["PNRM","Caritas"].map(team=>(
        <div key={team}>
          <div style={{ fontSize:12, fontWeight:700, color:C.muted, letterSpacing:1, textTransform:"uppercase", margin:"14px 0 6px" }}>{team} · {ma.filter(m=>m.team===team).length} Personen</div>
          {ma.filter(m=>m.team===team).map(m=>(
            <div key={m.id} style={{ ...css.section, display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8, padding:"11px 16px" }}>
              <div><strong>{m.name}</strong><span style={{ color:C.muted, fontSize:13, marginLeft:12 }}>{m.rolle}</span>{m.email&&<span style={{ color:C.muted, fontSize:12, marginLeft:12 }}>· {m.email}</span>}</div>
              <div style={{ display:"flex", gap:6 }}>
                <button onClick={()=>{ setEditing(m.id); setForm({...m}); }} style={{ ...css.btnSec, padding:"5px 11px", fontSize:12 }}>✏️</button>
                <button onClick={()=>del(m.id)} style={{ ...css.btnDanger, padding:"5px 11px" }}>✕</button>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────
function exportExcel(schulungen, ma) {
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(schulungen.map(s=>({Titel:s.titel,"Dok-Nr":s.dokNr,Version:s.version,Status:s.status,Kategorie:s.kategorie,Pflicht:s.pflicht?"Ja":"Nein","Gültig ab":s.gueltigAb,Versendet:s.empfaenger?.length||0,Nachweise:Object.keys(s.nachweise||{}).length}))),"Schulungen");
  const rows2=[]; schulungen.forEach(s=>(s.empfaenger||[]).forEach(id=>{const m=ma.find(x=>x.id===id);const n=s.nachweise?.[id];rows2.push({Schulung:s.titel,"Dok-Nr":s.dokNr,Name:m?.name||id,Team:m?.team||"",Bestanden:n?"Ja":"Ausstehend",Datum:n?.ts||"–",Prüfcode:n?.code||"–"});}));
  if(rows2.length)XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows2),"Nachweise");
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(ma.map(({...m})=>m)),"Mitarbeiter");
  XLSX.writeFile(wb,`PNRM_Schulungen_${new Date().toISOString().slice(0,10)}.xlsx`);
}


// ─── Auth ─────────────────────────────────────────────────────────────────────
async function signIn(email, password) {
  const res = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=password`, {
    method:"POST",
    headers:{ "apikey":SUPA_KEY, "Content-Type":"application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description||data.msg||"Login fehlgeschlagen");
  return data;
}
async function signOut(token) {
  await fetch(`${SUPA_URL}/auth/v1/logout`, {
    method:"POST", headers:{ "apikey":SUPA_KEY, "Authorization":`Bearer ${token}` },
  }).catch(()=>{});
}
function getSession() { try { return JSON.parse(localStorage.getItem("pnrm_admin")||"null"); } catch { return null; } }
function saveSession(s) { localStorage.setItem("pnrm_admin", JSON.stringify(s)); }
function clearSession() { localStorage.removeItem("pnrm_admin"); }

function LoginModal({ onClose, onLogin }) {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const submit = async () => {
    if (!email||!pw) { setErr("Bitte E-Mail und Passwort eingeben."); return; }
    setLoading(true); setErr("");
    try { const s = await signIn(email, pw); saveSession(s); onLogin(s); }
    catch(e) { setErr(e.message); }
    setLoading(false);
  };
  return (
    <div onClick={onClose} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.45)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,backdropFilter:"blur(4px)" }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:C.white,borderRadius:18,padding:36,width:"90%",maxWidth:400,boxShadow:"0 24px 64px rgba(0,0,0,.18)" }}>
        <h2 style={{ margin:"0 0 6px",fontSize:20,color:C.text }}>Admin-Login</h2>
        <p style={{ margin:"0 0 20px",color:C.muted,fontSize:14 }}>Palliativ Netzwerk Rhein-Maas</p>
        {err&&<div style={{ background:C.bad.bg,border:`1px solid ${C.bad.border}`,color:C.bad.text,padding:"10px 14px",borderRadius:10,marginBottom:14,fontSize:14 }}>{err}</div>}
        <label style={{ display:"block",fontWeight:700,marginBottom:5,fontSize:14 }}>E-Mail</label>
        <input type="email" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} style={{ width:"100%",fontSize:15,padding:11,border:`1px solid ${C.inputBorder}`,borderRadius:11,marginBottom:14,boxSizing:"border-box" }} placeholder="name@pallinetz.de" autoFocus />
        <label style={{ display:"block",fontWeight:700,marginBottom:5,fontSize:14 }}>Passwort</label>
        <input type="password" value={pw} onChange={e=>setPw(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} style={{ width:"100%",fontSize:15,padding:11,border:`1px solid ${C.inputBorder}`,borderRadius:11,marginBottom:20,boxSizing:"border-box" }} />
        <button onClick={submit} disabled={loading} style={{ width:"100%",background:C.blue,color:"#fff",border:0,borderRadius:12,padding:"13px 16px",fontWeight:700,fontSize:16,cursor:loading?"not-allowed":"pointer",opacity:loading?.65:1 }}>
          {loading?"Wird angemeldet…":"Anmelden"}
        </button>
      </div>
    </div>
  );
}


// ─── Passwort ändern ──────────────────────────────────────────────────────────
async function changePassword(token, newPassword) {
  const res = await fetch(`${SUPA_URL}/auth/v1/user`, {
    method:"PUT",
    headers:{ "apikey":SUPA_KEY, "Authorization":`Bearer ${token}`, "Content-Type":"application/json" },
    body: JSON.stringify({ password: newPassword }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description||data.msg||"Fehler beim Ändern");
  return data;
}

function PwChangeModal({ session, onClose, showToast }) {
  const [current, setCurrent] = useState("");
  const [neu, setNeu] = useState("");
  const [neu2, setNeu2] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    if (!neu||!neu2) { setErr("Bitte neues Passwort zweimal eingeben."); return; }
    if (neu !== neu2) { setErr("Passwörter stimmen nicht überein."); return; }
    if (neu.length < 8) { setErr("Passwort muss mindestens 8 Zeichen lang sein."); return; }
    setLoading(true); setErr("");
    try {
      await changePassword(session.access_token, neu);
      showToast("✓ Passwort erfolgreich geändert.");
      onClose();
    } catch(e) { setErr(e.message); }
    setLoading(false);
  };

  return (
    <div onClick={onClose} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.45)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,backdropFilter:"blur(4px)" }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:C.white,borderRadius:18,padding:32,width:"90%",maxWidth:400,boxShadow:"0 24px 64px rgba(0,0,0,.18)" }}>
        <h2 style={{ margin:"0 0 6px",fontSize:20 }}>Passwort ändern</h2>
        <p style={{ margin:"0 0 20px",color:C.muted,fontSize:14 }}>{session?.user?.email}</p>
        {err&&<div style={{ background:C.bad.bg,border:`1px solid ${C.bad.border}`,color:C.bad.text,padding:"10px 14px",borderRadius:10,marginBottom:14,fontSize:14 }}>{err}</div>}
        {[["Neues Passwort",neu,setNeu],["Neues Passwort wiederholen",neu2,setNeu2]].map(([label,val,setter],i)=>(
          <div key={i}>
            <label style={{ display:"block",fontWeight:700,marginBottom:5,fontSize:14 }}>{label}</label>
            <input type="password" value={val} onChange={e=>setter(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} style={{ width:"100%",fontSize:15,padding:11,border:`1px solid ${C.inputBorder}`,borderRadius:11,marginBottom:14,boxSizing:"border-box" }} placeholder="Mindestens 8 Zeichen" />
          </div>
        ))}
        <div style={{ display:"flex", gap:10, marginTop:6 }}>
          <button onClick={onClose} style={{ ...css.btnSec, flex:1 }}>Abbrechen</button>
          <button onClick={submit} disabled={loading} style={{ ...css.btn, flex:1, opacity:loading?.65:1 }}>{loading?"Wird gespeichert…":"Speichern"}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Wissensdatenbank ─────────────────────────────────────────────────────────

const dbW = {
  getKategorien: () => supaFetch("/wissen_kategorien?order=sortierung.asc"),
  getArtikel: () => supaFetch("/wissen_artikel?order=wichtig.desc,updated_at.desc"),
  getDateien: (artikelId) => supaFetch(`/wissen_dateien?artikel_id=eq.${artikelId}`),
  insertArtikel: (a) => supaFetch("/wissen_artikel", { method:"POST", body:JSON.stringify(a) }),
  updateArtikel: (id, a) => supaFetch(`/wissen_artikel?id=eq.${id}`, { method:"PATCH", body:JSON.stringify(a) }),
  deleteArtikel: (id) => supaFetch(`/wissen_artikel?id=eq.${id}`, { method:"DELETE", prefer:"return=minimal" }),
  insertKategorie: (k) => supaFetch("/wissen_kategorien", { method:"POST", body:JSON.stringify(k) }),
  uploadDatei: async (artikelId, file) => {
    const ext = file.name.split('.').pop();
    const path = `wissen/${artikelId}/${Date.now()}_${file.name}`;
    const res = await fetch(`${SUPA_URL}/storage/v1/object/pnrm-wissen/${path}`, {
      method:"POST",
      headers: { "apikey": SUPA_KEY, "Authorization": `Bearer ${SUPA_KEY}`, "Content-Type": file.type },
      body: file,
    });
    if (!res.ok) throw new Error("Upload fehlgeschlagen");
    const url = `${SUPA_URL}/storage/v1/object/public/pnrm-wissen/${path}`;
    await supaFetch("/wissen_dateien", { method:"POST", body:JSON.stringify({ artikel_id:artikelId, name:file.name, typ:ext, url, groesse:file.size }) });
    return url;
  },
};

function renderMarkdown(text) {
  if (!text) return "";
  return text
    .replace(/^## (.+)$/gm, '<h3 style="color:#2459b8;margin:16px 0 8px">$1</h3>')
    .replace(/^### (.+)$/gm, '<h4 style="margin:12px 0 6px">$1</h4>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^(\d+\. .+)$/gm, '<div style="margin:4px 0 4px 16px">$1</div>')
    .replace(/^- (.+)$/gm, '<div style="margin:3px 0 3px 16px">• $1</div>')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');
}

function ArtikelDetail({ artikel, dateien, onClose, onEdit, isAdmin }) {
  return (
    <div style={{ fontFamily:"Arial,Helvetica,sans-serif", color:"#172033" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 }}>
        <div>
          {artikel.wichtig && <span style={{ background:"#fff1f0", color:"#842029", border:"1px solid #ffccc7", borderRadius:999, padding:"3px 10px", fontSize:11, fontWeight:700, marginRight:8 }}>⚠️ WICHTIG</span>}
          <span style={{ background:"#eef5ff", color:"#2459b8", borderRadius:999, padding:"3px 10px", fontSize:11, fontWeight:700 }}>{artikel.unterkategorie||"Allgemein"}</span>
        </div>
        {isAdmin&&<button onClick={onEdit} style={{ background:"#eef5ff", color:"#2459b8", border:"1px solid #d7e0ec", borderRadius:10, padding:"7px 14px", fontWeight:700, fontSize:13, cursor:"pointer" }}>✏️ Bearbeiten</button>}
      </div>
      <h2 style={{ margin:"0 0 16px", fontSize:22 }}>{artikel.titel}</h2>
      <div style={{ background:"#fbfcff", border:"1px solid #d7e0ec", borderRadius:12, padding:"18px 20px", marginBottom:16, lineHeight:1.7, fontSize:15 }}
        dangerouslySetInnerHTML={{ __html: renderMarkdown(artikel.inhalt) }} />
      {artikel.schlagwoerter?.length > 0 && (
        <div style={{ marginBottom:16 }}>
          {artikel.schlagwoerter.map(s=><span key={s} style={{ background:"#f0f4ff", color:"#5f6d82", borderRadius:999, padding:"3px 10px", fontSize:12, marginRight:6 }}>#{s}</span>)}
        </div>
      )}
      {dateien?.length > 0 && (
        <div>
          <h3 style={{ fontSize:16, margin:"0 0 10px" }}>📎 Dateien</h3>
          {dateien.map(d=>(
            <div key={d.id} style={{ border:"1px solid #d7e0ec", borderRadius:10, padding:"10px 14px", marginBottom:8, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontSize:14 }}>📄 {d.name}</span>
              <button onClick={()=>window.open(d.url,"_blank")} style={{ background:"#eef5ff", color:"#2459b8", border:"1px solid #d7e0ec", borderRadius:8, padding:"5px 12px", fontWeight:700, fontSize:12, cursor:"pointer" }}>
                {["pdf"].includes(d.typ?.toLowerCase()) ? "📖 Anzeigen" : ["jpg","jpeg","png","gif","webp"].includes(d.typ?.toLowerCase()) ? "🖼 Anzeigen" : "▶️ Öffnen"}
              </button>
            </div>
          ))}
        </div>
      )}
      <p style={{ color:"#5f6d82", fontSize:12, marginTop:16 }}>Autor: {artikel.autor||"–"} · Zuletzt aktualisiert: {new Date(artikel.updated_at).toLocaleDateString("de-DE")}</p>
    </div>
  );
}

function ArtikelForm({ artikel, kategorien, onSave, onClose }) {
  const isNew = !artikel;
  const [form, setForm] = useState(artikel || { titel:"", inhalt:"", kategorie_id:"", unterkategorie:"", schlagwoerter:[], autor:"Alexander Pfeiffer", status:"Entwurf", wichtig:false });
  const [tagInput, setTagInput] = useState("");
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const addTag = () => { if(tagInput.trim()) { set("schlagwoerter",[...(form.schlagwoerter||[]),tagInput.trim().toLowerCase()]); setTagInput(""); } };
  const removeTag = (t) => set("schlagwoerter",(form.schlagwoerter||[]).filter(x=>x!==t));

  const handleFiles = async (savedId) => {
    setUploading(true);
    for (const f of files) {
      try { await dbW.uploadDatei(savedId, f); } catch(e) { console.error(e); }
    }
    setUploading(false);
  };

  const save = async () => {
    if (!form.titel.trim()) { alert("Bitte Titel eingeben."); return; }
    await onSave(form, handleFiles);
  };

  return (
    <div style={{ fontFamily:"Arial,Helvetica,sans-serif", color:"#172033" }}>
      <h2 style={{ margin:"0 0 18px", fontSize:20 }}>{isNew?"Neuer Artikel":"Artikel bearbeiten"}</h2>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
        <div style={{ gridColumn:"span 2" }}>
          <label style={{ display:"block", fontWeight:700, marginBottom:5, fontSize:14 }}>Titel</label>
          <input value={form.titel} onChange={e=>set("titel",e.target.value)} style={{ width:"100%", fontSize:15, padding:11, border:"1px solid #cbd6e6", borderRadius:11, background:"#fff", color:"#172033", boxSizing:"border-box" }} placeholder="z.B. Vorgehen bei Sturzunfall" />
        </div>
        <div>
          <label style={{ display:"block", fontWeight:700, marginBottom:5, fontSize:14 }}>Kategorie</label>
          <select value={form.kategorie_id||""} onChange={e=>set("kategorie_id",Number(e.target.value))} style={{ width:"100%", fontSize:15, padding:11, border:"1px solid #cbd6e6", borderRadius:11, background:"#fff", color:"#172033", boxSizing:"border-box" }}>
            <option value="">Bitte wählen</option>
            {kategorien.map(k=><option key={k.id} value={k.id}>{k.icon} {k.name}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display:"block", fontWeight:700, marginBottom:5, fontSize:14 }}>Unterkategorie</label>
          <input value={form.unterkategorie||""} onChange={e=>set("unterkategorie",e.target.value)} style={{ width:"100%", fontSize:15, padding:11, border:"1px solid #cbd6e6", borderRadius:11, background:"#fff", boxSizing:"border-box" }} placeholder="z.B. Notfallprotokoll" />
        </div>
        <div>
          <label style={{ display:"block", fontWeight:700, marginBottom:5, fontSize:14 }}>Autor</label>
          <input value={form.autor||""} onChange={e=>set("autor",e.target.value)} style={{ width:"100%", fontSize:15, padding:11, border:"1px solid #cbd6e6", borderRadius:11, background:"#fff", boxSizing:"border-box" }} />
        </div>
        <div>
          <label style={{ display:"block", fontWeight:700, marginBottom:5, fontSize:14 }}>Status</label>
          <select value={form.status} onChange={e=>set("status",e.target.value)} style={{ width:"100%", fontSize:15, padding:11, border:"1px solid #cbd6e6", borderRadius:11, background:"#fff", boxSizing:"border-box" }}>
            <option>Entwurf</option><option>Freigegeben</option><option>Archiviert</option>
          </select>
        </div>
      </div>
      <label style={{ display:"block", fontWeight:700, marginBottom:5, fontSize:14 }}>Inhalt (Markdown: ## Überschrift, **fett**, - Liste)</label>
      <textarea value={form.inhalt||""} onChange={e=>set("inhalt",e.target.value)} rows={10} style={{ width:"100%", fontSize:14, padding:11, border:"1px solid #cbd6e6", borderRadius:11, background:"#fff", resize:"vertical", fontFamily:"monospace", boxSizing:"border-box" }} placeholder="## Abschnitt&#10;&#10;Inhalt hier eingeben...&#10;&#10;- Listenpunkt 1&#10;- Listenpunkt 2" />
      <div style={{ marginTop:12 }}>
        <label style={{ display:"block", fontWeight:700, marginBottom:5, fontSize:14 }}>Schlagwörter</label>
        <div style={{ display:"flex", gap:8, marginBottom:8 }}>
          <input value={tagInput} onChange={e=>setTagInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addTag()} style={{ flex:1, fontSize:14, padding:9, border:"1px solid #cbd6e6", borderRadius:10, background:"#fff" }} placeholder="Schlagwort eingeben + Enter" />
          <button onClick={addTag} style={{ background:"#eef5ff", color:"#2459b8", border:"1px solid #d7e0ec", borderRadius:10, padding:"9px 14px", fontWeight:700, cursor:"pointer" }}>+</button>
        </div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
          {(form.schlagwoerter||[]).map(t=><span key={t} onClick={()=>removeTag(t)} style={{ background:"#f0f4ff", color:"#5f6d82", borderRadius:999, padding:"3px 10px", fontSize:12, cursor:"pointer" }}>#{t} ✕</span>)}
        </div>
      </div>
      <label style={{ display:"flex", alignItems:"center", gap:10, marginTop:14, cursor:"pointer" }}>
        <input type="checkbox" checked={form.wichtig} onChange={e=>set("wichtig",e.target.checked)} style={{ width:18,height:18,accentColor:"#c0392b" }} />
        <strong style={{ color:"#c0392b" }}>Als wichtig markieren</strong> (erscheint ganz oben)
      </label>
      <div style={{ marginTop:14 }}>
        <label style={{ display:"block", fontWeight:700, marginBottom:5, fontSize:14 }}>📎 Dateien anhängen (PDF, PPT, Bilder)</label>
        <button onClick={()=>fileRef.current.click()} style={{ background:"#eef5ff", color:"#2459b8", border:"1px solid #d7e0ec", borderRadius:10, padding:"9px 14px", fontWeight:700, fontSize:13, cursor:"pointer" }}>Dateien auswählen</button>
        <input ref={fileRef} type="file" multiple accept=".pdf,.ppt,.pptx,.doc,.docx,.jpg,.jpeg,.png" onChange={e=>setFiles([...e.target.files])} style={{ display:"none" }} />
        {files.length>0 && <div style={{ marginTop:8 }}>{[...files].map((f,i)=><div key={i} style={{ fontSize:13, color:"#5f6d82" }}>📄 {f.name}</div>)}</div>}
      </div>
      <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:20 }}>
        <button onClick={onClose} style={{ background:"#eef5ff", color:"#1f365f", border:"1px solid #d7e0ec", borderRadius:12, padding:"11px 16px", fontWeight:700, fontSize:14, cursor:"pointer" }}>Abbrechen</button>
        <button onClick={save} disabled={uploading} style={{ background:"#2459b8", color:"#fff", border:0, borderRadius:12, padding:"11px 16px", fontWeight:700, fontSize:15, cursor:"pointer", opacity:uploading?.65:1 }}>{uploading?"Wird gespeichert…":"Speichern"}</button>
      </div>
    </div>
  );
}

function WissenTab({ showToast, isAdmin }) {
  const [kategorien, setKategorien] = useState([]);
  const [artikel, setArtikel] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeKat, setActiveKat] = useState(null);
  const [modal, setModal] = useState(null);
  const [activeArtikel, setActiveArtikel] = useState(null);
  const [dateien, setDateien] = useState([]);

  useEffect(()=>{
    Promise.all([dbW.getKategorien(), dbW.getArtikel()]).then(([k,a])=>{
      setKategorien(k||[]); setArtikel(a||[]); setLoading(false);
    }).catch(()=>setLoading(false));
  },[]);

  const openArtikel = async (a) => {
    setActiveArtikel(a);
    const d = await dbW.getDateien(a.id).catch(()=>[]);
    setDateien(d||[]);
    setModal("detail");
  };

  const saveArtikel = async (data, uploadFn) => {
    try {
      if (activeArtikel && modal==="edit") {
        await dbW.updateArtikel(activeArtikel.id, data);
        setArtikel(a=>a.map(x=>x.id===activeArtikel.id?{...x,...data}:x));
        if (uploadFn) await uploadFn(activeArtikel.id);
        showToast("Artikel gespeichert.");
      } else {
        const res = await dbW.insertArtikel(data);
        const newA = res[0];
        if (uploadFn) await uploadFn(newA.id);
        setArtikel(a=>[newA,...a]);
        showToast("Artikel angelegt.");
      }
      setModal(null); setActiveArtikel(null);
    } catch(e) { showToast("Fehler: " + e.message, "warn"); }
  };

  const deleteArtikel = async (id) => {
    if (!window.confirm("Artikel wirklich löschen?")) return;
    await dbW.deleteArtikel(id);
    setArtikel(a=>a.filter(x=>x.id!==id));
    showToast("Artikel gelöscht.");
    setModal(null);
  };

  const filtered = artikel.filter(a=>{
    const katMatch = !activeKat || a.kategorie_id===activeKat;
    if (!search) return katMatch;
    const q = search.toLowerCase();
    return katMatch && (
      a.titel?.toLowerCase().includes(q) ||
      a.inhalt?.toLowerCase().includes(q) ||
      a.unterkategorie?.toLowerCase().includes(q) ||
      (a.schlagwoerter||[]).some(s=>s.includes(q))
    );
  });

  const wichtig = filtered.filter(a=>a.wichtig);
  const normal = filtered.filter(a=>!a.wichtig);

  if (loading) return <div style={{ textAlign:"center", padding:60, color:"#5f6d82" }}>⏳ Lade Wissensdatenbank...</div>;

  return (
    <div style={{ fontFamily:"Arial,Helvetica,sans-serif" }}>
      {/* Suche */}
      <div style={{ position:"relative", marginBottom:20 }}>
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="🔍 Suchen... z.B. Unfall, Notfall, Fahrzeug, Passwort"
          style={{ width:"100%", fontSize:16, padding:"13px 16px", border:"2px solid #2459b8", borderRadius:14, background:"#fff", color:"#172033", boxSizing:"border-box", boxShadow:"0 4px 16px rgba(36,89,184,.1)" }} />
        {search && <button onClick={()=>setSearch("")} style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", fontSize:18, color:"#5f6d82", cursor:"pointer" }}>✕</button>}
      </div>

      {/* Kategorien */}
      <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:20 }}>
        <button onClick={()=>setActiveKat(null)} style={{ background:!activeKat?"#2459b8":"#eef5ff", color:!activeKat?"#fff":"#2459b8", border:"1px solid #bed0ed", borderRadius:999, padding:"7px 16px", fontWeight:700, fontSize:13, cursor:"pointer" }}>Alle</button>
        {kategorien.map(k=>(
          <button key={k.id} onClick={()=>setActiveKat(activeKat===k.id?null:k.id)} style={{ background:activeKat===k.id?k.farbe||"#2459b8":"#eef5ff", color:activeKat===k.id?"#fff":"#2459b8", border:"1px solid #bed0ed", borderRadius:999, padding:"7px 16px", fontWeight:700, fontSize:13, cursor:"pointer" }}>
            {k.icon} {k.name}
          </button>
        ))}
        {isAdmin&&<button onClick={()=>{ setActiveArtikel(null); setModal("neu"); }} style={{ background:"#2459b8", color:"#fff", border:0, borderRadius:999, padding:"7px 16px", fontWeight:700, fontSize:13, cursor:"pointer", marginLeft:"auto" }}>+ Neuer Artikel</button>}
      </div>

      {/* Suchergebnis-Info */}
      {search && <p style={{ color:"#5f6d82", fontSize:14, marginBottom:12 }}>{filtered.length} Ergebnis{filtered.length!==1?"se":""} für "{search}"</p>}

      {/* Wichtige Artikel */}
      {wichtig.length>0 && (
        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:12, fontWeight:700, color:"#842029", letterSpacing:1, textTransform:"uppercase", marginBottom:8 }}>⚠️ Wichtig</div>
          {wichtig.map(a=><ArtikelKarte key={a.id} a={a} kategorien={kategorien} onClick={()=>openArtikel(a)} />)}
        </div>
      )}

      {/* Normale Artikel */}
      {normal.length>0 && (
        <div>
          {wichtig.length>0 && <div style={{ fontSize:12, fontWeight:700, color:"#5f6d82", letterSpacing:1, textTransform:"uppercase", marginBottom:8 }}>Alle Artikel</div>}
          {normal.map(a=><ArtikelKarte key={a.id} a={a} kategorien={kategorien} onClick={()=>openArtikel(a)} />)}
        </div>
      )}

      {filtered.length===0 && (
        <div style={{ textAlign:"center", padding:60, color:"#5f6d82" }}>
          {search ? `Keine Ergebnisse für "${search}" — anderen Suchbegriff versuchen.` : "Noch keine Artikel — ersten Artikel anlegen."}
        </div>
      )}

      {/* Modals */}
      {modal==="detail" && activeArtikel && (
        <Modal onClose={()=>setModal(null)} wide>
          <ArtikelDetail artikel={activeArtikel} dateien={dateien} onClose={()=>setModal(null)} onEdit={()=>setModal("edit")} isAdmin={isAdmin} />
          <div style={{ borderTop:"1px solid #d7e0ec", marginTop:16, paddingTop:14, display:"flex", justifyContent:"flex-end" }}>
            {isAdmin&&<button onClick={()=>deleteArtikel(activeArtikel.id)} style={{ background:"#fff1f0", color:"#842029", border:"1px solid #ffccc7", borderRadius:10, padding:"8px 14px", fontWeight:700, fontSize:13, cursor:"pointer" }}>🗑 Löschen</button>}
          </div>
        </Modal>
      )}
      {(modal==="neu"||modal==="edit") && (
        <Modal onClose={()=>setModal(null)} wide>
          <ArtikelForm artikel={modal==="edit"?activeArtikel:null} kategorien={kategorien} onSave={saveArtikel} onClose={()=>setModal(null)} />
        </Modal>
      )}
    </div>
  );
}

function ArtikelKarte({ a, kategorien, onClick }) {
  const kat = kategorien.find(k=>k.id===a.kategorie_id);
  return (
    <div onClick={onClick} style={{ background:"#fff", border:"1px solid #d7e0ec", borderRadius:14, padding:"14px 18px", marginBottom:10, cursor:"pointer", boxShadow:"0 4px 14px rgba(16,24,40,.05)", transition:"box-shadow .15s" }}
      onMouseEnter={e=>e.currentTarget.style.boxShadow="0 6px 20px rgba(36,89,184,.12)"}
      onMouseLeave={e=>e.currentTarget.style.boxShadow="0 4px 14px rgba(16,24,40,.05)"}>
      <div style={{ display:"flex", gap:8, marginBottom:6, flexWrap:"wrap", alignItems:"center" }}>
        {kat && <span style={{ background:kat.farbe+"22", color:kat.farbe, borderRadius:999, padding:"3px 10px", fontSize:11, fontWeight:700 }}>{kat.icon} {kat.name}</span>}
        {a.unterkategorie && <span style={{ background:"#f0f4ff", color:"#5f6d82", borderRadius:999, padding:"3px 10px", fontSize:11 }}>{a.unterkategorie}</span>}
        {a.status==="Freigegeben" && <span style={{ background:"#eefaf2", color:"#0f5331", borderRadius:999, padding:"3px 10px", fontSize:11, fontWeight:700 }}>Freigegeben</span>}
      </div>
      <h3 style={{ margin:"0 0 4px", fontSize:16 }}>{a.titel}</h3>
      {a.schlagwoerter?.length>0 && <div style={{ marginTop:6 }}>{a.schlagwoerter.slice(0,4).map(s=><span key={s} style={{ color:"#5f6d82", fontSize:12, marginRight:8 }}>#{s}</span>)}</div>}
    </div>
  );
}


// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [session, setSession] = useState(()=>getSession());
  const [showLogin, setShowLogin] = useState(false);
  const [showPwChange, setShowPwChange] = useState(false);
  const isAdmin = !!session?.access_token;
  const handleLogin = (s) => { setSession(s); setShowLogin(false); };
  const handleLogout = async () => { await signOut(session?.access_token); clearSession(); setSession(null); };
  const [schulungen, setSchulungen] = useState([]);
  const [ma, setMa] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null);
  const [active, setActive] = useState(null);
  const [tab, setTab] = useState("schulungen");
  const [filter, setFilter] = useState("alle");
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState(null);
  const importRef = useRef();

  const showToast = (msg, type="success") => { setToast({msg,type}); setTimeout(()=>setToast(null),5000); };

  // Daten laden
  const loadData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [sc, mitarb] = await Promise.all([db.getSchulungen(), db.getMitarbeiter()]);
      setSchulungen((sc||[]).map(fromDb));
      setMa(mitarb||[]);
    } catch(e) {
      setError("Verbindung zur Datenbank fehlgeschlagen. Bitte Seite neu laden.");
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const saveSchul = async data => {
    try {
      if (active && modal==="edit") {
        await db.updateSchulung(active.id, data);
        setSchulungen(s=>s.map(x=>x.id===active.id?{...active,...data}:x));
        showToast("Gespeichert.");
      } else {
        const res = await db.insertSchulung(data);
        const newSc = fromDb(res[0]);
        setSchulungen(s=>[newSc,...s]);
        showToast("Schulung angelegt.");
      }
      setModal(null); setActive(null);
    } catch(e) { showToast("Fehler beim Speichern: " + e.message, "warn"); }
  };

  const sendSchul = async (id, empf) => {
    const sc = schulungen.find(x=>x.id===id);
    await db.updateSchulung(id, {...sc, empfaenger: empf});
    setSchulungen(s=>s.map(x=>x.id===id?{...x,empfaenger:empf}:x));
    setModal(null); setActive(null);
    const hasC = empf.some(eid=>ma.find(m=>m.id===eid)?.team==="Caritas");
    showToast(`✓ An ${empf.length} Personen versendet.`);
    if(hasC) setTimeout(()=>showToast("⚠️ Caritas-Partnerteam einbezogen — bitte offizielle Weitergabe sicherstellen.","warn"),5500);
  };

  const saveNachweis = async (schulungId, nw) => {
    const sc = schulungen.find(x=>x.id===schulungId);
    const maMatch = ma.find(m=>m.name.toLowerCase()===nw.name.toLowerCase());
    const key = maMatch?.id || nw.name;
    const newNachweise = { ...(sc.nachweise||{}), [key]: nw };
    await db.updateSchulung(schulungId, {...sc, nachweise: newNachweise});
    setSchulungen(s=>s.map(x=>x.id===schulungId?{...x,nachweise:newNachweise}:x));
    showToast(`✓ Nachweis gespeichert. Code: ${nw.code}`);
  };

  const importSchulungJSON = e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async ev => {
      try {
        const data = JSON.parse(ev.target.result);
        const exists = schulungen.find(x=>x.dokNr && x.dokNr===data.dokNr);
        if (exists) { showToast(`⚠️ Schulung mit Dok.-Nr. ${data.dokNr} bereits vorhanden.`, "warn"); return; }
        const res = await db.insertSchulung(data);
        const newSc = fromDb(res[0]);
        setSchulungen(s=>[newSc,...s]);
        showToast(`✓ "${data.titel}" erfolgreich importiert.`);
      } catch(e) { showToast("Fehler: Ungültige JSON-Datei. " + e.message, "warn"); }
    };
    reader.readAsText(file, "UTF-8");
    e.target.value = "";
  };

  const visibleSchulungen = isAdmin ? schulungen : schulungen.filter(s=>s.status==="Freigegeben");
  const filtered = visibleSchulungen.filter(s=>{
    const mF = filter==="alle"||s.status===filter||(filter==="Pflicht"&&s.pflicht)||(filter==="Versendet"&&s.empfaenger?.length>0);
    const mS = !search||s.titel.toLowerCase().includes(search.toLowerCase())||s.dokNr?.toLowerCase().includes(search.toLowerCase());
    return mF&&mS;
  });

  const stats = [
    {l:"Schulungen",v:schulungen.length},{l:"Freigegeben",v:schulungen.filter(s=>s.status==="Freigegeben").length},
    {l:"Versendet",v:schulungen.filter(s=>s.empfaenger?.length>0).length},
    {l:"Nachweise",v:schulungen.reduce((a,s)=>a+Object.keys(s.nachweise||{}).length,0)},
    {l:"Mitarbeiter",v:ma.length},
  ];

  return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"Arial,Helvetica,sans-serif", color:C.text }}>
      <header style={{ background:C.white, borderBottom:`1px solid ${C.border}`, position:"sticky", top:0, zIndex:10 }}>
        <div style={{ maxWidth:980, margin:"0 auto", padding:"14px 20px", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:12 }}>
          <div>
            <div style={{ fontSize:10, color:C.blue, fontWeight:700, letterSpacing:2, textTransform:"uppercase" }}>Palliativ Netzwerk Rhein-Maas GmbH & Co. KG</div>
            <h1 style={{ margin:"2px 0 0", fontSize:22, fontWeight:700 }}>Schulungsverwaltung</h1>
            <p style={{ margin:0, color:C.muted, fontSize:13 }}>SAPV · Kreis Kleve & Moers · DIN EN 15224</p>
          </div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
            <div style={{ width:8, height:8, borderRadius:"50%", background: error?"#e05c5c":loading?"#e0a95c":"#2eb88a" }} title={error?"Fehler":loading?"Lädt...":"Verbunden"} />
            {isAdmin&&<span style={{ fontSize:12, color:"#0f5331", background:"#eefaf2", border:"1px solid #b8e2c7", borderRadius:999, padding:"4px 10px", fontWeight:700 }}>🔒 Admin</span>}
            {isAdmin&&<button onClick={()=>exportExcel(schulungen,ma)} style={{ ...css.btnSec, fontSize:13, padding:"8px 14px" }}>Excel-Export</button>}
            {isAdmin&&tab==="schulungen"&&<button onClick={()=>importRef.current.click()} style={{ ...css.btnSec, fontSize:13, padding:"8px 14px" }}>JSON importieren</button>}
            <input ref={importRef} type="file" accept=".json" onChange={importSchulungJSON} style={{ display:"none" }} />
            {isAdmin&&tab==="schulungen"&&<button onClick={()=>{setActive(null);setModal("neu");}} style={css.btn}>+ Neue Schulung</button>}
            {isAdmin
              ? <><button onClick={()=>setShowPwChange(true)} style={{ ...css.btnSec, fontSize:13, padding:"8px 14px" }}>🔑 Passwort</button><button onClick={handleLogout} style={{ ...css.btnSec, fontSize:13, padding:"8px 14px", color:C.bad.text, borderColor:C.bad.border }}>Abmelden</button></>
              : <button onClick={()=>setShowLogin(true)} style={{ ...css.btnSec, fontSize:13, padding:"8px 14px" }}>🔒 Admin</button>
            }
          </div>
        </div>
      </header>

      <div style={{ maxWidth:980, margin:"0 auto", padding:"20px" }}>
        {error && <div style={{ ...css.bad, marginBottom:16 }}>{error} <button onClick={loadData} style={{ ...css.btn, fontSize:13, marginLeft:12 }}>Neu laden</button></div>}

        <div style={{ display:"flex", gap:10, marginBottom:18, flexWrap:"wrap" }}>
          {stats.map(({l,v})=>(
            <div key={l} style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:12, padding:"10px 18px" }}>
              <div style={{ fontSize:22, fontWeight:700, color:C.blue }}>{v}</div>
              <div style={{ fontSize:12, color:C.muted }}>{l}</div>
            </div>
          ))}
        </div>

        <div style={{ display:"flex", borderBottom:`2px solid ${C.border}`, marginBottom:18 }}>
          {(isAdmin ? [["schulungen","Schulungen"],["wissen","Wissen"],["mitarbeiter","Mitarbeiter"]] : [["schulungen","Schulungen"],["wissen","Wissen"]]).map(([id,label])=>(
            <button key={id} onClick={()=>setTab(id)} style={{ background:"none", border:"none", borderBottom:tab===id?`3px solid ${C.blue}`:"3px solid transparent", color:tab===id?C.blue:C.muted, padding:"10px 18px", cursor:"pointer", fontSize:14, fontWeight:tab===id?700:400, marginBottom:-2 }}>{label}</button>
          ))}
        </div>

        {loading ? <Spinner /> : tab==="schulungen" ? (
          <>
            <div style={{ display:"flex", gap:8, marginBottom:14, flexWrap:"wrap", alignItems:"center" }}>
              {["alle","Freigegeben","Entwurf","Pflicht","Versendet"].map(f=>(
                <button key={f} onClick={()=>setFilter(f)} style={{ background:filter===f?C.blue:C.blueDim, color:filter===f?C.white:C.blue, border:`1px solid ${filter===f?C.blue:C.blueBorder}`, padding:"6px 14px", borderRadius:999, cursor:"pointer", fontSize:12, fontWeight:700 }}>{f}</button>
              ))}
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Titel oder Dok.-Nr. suchen…" style={{ ...css.inp, flex:1, minWidth:160, padding:"7px 13px" }} />
            </div>
            {filtered.length===0 && !loading && <p style={{ color:C.muted, textAlign:"center", padding:40 }}>Keine Schulungen gefunden.</p>}
            {filtered.map(sc=>{
              const nwCount=Object.keys(sc.nachweise||{}).length; const sent=sc.empfaenger?.length||0;
              return (
                <div key={sc.id} style={{ ...css.section, cursor:"pointer" }} onClick={()=>{setActive(sc);setModal("player");}}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:12 }}>
                    <div style={{ flex:1 }}>
                      <div style={{ display:"flex", gap:7, marginBottom:7, flexWrap:"wrap", alignItems:"center" }}>
                        <span style={css.badge}>{sc.kategorie}</span>
                        <span style={{ ...css.badge, background:sc.status==="Freigegeben"?C.good.bg:C.warn.bg, color:sc.status==="Freigegeben"?C.good.text:C.warn.text }}>{sc.status}</span>
                        {sc.pflicht&&<span style={{ ...css.badge, background:C.bad.bg, color:C.bad.text }}>Pflicht</span>}
                        {sent>0&&<span style={{ fontSize:12, color:C.blue }}>✓ {sent} Empf. · {nwCount}/{sent} Nachweise</span>}
                      </div>
                      <h3 style={{ margin:"0 0 3px", fontSize:16 }}>{sc.titel}</h3>
                      <p style={{ margin:0, fontSize:12, color:C.muted }}>{sc.dokNr} · Version {sc.version} · Gültig ab {sc.gueltigAb}</p>
                    </div>
                    <div style={{ display:"flex", gap:8 }} onClick={e=>e.stopPropagation()}>
                      {isAdmin&&<button onClick={()=>{setActive(sc);setModal("edit");}} style={{ ...css.btnSec, padding:"7px 13px", fontSize:13 }}>✏️</button>}
                      {isAdmin&&sent>0&&<button onClick={()=>{setActive(sc);setModal("nw");}} style={{ ...css.btnSec, padding:"7px 13px", fontSize:13 }}>📄</button>}
                      {isAdmin&&sc.status==="Freigegeben"&&<button onClick={()=>{setActive(sc);setModal("send");}} style={{ ...css.btn, padding:"7px 13px", fontSize:13 }}>Senden</button>}
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        ) : null}
        {tab==="mitarbeiter" && <MitarbeiterView ma={ma} setMa={setMa} showToast={showToast} />}
        {tab==="wissen" && <WissenTab showToast={showToast} isAdmin={isAdmin} />}
      </div>

      {(modal==="neu"||modal==="edit")&&<Modal onClose={()=>setModal(null)} wide><SchulungForm schulung={modal==="edit"?active:null} onSave={saveSchul} onClose={()=>setModal(null)} /></Modal>}
      {modal==="player"&&active&&<Modal onClose={()=>setModal(null)} wide><SchulungsPlayer sc={active} onClose={()=>setModal(null)} onNachweis={saveNachweis} /></Modal>}
      {modal==="send"&&active&&<Modal onClose={()=>setModal(null)}><SendModal sc={active} ma={ma} onClose={()=>setModal(null)} onSend={sendSchul} /></Modal>}
      {modal==="nw"&&active&&<Modal onClose={()=>setModal(null)} wide><NachweisModal sc={active} ma={ma} onClose={()=>setModal(null)} /></Modal>}

      {showLogin&&<LoginModal onClose={()=>setShowLogin(false)} onLogin={handleLogin} />}
      {showPwChange&&session&&<PwChangeModal session={session} onClose={()=>setShowPwChange(false)} showToast={showToast} />}
      {toast&&<div style={{ position:"fixed",bottom:22,right:22,background:toast.type==="warn"?C.warn.bg:C.good.bg,border:`1px solid ${toast.type==="warn"?C.warn.border:C.good.border}`,color:toast.type==="warn"?C.warn.text:C.good.text,padding:"12px 20px",borderRadius:12,fontSize:14,fontWeight:600,boxShadow:"0 8px 24px rgba(0,0,0,.12)",zIndex:200,maxWidth:400,animation:"fadeIn .3s" }}>{toast.msg}</div>}
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}} *{box-sizing:border-box} select option{background:#fff;color:#172033}`}</style>
    </div>
  );
}
