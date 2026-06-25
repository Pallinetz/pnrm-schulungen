import { useState, useRef, useEffect } from "react";
import * as XLSX from "xlsx";
import { VideoUploader } from "./components/VideoUploader";
import { VideoPlayer } from "./components/VideoPlayer";
import { getSignedVideoUrl } from "./lib/videoStorage";
import { supabase } from "./lib/supabase";

// ─── Farben & Design — PNRM Corporate ─────────────────────────────────────────
const C = {
  bg: "#F0F4F8",
  white: "#FFFFFF",
  blue: "#2E4B6E",         // primary navy — alle bestehenden C.blue-Refs bleiben gültig
  navy: "#2E4B6E",         // alias für neue Komponenten
  navyDark: "#1E3452",
  blueAccent: "#3A7CA5",   // mittleres Blau
  blueLight: "#5BA4C8",
  blueDim: "#E8F0F7",
  blueBorder: "#D1DCE8",
  teal: "#2E7D8C",
  border: "#D1DCE8",
  inputBorder: "#C5D0DE",
  text: "#1A2638",
  muted: "#5A6E85",
  good: { bg:"#E8F5EE", border:"#A3D9B5", text:"#1A6B3C" },
  warn: { bg:"#FEF3E2", border:"#F5D08A", text:"#8B5E00" },
  bad:  { bg:"#FDECEA", border:"#F5A5A5", text:"#8B1A1A" },
  ok:   { bg:"#E8F0F7", border:"#A8C4DC", text:"#2E4B6E" },
};
const FONT = "'Inter', -apple-system, sans-serif";

// ─── Seed-Daten ───────────────────────────────────────────────────────────────
const SEED_MA = [
  { id:"k1", name:"Dr. Müller",    rolle:"Arzt",            team:"PNRM",    email:"mueller@pnrm.de" },
  { id:"k2", name:"Sabine Kraft",  rolle:"Pflegefachkraft", team:"PNRM",    email:"kraft@pnrm.de" },
  { id:"k3", name:"Jan Weber",     rolle:"Pflegefachkraft", team:"PNRM",    email:"weber@pnrm.de" },
  { id:"k4", name:"Maria Hofer",   rolle:"Koordination",    team:"PNRM",    email:"hofer@pnrm.de" },
  { id:"k5", name:"Thomas Bauer",  rolle:"Pflegefachkraft", team:"Caritas", email:"bauer@caritas-kleve.de" },
  { id:"k6", name:"Ingrid Schäfer",rolle:"Pflegefachkraft", team:"Caritas", email:"schaefer@caritas-kleve.de" },
];

const KATEGORIEN = ["Pflege","Medizin","Recht & Compliance","QM","Kommunikation","Notfallmanagement"];
const ROLLEN = ["Arzt / Ärztin","Pflegefachkraft","Alltagsbegleiter/in","Koordination","Verwaltung","Leitung","Geschäftsführung"];

// ─── Styles ────────────────────────────────────────────────────────────────────
const css = {
  section: { background:C.white, border:`1px solid ${C.border}`, borderRadius:12, padding:20, margin:"12px 0" },
  inp: { width:"100%", fontSize:14, padding:"10px 14px", border:`1px solid ${C.inputBorder}`, borderRadius:8, background:C.white, color:C.text, boxSizing:"border-box", fontFamily:FONT, outline:"none" },
  lbl: { display:"block", fontWeight:600, marginBottom:4, fontSize:13, color:C.text },
  btn: { appearance:"none", border:0, borderRadius:8, background:C.navy, color:C.white, padding:"9px 16px", fontWeight:600, fontSize:14, cursor:"pointer", fontFamily:FONT },
  btnSec: { appearance:"none", borderRadius:8, background:"transparent", color:C.navy, border:`1px solid ${C.border}`, padding:"9px 16px", fontWeight:600, fontSize:14, cursor:"pointer", fontFamily:FONT },
  btnDanger: { background:C.bad.bg, color:C.bad.text, border:`1px solid ${C.bad.border}`, borderRadius:8, padding:"6px 12px", fontWeight:600, fontSize:13, cursor:"pointer", appearance:"none", fontFamily:FONT },
  good: { background:C.good.bg, border:`1px solid ${C.good.border}`, color:C.good.text, padding:"12px 16px", borderRadius:8, fontSize:14 },
  bad:  { background:C.bad.bg,  border:`1px solid ${C.bad.border}`,  color:C.bad.text,  padding:"12px 16px", borderRadius:8, fontSize:14 },
  notice: { background:C.warn.bg, border:`1px solid ${C.warn.border}`, color:C.warn.text, padding:"12px 16px", borderRadius:8, fontSize:14 },
  module: { borderLeft:`4px solid ${C.navy}`, paddingLeft:14, margin:"16px 0" },
  badge: { display:"inline-block", background:C.blueDim, color:C.navy, padding:"4px 10px", borderRadius:20, fontWeight:600, fontSize:12 },
  docmeta: { display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginTop:12, fontSize:13 },
  docmetaCell: { border:`1px solid ${C.border}`, background:C.bg, borderRadius:8, padding:"8px 10px" },
  qBox: { border:`1px solid ${C.border}`, background:C.bg, borderRadius:10, padding:"13px 15px", marginBottom:12 },
  confirmBox: { display:"flex", gap:10, alignItems:"flex-start", border:`1px solid ${C.border}`, background:C.bg, borderRadius:8, padding:12, margin:"8px 0" },
  progress: { height:5, background:C.border, borderRadius:999, overflow:"hidden", marginTop:10 },
};

// ─── PNRM Logo ────────────────────────────────────────────────────────────────
function PNRMLogo({ compact }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-start", lineHeight:1 }}>
      <img src="/logo.png" alt="Palliativ Netzwerk Rhein-Maas" style={{ height: compact ? "48px" : "60px", width:"auto", objectFit:"contain", display:"block" }} />
      {!compact && <div style={{ fontSize:11, color:C.muted, letterSpacing:"0.3px", marginTop:6 }}>Schulungsverwaltung</div>}
    </div>
  );
}

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────
async function callAI(system, user) {
  const res = await fetch("/api/anthropic", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ system, user }),
  });
  if (!res.ok) throw new Error(`API-Fehler ${res.status}`);
  const d = await res.json();
  return d.content?.find(b => b.type === "text")?.text || "";
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

// ─── Wissen-Video-Block (lädt signed URL on mount) ────────────────────────────
function WissenVideoBlock({ datei }) {
  const [signedUrl, setSignedUrl] = useState(null);
  useEffect(() => {
    getSignedVideoUrl(datei.url).then(setSignedUrl).catch(console.error);
  }, [datei.url]);
  return <VideoPlayer url={signedUrl} titel={datei.name} />;
}

// ─── Video-Modul (lädt signed URL on mount) ───────────────────────────────────
function VideoModul({ modul }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    if (modul.video_path) {
      getSignedVideoUrl(modul.video_path).then(setUrl).catch(console.error);
    }
  }, [modul.video_path]);
  return (
    <div>
      <h3 style={{ margin:"0 0 8px", fontSize:18 }}>{modul.titel}</h3>
      {url
        ? <VideoPlayer url={url} />
        : <p style={{ margin:0, color:C.muted, fontSize:13 }}>Video wird geladen…</p>
      }
    </div>
  );
}

