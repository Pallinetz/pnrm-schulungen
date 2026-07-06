import { useState, useRef, useEffect } from "react";
import * as XLSX from "xlsx";
import { VideoUploader } from "./components/VideoUploader";
import { VideoPlayer } from "./components/VideoPlayer";
import { getSignedVideoUrl, deleteVideo } from "./lib/videoStorage";
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
  section: { background:C.white, border:`1px solid ${C.border}`, borderRadius:14, padding:20, margin:"12px 0", boxShadow:"0 1px 2px rgba(22,35,58,.04)" },
  inp: { width:"100%", fontSize:14, padding:"10px 14px", border:`1px solid ${C.inputBorder}`, borderRadius:9, background:C.white, color:C.text, boxSizing:"border-box", fontFamily:FONT, outline:"none", transition:"border-color .15s ease, box-shadow .15s ease" },
  lbl: { display:"block", fontWeight:600, marginBottom:4, fontSize:13, color:C.text },
  btn: { appearance:"none", border:0, borderRadius:9, background:`linear-gradient(180deg, #35577E, ${C.navy})`, color:C.white, padding:"9px 16px", fontWeight:600, fontSize:14, cursor:"pointer", fontFamily:FONT, boxShadow:"0 1px 3px rgba(30,52,82,.3), inset 0 1px 0 rgba(255,255,255,.08)", transition:"transform .12s ease, box-shadow .12s ease" },
  btnSec: { appearance:"none", borderRadius:9, background:C.white, color:C.navy, border:`1px solid ${C.inputBorder}`, padding:"9px 16px", fontWeight:600, fontSize:14, cursor:"pointer", fontFamily:FONT, boxShadow:"0 1px 2px rgba(22,35,58,.05)", transition:"border-color .12s ease, box-shadow .12s ease" },
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
function PNRMLogo({ compact, white }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-start", lineHeight:1 }}>
      <img src="/logo.png" alt="Palliativ Netzwerk Rhein-Maas" style={{ height: compact ? "40px" : "60px", width:"auto", objectFit:"contain", display:"block", filter: white ? "brightness(0) invert(1)" : "none" }} />
      {!compact && !white && <div style={{ fontSize:11, color:C.muted, letterSpacing:"0.3px", marginTop:6 }}>Schulungsverwaltung</div>}
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

  // ─── Load Mitarbeiter von Supabase ──────────────────────────────────────
  useEffect(() => {
    const loadMa = async () => {
      try {
        const { data, error } = await supabase.from('mitarbeiter').select('*').order('name');
        if (!error && data) {
          setMa(data.map(m => ({ ...m, bestaetigt: m.bestaetigt || false })));
        }
      } catch (e) {
        console.error('Fehler beim Laden von Mitarbeitern:', e);
      }
    };
    if (user) loadMa();
  }, [user]);
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
function buildInviteMail(name, email, password, app) {
  const subject = app === "schulungen"
    ? "Zugangsdaten – Schulungen & Wissen – Palliativ Netzwerk Rhein-Maas"
    : "Zugangsdaten – Raumplanung – Palliativ Netzwerk Rhein-Maas";
  const label = app === "schulungen" ? "Schulungen & Wissen" : "Raumplanung";
  const body = `Hallo ${name},\n\nhier sind deine Zugangsdaten für ${label} der Palliativ Netzwerk Rhein-Maas:\n\nE-Mail: ${email}\nEinmalpasswort: ${password}\n\nBitte melde dich unter https://pnrm-schulungen.vercel.app an. Direkt nach der ersten Anmeldung wirst du gebeten, ein eigenes Passwort zu vergeben.\n\n`;
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}


function parseImportFile(file) {
  return new Promise((resolve, reject) => {
    const isCsv = /\.csv$/i.test(file.name);
    const r = new FileReader();
    r.onerror = () => reject(new Error("Datei konnte nicht gelesen werden."));
    r.onload = ev => {
      try {
        let rows = [];
        if (isCsv) {
          const text = ev.target.result;
          const lines = text.split(/\r?\n/).filter(l => l.trim());
          if (!lines.length) return resolve([]);
          const delim = lines[0].includes(";") ? ";" : ",";
          const header = lines[0].split(delim).map(h => h.trim().toLowerCase());
          const idxV = header.findIndex(h => h.includes("vorname"));
          const idxN = header.findIndex(h => h.includes("nachname") || (h.includes("name") && !h.includes("vorname") && !h.includes("nutzername")));
          const idxE = header.findIndex(h => h.includes("mail"));
          rows = lines.slice(1).map(line => {
            const c = line.split(delim);
            return {
              vorname: idxV > -1 ? (c[idxV] || "").trim() : "",
              nachname: idxN > -1 ? (c[idxN] || "").trim() : "",
              email: idxE > -1 ? (c[idxE] || "").trim() : "",
            };
          });
        } else {
          const wb = XLSX.read(ev.target.result, { type: "binary" });
          const json = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
          rows = json.map(r => {
            const keys = Object.keys(r);
            const kV = keys.find(k => k.toLowerCase().includes("vorname"));
            const kN = keys.find(k => k.toLowerCase().includes("nachname") || (k.toLowerCase().includes("name") && !k.toLowerCase().includes("vorname")));
            const kE = keys.find(k => k.toLowerCase().includes("mail"));
            return {
              vorname: kV ? String(r[kV] || "").trim() : "",
              nachname: kN ? String(r[kN] || "").trim() : "",
              email: kE ? String(r[kE] || "").trim() : "",
            };
          });
        }
        resolve(rows.filter(r => r.email && r.email.includes("@")));
      } catch (e) {
        reject(e);
      }
    };
    if (isCsv) r.readAsText(file, "utf-8");
    else r.readAsBinaryString(file);
  });
}

function BulkInviteModal({ onClose, showToast, onInviteSent }) {
  const [rows, setRows] = useState([]);
  const [rolle, setRolle] = useState("user");
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState(null);
  const fileRef = useRef();

  const handleFile = async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const parsed = await parseImportFile(file);
      if (!parsed.length) { showToast("Keine gültigen Zeilen mit E-Mail gefunden."); return; }
      setRows(parsed);
    } catch (err) {
      showToast(`Fehler beim Lesen: ${err.message}`);
    }
    e.target.value = "";
  };

  const removeRow = i => setRows(r => r.filter((_, idx) => idx !== i));

  const createAll = async () => {
    setProcessing(true);
    const { data: { session } } = await supabase.auth.getSession();
    const out = [];
    for (const row of rows) {
      const name = `${row.vorname} ${row.nachname}`.trim() || row.email;
      try {
        const res = await supabase.functions.invoke("send-invitation-email", {
          body: { action: "create_link_schulungen", email: row.email, name, rolle },
          headers: { Authorization: `Bearer ${session.access_token}` }
        });
        if (res.error) throw new Error(res.error.message);
        if (res.data?.error) throw new Error(res.data.error);
        out.push({ name, email: row.email, password: res.data.password, ok: true });
        if (onInviteSent) onInviteSent({ email: row.email, name, rolle, id: `bulk_${Date.now()}_${row.email}`, bestaetigt: false });
      } catch (err) {
        out.push({ name, email: row.email, error: err.message, ok: false });
      }
    }
    setResults(out);
    setProcessing(false);
  };

  const copyPassword = password => navigator.clipboard.writeText(password);
  const openMail = (name, email, password) => { window.location.href = buildInviteMail(name, email, password, "schulungen"); };

  return (
    <div style={{ fontFamily: FONT, color: C.text }}>
      <h2 style={{ margin: "0 0 6px", fontSize: 20 }}>Mehrere Mitarbeiter einladen</h2>
      <p style={{ margin: "0 0 16px", fontSize: 13, color: C.muted }}>CSV oder Excel mit Spalten Vorname, Nachname, E-Mail hochladen.</p>

      {!results && (
        <>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14 }}>
            <button onClick={() => fileRef.current.click()} style={{ ...css.btnSec, fontSize: 13, padding: "8px 14px" }}>📁 Datei auswählen</button>
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleFile} style={{ display: "none" }} />
            {rows.length > 0 && <span style={{ fontSize: 13, color: C.muted }}>{rows.length} Person{rows.length !== 1 ? "en" : ""} erkannt</span>}
            <div style={{ marginLeft: "auto" }}>
              <select value={rolle} onChange={e => setRolle(e.target.value)} style={{ ...css.inp, fontSize: 13, padding: "6px 10px" }}>
                <option value="user">Alle als Nutzer</option>
                <option value="admin">Alle als Admin</option>
              </select>
            </div>
          </div>

          {rows.length > 0 && (
            <div style={{ maxHeight: 280, overflowY: "auto", border: `1px solid ${C.border}`, borderRadius: 10 }}>
              {rows.map((r, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderBottom: i < rows.length - 1 ? `1px solid ${C.border}` : "none" }}>
                  <div style={{ flex: 1, fontSize: 13 }}><strong>{r.vorname} {r.nachname}</strong></div>
                  <div style={{ flex: 1, fontSize: 13, color: C.muted }}>{r.email}</div>
                  <button onClick={() => removeRow(i)} style={{ ...css.btnDanger, padding: "3px 9px", fontSize: 12 }}>✕</button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {results && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 340, overflowY: "auto" }}>
          {results.map((r, i) => (
            <div key={i} style={{ ...css.section, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", borderLeft: `4px solid ${r.ok ? C.blue : "#dc2626"}` }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{r.name}</div>
                <div style={{ fontSize: 12, color: C.muted }}>{r.email}</div>
                {!r.ok && <div style={{ fontSize: 12, color: "#dc2626", marginTop: 3 }}>Fehler: {r.error}</div>}
              </div>
              {r.ok && (
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => copyPassword(r.password)} style={{ ...css.btnSec, fontSize: 12, padding: "5px 10px" }}>Passwort kopieren</button>
                  <button onClick={() => openMail(r.name, r.email, r.password)} style={{ ...css.btn, fontSize: 12, padding: "5px 10px" }}>In Outlook öffnen</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 18 }}>
        <button onClick={onClose} style={css.btnSec}>Schließen</button>
        {!results && rows.length > 0 && (
          <button onClick={createAll} disabled={processing} style={{ ...css.btn, opacity: processing ? 0.65 : 1 }}>
            {processing ? "Erstelle Zugänge…" : `${rows.length} Zugänge erstellen`}
          </button>
        )}
      </div>
    </div>
  );
}

function InviteModal({ onClose, showToast, onInviteSent }) {
  const [form, setForm] = useState({ name:"", email:"", rolle:"user" });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [password, setPassword] = useState(null);
  const [copied, setCopied] = useState(false);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const handleInvite = async () => {
    if (!form.email.trim() || !form.name.trim()) return;
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("send-invitation-email", {
        body: { action:"create_link_schulungen", email: form.email, name: form.name, rolle: form.rolle },
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);
      const pw = res.data.password;
      setPassword(pw);
      setResult(`Zugang für ${form.email} erstellt.`);
      if (onInviteSent) onInviteSent({ email: form.email, name: form.name, rolle: form.rolle, id: `sent_${Date.now()}`, bestaetigt: false });
      window.location.href = buildInviteMail(form.name, form.email, pw, "schulungen");
    } catch (e) {
      setResult(`Fehler: ${e.message}`);
    }
    setLoading(false);
  };

  const copyPassword = () => {
    navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(()=>setCopied(false), 2000);
  };

  return (
    <div style={{ fontFamily:FONT, color:C.text }}>
      <h2 style={{ margin:"0 0 18px", fontSize:20 }}>Mitarbeiter einladen</h2>
      {result
        ? <div>
            <div style={css.good}>{result}</div>
            {password && (
              <div style={{ marginTop:14 }}>
                <p style={{ fontSize:13, color:C.muted, margin:"0 0 8px" }}>Outlook sollte sich mit Zugangsdaten (E-Mail + Einmalpasswort) geöffnet haben. Falls nicht, Passwort manuell kopieren:</p>
                <div style={{ display:"flex", gap:8 }}>
                  <input readOnly value={password} style={{ ...css.inp, fontSize:12, flex:1 }} onClick={e=>e.target.select()} />
                  <button onClick={copyPassword} style={{ ...css.btnSec, padding:"8px 14px", fontSize:13 }}>{copied?"Kopiert!":"Kopieren"}</button>
                </div>
              </div>
            )}
          </div>
        : <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <div><label style={css.lbl}>Name</label><input value={form.name} onChange={e=>set("name",e.target.value)} style={css.inp} placeholder="Vor- und Nachname" /></div>
            <div><label style={css.lbl}>E-Mail</label><input type="email" value={form.email} onChange={e=>set("email",e.target.value)} style={css.inp} placeholder="email@pallinetz.de" /></div>
            <div><label style={css.lbl}>Zugriff</label><select value={form.rolle} onChange={e=>set("rolle",e.target.value)} style={css.inp}><option value="user">Nutzer – nur Schulungen ansehen</option><option value="admin">Admin – Schulungen verwalten & Mitarbeiter einladen</option></select></div>
          </div>
      }
      <div style={{ display:"flex", gap:8, justifyContent:"flex-end", marginTop:18 }}>
        <button onClick={onClose} style={css.btnSec}>Schließen</button>
        {!result && <button onClick={handleInvite} disabled={loading||!form.email||!form.name} style={{ ...css.btn, opacity:(loading||!form.email||!form.name)?0.65:1 }}>{loading?"Wird erstellt…":"Einladung erstellen & in Outlook öffnen"}</button>}
      </div>
    </div>
  );
}

function MitarbeiterView({ ma, setMa, showToast, isAdmin, user }) {
  const [loading, setLoading] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [resending, setResending] = useState(null);
  const fileRef = useRef();

  const importCSV = e => {
    const file = e.target.files[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = ev => {
      const wb = XLSX.read(ev.target.result, { type: "binary" });
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      const imp = rows.map((r, i) => ({
        id: `imp_${Date.now()}_${i}`,
        name: r.Name || r.name || "",
        email: r.Email || r.email || "",
        rolle: "user",
      })).filter(m => m.name && m.email);
      setMa(m => {
        const ex = new Set(m.map(x => x.email.toLowerCase()));
        const news = imp.filter(x => !ex.has(x.email.toLowerCase()));
        showToast(`${news.length} neue importiert.`);
        return [...m, ...news];
      });
    };
    r.readAsBinaryString(file);
    e.target.value = "";
  };

  const resendInvite = async (email, name, rolle) => {
    setResending(email);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("send-invitation-email", {
        body: { action: "create_link_schulungen", email, name, rolle },
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);
      const password = res.data.password;
      showToast(`Neues Einmalpasswort für ${email} erstellt – Outlook öffnet sich.`);
      window.location.href = buildInviteMail(name, email, password, "schulungen");
    } catch (e) {
      showToast(`Fehler: ${e.message}`);
    }
    setResending(null);
  };

  const deleteUser = async (id, email) => {
    setMa(m => m.filter(x => x.id !== id));
    showToast(`${email} entfernt.`);
  };

  return (
    <div style={{ fontFamily: FONT }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>👥 Mitarbeiter</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => fileRef.current.click()} style={{ ...css.btnSec, fontSize: 13, padding: "8px 13px" }}>📥 Import CSV</button>
          <input ref={fileRef} type="file" accept=".xlsx,.csv" onChange={importCSV} style={{ display: "none" }} />
          {isAdmin && <button onClick={() => setBulkOpen(true)} style={{ ...css.btnSec, fontSize: 13, padding: "8px 14px" }}>📊 Mehrere per Excel/CSV</button>}
          {isAdmin && <button onClick={() => setInviteOpen(true)} style={{ ...css.btn, fontSize: 13, padding: "8px 14px" }}>+ Mitarbeiter einladen</button>}
        </div>
      </div>

      {ma.length === 0 ? (
        <div style={{ textAlign: "center", padding: "2rem", color: C.muted }}>Noch keine Mitarbeiter. Laden Sie welche ein!</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {ma.map(m => {
            const bestaetigt = m.bestaetigt || false;
            return (
              <div key={m.email || m.id} style={{
                ...css.section,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "12px 14px",
                borderLeft: `4px solid ${bestaetigt ? C.blue : "#fbbf24"}`,
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>{m.name}</div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>{m.email}</div>
                  <div style={{ fontSize: 11, marginTop: 4, display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{
                      background: m.rolle === "admin" ? C.blueDim : "#f3f4f6",
                      color: m.rolle === "admin" ? C.blue : "#6b7280",
                      padding: "1px 7px",
                      borderRadius: 20,
                      fontWeight: 700,
                    }}>
                      {m.rolle === "admin" ? "Admin" : "Nutzer"}
                    </span>
                    {bestaetigt
                      ? <span style={{ color: C.muted }}>✓ Bestätigt</span>
                      : <span style={{ color: "#f59e0b", fontWeight: 600 }}>⏳ Einladung ausstehend</span>
                    }
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    onClick={() => resendInvite(m.email, m.name, m.rolle)}
                    disabled={resending === m.email}
                    style={{
                      ...css.btnSec,
                      padding: "5px 11px",
                      fontSize: 12,
                      opacity: resending === m.email ? 0.65 : 1,
                    }}
                  >
                    {resending === m.email ? "Wird gesendet…" : "Erneut senden"}
                  </button>
                  <button
                    onClick={() => deleteUser(m.id, m.email)}
                    style={{ ...css.btnDanger, padding: "5px 11px" }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {inviteOpen && (
        <Modal onClose={() => setInviteOpen(false)}>
          <InviteModal
            onClose={() => setInviteOpen(false)}
            showToast={showToast}
            onInviteSent={(m) => {
              setMa(list => [...list, m]);
              setInviteOpen(false);
            }}
          />
        </Modal>
      )}

      {bulkOpen && (
        <Modal onClose={() => setBulkOpen(false)} wide>
          <BulkInviteModal
            onClose={() => setBulkOpen(false)}
            showToast={showToast}
            onInviteSent={(m) => {
              setMa(list => {
                if (list.some(x => x.email === m.email)) return list;
                return [...list, m];
              });
            }}
          />
        </Modal>
      )}

      <div style={{ marginTop: 14, padding: "10px 14px", background: "#fbfcff", border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 12, color: C.muted }}>
        CSV-Format: Spalten <strong style={{ color: C.text }}>Name, Email</strong>
      </div>
    </div>
  );
}
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

  const saveArtikel = async () => {
    if (!form.titel.trim()) return;
    const payload = {
      titel:form.titel, kategorie_id:form.kategorie_id||null, inhalt:form.inhalt, status:form.status||"Entwurf",
      dok_nr:form.dokNr||null, version:form.version||"1.0", autor:form.autor||null,
      freigegeben_von:form.freigegebenVon||null, gueltig_ab:form.gueltigAb||null,
      geltungsbereich:form.geltungsbereich||null, bezugsdokumente:form.bezugsdokumente||null,
    };
    if (editing==="neu") {
      const { data, error } = await supabase.from("wissen_artikel").insert(payload).select("*, wissen_dateien(*)").single();
      if (error) { showToast(`Fehler: ${error.message}`); return; }
      setArtikel(a=>[...a,{ ...data, dateien:data.wissen_dateien ?? [] }]);
      showToast("Artikel erstellt.");
    } else {
      const { data, error } = await supabase.from("wissen_artikel").update(payload).eq("id",editing).select("*, wissen_dateien(*)").single();
      if (error) { showToast(`Fehler: ${error.message}`); return; }
      setArtikel(a=>a.map(x=>x.id===editing?{ ...data, dateien:data.wissen_dateien ?? [] }:x));
      showToast("Gespeichert.");
    }
    setEditing(null);
  };

  const deleteArtikel = async (id) => {
    const { error } = await supabase.from("wissen_artikel").delete().eq("id",id);
    if (error) { showToast(`Fehler: ${error.message}`); return; }
    setArtikel(x=>x.filter(y=>y.id!==id));
    showToast("Gelöscht.");
  };

  const addVideo = async (artikelId, { path, name }) => {
    const { data, error } = await supabase.from("wissen_dateien").insert({ artikel_id:artikelId, name, typ:"video", url:path }).select().single();
    if (error) { showToast(`Fehler: ${error.message}`); return; }
    setArtikel(a=>a.map(x=>x.id===artikelId ? { ...x, dateien:[...x.dateien,data] } : x));
    showToast("Video angehängt.");
  };

  const removeVideo = async (artikelId, dateiId, url) => {
    const { error } = await supabase.from("wissen_dateien").delete().eq("id",dateiId);
    if (error) { showToast(`Fehler: ${error.message}`); return; }
    setArtikel(a=>a.map(x=>x.id===artikelId ? { ...x, dateien:x.dateien.filter(d=>d.id!==dateiId) } : x));
    deleteVideo(url).catch(console.error);
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
          <button onClick={()=>{ setForm({titel:"",kategorie_id:Object.keys(kategorieMap)[0]||"",inhalt:"",status:"Entwurf",dokNr:"",version:"1.0",autor:"",freigegebenVon:"",gueltigAb:new Date().toISOString().slice(0,10),geltungsbereich:"",bezugsdokumente:""}); setEditing("neu"); }} style={{ ...css.btn, fontSize:13, padding:"8px 14px" }}>+ Neuer Artikel</button>
        )}
        {isAdmin && selected && !editing && (
          <button onClick={()=>{ setForm({titel:art.titel,kategorie_id:art.kategorie_id||"",inhalt:art.inhalt,status:art.status||"Entwurf",dokNr:art.dok_nr||"",version:art.version||"1.0",autor:art.autor||"",freigegebenVon:art.freigegeben_von||"",gueltigAb:art.gueltig_ab||"",geltungsbereich:art.geltungsbereich||"",bezugsdokumente:art.bezugsdokumente||""}); setEditing(selected); }} style={{ ...css.btnSec, fontSize:13, padding:"8px 14px" }}>✏️ Bearbeiten</button>
        )}
      </div>

      {/* Formular */}
      {editing && (
        <div style={css.section}>
          <h3 style={{ margin:"0 0 14px", fontSize:16 }}>{editing==="neu"?"Neuer Artikel":"Artikel bearbeiten"}</h3>
          <div style={{ display:"grid", gridTemplateColumns:"1fr auto auto", gap:12, marginBottom:12 }}>
            <div>
              <label style={css.lbl}>Titel</label>
              <input value={form.titel} onChange={e=>setF("titel",e.target.value)} style={css.inp} />
            </div>
            <div>
              <label style={css.lbl}>Kategorie</label>
              <select value={form.kategorie_id} onChange={e=>setF("kategorie_id",e.target.value)} style={css.inp}>
                {Object.entries(kategorieMap).map(([id,name])=><option key={id} value={id}>{name}</option>)}
              </select>
            </div>
            <div>
              <label style={css.lbl}>Status</label>
              <select value={form.status} onChange={e=>setF("status",e.target.value)} style={css.inp}>
                <option>Entwurf</option><option>Freigegeben</option><option>Archiviert</option>
              </select>
            </div>
          </div>

          <h4 style={{ margin:"0 0 10px", fontSize:14, color:C.muted }}>📋 Dokumentenlenkung (DIN EN 15224)</h4>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
            {[["dokNr","Dok.-Nr."],["version","Version"],["autor","Erstellt durch"],["freigegebenVon","Freigegeben durch"],["gueltigAb","Gültig ab"]].map(([k,l])=>(
              <div key={k}>
                <label style={css.lbl}>{l}</label>
                <input type={k==="gueltigAb"?"date":"text"} value={form[k]||""} onChange={e=>setF(k,e.target.value)} style={css.inp} />
              </div>
            ))}
          </div>
          {[["geltungsbereich","Geltungsbereich"],["bezugsdokumente","Bezugsdokumente / Normen"]].map(([k,l])=>(
            <div key={k} style={{ marginBottom:12 }}>
              <label style={css.lbl}>{l}</label>
              <input value={form[k]||""} onChange={e=>setF(k,e.target.value)} style={css.inp} />
            </div>
          ))}

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
          <span style={{ ...css.badge, marginBottom:10, marginRight:6, display:"inline-block" }}>{kategorieMap[art.kategorie_id] ?? art.kategorie ?? "—"}</span>
          {isAdmin && art.status && art.status!=="Freigegeben" && <span style={{ ...css.badge, marginBottom:10, display:"inline-block", background:"#fde68a", color:"#92400e" }}>{art.status}</span>}
          <h2 style={{ margin:"0 0 14px", fontSize:20 }}>{art.titel}</h2>
          <p style={{ margin:"0 0 20px", whiteSpace:"pre-wrap", lineHeight:1.7 }}>{art.inhalt}</p>
          {art.dateien.filter(d=>d.typ==="video").map(d=>(
            <div key={d.id} style={{ position:"relative", marginBottom:8 }}>
              <WissenVideoBlock datei={d} />
              {isAdmin && (
                <button onClick={()=>removeVideo(art.id,d.id,d.url)} style={{ ...css.btnDanger, position:"absolute", top:0, right:0, padding:"3px 9px", fontSize:12 }}>✕</button>
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
                    <span style={{ ...css.badge, marginBottom:6, marginRight:6, display:"inline-block" }}>{kategorieMap[a.kategorie_id] ?? a.kategorie ?? "—"}</span>
                    {isAdmin && a.status && a.status!=="Freigegeben" && <span style={{ ...css.badge, marginBottom:6, display:"inline-block", background:"#fde68a", color:"#92400e" }}>{a.status}</span>}
                    <h3 style={{ margin:"0 0 4px", fontSize:16 }}>{a.titel}</h3>
                    <p style={{ margin:0, fontSize:12, color:C.muted }}>{stripMd(a.inhalt).slice(0,120)}{stripMd(a.inhalt).length>120?"…":""}</p>
                    {videos>0 && <span style={{ fontSize:12, color:C.blue, marginTop:4, display:"inline-block" }}>▶ {videos} Video{videos!==1?"s":""}</span>}
                  </div>
                  {isAdmin && (
                    <button onClick={e=>{e.stopPropagation();deleteArtikel(a.id);}} style={{ ...css.btnDanger, padding:"5px 11px" }}>✕</button>
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
  const [ma, setMa] = useState([]);
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
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [newPassword2, setNewPassword2] = useState("");
  const [pwChangeError, setPwChangeError] = useState(null);
  const [pwChangeLoading, setPwChangeLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setMustChangePassword(session?.user?.user_metadata?.must_change_password === true);
      if (session?.user) checkAdmin(session.user.email);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setMustChangePassword(session?.user?.user_metadata?.must_change_password === true);
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
    if (error || !data) {
      // Angemeldet bei Supabase Auth, aber kein Eintrag in der Mitarbeiter-Tabelle
      // (z.B. Selbstregistrierung falls Auth-Signup nicht deaktiviert ist, oder entfernter Mitarbeiter).
      setIsAdmin(false);
      setLoginError("Dieses Konto ist nicht für die Schulungsplattform freigeschaltet. Bitte wende dich an das Admin-Team.");
      await supabase.auth.signOut();
      return;
    }
    setIsAdmin(data.rolle === "admin");
  }

  const showToast=(msg,type="success")=>{setToast({msg,type});setTimeout(()=>setToast(null),5000);};
  const saveSchul=data=>{ if(active&&modal==="edit"){setSchulungen(s=>s.map(x=>x.id===active.id?{...active,...data}:x));showToast("Gespeichert.");}else{const n={...data,id:Date.now(),empfaenger:[],nachweise:{}};setSchulungen(s=>[...s,n]);showToast("Schulung angelegt.");} setModal(null);setActive(null); };
  const sendSchul=(id,empf)=>{setSchulungen(s=>s.map(x=>x.id===id?{...x,empfaenger:empf}:x));setModal(null);setActive(null);const hasC=empf.some(eid=>ma.find(m=>m.id===eid)?.team==="Caritas");showToast(`✓ An ${empf.length} Personen versendet.`);if(hasC)setTimeout(()=>showToast("⚠️ Caritas-Partnerteam einbezogen — bitte offizielle Weitergabe sicherstellen.","warn"),5500);};
  const saveNachweis=(schulungId,nw)=>{const maMatch=ma.find(m=>m.name.toLowerCase()===nw.name.toLowerCase());const key=maMatch?.id||nw.name;setSchulungen(s=>s.map(x=>x.id===schulungId?{...x,nachweise:{...(x.nachweise||{}),[key]:nw}}:x));showToast(`✓ Nachweis gespeichert. Code: ${nw.code}`);};
  const filtered=schulungen.filter(s=>{const mF=filter==="alle"||s.status===filter||(filter==="Pflicht"&&s.pflicht)||(filter==="Versendet"&&s.empfaenger?.length>0);const mS=!search||s.titel.toLowerCase().includes(search.toLowerCase())||s.dokNr?.toLowerCase().includes(search.toLowerCase());return mF&&mS;});

  if (!user) return (
    <div style={{ minHeight:"100vh", display:"flex", fontFamily:FONT, color:C.text }}>
      {/* Marken-Panel */}
      <div className="pnrm-brandpanel" style={{ flex:"0 0 44%", background:`linear-gradient(165deg, ${C.navyDark} 0%, ${C.navy} 55%, #35597F 100%)`, color:C.white, display:"flex", flexDirection:"column", justifyContent:"space-between", padding:"48px 52px", position:"relative", overflow:"hidden" }}>
        <svg style={{ position:"absolute", bottom:-20, left:0, width:"140%", opacity:0.1, pointerEvents:"none" }} viewBox="0 0 1200 300" preserveAspectRatio="none">
          <path d="M0,180 Q200,80 400,150 Q600,220 800,120 Q1000,20 1200,100 L1200,300 L0,300 Z" fill="#fff"/>
        </svg>
        <svg style={{ position:"absolute", top:40, right:-60, width:280, height:280, opacity:0.06, pointerEvents:"none" }} viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="48" fill="none" stroke="#fff" strokeWidth="0.8"/>
          <circle cx="50" cy="50" r="34" fill="none" stroke="#fff" strokeWidth="0.8"/>
          <circle cx="50" cy="50" r="20" fill="none" stroke="#fff" strokeWidth="0.8"/>
        </svg>
        <PNRMLogo compact={false} white />
        <div style={{ position:"relative", zIndex:1 }}>
          <div style={{ fontSize:12, fontWeight:600, letterSpacing:"2.5px", textTransform:"uppercase", opacity:0.55, marginBottom:14 }}>Schulungen &amp; Wissen</div>
          <h1 style={{ margin:0, fontSize:30, fontWeight:700, lineHeight:1.25, letterSpacing:"-0.02em", maxWidth:380 }}>Wissen, das in der Versorgung ankommt.</h1>
          <p style={{ margin:"14px 0 0", fontSize:14.5, lineHeight:1.6, opacity:0.72, maxWidth:360 }}>Die interne Schulungsplattform der Palliativ Netzwerk Rhein-Maas — Pflichtschulungen, Nachweise und Wissensdatenbank an einem Ort.</p>
        </div>
        <div style={{ fontSize:12, opacity:0.5, position:"relative", zIndex:1 }}>© Palliativ Netzwerk Rhein-Maas GmbH &amp; Co. KG</div>
      </div>

      {/* Formular-Panel */}
      <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", background:C.bg, padding:"40px 24px" }}>
        <div style={{ width:"100%", maxWidth:400 }}>
          <div className="pnrm-mobilelogo" style={{ display:"none", marginBottom:28, textAlign:"center" }}>
            <img src="/logo.png" alt="PNRM" style={{ height:52 }} />
          </div>
          {loginView==="reset" ? (
            <div style={{ background:C.white, borderRadius:16, padding:"36px 34px", boxShadow:"0 1px 2px rgba(22,35,58,.05), 0 12px 40px rgba(46,75,110,.1)", border:`1px solid ${C.border}` }}>
              <h2 style={{ margin:"0 0 8px", fontSize:20, fontWeight:700, letterSpacing:"-0.01em" }}>Passwort zurücksetzen</h2>
              <p style={{ margin:"0 0 18px", fontSize:14, color:C.muted, lineHeight:1.55 }}>Gib deine E-Mail-Adresse ein. Du erhältst einen Link, um ein neues Passwort zu setzen.</p>
              {resetResult
                ? <div style={css.good}>{resetResult}</div>
                : <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                    <input type="email" value={resetEmail} onChange={e=>setResetEmail(e.target.value)} placeholder="E-Mail" style={{ ...css.inp, padding:"12px 16px" }} />
                    <button onClick={async()=>{ setResetLoading(true); const {error}=await supabase.auth.resetPasswordForEmail(resetEmail,{redirectTo:"https://pnrm-schulungen.vercel.app"}); if(error){alert(error.message);}else{setResetResult("Reset-Link wurde an deine Email gesendet.");} setResetLoading(false); }} disabled={resetLoading||!resetEmail} style={{ ...css.btn, padding:"12px 16px", fontSize:14, width:"100%", opacity:(resetLoading||!resetEmail)?0.65:1 }}>{resetLoading?"Wird gesendet…":"Reset-Link senden"}</button>
                  </div>
              }
              <button type="button" onClick={()=>{setLoginView("login");setResetResult(null);}} style={{ background:"none", border:"none", color:C.blueAccent, cursor:"pointer", fontSize:13, marginTop:16, padding:0, fontFamily:FONT }}>← Zurück zur Anmeldung</button>
            </div>
          ) : (
            <div style={{ background:C.white, borderRadius:16, padding:"36px 34px", boxShadow:"0 1px 2px rgba(22,35,58,.05), 0 12px 40px rgba(46,75,110,.1)", border:`1px solid ${C.border}` }}>
              <h2 style={{ margin:"0 0 4px", fontSize:20, fontWeight:700, letterSpacing:"-0.01em" }}>Anmeldung</h2>
              <p style={{ margin:"0 0 22px", fontSize:14, color:C.muted }}>Mit deinem PNRM-Konto fortfahren</p>
              <form onSubmit={async e=>{ e.preventDefault(); setLoginLoading(true); setLoginError(null); const {error}=await supabase.auth.signInWithPassword({email:loginEmail,password:loginPassword}); if(error){setLoginError(error.message);} setLoginLoading(false); }} style={{ display:"flex", flexDirection:"column", gap:12 }}>
                <div><label style={css.lbl}>E-Mail</label><input type="email" value={loginEmail} onChange={e=>setLoginEmail(e.target.value)} placeholder="vorname.nachname@pallinetz.de" required autoComplete="email" style={{ ...css.inp, padding:"12px 16px" }} /></div>
                <div><label style={css.lbl}>Passwort</label><input type="password" value={loginPassword} onChange={e=>setLoginPassword(e.target.value)} placeholder="••••••••" required autoComplete="current-password" style={{ ...css.inp, padding:"12px 16px" }} /></div>
                {loginError&&<p style={{ margin:0, fontSize:13, color:C.bad.text }}>{loginError}</p>}
                <button type="submit" disabled={loginLoading} style={{ ...css.btn, padding:"12px 16px", fontSize:14.5, width:"100%", marginTop:4, opacity:loginLoading?0.65:1 }}>{loginLoading?"Anmelden…":"Anmelden"}</button>
                <button type="button" onClick={()=>{setLoginView("reset");setResetEmail(loginEmail);}} style={{ background:"none", border:"none", color:C.blueAccent, cursor:"pointer", fontSize:13, padding:0, textAlign:"center", fontFamily:FONT }}>Passwort vergessen?</button>
              </form>
            </div>
          )}
          <p style={{ textAlign:"center", fontSize:12, color:C.muted, marginTop:20 }}>Zugang nur auf Einladung · Fragen an das Admin-Team</p>
        </div>
      </div>
    </div>
  );

  if (mustChangePassword) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:FONT, color:C.text, background:C.bg, padding:24 }}>
      <div style={{ width:"100%", maxWidth:400, background:C.white, borderRadius:16, padding:"36px 34px", boxShadow:"0 1px 2px rgba(22,35,58,.05), 0 12px 40px rgba(46,75,110,.1)", border:`1px solid ${C.border}` }}>
        <h2 style={{ margin:"0 0 8px", fontSize:20, fontWeight:700, letterSpacing:"-0.01em" }}>Neues Passwort festlegen</h2>
        <p style={{ margin:"0 0 18px", fontSize:14, color:C.muted, lineHeight:1.55 }}>Du hast dich mit einem Einmalpasswort angemeldet. Bitte lege jetzt dein eigenes Passwort fest.</p>
        <form onSubmit={async e=>{
          e.preventDefault();
          setPwChangeError(null);
          if (newPassword.length < 8) { setPwChangeError("Mindestens 8 Zeichen."); return; }
          if (newPassword !== newPassword2) { setPwChangeError("Passwörter stimmen nicht überein."); return; }
          setPwChangeLoading(true);
          const { error } = await supabase.auth.updateUser({ password: newPassword, data: { must_change_password: false } });
          setPwChangeLoading(false);
          if (error) { setPwChangeError(error.message); return; }
          setMustChangePassword(false);
        }} style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <div><label style={css.lbl}>Neues Passwort</label><input type="password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} required autoComplete="new-password" style={{ ...css.inp, padding:"12px 16px" }} /></div>
          <div><label style={css.lbl}>Passwort wiederholen</label><input type="password" value={newPassword2} onChange={e=>setNewPassword2(e.target.value)} required autoComplete="new-password" style={{ ...css.inp, padding:"12px 16px" }} /></div>
          {pwChangeError && <p style={{ margin:0, fontSize:13, color:C.bad.text }}>{pwChangeError}</p>}
          <button type="submit" disabled={pwChangeLoading} style={{ ...css.btn, padding:"12px 16px", fontSize:14.5, width:"100%", marginTop:4, opacity:pwChangeLoading?0.65:1 }}>{pwChangeLoading?"Speichern…":"Passwort speichern"}</button>
        </form>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:FONT, color:C.text, fontSize:15 }}>
      {/* Header */}
      <header style={{ background:`linear-gradient(90deg, ${C.navyDark} 0%, ${C.navy} 100%)`, position:"sticky", top:0, zIndex:10, boxShadow:"0 2px 16px rgba(22,35,58,.18)" }}>
        <div style={{ maxWidth:980, margin:"0 auto", padding:"12px 24px", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:10 }}>
          <div style={{ display:"flex", alignItems:"center", gap:14 }}>
            <PNRMLogo compact white />
            <div style={{ width:1, height:26, background:"rgba(255,255,255,.22)" }} />
            <span style={{ color:C.white, fontSize:13.5, fontWeight:600, letterSpacing:"0.02em", opacity:0.92 }}>Schulungen &amp; Wissen</span>
          </div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
            {user && (
              <span title={isAdmin?"Administrator":"Nutzer"} style={{ display:"inline-flex", alignItems:"center", gap:7, background:"rgba(255,255,255,.1)", border:"1px solid rgba(255,255,255,.18)", color:C.white, borderRadius:20, padding:"4px 12px 4px 5px", fontSize:12, fontWeight:500, whiteSpace:"nowrap" }}>
                <span style={{ width:22, height:22, borderRadius:"50%", background:"rgba(255,255,255,.92)", color:C.navy, display:"inline-flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700 }}>{(user.email||"?")[0].toUpperCase()}</span>
                {user.email}{isAdmin && <span style={{ opacity:0.65, fontWeight:400 }}>· Admin</span>}
              </span>
            )}
            {user && <button className="hdrbtn" onClick={()=>exportExcel(schulungen,ma)} style={{ appearance:"none", background:"transparent", color:C.white, border:"1px solid rgba(255,255,255,.3)", borderRadius:8, padding:"7px 13px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:FONT }}>Excel-Export</button>}
            {isAdmin&&<button className="hdrbtn-solid" onClick={()=>{setActive(null);setModal("neu");setTab("schulungen");}} style={{ appearance:"none", background:C.white, color:C.navy, border:0, borderRadius:8, padding:"7px 14px", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:FONT, boxShadow:"0 1px 4px rgba(0,0,0,.15)" }}>+ Neue Schulung</button>}
            <button type="button" className="hdrbtn" onClick={()=>supabase.auth.signOut()} style={{ appearance:"none", background:"transparent", color:"rgba(255,255,255,.85)", border:"1px solid rgba(255,255,255,.3)", borderRadius:8, padding:"6px 12px", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:FONT }}>Abmelden</button>
          </div>
        </div>
        <div style={{ height:3, background:`linear-gradient(90deg, ${C.blueLight} 0%, ${C.blueAccent} 40%, ${C.teal} 100%)` }} />
      </header>

      <div style={{ maxWidth:980, margin:"0 auto", padding:"20px" }}>
        {/* Stats */}
        <div className="statstrip" style={{ display:"grid", gridTemplateColumns:"repeat(5, 1fr)", background:C.white, border:`1px solid ${C.border}`, borderRadius:14, marginBottom:22, overflow:"hidden", boxShadow:"0 1px 2px rgba(22,35,58,.04), 0 4px 16px rgba(46,75,110,.05)" }}>
          {[["Schulungen",schulungen.length,C.navy],["Freigegeben",schulungen.filter(s=>s.status==="Freigegeben").length,"#1A6B3C"],["Versendet",schulungen.filter(s=>s.empfaenger?.length>0).length,C.blueAccent],["Nachweise",schulungen.reduce((a,s)=>a+Object.keys(s.nachweise||{}).length,0),C.teal],["Mitarbeiter",ma.length,"#5A6E85"]].map(([l,v,accent],i)=>(
            <div key={l} style={{ padding:"16px 18px 14px", borderLeft: i>0 ? `1px solid ${C.border}` : "none", position:"relative" }}>
              <div style={{ position:"absolute", top:0, left:0, right:0, height:3, background:accent, opacity:0.85 }} />
              <div style={{ fontSize:24, fontWeight:700, color:C.text, lineHeight:1.1, fontVariantNumeric:"tabular-nums", letterSpacing:"-0.02em" }}>{v}</div>
              <div style={{ fontSize:11, color:C.muted, marginTop:4, textTransform:"uppercase", letterSpacing:"0.7px", fontWeight:600 }}>{l}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display:"flex", gap:2, borderBottom:`1px solid ${C.border}`, marginBottom:20 }}>
          {[["schulungen","Schulungen"],["wissen","Wissen"],...(user?[["mitarbeiter","Mitarbeiter"]]:[])]  .map(([id,label])=>(
            <button key={id} onClick={()=>setTab(id)} className="ptab" style={{ background: tab===id ? C.white : "none", border:`1px solid ${tab===id?C.border:"transparent"}`, borderBottom: tab===id ? `1px solid ${C.white}` : "1px solid transparent", borderRadius:"10px 10px 0 0", color:tab===id?C.navy:C.muted, padding:"10px 20px", cursor:"pointer", fontSize:14, fontWeight:tab===id?700:500, marginBottom:-1, fontFamily:FONT, transition:"color .15s, background .15s" }}>{label}</button>
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
              style={{ ...css.section, cursor:"pointer", padding:20, transition:"box-shadow .18s ease, border-color .18s ease, transform .18s ease" }}
              onClick={()=>{setActive(sc);setModal("player");}}
              onMouseEnter={e=>{e.currentTarget.style.boxShadow="0 2px 4px rgba(22,35,58,.05), 0 12px 32px rgba(46,75,110,.13)";e.currentTarget.style.borderColor=C.blueAccent;e.currentTarget.style.transform="translateY(-2px)";}}
              onMouseLeave={e=>{e.currentTarget.style.boxShadow="0 1px 2px rgba(22,35,58,.04)";e.currentTarget.style.borderColor=C.border;e.currentTarget.style.transform="none";}}>
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
        {tab==="mitarbeiter"&&<MitarbeiterView ma={ma} setMa={setMa} showToast={showToast} isAdmin={isAdmin} user={user} />}

        <footer style={{ marginTop:48, paddingTop:20, borderTop:`1px solid ${C.border}`, display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:10, paddingBottom:28 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <img src="/logo.png" alt="" style={{ height:20, opacity:0.4 }} />
            <span style={{ fontSize:12, color:C.muted }}>© Palliativ Netzwerk Rhein-Maas GmbH &amp; Co. KG</span>
          </div>
          <span style={{ fontSize:12, color:C.muted, opacity:0.75 }}>Schulungen &amp; Wissen · Interne Plattform</span>
        </footer>
      </div>

      {(modal==="neu"||modal==="edit")&&<Modal onClose={()=>setModal(null)} wide><SchulungForm schulung={modal==="edit"?active:null} onSave={saveSchul} onClose={()=>setModal(null)} isAdmin={isAdmin} /></Modal>}
      {modal==="player"&&active&&<Modal onClose={()=>setModal(null)} wide><SchulungsPlayer sc={active} onClose={()=>setModal(null)} onNachweis={(id,nw)=>saveNachweis(id,nw)} /></Modal>}
      {modal==="send"&&active&&<Modal onClose={()=>setModal(null)}><SendModal sc={active} ma={ma} onClose={()=>setModal(null)} onSend={sendSchul} /></Modal>}
      {modal==="nw"&&active&&<Modal onClose={()=>setModal(null)} wide><NachweisModal sc={active} ma={ma} onClose={()=>setModal(null)} /></Modal>}

      {toast&&<div style={{ position:"fixed",bottom:22,right:22,display:"flex",alignItems:"flex-start",gap:10,background:C.white,borderLeft:`4px solid ${toast.type==="warn"?"#E8A317":"#2E9E5B"}`,border:`1px solid ${C.border}`,color:C.text,padding:"13px 18px",borderRadius:12,fontSize:14,fontWeight:500,boxShadow:"0 4px 12px rgba(22,35,58,.08), 0 16px 48px rgba(22,35,58,.16)",zIndex:200,maxWidth:400,animation:"fadeIn .3s" }}><span style={{ fontSize:16, lineHeight:1.3 }}>{toast.type==="warn"?"⚠️":"✓"}</span><span style={{ lineHeight:1.45 }}>{toast.msg}</span></div>}
      <style>{`
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        *{box-sizing:border-box}
        body{font-family:'Inter',-apple-system,sans-serif;background:#F0F4F8;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
        ::selection{background:rgba(58,124,165,.22)}
        select option{background:#fff;color:#1A2638}
        button{transition:filter .12s ease, transform .12s ease, box-shadow .12s ease, background .12s ease, border-color .12s ease}
        button:hover{filter:brightness(.96)}
        button:active{transform:translateY(1px)}
        button:focus-visible, a:focus-visible{outline:2px solid #3A7CA5;outline-offset:2px}
        .hdrbtn:hover{background:rgba(255,255,255,.12)!important;filter:none!important}
        .hdrbtn-solid:hover{filter:brightness(.97)!important;box-shadow:0 2px 8px rgba(0,0,0,.2)!important}
        .ptab:hover{color:#2E4B6E!important;filter:none}
        input:focus,textarea:focus,select:focus{border-color:#3A7CA5!important;outline:none!important;box-shadow:0 0 0 3px rgba(58,124,165,.13)!important}
        ::-webkit-scrollbar{width:10px;height:10px}
        ::-webkit-scrollbar-thumb{background:#C5D0DE;border-radius:99px;border:2px solid #F0F4F8}
        ::-webkit-scrollbar-thumb:hover{background:#A8B8CC}
        ::-webkit-scrollbar-track{background:transparent}
        @media (max-width: 860px){
          .pnrm-brandpanel{display:none!important}
          .pnrm-mobilelogo{display:block!important}
          .statstrip{grid-template-columns:repeat(2,1fr)!important}
          .statstrip > div{border-left:none!important;border-top:1px solid #D1DCE8}
          .statstrip > div:first-child,.statstrip > div:nth-child(2){border-top:none}
        }
        @media (prefers-reduced-motion: reduce){
          *,*::before,*::after{animation-duration:.01ms!important;transition-duration:.01ms!important}
        }
      `}</style>
    </div>
  );
}