// ─── Schulungs-Player — SOP-konform wie Original ──────────────────────────────
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

  // Fortschrittsbalken
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

  const resetQuiz = () => { setAnswers({}); setScore(null); setWrongList([]); setProofUnlocked(false); };

  const submitProof = () => {
    if (score === null || score < grenze) { alert("Erst nach bestandener Prüfung möglich."); return; }
    if (!form.name||!form.rolle||!form.datum||!form.sig) { alert("Bitte Name, Funktion, Datum und digitale Namensbestätigung ausfüllen."); return; }
    if (!checks.c1||!checks.c2||!checks.c3||!checks.c4) { alert("Bitte alle Bestätigungen ankreuzen."); return; }
    setSubmitting(true);
    const code = proofCode(form.name.split(" ").map(w=>w[0]).join(""));
    setTimeout(()=>{
      const nachweis = { ...form, code, score, maxP, grenze, ts:new Date().toLocaleString("de-DE"), dokNr:sc.dokNr, version:sc.version };
      setSubmitResult({ ok:true, code });
      onNachweis(sc.id, nachweis);
      setSubmitting(false);
    }, 700);
  };

  const tabs = [["start","Start"],["schulung","Schulung"],["checklisten","Checklisten"],["quiz","Quiz"],["nachweis","Nachweis"]];

  return (
    <div style={{ fontFamily:FONT, color:C.text, lineHeight:1.55, fontSize:16 }}>
      {/* Header */}
      <div style={{ marginBottom:4 }}>
        <div style={{ fontSize:10, color:C.blue, fontWeight:700, letterSpacing:2, textTransform:"uppercase", marginBottom:6 }}>
          {sc.orgName || "Palliativ Netzwerk Rhein-Maas GmbH & Co. KG"}
        </div>
        <h2 style={{ margin:"0 0 2px", fontSize:22 }}>{sc.titel}</h2>
        <p style={{ margin:"0 0 6px", color:C.muted, fontSize:14 }}>{sc.orgName} · Selbstlern-Unterweisung</p>
        <span style={css.badge}>Dauer: {sc.dauer||"ca. 20–30 Min."} · Bestanden ab {grenze}/{maxP}</span>
        {/* Dokumentenlenkung — 4-spaltig wie Original */}
        <div style={css.docmeta}>
          <div style={css.docmetaCell}><strong>Dok.-Nr.:</strong><br/>{sc.dokNr}</div>
          <div style={css.docmetaCell}><strong>Version:</strong><br/>{sc.version}</div>
          <div style={css.docmetaCell}><strong>Status:</strong><br/>{sc.status}</div>
          <div style={css.docmetaCell}><strong>Freigabe:</strong><br/>{sc.freigegebenVon}</div>
        </div>
        {/* Nav wie Original */}
        <nav style={{ display:"flex", gap:8, flexWrap:"wrap", marginTop:12 }}>
          {tabs.map(([id,label])=>(
            <button key={id} onClick={()=>{ if(id==="nachweis"&&!proofUnlocked)return; setTab(id); }}
              style={{ textDecoration:"none", color:tab===id?C.white:C.blue, border:`1px solid ${C.blueBorder}`, borderRadius:999, padding:"7px 12px", background:tab===id?C.blue:C.white, fontWeight:700, fontSize:14, cursor:(id==="nachweis"&&!proofUnlocked)?"not-allowed":"pointer", opacity:(id==="nachweis"&&!proofUnlocked)?.45:1, appearance:"none" }}>
              {label}
            </button>
          ))}
        </nav>
        {/* Fortschrittsbalken */}
        <div style={css.progress}><div style={{ height:"100%", background:`linear-gradient(90deg, ${C.navy}, ${C.blueAccent})`, width:`${pct}%`, transition:"width .4s ease", borderRadius:999 }} /></div>
      </div>

      {/* ── Start ── */}
      {tab==="start" && (
        <div>
          <div style={css.section}>
            <h2>Start</h2>
            <p>Diese Unterweisung ist als gelenktes internes Schulungsdokument nach DIN EN 15224 aufgebaut. Sie enthält Dokumenten-Nr., Version, Status, Freigabeangaben, Gültigkeit, Quiz und Nachweis.</p>
            <div style={css.notice}><strong>Grundsatz:</strong> {sc.grundsatz}</div>
            {/* Erweitertes Metadaten-Grid */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginTop:14, fontSize:13 }}>
              {[
                ["Geltungsbereich", sc.geltungsbereich],
                ["Bezugsdokumente", sc.bezugsdokumente],
                ["Erstellt durch", sc.erstelltDurch],
                ["Gültig ab", sc.gueltigAb],
                ["Lernziele", sc.lernziele],
                ["Nächste Prüfung", sc.naechstePruefung],
              ].map(([k,v])=>(
                <div key={k} style={{ border:`1px solid ${C.border}`, background:"#fbfcff", borderRadius:9, padding:"8px 11px" }}>
                  <strong>{k}:</strong><br/><span style={{ color:C.muted }}>{v||"–"}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ textAlign:"right" }}>
            <button onClick={()=>setTab("schulung")} style={css.btn}>Zur Schulung →</button>
          </div>
        </div>
      )}

      {/* ── Schulung ── */}
      {tab==="schulung" && (
        <div>
          <div style={css.section}>
            <h2>Schulung</h2>
            {(sc.module||[]).map((m,i)=>(
              <div key={i} style={css.module}>
                {m.typ === "video"
                  ? <VideoModul modul={m} />
                  : <><h3 style={{ margin:"0 0 8px", fontSize:18 }}>{m.titel}</h3><p style={{ margin:0, whiteSpace:"pre-wrap" }}>{m.inhalt}</p></>
                }
              </div>
            ))}
          </div>
          <div style={{ textAlign:"right" }}>
            <button onClick={()=>setTab("checklisten")} style={css.btn}>Zu den Checklisten →</button>
          </div>
        </div>
      )}

      {/* ── Checklisten ── */}
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
          <div style={{ textAlign:"right" }}>
            <button onClick={()=>setTab("quiz")} style={css.btn}>Zum Quiz →</button>
          </div>
        </div>
      )}

      {/* ── Quiz ── */}
      {tab==="quiz" && (
        <div>
          <div style={css.section}>
            <h2>Quiz</h2>
            <p>Bitte wählen Sie bei jeder Frage eine Antwort aus. Es ist nichts vorausgewählt. Ab <strong>{grenze} von {maxP} Punkten</strong> ist die Unterweisung bestanden.</p>
            {fragen.map((f,i)=>(
              <div key={i} style={css.qBox}>
                <h3 style={{ margin:"0 0 10px", fontSize:17 }}>{i+1}. {f.q}</h3>
                <select value={answers[i]??""} onChange={e=>setAnswers(a=>({...a,[i]:e.target.value}))} style={css.inp}>
                  <option value="">Bitte auswählen</option>
                  {f.a.map((opt,j)=><option key={j} value={j}>{String.fromCharCode(65+j)}: {opt}</option>)}
                </select>
              </div>
            ))}
            <div style={{ display:"flex", gap:10, marginTop:14, flexWrap:"wrap" }}>
              <button onClick={gradeQuiz} style={css.btn}>Quiz auswerten</button>
              <button onClick={resetQuiz} style={css.btnSec}>Antworten zurücksetzen</button>
            </div>
            {/* Ergebnis */}
            {score !== null && (
              <div style={{ marginTop:16 }}>
                <div style={{ ...(score>=grenze?css.good:css.bad), fontSize:18, fontWeight:700 }}>
                  {score} von {maxP} Punkten · {score>=grenze?"Bestanden":"Nicht bestanden"}
                </div>
                {wrongList.length>0 ? (
                  <div style={{ marginTop:10 }}>
                    <h3 style={{ fontSize:17 }}>Hinweise</h3>
                    <ul>{wrongList.map(w=><li key={w.n}>Frage {w.n}: richtige Antwort {w.c}</li>)}</ul>
                  </div>
                ) : score!==null && (
                  <div style={{ ...css.good, marginTop:10 }}>Alle Fragen richtig beantwortet.</div>
                )}
                {score>=grenze && <div style={{ marginTop:12, textAlign:"right" }}><button onClick={()=>setTab("nachweis")} style={css.btn}>Zum Nachweis →</button></div>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Nachweis ── */}
      {tab==="nachweis" && (
        <div>
          <div style={css.section}>
            <h2>Nachweis</h2>
            {!proofUnlocked ? (
              <div style={css.notice}>Noch nicht freigeschaltet. Bitte zuerst das Quiz mit mindestens {grenze} von {maxP} Punkten bestehen.</div>
            ) : submitResult?.ok ? (
              <div style={css.good}>
                <strong>Nachweis gesendet.</strong><br/>
                Prüfcode: <strong>{submitResult.code}</strong><br/>
                Ihr Nachweis wurde erfasst und an die Koordination weitergeleitet.
              </div>
            ) : (
              <>
                <div style={css.good}>Prüfung bestanden. Bitte Angaben ausfüllen und Nachweis absenden.</div>
                <h3>Angaben</h3>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                  {[["name","Name","text"],["rolle","Funktion / Tätigkeitsbereich","text"],["email","E-Mail","email"],["datum","Datum","date"]].map(([k,l,t])=>(
                    <div key={k}>
                      <label style={css.lbl}>{l}</label>
                      <input type={t} value={form[k]} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))} style={css.inp} />
                    </div>
                  ))}
                </div>
                <h3>Bestätigungen</h3>
                {[
                  ["c1","Ich habe die Schulung vollständig bearbeitet."],
                  ["c2","Ich habe die Inhalte verstanden."],
                  ["c3","Ich weiß: Bei Unsicherheit oder Abweichungen stoppen, Hilfe holen und sicher vorgehen."],
                  ["c4","Ich habe keine Patientendaten eingetragen."],
                ].map(([k,txt])=>(
                  <label key={k} style={{ ...css.confirmBox, cursor:"pointer" }}>
                    <input type="checkbox" checked={checks[k]} onChange={e=>setChecks(c=>({...c,[k]:e.target.checked}))} style={{ width:22,height:22,flexShrink:0,marginTop:2,accentColor:C.blue }} />
                    <span>{txt}</span>
                  </label>
                ))}
                <h3>Digitale Teilnahme- und Verständnisbestätigung</h3>
                <div style={css.notice}>
                  Der Nachweis enthält Name, Funktion, Datum/Uhrzeit, Thema, Quiz-Ergebnis, Bestehensgrenze, Bestätigungstext, Namenseingabe, Prüfcode und Dokumentenversion.
                </div>
                <label style={{ ...css.lbl, marginTop:12 }}>Vollständiger Name als digitale Bestätigung</label>
                <input type="text" value={form.sig} onChange={e=>setForm(f=>({...f,sig:e.target.value}))} style={css.inp} placeholder="Vor- und Nachname eingeben" />
                <h3>Offene Fragen / Bemerkungen</h3>
                <textarea value={form.offen} onChange={e=>setForm(f=>({...f,offen:e.target.value}))} style={{ ...css.inp, minHeight:80, resize:"vertical" }} placeholder="Optional" />
                <div style={{ display:"flex", gap:10, marginTop:14, flexWrap:"wrap" }}>
                  <button onClick={submitProof} disabled={submitting} style={{ ...css.btn, opacity:submitting?.65:1, cursor:submitting?"not-allowed":"pointer" }}>
                    {submitting?"Wird gespeichert…":"Nachweis absenden"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <p style={{ textAlign:"center", color:C.muted, fontSize:12, marginTop:16 }}>
        {sc.dokNr} · Version {sc.version} · {sc.status} · Gültig ab {sc.gueltigAb} · Nächste Prüfung {sc.naechstePruefung}
      </p>
    </div>
  );
}

// ─── Schulung anlegen / bearbeiten ────────────────────────────────────────────
function SchulungForm({ schulung, onSave, onClose, isAdmin }) {
  const isNew = !schulung;
  const [form, setForm] = useState(schulung || {
    titel:"", orgName:"Palliativ Netzwerk Rhein-Maas GmbH & Co. KG",
    dokNr:"", version:"1.0", status:"Entwurf",
    gueltigAb:new Date().toISOString().slice(0,10), naechstePruefung:"",
    erstelltDurch:"", freigegebenVon:"",
    geltungsbereich:"", bezugsdokumente:"",
    kategorie:"Pflege", pflicht:false, dauer:"ca. 20–30 Min.",
    bestehensgrenze:16, maxPunkte:20,
    grundsatz:"", lernziele:"", module:[], checkliste:[], fragen:[],
    empfaenger:[], nachweise:{},
  });
  const [ai, setAi] = useState(false);
  const [aiErr, setAiErr] = useState("");
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const generateAI = async () => {
    if (!form.titel.trim()) { setAiErr("Bitte zuerst Titel eingeben."); return; }
    setAi(true); setAiErr("");
    try {
      const raw = await callAI(
        `Du bist QM-Beauftragter bei Palliativnetzwerk Rhein-Maas (SAPV). Erstelle eine vollständige Selbstlern-Unterweisung als JSON. Nur gültiges JSON, kein Markdown.
Format:
{
  "grundsatz": "1 Satz Kernbotschaft der Schulung",
  "lernziele": "Was Mitarbeitende danach wissen/können",
  "geltungsbereich": "Für wen gilt diese Schulung",
  "bezugsdokumente": "Relevante Leitlinien, Gesetze, Normen",
  "module": [{"titel":"1. …","inhalt":"…"}, ... exakt 4 Module],
  "checkliste": ["…", ... 7-8 Punkte, letzter Punkt immer: Keine Patientendaten eingetragen],
  "fragen": [{"q":"…","a":["…","…","…"],"c":0}, ... genau 20 Fragen, c=Index richtige Antwort (0-2)]
}`,
        `Schulung: "${form.titel}" | Kategorie: ${form.kategorie} | Bestanden ab: ${form.bestehensgrenze}/${form.maxPunkte} | Kontext: SAPV-Palliativversorgung, Kreis Kleve und Moers.`
      );
      const clean = raw.replace(/```json|```/g,"").trim();
      const parsed = JSON.parse(clean);
      setForm(f=>({...f,
        grundsatz:parsed.grundsatz||f.grundsatz,
        lernziele:parsed.lernziele||f.lernziele,
        geltungsbereich:parsed.geltungsbereich||f.geltungsbereich,
        bezugsdokumente:parsed.bezugsdokumente||f.bezugsdokumente,
        module:parsed.module||[],
        checkliste:parsed.checkliste||[],
        fragen:parsed.fragen||[],
      }));
    } catch(e) { setAiErr("Fehler beim Generieren. Bitte erneut versuchen."); }
    setAi(false);
  };

  const setMod = (i,k,v) => setForm(f=>{ const m=[...f.module]; m[i]={...m[i],[k]:v}; return {...f,module:m}; });
  const setFr  = (i,k,v) => setForm(f=>{ const q=[...f.fragen]; q[i]={...q[i],[k]:v}; return {...f,fragen:q}; });
  const setAns = (fi,ai2,v) => setForm(f=>{ const q=[...f.fragen]; const a=[...q[fi].a]; a[ai2]=v; q[fi]={...q[fi],a}; return {...f,fragen:q}; });
  const setChk = (i,v) => setForm(f=>{ const c=[...f.checkliste]; c[i]=v; return {...f,checkliste:c}; });

  const meta1 = [["titel","Titel (Schulungsthema)"],["dokNr","Dok.-Nr."],["version","Version"],["status","Status"],["gueltigAb","Gültig ab"],["naechstePruefung","Nächste Prüfung"],["erstelltDurch","Erstellt durch"],["freigegebenVon","Freigegeben durch"]];
  const meta2 = [["geltungsbereich","Geltungsbereich"],["bezugsdokumente","Bezugsdokumente / Normen"]];

  return (
    <div style={{ fontFamily:FONT, color:C.text, lineHeight:1.55 }}>
      <h2 style={{ margin:"0 0 18px", fontSize:20 }}>{isNew?"Neue Schulung anlegen":"Schulung bearbeiten"}</h2>

      {/* Dokumentenlenkung */}
      <div style={css.section}>
        <h3 style={{ margin:"0 0 14px", fontSize:17 }}>📋 Dokumentenlenkung (DIN EN 15224)</h3>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          {meta1.map(([k,l])=>(
            <div key={k}>
              <label style={css.lbl}>{l}</label>
              {k==="status" ? (
                <select value={form[k]||""} onChange={e=>set(k,e.target.value)} style={css.inp}>
                  <option>Entwurf</option><option>Freigegeben</option><option>Archiviert</option>
                </select>
              ) : (
                <input value={form[k]||""} onChange={e=>set(k,e.target.value)} style={css.inp} />
              )}
            </div>
          ))}
          <div>
            <label style={css.lbl}>Kategorie</label>
            <select value={form.kategorie} onChange={e=>set("kategorie",e.target.value)} style={css.inp}>
              {KATEGORIEN.map(k=><option key={k}>{k}</option>)}
            </select>
          </div>
          <div>
            <label style={css.lbl}>Dauer</label>
            <input value={form.dauer||""} onChange={e=>set("dauer",e.target.value)} style={css.inp} placeholder="ca. 20–30 Min." />
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, gridColumn:"span 2" }}>
            <div><label style={css.lbl}>Bestehensgrenze (Punkte)</label><input type="number" value={form.bestehensgrenze} onChange={e=>set("bestehensgrenze",Number(e.target.value))} style={css.inp} /></div>
            <div><label style={css.lbl}>Max. Punkte</label><input type="number" value={form.maxPunkte} onChange={e=>set("maxPunkte",Number(e.target.value))} style={css.inp} /></div>
          </div>
        </div>
        {meta2.map(([k,l])=>(
          <div key={k} style={{ marginTop:12 }}>
            <label style={css.lbl}>{l}</label>
            <input value={form[k]||""} onChange={e=>set(k,e.target.value)} style={css.inp} />
          </div>
        ))}
        <label style={{ display:"flex", alignItems:"center", gap:10, marginTop:14, cursor:"pointer" }}>
          <input type="checkbox" checked={form.pflicht} onChange={e=>set("pflicht",e.target.checked)} style={{ width:18,height:18,accentColor:C.blue }} />
          <strong>Pflichtschulung</strong> — für alle Mitarbeitenden verbindlich
        </label>
      </div>

      {/* KI */}
      <div style={{ ...css.notice, display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <span>✦ KI generiert Grundsatz, Lernziele, Geltungsbereich, Bezugsdokumente, 4 Module, Checkliste und <strong>20 Quiz-Fragen</strong></span>
        <AIBtn onClick={generateAI} loading={ai} label="Alles generieren" />
      </div>
      {aiErr && <p style={{ color:C.bad.text, fontSize:13 }}>{aiErr}</p>}

      {/* Grundsatz & Lernziele */}
      <div style={css.section}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <div><label style={css.lbl}>Grundsatz (Kernbotschaft)</label><textarea value={form.grundsatz||""} onChange={e=>set("grundsatz",e.target.value)} style={{ ...css.inp, minHeight:70, resize:"vertical" }} /></div>
          <div><label style={css.lbl}>Lernziele</label><textarea value={form.lernziele||""} onChange={e=>set("lernziele",e.target.value)} style={{ ...css.inp, minHeight:70, resize:"vertical" }} /></div>
        </div>
      </div>

      {/* Module */}
      <div style={css.section}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
          <h3 style={{ margin:0, fontSize:17 }}>📖 Lernmodule</h3>
          <button onClick={()=>set("module",[...form.module,{titel:"",inhalt:"",typ:"text",video_path:null,video_name:null}])} style={{ ...css.btnSec, padding:"6px 12px", fontSize:13 }}>+ Modul</button>
        </div>
        {form.module.map((m,i)=>(
          <div key={i} style={{ borderLeft:`4px solid ${C.blue}`, paddingLeft:14, marginBottom:14 }}>
            <div style={{ display:"flex", gap:8, marginBottom:6 }}>
              <input value={m.titel} onChange={e=>setMod(i,"titel",e.target.value)} style={{ ...css.inp, fontWeight:700, marginBottom:0, flex:1 }} placeholder={`Modul ${i+1} Titel`} />
              {isAdmin && (
                <select value={m.typ||"text"} onChange={e=>setMod(i,"typ",e.target.value)} style={{ ...css.inp, width:"auto", marginBottom:0, paddingLeft:10, paddingRight:10 }}>
                  <option value="text">Text</option>
                  <option value="video">Video</option>
                </select>
              )}
              <button onClick={()=>set("module",form.module.filter((_,j)=>j!==i))} style={css.btnDanger}>✕</button>
            </div>
            {(m.typ||"text")==="video" ? (
              <div style={{ marginTop:4 }}>
                {m.video_path ? (
                  <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", background:C.good.bg, border:`1px solid ${C.good.border}`, borderRadius:10 }}>
                    <span style={{ color:C.good.text, fontSize:13 }}>✓ {m.video_name}</span>
                    <button style={{ ...css.btnDanger, padding:"4px 10px", fontSize:12, marginLeft:"auto" }} onClick={()=>setForm(f=>{ const mod=[...f.module]; mod[i]={...mod[i],video_path:null,video_name:null}; return {...f,module:mod}; })}>Entfernen</button>
                  </div>
                ) : (
                  <VideoUploader
                    label="MP4 / Video hochladen"
                    onUploaded={({path,name})=>setForm(f=>{ const mod=[...f.module]; mod[i]={...mod[i],video_path:path,video_name:name}; return {...f,module:mod}; })}
                  />
                )}
              </div>
            ) : (
              <textarea value={m.inhalt} onChange={e=>setMod(i,"inhalt",e.target.value)} style={{ ...css.inp, minHeight:70, resize:"vertical" }} />
            )}
          </div>
        ))}
        {!form.module.length && <p style={{ color:C.muted }}>Noch keine Module — KI verwenden oder manuell hinzufügen.</p>}
      </div>

      {/* Checkliste */}
      <div style={css.section}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
          <h3 style={{ margin:0, fontSize:17 }}>✓ Checkliste</h3>
          <button onClick={()=>set("checkliste",[...form.checkliste,""])} style={{ ...css.btnSec, padding:"6px 12px", fontSize:13 }}>+ Punkt</button>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
          {form.checkliste.map((c,i)=>(
            <div key={i} style={{ display:"flex", gap:6 }}>
              <input value={c} onChange={e=>setChk(i,e.target.value)} style={{ ...css.inp, marginBottom:0 }} placeholder={`Punkt ${i+1}`} />
              <button onClick={()=>set("checkliste",form.checkliste.filter((_,j)=>j!==i))} style={css.btnDanger}>✕</button>
            </div>
          ))}
        </div>
        {!form.checkliste.length && <p style={{ color:C.muted }}>Noch keine Punkte.</p>}
      </div>

      {/* Fragen */}
      <div style={css.section}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
          <h3 style={{ margin:0, fontSize:17 }}>❓ Quiz-Fragen ({form.fragen.length}/{form.maxPunkte})</h3>
          <button onClick={()=>set("fragen",[...form.fragen,{q:"",a:["","",""],c:0}])} style={{ ...css.btnSec, padding:"6px 12px", fontSize:13 }}>+ Frage</button>
        </div>
        {form.fragen.length > 0 && form.fragen.length !== form.maxPunkte && (
          <div style={{ ...css.notice, marginBottom:12, fontSize:13 }}>
            ⚠️ Aktuell {form.fragen.length} Fragen — Bestehensgrenze gilt für {form.maxPunkte} Punkte. Bitte angleichen.
          </div>
        )}
        {form.fragen.map((f,fi)=>(
          <div key={fi} style={{ border:`1px solid ${C.border}`, borderRadius:12, padding:"12px 14px", marginBottom:12 }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
              <strong style={{ fontSize:14 }}>Frage {fi+1}</strong>
              <button onClick={()=>set("fragen",form.fragen.filter((_,j)=>j!==fi))} style={css.btnDanger}>✕</button>
            </div>
            <input value={f.q} onChange={e=>setFr(fi,"q",e.target.value)} style={{ ...css.inp, fontWeight:600, marginBottom:10 }} placeholder="Frage eingeben…" />
            {(f.a||[]).map((ans,ai2)=>(
              <div key={ai2} style={{ display:"flex", gap:8, alignItems:"center", marginBottom:7 }}>
                <input type="radio" name={`c_${fi}`} checked={Number(f.c)===ai2} onChange={()=>setFr(fi,"c",ai2)} style={{ width:18,height:18,accentColor:C.blue,flexShrink:0 }} title="Richtige Antwort" />
                <input value={ans} onChange={e=>setAns(fi,ai2,e.target.value)} style={{ ...css.inp, marginBottom:0 }} placeholder={`Antwort ${String.fromCharCode(65+ai2)}`} />
              </div>
            ))}
            <p style={{ margin:"5px 0 0", fontSize:12, color:C.muted }}>🔘 Richtige Antwort markieren</p>
          </div>
        ))}
        {!form.fragen.length && <p style={{ color:C.muted }}>Noch keine Fragen — KI verwenden oder manuell hinzufügen.</p>}
      </div>

      {form.status==="Freigegeben" && (
        <div style={{ ...css.notice, marginBottom:14 }}>
          ⚠️ Freigegebene Schulungen werden auch dem Caritas-Partnerteam zugänglich. Bitte Vier-Augen-Check und QM-Einbindung vor Freigabe sicherstellen.
        </div>
      )}

      <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:18 }}>
        <button onClick={onClose} style={css.btnSec}>Abbrechen</button>
        <button onClick={()=>onSave(form)} style={css.btn}>{isNew?"Schulung anlegen":"Speichern"}</button>
      </div>
    </div>
  );
}

// ─── Mitarbeiterverwaltung ────────────────────────────────────────────────────
function InviteModal({ onClose, showToast }) {
  const [form, setForm] = useState({ name:"", email:"", rolle:"user" });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const handleInvite = async () => {
    if (!form.email.trim() || !form.name.trim()) return;
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("send-invitation-email", {
        body: { action:"invite_schulungen", email: form.email, name: form.name, rolle: form.rolle },
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);
      setResult(`Einladung an ${form.email} gesendet.`);
      showToast(`Einladung an ${form.email} gesendet.`);
    } catch (e) {
      setResult(`Fehler: ${e.message}`);
    }
    setLoading(false);
  };

  return (
    <div style={{ fontFamily:FONT, color:C.text }}>
      <h2 style={{ margin:"0 0 18px", fontSize:20 }}>Mitarbeiter einladen</h2>
      {result
        ? <div style={css.good}>{result}</div>
        : <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <div><label style={css.lbl}>Name</label><input value={form.name} onChange={e=>set("name",e.target.value)} style={css.inp} placeholder="Vor- und Nachname" /></div>
            <div><label style={css.lbl}>E-Mail</label><input type="email" value={form.email} onChange={e=>set("email",e.target.value)} style={css.inp} placeholder="email@pallinetz.de" /></div>
            <div><label style={css.lbl}>Zugriff</label><select value={form.rolle} onChange={e=>set("rolle",e.target.value)} style={css.inp}><option value="user">Nutzer – nur Schulungen ansehen</option><option value="admin">Admin – Schulungen verwalten & Mitarbeiter einladen</option></select></div>
          </div>
      }
      <div style={{ display:"flex", gap:8, justifyContent:"flex-end", marginTop:18 }}>
        <button onClick={onClose} style={css.btnSec}>Schließen</button>
        {!result && <button onClick={handleInvite} disabled={loading||!form.email||!form.name} style={{ ...css.btn, opacity:(loading||!form.email||!form.name)?0.65:1 }}>{loading?"Wird gesendet…":"Einladung senden"}</button>}
      </div>
    </div>
  );
}

function MitarbeiterView({ ma, setMa, showToast, isAdmin }) {
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [inviteOpen, setInviteOpen] = useState(false);
  const fileRef = useRef();
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const save = () => { if(!form.name.trim())return; editing==="neu"?setMa(m=>[...m,form]):setMa(m=>m.map(x=>x.id===editing?form:x)); setEditing(null); showToast(editing==="neu"?"Hinzugefügt.":"Gespeichert."); };
  const importCSV = e => {
    const file=e.target.files[0]; if(!file)return;
    const r=new FileReader();
    r.onload=ev=>{ const wb=XLSX.read(ev.target.result,{type:"binary"}); const rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]); const imp=rows.map((r,i)=>({id:`imp_${Date.now()}_${i}`,name:r.Name||r.name||"",rolle:r.Rolle||r.rolle||"Pflegefachkraft",team:r.Team||r.team||"PNRM",email:r.Email||r.email||""})).filter(m=>m.name); setMa(m=>{ const ex=new Set(m.map(x=>x.name.toLowerCase())); const news=imp.filter(x=>!ex.has(x.name.toLowerCase())); showToast(`${news.length} neue importiert.`); return [...m,...news]; }); };
    r.readAsBinaryString(file); e.target.value="";
  };
  return (
    <div style={{ fontFamily:FONT }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
        <h2 style={{ margin:0, fontSize:20 }}>👥 Mitarbeiter</h2>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={()=>fileRef.current.click()} style={{ ...css.btnSec, fontSize:13, padding:"8px 13px" }}>📥 Import</button>
          <input ref={fileRef} type="file" accept=".xlsx,.csv" onChange={importCSV} style={{ display:"none" }} />
          <button onClick={()=>{ setEditing("neu"); setForm({id:`k${Date.now()}`,name:"",rolle:ROLLEN[0],team:"PNRM",email:""}); }} style={{ ...css.btn, fontSize:13, padding:"8px 14px" }}>+ Neu</button>
          {isAdmin && <button onClick={()=>setInviteOpen(true)} style={{ ...css.btn, fontSize:13, padding:"8px 14px" }}>+ Einladen</button>}
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
            <button onClick={save} style={css.btn}>Speichern</button>
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
                <button onClick={()=>{ setMa(x=>x.filter(y=>y.id!==m.id)); showToast("Gelöscht."); }} style={{ ...css.btnDanger, padding:"5px 11px" }}>✕</button>
              </div>
            </div>
          ))}
        </div>
      ))}
      <div style={{ marginTop:14, padding:"10px 14px", background:"#fbfcff", border:`1px solid ${C.border}`, borderRadius:10, fontSize:12, color:C.muted }}>
        CSV/Excel-Format: Spalten <strong style={{ color:C.text }}>Name, Rolle, Team, Email</strong>
      </div>
      {inviteOpen && <Modal onClose={()=>setInviteOpen(false)}><InviteModal onClose={()=>setInviteOpen(false)} showToast={showToast} /></Modal>}
    </div>
  );
}

// ─── Versenden ────────────────────────────────────────────────────────────────
function SendModal({ sc, ma, onClose, onSend }) {
  const [sel, setSel] = useState(new Set(sc.empfaenger||[]));
  const [msg, setMsg] = useState(`Liebe Kolleginnen und Kollegen,\n\nbitte bearbeitet die Selbstlern-Unterweisung „${sc.titel}"${sc.pflicht?" (Pflichtschulung)":""}.\n\nNach Abschluss bitte den digitalen Nachweis absenden.\n\nViele Grüße`);
  const [aiL, setAiL] = useState(false);
  const toggle = id=>{const n=new Set(sel);n.has(id)?n.delete(id):n.add(id);setSel(n);};
  const toggleTeam = team=>{const ids=ma.filter(m=>m.team===team).map(m=>m.id);const all=ids.every(id=>sel.has(id));const n=new Set(sel);ids.forEach(id=>all?n.delete(id):n.add(id));setSel(n);};
  const genMsg=async()=>{ setAiL(true); const t=await callAI("Kurze Teams-Nachricht für SAPV-Team. Nur Text, kein Betreff.",`Einladung zur Selbstlern-Unterweisung "${sc.titel}"${sc.pflicht?", Pflichtschulung":""}. Freundlich, knapp, professionell.`).catch(()=>""); if(t)setMsg(t); setAiL(false); };
  const hasCaritas=[...sel].some(id=>ma.find(m=>m.id===id)?.team==="Caritas");
  return (
    <div style={{ fontFamily:FONT, color:C.text }}>
      <h2 style={{ margin:"0 0 4px", fontSize:20 }}>📤 Schulung versenden</h2>
      <p style={{ color:C.muted, margin:"0 0 18px", fontSize:14 }}>{sc.titel} · {sc.dokNr} · Version {sc.version}</p>
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
      {hasCaritas && <div style={{ ...css.notice, marginBottom:14 }}>⚠️ <strong>Caritas-Partnerteam einbezogen</strong> — bitte sicherstellen, dass die Schulung dort ebenfalls offiziell kommuniziert und in die Caritas-Prozesse integriert wird.</div>}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
        <label style={css.lbl}>Teams-Nachricht</label>
        <AIBtn onClick={genMsg} loading={aiL} label="Formulieren" />
      </div>
      <textarea value={msg} onChange={e=>setMsg(e.target.value)} style={{ ...css.inp, minHeight:100, resize:"vertical" }} />
      <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:14 }}>
        <button onClick={onClose} style={css.btnSec}>Abbrechen</button>
        <button onClick={()=>onSend(sc.id,[...sel],msg)} disabled={!sel.size} style={{ ...css.btn, opacity:sel.size?1:.5 }}>📤 An {sel.size} Person{sel.size!==1?"en":""} senden</button>
      </div>
    </div>
  );
}

// ─── Nachweisübersicht ────────────────────────────────────────────────────────
function NachweisModal({ sc, ma, onClose }) {
  const empf=(sc.empfaenger||[]).map(id=>ma.find(m=>m.id===id)).filter(Boolean);
  const nw=sc.nachweise||{};
  const done=empf.filter(m=>nw[m.id]); const open=empf.filter(m=>!nw[m.id]);
  const exportXls=()=>{const rows=empf.map(m=>{const n=nw[m.id];return{Schulung:sc.titel,"Dok-Nr":sc.dokNr,Version:sc.version,Name:m.name,Team:m.team,Rolle:m.rolle,Bestanden:n?"Ja":"Ausstehend",Datum:n?.ts||"–",Punkte:n?`${n.score}/${n.maxP}`:"–",Prüfcode:n?.code||"–"};});const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows),"Nachweise");XLSX.writeFile(wb,`Nachweise_${sc.dokNr}_${new Date().toISOString().slice(0,10)}.xlsx`);};
  return (
    <div style={{ fontFamily:FONT, color:C.text }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 }}>
        <div><h2 style={{ margin:"0 0 4px", fontSize:20 }}>📄 Nachweise</h2><p style={{ color:C.muted, margin:0, fontSize:14 }}>{sc.titel} · {sc.dokNr}</p></div>
        <button onClick={exportXls} style={{ ...css.btnSec, fontSize:13 }}>📊 Export</button>
      </div>
      <div style={{ display:"flex", gap:12, marginBottom:20 }}>
        {[["Versendet",empf.length,C.muted],["Bestanden",done.length,C.good.text],["Ausstehend",open.length,C.warn.text]].map(([l,v,col])=>(
          <div key={l} style={{ flex:1, background:C.white, border:`1px solid ${C.border}`, borderRadius:12, padding:"12px 16px", textAlign:"center" }}>
            <div style={{ fontSize:24, fontWeight:700, color:col }}>{v}</div>
            <div style={{ fontSize:12, color:C.muted }}>{l}</div>
          </div>
        ))}
      </div>
      {open.length>0&&<><div style={{ fontSize:12,fontWeight:700,color:C.warn.text,letterSpacing:1,textTransform:"uppercase",marginBottom:8 }}>⏳ Ausstehend</div>{open.map(m=><div key={m.id} style={{ ...css.section,display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 15px",marginBottom:7 }}><div><strong>{m.name}</strong><span style={{ color:C.muted,fontSize:12,marginLeft:10 }}>{m.rolle} · {m.team}</span></div><span style={{ color:C.muted,fontSize:13 }}>Noch nicht abgeschlossen</span></div>)}</>}
      {done.length>0&&<><div style={{ fontSize:12,fontWeight:700,color:C.good.text,letterSpacing:1,textTransform:"uppercase",margin:"16px 0 8px" }}>✓ Abgeschlossen</div>{done.map(m=>{const n=nw[m.id];return(<div key={m.id} style={{ background:C.good.bg,border:`1px solid ${C.good.border}`,borderRadius:12,padding:"11px 15px",marginBottom:7,display:"flex",justifyContent:"space-between",alignItems:"center" }}><div><strong>{m.name}</strong><span style={{ color:C.muted,fontSize:12,marginLeft:10 }}>{m.rolle}</span></div><div style={{ textAlign:"right",fontSize:12,color:C.good.text }}>✓ {n.score}/{n.maxP} P. · {n.ts}<br/><span style={{ color:C.muted,fontFamily:"monospace",fontSize:11 }}>{n.code}</span></div></div>);})}</>}
    </div>
  );
}

// ─── Wissen ───────────────────────────────────────────────────────────────────
const stripMd = txt => (txt||"").replace(/#{1,6} /g,"").replace(/\*\*/g,"").replace(/\*/g,"").replace(/_/g,"");

function WissenView({ isAdmin, showToast }) {
  const [artikel, setArtikel] = useState([]);
  const [kategorieMap, setKategorieMap] = useState({});
  const [wissenLoading, setWissenLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ titel:"", kategorie_id:"", inhalt:"" });

  useEffect(() => {
    Promise.all([
      supabase.from("wissen_artikel").select("*, wissen_dateien(*)").order("created_at"),
      supabase.from("wissen_kategorien").select("*"),
    ]).then(([artRes, katRes]) => {
      if (artRes.error) console.error("Wissen-Fehler:", artRes.error);
      if (katRes.error) console.error("Kategorien-Fehler:", katRes.error);
      if (katRes.data) {
        const map = {};
        katRes.data.forEach(k => { map[k.id] = k.name; });
        setKategorieMap(map);
      }
      if (artRes.data) setArtikel(artRes.data.map(a => ({ ...a, dateien: a.wissen_dateien ?? [] })));
      setWissenLoading(false);
    });
  }, []);
  const setF = (k,v) => setForm(f=>({...f,[k]:v}));

  const art = selected ? artikel.find(a=>a.id===selected) : null;

  const saveArtikel = () => {
    if (!form.titel.trim()) return;
    if (editing==="neu") {
      setArtikel(a=>[...a,{ ...form, id:`w${Date.now()}`, dateien:[] }]);
      showToast("Artikel erstellt.");
    } else {
      setArtikel(a=>a.map(x=>x.id===editing?{...x,...form}:x));
      showToast("Gespeichert.");
    }
    setEditing(null);
  };

  const addVideo = (artikelId, { path, name }) => {
    setArtikel(a=>a.map(x=>x.id===artikelId
      ? { ...x, dateien:[...x.dateien,{ id:`d${Date.now()}`, name, typ:"video", url:path }] }
      : x
    ));
    showToast("Video angehängt.");
  };

  const removeVideo = (artikelId, dateiId) => {
    setArtikel(a=>a.map(x=>x.id===artikelId
      ? { ...x, dateien:x.dateien.filter(d=>d.id!==dateiId) }
      : x
    ));
  };

  if (wissenLoading) return <p style={{ color:C.muted, textAlign:"center", padding:40 }}>Wissensdatenbank wird geladen…</p>;

  return (
    <div style={{ fontFamily:FONT }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          {selected && <button onClick={()=>setSelected(null)} style={{ ...css.btnSec, fontSize:12, padding:"5px 12px" }}>← Zurück</button>}
          <h2 style={{ margin:0, fontSize:20 }}>📚 Wissensdatenbank</h2>
        </div>
        {isAdmin && !selected && !editing && (
          <button onClick={()=>{ setForm({titel:"",kategorie:"Pflege",inhalt:""}); setEditing("neu"); }} style={{ ...css.btn, fontSize:13, padding:"8px 14px" }}>+ Neuer Artikel</button>
        )}
        {isAdmin && selected && !editing && (
          <button onClick={()=>{ setForm({titel:art.titel,kategorie:art.kategorie,inhalt:art.inhalt}); setEditing(selected); }} style={{ ...css.btnSec, fontSize:13, padding:"8px 14px" }}>✏️ Bearbeiten</button>
        )}
      </div>

      {/* Formular */}
      {editing && (
        <div style={css.section}>
          <h3 style={{ margin:"0 0 14px", fontSize:16 }}>{editing==="neu"?"Neuer Artikel":"Artikel bearbeiten"}</h3>
          <div style={{ display:"grid", gridTemplateColumns:"1fr auto", gap:12, marginBottom:12 }}>
            <div>
              <label style={css.lbl}>Titel</label>
              <input value={form.titel} onChange={e=>setF("titel",e.target.value)} style={css.inp} />
            </div>
            <div>
              <label style={css.lbl}>Kategorie</label>
              <select value={form.kategorie} onChange={e=>setF("kategorie",e.target.value)} style={css.inp}>
                {KATEGORIEN.map(k=><option key={k}>{k}</option>)}
              </select>
            </div>
          </div>
          <label style={css.lbl}>Inhalt</label>
          <textarea value={form.inhalt} onChange={e=>setF("inhalt",e.target.value)} style={{ ...css.inp, minHeight:100, resize:"vertical", marginBottom:12 }} />
          <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
            <button onClick={()=>setEditing(null)} style={css.btnSec}>Abbrechen</button>
            <button onClick={saveArtikel} style={css.btn}>Speichern</button>
          </div>
        </div>
      )}

      {/* Detailansicht */}
      {selected && art && !editing && (
        <div style={css.section}>
          <span style={{ ...css.badge, marginBottom:10, display:"inline-block" }}>{kategorieMap[art.kategorie_id] ?? art.kategorie ?? "—"}</span>
          <h2 style={{ margin:"0 0 14px", fontSize:20 }}>{art.titel}</h2>
          <p style={{ margin:"0 0 20px", whiteSpace:"pre-wrap", lineHeight:1.7 }}>{art.inhalt}</p>
          {art.dateien.filter(d=>d.typ==="video").map(d=>(
            <div key={d.id} style={{ position:"relative", marginBottom:8 }}>
              <WissenVideoBlock datei={d} />
              {isAdmin && (
                <button onClick={()=>removeVideo(art.id,d.id)} style={{ ...css.btnDanger, position:"absolute", top:0, right:0, padding:"3px 9px", fontSize:12 }}>✕</button>
              )}
            </div>
          ))}
          {isAdmin && (
            <div style={{ marginTop:16, borderTop:`1px solid ${C.border}`, paddingTop:14 }}>
              <p style={{ margin:"0 0 8px", fontSize:13, fontWeight:700, color:C.muted }}>Video anhängen</p>
              <VideoUploader label="Video hochladen (MP4)" onUploaded={({path,name})=>addVideo(art.id,{path,name})} />
            </div>
          )}
        </div>
      )}

      {/* Artikelliste */}
      {!selected && !editing && (
        <div>
          {artikel.length===0 && <p style={{ color:C.muted, textAlign:"center", padding:40 }}>Noch keine Artikel.</p>}
          {artikel.map(a=>{
            const videos=a.dateien.filter(d=>d.typ==="video").length;
            return (
              <div key={a.id} style={{ ...css.section, cursor:"pointer" }} onClick={()=>setSelected(a.id)}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12 }}>
                  <div style={{ flex:1 }}>
                    <span style={{ ...css.badge, marginBottom:6, display:"inline-block" }}>{kategorieMap[a.kategorie_id] ?? a.kategorie ?? "—"}</span>
                    <h3 style={{ margin:"0 0 4px", fontSize:16 }}>{a.titel}</h3>
                    <p style={{ margin:0, fontSize:12, color:C.muted }}>{stripMd(a.inhalt).slice(0,120)}{stripMd(a.inhalt).length>120?"…":""}</p>
                    {videos>0 && <span style={{ fontSize:12, color:C.blue, marginTop:4, display:"inline-block" }}>▶ {videos} Video{videos!==1?"s":""}</span>}
                  </div>
                  {isAdmin && (
                    <button onClick={e=>{e.stopPropagation();setArtikel(x=>x.filter(y=>y.id!==a.id));showToast("Gelöscht.");}} style={{ ...css.btnDanger, padding:"5px 11px" }}>✕</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────
function exportExcel(schulungen, ma) {
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(schulungen.map(s=>({Titel:s.titel,"Dok-Nr":s.dokNr,Version:s.version,Status:s.status,Kategorie:s.kategorie,Pflicht:s.pflicht?"Ja":"Nein","Gültig ab":s.gueltigAb,"Nächste Prüfung":s.naechstePruefung,Versendet:s.empfaenger?.length||0,Nachweise:Object.keys(s.nachweise||{}).length}))),"Schulungen");
  const rows2=[]; schulungen.forEach(s=>(s.empfaenger||[]).forEach(id=>{const m=ma.find(x=>x.id===id);const n=s.nachweise?.[id];rows2.push({Schulung:s.titel,"Dok-Nr":s.dokNr,Version:s.version,Name:m?.name||id,Team:m?.team||"",Rolle:m?.rolle||"",Bestanden:n?"Ja":"Ausstehend",Datum:n?.ts||"–",Punkte:n?`${n.score}/${n.maxP}`:"–",Prüfcode:n?.code||"–"});}));
  if(rows2.length)XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows2),"Nachweise");
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(ma.map(({id,...m})=>m)),"Mitarbeiter");
  XLSX.writeFile(wb,`PNRM_Schulungen_${new Date().toISOString().slice(0,10)}.xlsx`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [schulungen, setSchulungen] = useState([]);
  const [schulungenLoading, setSchulungenLoading] = useState(false);
  const [ma, setMa] = useState(SEED_MA);
  const [modal, setModal] = useState(null);
  const [active, setActive] = useState(null);
  const [tab, setTab] = useState("schulungen");
  const [filter, setFilter] = useState("alle");
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState(null);
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginView, setLoginView] = useState("login");
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetResult, setResetResult] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) checkAdmin(session.user.email);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) checkAdmin(session.user.email);
      else setIsAdmin(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    setSchulungenLoading(true);
    supabase.from("schulungen").select("*").order("created_at", { ascending: false }).then(({ data, error }) => {
      if (!error && data) setSchulungen(data);
      setSchulungenLoading(false);
    });
  }, [user]);

  async function checkAdmin(email) {
    const { data, error } = await supabase.from("mitarbeiter").select("rolle").eq("email", email).single();
    console.log("checkAdmin:", email, "→ data:", data, "error:", error);
    setIsAdmin(data?.rolle === "admin");
  }

  const showToast=(msg,type="success")=>{setToast({msg,type});setTimeout(()=>setToast(null),5000);};
  const saveSchul=data=>{ if(active&&modal==="edit"){setSchulungen(s=>s.map(x=>x.id===active.id?{...active,...data}:x));showToast("Gespeichert.");}else{const n={...data,id:Date.now(),empfaenger:[],nachweise:{}};setSchulungen(s=>[...s,n]);showToast("Schulung angelegt.");} setModal(null);setActive(null); };
  const sendSchul=(id,empf)=>{setSchulungen(s=>s.map(x=>x.id===id?{...x,empfaenger:empf}:x));setModal(null);setActive(null);const hasC=empf.some(eid=>ma.find(m=>m.id===eid)?.team==="Caritas");showToast(`✓ An ${empf.length} Personen versendet.`);if(hasC)setTimeout(()=>showToast("⚠️ Caritas-Partnerteam einbezogen — bitte offizielle Weitergabe sicherstellen.","warn"),5500);};
  const saveNachweis=(schulungId,nw)=>{const maMatch=ma.find(m=>m.name.toLowerCase()===nw.name.toLowerCase());const key=maMatch?.id||nw.name;setSchulungen(s=>s.map(x=>x.id===schulungId?{...x,nachweise:{...(x.nachweise||{}),[key]:nw}}:x));showToast(`✓ Nachweis gespeichert. Code: ${nw.code}`);};
  const filtered=schulungen.filter(s=>{const mF=filter==="alle"||s.status===filter||(filter==="Pflicht"&&s.pflicht)||(filter==="Versendet"&&s.empfaenger?.length>0);const mS=!search||s.titel.toLowerCase().includes(search.toLowerCase())||s.dokNr?.toLowerCase().includes(search.toLowerCase());return mF&&mS;});

  if (!user) return (
    <div style={{ minHeight:"100vh", background:`linear-gradient(160deg, #E8EFF8 0%, #F0F4F8 60%, #E4EEF5 100%)`, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:FONT, color:C.text, position:"relative", overflow:"hidden" }}>
      {/* Dezente Wellen im Hintergrund */}
      <svg style={{ position:"absolute", bottom:0, left:0, width:"100%", opacity:0.07, pointerEvents:"none" }} viewBox="0 0 1200 200" preserveAspectRatio="none">
        <path d="M0,120 Q200,40 400,100 Q600,160 800,80 Q1000,0 1200,60 L1200,200 L0,200 Z" fill={C.navy}/>
      </svg>
      <svg style={{ position:"absolute", top:0, right:0, width:"60%", opacity:0.04, pointerEvents:"none" }} viewBox="0 0 800 300" preserveAspectRatio="none">
        <path d="M800,0 Q600,80 400,40 Q200,0 0,60 L0,0 Z" fill={C.blueAccent}/>
      </svg>
      <div style={{ background:C.white, borderRadius:16, padding:"40px 36px", width:"100%", maxWidth:420, boxShadow:"0 8px 40px rgba(46,75,110,0.12)", border:`1px solid ${C.border}`, position:"relative", zIndex:1 }}>
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <div style={{ display:"inline-flex", flexDirection:"column", alignItems:"center", gap:4, marginBottom:16 }}>
            <PNRMLogo compact={false} />
          </div>
          <h1 style={{ margin:"4px 0 4px", fontSize:19, fontWeight:700, color:C.text }}>Schulungsverwaltung</h1>
          <p style={{ margin:0, color:C.muted, fontSize:13 }}>Interne Schulungsplattform · SAPV</p>
        </div>
        {loginView==="reset" ? (
          <div>
            <h2 style={{ margin:"0 0 8px", fontSize:18 }}>Passwort zurücksetzen</h2>
            <p style={{ margin:"0 0 14px", fontSize:14, color:C.muted }}>Gib deine E-Mail-Adresse ein. Du erhältst einen Reset-Link.</p>
            {resetResult
              ? <div style={css.good}>{resetResult}</div>
              : <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                  <input type="email" value={resetEmail} onChange={e=>setResetEmail(e.target.value)} placeholder="E-Mail" style={{ ...css.inp, padding:"12px 16px" }} />
                  <button onClick={async()=>{ setResetLoading(true); const {error}=await supabase.auth.resetPasswordForEmail(resetEmail,{redirectTo:"https://pnrm-schulungen.vercel.app"}); if(error){alert(error.message);}else{setResetResult("Reset-Link wurde an deine Email gesendet.");} setResetLoading(false); }} disabled={resetLoading||!resetEmail} style={{ ...css.btn, padding:"12px 16px", fontSize:14, width:"100%", borderRadius:8, opacity:(resetLoading||!resetEmail)?0.65:1 }}>{resetLoading?"Wird gesendet…":"Reset-Link senden"}</button>
                </div>
            }
            <button type="button" onClick={()=>{setLoginView("login");setResetResult(null);}} style={{ background:"none", border:"none", color:C.blueAccent, cursor:"pointer", fontSize:13, marginTop:14, padding:0 }}>← Zurück zum Login</button>
          </div>
        ) : (
          <form onSubmit={async e=>{ e.preventDefault(); setLoginLoading(true); setLoginError(null); const {error}=await supabase.auth.signInWithPassword({email:loginEmail,password:loginPassword}); if(error){setLoginError(error.message);} setLoginLoading(false); }} style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <input type="email" value={loginEmail} onChange={e=>setLoginEmail(e.target.value)} placeholder="E-Mail" required autoComplete="email" style={{ ...css.inp, padding:"12px 16px" }} />
            <input type="password" value={loginPassword} onChange={e=>setLoginPassword(e.target.value)} placeholder="Passwort" required autoComplete="current-password" style={{ ...css.inp, padding:"12px 16px" }} />
            {loginError&&<p style={{ margin:0, fontSize:13, color:C.bad.text }}>{loginError}</p>}
            <button type="submit" disabled={loginLoading} style={{ ...css.btn, padding:"12px 16px", fontSize:14, width:"100%", borderRadius:8, opacity:loginLoading?0.65:1 }}>{loginLoading?"Anmelden…":"Anmelden"}</button>
            <button type="button" onClick={()=>{setLoginView("reset");setResetEmail(loginEmail);}} style={{ background:"none", border:"none", color:C.blueAccent, cursor:"pointer", fontSize:13, padding:0, textAlign:"center" }}>Passwort vergessen?</button>
          </form>
        )}
      </div>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:FONT, color:C.text, fontSize:15 }}>
      {/* Header */}
      <header style={{ background:C.white, borderBottom:`1px solid ${C.border}`, position:"sticky", top:0, zIndex:10, boxShadow:"0 1px 8px rgba(46,75,110,0.06)" }}>
        <div style={{ maxWidth:980, margin:"0 auto", padding:"10px 24px", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:10 }}>
          <PNRMLogo compact={true} />
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
            {isAdmin && user && (
              <span style={{ background:C.navy, color:C.white, borderRadius:20, padding:"4px 12px", fontSize:12, fontWeight:500, whiteSpace:"nowrap" }}>
                ⚿ {user.email}
              </span>
            )}
            {!isAdmin && user && <span style={{ fontSize:12, color:C.muted, whiteSpace:"nowrap" }}>{user.email}</span>}
            {user && <button onClick={()=>exportExcel(schulungen,ma)} style={{ ...css.btnSec, fontSize:13, padding:"7px 13px" }}>Excel-Export</button>}
            {isAdmin&&<button onClick={()=>{setActive(null);setModal("neu");setTab("schulungen");}} style={{ ...css.btn, fontSize:13, padding:"7px 14px" }}>+ Neue Schulung</button>}
            <button type="button" onClick={()=>supabase.auth.signOut()} style={{ ...css.btnSec, fontSize:12, padding:"6px 12px" }}>Abmelden</button>
          </div>
        </div>
      </header>

      <div style={{ maxWidth:980, margin:"0 auto", padding:"20px" }}>
        {/* Stats */}
        <div style={{ display:"flex", gap:8, marginBottom:18, flexWrap:"wrap" }}>
          {[["Schulungen",schulungen.length,C.navy],["Freigegeben",schulungen.filter(s=>s.status==="Freigegeben").length,C.good.text],["Versendet",schulungen.filter(s=>s.empfaenger?.length>0).length,C.blueAccent],["Nachweise",schulungen.reduce((a,s)=>a+Object.keys(s.nachweise||{}).length,0),C.teal],["Mitarbeiter",ma.length,C.muted]].map(([l,v,accent])=>(
            <div key={l} style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:8, padding:"10px 16px", borderLeft:`3px solid ${accent}`, display:"flex", flexDirection:"column", gap:2 }}>
              <div style={{ fontSize:22, fontWeight:700, color:C.navy, lineHeight:1 }}>{v}</div>
              <div style={{ fontSize:11, color:C.muted }}>{l}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display:"flex", borderBottom:`1px solid ${C.border}`, marginBottom:18 }}>
          {[["schulungen","Schulungen"],["wissen","Wissen"],...(user?[["mitarbeiter","Mitarbeiter"]]:[])]  .map(([id,label])=>(
            <button key={id} onClick={()=>setTab(id)} style={{ background:"none", border:"none", borderBottom:tab===id?`3px solid ${C.navy}`:"3px solid transparent", color:tab===id?C.navy:C.muted, padding:"10px 18px", cursor:"pointer", fontSize:14, fontWeight:tab===id?700:400, marginBottom:-1, fontFamily:FONT }}>{label}</button>
          ))}
        </div>

        {tab==="schulungen"&&<>
          <div style={{ display:"flex", gap:6, marginBottom:14, flexWrap:"wrap", alignItems:"center" }}>
            {["alle","Freigegeben","Entwurf","Pflicht","Versendet"].map(f=>(
              <button key={f} onClick={()=>setFilter(f)} style={{ background:filter===f?C.navy:"transparent", color:filter===f?C.white:C.muted, border:`1px solid ${filter===f?C.navy:C.border}`, padding:"5px 13px", borderRadius:999, cursor:"pointer", fontSize:13, fontWeight:filter===f?600:400, fontFamily:FONT }}>{f}</button>
            ))}
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Titel oder Dok.-Nr. suchen…" style={{ ...css.inp, flex:1, minWidth:160, padding:"7px 12px", fontSize:13 }} />
          </div>
          {schulungenLoading&&<p style={{ color:C.muted, textAlign:"center", padding:40 }}>Schulungen werden geladen…</p>}
          {!schulungenLoading&&filtered.length===0&&<p style={{ color:C.muted, textAlign:"center", padding:40 }}>Keine Schulungen gefunden.</p>}
          {filtered.map(sc=>{
            const nwCount=Object.keys(sc.nachweise||{}).length; const sent=sc.empfaenger?.length||0;
            const statusStyle = sc.status==="Freigegeben"
              ? { background:C.good.bg, color:C.good.text }
              : sc.status==="Entwurf"
              ? { background:"#EAECEF", color:C.muted }
              : { background:C.warn.bg, color:C.warn.text };
            return <div key={sc.id}
              style={{ ...css.section, cursor:"pointer", padding:20, transition:"box-shadow .15s, border-color .15s" }}
              onClick={()=>{setActive(sc);setModal("player");}}
              onMouseEnter={e=>{e.currentTarget.style.boxShadow="0 4px 20px rgba(46,75,110,0.1)";e.currentTarget.style.borderColor=C.blueAccent;}}
              onMouseLeave={e=>{e.currentTarget.style.boxShadow="none";e.currentTarget.style.borderColor=C.border;}}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:12 }}>
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", gap:6, marginBottom:8, flexWrap:"wrap", alignItems:"center" }}>
                    <span style={{ ...css.badge }}>{sc.kategorie}</span>
                    <span style={{ ...css.badge, ...statusStyle }}>{sc.status}</span>
                    {sc.pflicht&&<span style={{ ...css.badge, background:C.warn.bg, color:C.warn.text }}>Pflicht</span>}
                  </div>
                  <h3 style={{ margin:"0 0 4px", fontSize:17, fontWeight:600, color:C.text }}>{sc.titel}</h3>
                  <p style={{ margin:0, fontSize:13, color:C.muted }}>{sc.dokNr} · v{sc.version} · {sc.gueltigAb}{sent>0?` · ${sent} Empf. · ${nwCount}/${sent} Nachweise`:""}</p>
                </div>
                <div style={{ display:"flex", gap:7 }} onClick={e=>e.stopPropagation()}>
                  {isAdmin&&<button onClick={()=>{setActive(sc);setModal("edit");}} style={{ ...css.btnSec, padding:"6px 12px", fontSize:13 }}>Bearbeiten</button>}
                  {isAdmin&&sent>0&&<button onClick={()=>{setActive(sc);setModal("nw");}} style={{ ...css.btnSec, padding:"6px 12px", fontSize:13 }}>Nachweise</button>}
                  {isAdmin&&sc.status==="Freigegeben"&&<button onClick={()=>{setActive(sc);setModal("send");}} style={{ ...css.btn, padding:"6px 12px", fontSize:13 }}>✉ Senden</button>}
                </div>
              </div>
            </div>;
          })}
        </>}
        {tab==="wissen"&&<WissenView isAdmin={isAdmin} showToast={showToast} />}
        {tab==="mitarbeiter"&&<MitarbeiterView ma={ma} setMa={setMa} showToast={showToast} isAdmin={isAdmin} />}
      </div>

      {(modal==="neu"||modal==="edit")&&<Modal onClose={()=>setModal(null)} wide><SchulungForm schulung={modal==="edit"?active:null} onSave={saveSchul} onClose={()=>setModal(null)} isAdmin={isAdmin} /></Modal>}
      {modal==="player"&&active&&<Modal onClose={()=>setModal(null)} wide><SchulungsPlayer sc={active} onClose={()=>setModal(null)} onNachweis={(id,nw)=>saveNachweis(id,nw)} /></Modal>}
      {modal==="send"&&active&&<Modal onClose={()=>setModal(null)}><SendModal sc={active} ma={ma} onClose={()=>setModal(null)} onSend={sendSchul} /></Modal>}
      {modal==="nw"&&active&&<Modal onClose={()=>setModal(null)} wide><NachweisModal sc={active} ma={ma} onClose={()=>setModal(null)} /></Modal>}

      {toast&&<div style={{ position:"fixed",bottom:22,right:22,background:toast.type==="warn"?C.warn.bg:C.good.bg,border:`1px solid ${toast.type==="warn"?C.warn.border:C.good.border}`,color:toast.type==="warn"?C.warn.text:C.good.text,padding:"12px 20px",borderRadius:12,fontSize:14,fontWeight:600,boxShadow:"0 8px 24px rgba(0,0,0,.12)",zIndex:200,maxWidth:400,animation:"fadeIn .3s" }}>{toast.msg}</div>}
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}} *{box-sizing:border-box} body{font-family:'Inter',-apple-system,sans-serif;background:#F0F4F8} select option{background:#fff;color:#1A2638} button:hover{filter:brightness(.93)} input:focus,textarea:focus,select:focus{border-color:#2E4B6E!important;outline:none!important;box-shadow:0 0 0 3px rgba(46,75,110,0.08)!important;}`}</style>
    </div>
  );
}
