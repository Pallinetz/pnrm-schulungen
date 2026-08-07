import { useState, useRef, useEffect } from "react";
import { MoreHorizontal, GraduationCap, CheckCircle2, Send, FileCheck2, Users, ChevronDown, LogOut, ClipboardList, Percent, SearchX, BookOpen } from "lucide-react";
import * as XLSX from "xlsx";
import { VideoUploader } from "./components/VideoUploader";
import { VideoPlayer } from "./components/VideoPlayer";
import { getSignedVideoUrl, deleteVideo } from "./lib/videoStorage";
import { uploadDokument, deleteDokument, getSignedUrl } from "./lib/dokumentStorage";
import { supabase } from "./lib/supabase";

// functions.invoke() only puts the generic "Edge Function returned a non-2xx
// status code" in res.error.message — the actual reason from the function's
// JSON body sits in res.error.context (the raw Response) and must be parsed separately.
async function invokeFn(action, body, opts) {
  const res = await supabase.functions.invoke("send-invitation-email", { body: { action, ...body }, ...opts });
  if (res.error) {
    let msg = res.error.message;
    try { const detail = await res.error.context?.json(); if (detail?.error) msg = detail.error; } catch {}
    throw new Error(msg);
  }
  if (res.data?.error) throw new Error(res.data.error);
  return res.data;
}

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
const PROFILE = ["Pflege", "Büro", "Alltagsbegleitung"];
// Abteilungs-Text aus dem Excel/CSV-Import auf ein oder mehrere Profile
// abbilden: "Fachpflege" -> Pflege, "Alltag" -> Alltagsbegleitung, alles
// andere (auch leer) -> Büro.
function matchProfil(text) {
  const t = (text || "").trim().toLowerCase();
  const treffer = [];
  if (t.includes("fachpflege")) treffer.push("Pflege");
  if (t.includes("alltag")) treffer.push("Alltagsbegleitung");
  return treffer.length ? treffer : ["Büro"];
}

// Zielgruppe einer Schulung ("Alle" oder eine Auswahl aus PROFILE) gegen die
// Profile eines Mitarbeiters (ein Mitarbeiter kann mehrere haben). Wird live
// berechnet statt gespeichert, damit ein späteres Ändern der Profile (oder
// der Zielgruppe) sofort überall greift.
const ZIELGRUPPEN = ["Alle", ...PROFILE];
function matchesZielgruppe(zielgruppen, profile) {
  return !!zielgruppen?.length && (zielgruppen.includes("Alle") || !!profile?.some(p => zielgruppen.includes(p)));
}
function effectiveEmpfaenger(sc, maList) {
  const auto = maList.filter(m => matchesZielgruppe(sc.zielgruppen, m.profil)).map(m => m.id);
  return Array.from(new Set([...(sc.empfaenger || []), ...auto]));
}

// schulungen-Tabelle: Spalten sind snake_case, der Rest der App arbeitet durchgehend
// camelCase — bisher fehlte diese Umwandlung komplett (dokNr/gueltigAb/... kamen nie an).
const toSnakeCase = k => k.replace(/[A-Z]/g, c => "_" + c.toLowerCase());
const toCamelCase = k => k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
function schulungToDb(s) {
  const row = {};
  for (const k in s) if (k !== "id") row[toSnakeCase(k)] = s[k];
  return row;
}
function schulungFromDb(r) {
  const s = {};
  for (const k in r) s[toCamelCase(k)] = r[k];
  return s;
}

// ─── Tailwind-Tokens (neu gestaltete Bereiche: Login, Mitarbeiter-Tabelle) ─────
const twInput = "w-full bg-white border border-slate-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/10 rounded-lg py-2.5 px-3.5 text-sm transition-all outline-none text-slate-900 placeholder:text-slate-400";
const twLabel = "block text-xs font-medium text-slate-500 mb-1";
const twBtnPrimary = "rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold shadow-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed";
const twBtnSecondary = "rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed";
const twBadge = "inline-flex items-center bg-slate-100 text-slate-700 text-xs px-2.5 py-0.5 rounded-md font-normal";
const AVATAR_COLORS = ["bg-blue-100 text-blue-700", "bg-emerald-100 text-emerald-700", "bg-amber-100 text-amber-700", "bg-violet-100 text-violet-700", "bg-rose-100 text-rose-700", "bg-teal-100 text-teal-700"];
function avatarInitials(name) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts[parts.length - 1]?.[0] || "")).toUpperCase() || "?";
}
function avatarColorClass(name) {
  const sum = [...(name || "")].reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}
const twLink = "bg-transparent border-0 p-0 text-sm text-blue-700 hover:text-blue-800 cursor-pointer font-sans";

// ─── Styles ────────────────────────────────────────────────────────────────────
const css = {
  section: { background:C.white, border:`1px solid ${C.border}`, borderRadius:8, padding:20, margin:"12px 0", boxShadow:"0 1px 2px rgba(22,35,58,.04)" },
  inp: { width:"100%", fontSize:14, padding:"10px 14px", border:`1px solid ${C.inputBorder}`, borderRadius:8, background:C.white, color:C.text, boxSizing:"border-box", fontFamily:FONT, outline:"none", transition:"border-color .15s ease, box-shadow .15s ease" },
  lbl: { display:"block", fontWeight:600, marginBottom:4, fontSize:13, color:C.text },
  btn: { appearance:"none", border:0, borderRadius:8, background:`linear-gradient(180deg, #35577E, ${C.navy})`, color:C.white, padding:"9px 16px", fontWeight:600, fontSize:14, cursor:"pointer", fontFamily:FONT, boxShadow:"0 1px 3px rgba(30,52,82,.3), inset 0 1px 0 rgba(255,255,255,.08)", transition:"transform .12s ease, box-shadow .12s ease" },
  btnSec: { appearance:"none", borderRadius:8, background:C.white, color:C.navy, border:`1px solid ${C.inputBorder}`, padding:"9px 16px", fontWeight:600, fontSize:14, cursor:"pointer", fontFamily:FONT, boxShadow:"0 1px 2px rgba(22,35,58,.05)", transition:"border-color .12s ease, box-shadow .12s ease" },
  btnDanger: { background:C.bad.bg, color:C.bad.text, border:`1px solid ${C.bad.border}`, borderRadius:8, padding:"6px 12px", fontWeight:600, fontSize:13, cursor:"pointer", appearance:"none", fontFamily:FONT },
  good: { background:C.good.bg, border:`1px solid ${C.good.border}`, color:C.good.text, padding:"12px 16px", borderRadius:8, fontSize:14 },
  bad:  { background:C.bad.bg,  border:`1px solid ${C.bad.border}`,  color:C.bad.text,  padding:"12px 16px", borderRadius:8, fontSize:14 },
  notice: { background:C.warn.bg, border:`1px solid ${C.warn.border}`, color:C.warn.text, padding:"12px 16px", borderRadius:8, fontSize:14 },
  module: { borderLeft:`4px solid ${C.navy}`, paddingLeft:14, margin:"16px 0" },
  badge: { display:"inline-block", background:C.blueDim, color:C.navy, padding:"4px 10px", borderRadius:6, fontWeight:600, fontSize:12 },
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

// "over" = Frist verstrichen, "soon" = Frist in <=7 Tagen, sonst null (kein Hinweis nötig)
function fristStatus(frist) {
  if (!frist) return null;
  const today = new Date().toISOString().slice(0,10);
  if (frist < today) return "over";
  const days = Math.ceil((new Date(frist) - new Date(today)) / 86400000);
  return days <= 7 ? "soon" : null;
}

function Modal({ onClose, children, wide }) {
  return (
    <div onClick={onClose} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.45)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,backdropFilter:"blur(3px)" }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:C.white,borderRadius:8,padding:28,width:wide?"94%":"90%",maxWidth:wide?1000:700,minWidth:0,maxHeight:"92vh",overflowY:"auto",overflowX:"hidden",position:"relative",boxShadow:"0 24px 64px rgba(0,0,0,.18)" }}>
        <button onClick={onClose} style={{ position:"absolute",top:13,right:16,background:"none",border:"none",fontSize:20,color:C.muted,cursor:"pointer",lineHeight:1 }}>✕</button>
        {children}
      </div>
    </div>
  );
}

function AIBtn({ onClick, loading, label }) {
  return <button onClick={onClick} disabled={loading} style={{ ...css.btnSec, fontSize:13, padding:"7px 14px", opacity:loading?.65:1, display:"flex", alignItems:"center", gap:6 }}><span>{loading?"⏳":"✦"}</span>{loading?"KI generiert…":label}</button>;
}

function Skel({ w, h, r=6, style }) {
  return <div style={{ width:w, height:h, borderRadius:r, background:"linear-gradient(90deg, #E7EDF7 25%, #EEF2F8 37%, #E7EDF7 63%)", backgroundSize:"400% 100%", animation:"skelShimmer 1.4s ease infinite", ...style }} />;
}
function SchulungSkeletonCard() {
  return (
    <div style={{ ...css.section, padding:20 }}>
      <div style={{ display:"flex", gap:6, marginBottom:10 }}><Skel w={72} h={20} /><Skel w={92} h={20} /></div>
      <Skel w="55%" h={19} r={5} style={{ marginBottom:9 }} />
      <Skel w="32%" h={13} />
    </div>
  );
}
function WissenSkeletonCard() {
  return (
    <div style={{ border:`1px solid ${C.border}`, borderRadius:12, padding:16 }}>
      <Skel w="40%" h={12} r={4} style={{ marginBottom:12 }} />
      <Skel w="80%" h={17} r={5} style={{ marginBottom:8 }} />
      <Skel w="100%" h={12} r={4} style={{ marginBottom:6 }} />
      <Skel w="70%" h={12} r={4} />
    </div>
  );
}

function EmptyState({ icon:Icon, text }) {
  return (
    <div style={{ textAlign:"center", padding:"48px 20px", color:C.muted }}>
      <Icon size={26} strokeWidth={1.5} style={{ opacity:.4, marginBottom:10 }} />
      <p style={{ margin:0, fontSize:14 }}>{text}</p>
    </div>
  );
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
    gueltigAb:new Date().toISOString().slice(0,10), naechstePruefung:"", frist:"",
    erstelltDurch:"", freigegebenVon:"",
    geltungsbereich:"", bezugsdokumente:"",
    kategorie:"Pflege", pflicht:false, dauer:"ca. 20–30 Min.",
    bestehensgrenze:16, maxPunkte:20,
    grundsatz:"", lernziele:"", module:[], checkliste:[], fragen:[],
    empfaenger:[], nachweise:{}, zielgruppen:["Alle"],
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

  const meta1 = [["titel","Titel (Schulungsthema)"],["dokNr","Dok.-Nr."],["version","Version"],["status","Status"],["gueltigAb","Gültig ab"],["naechstePruefung","Nächste Prüfung"],["frist","Frist (Abschluss durch Mitarbeitende bis)"],["erstelltDurch","Erstellt durch"],["freigegebenVon","Freigegeben durch"]];
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
        <div style={{ marginTop:14 }}>
          <label style={css.lbl}>Zielgruppe</label>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            {ZIELGRUPPEN.map(z=>{
              const checked = (form.zielgruppen||[]).includes(z);
              return (
                <label key={z} style={{ display:"flex", alignItems:"center", gap:6, border:`1px solid ${checked?C.blue:C.border}`, background:checked?C.blueDim:C.white, borderRadius:999, padding:"5px 12px", cursor:"pointer", fontSize:13 }}>
                  <input type="checkbox" checked={checked} onChange={()=>set("zielgruppen", checked ? (form.zielgruppen||[]).filter(x=>x!==z) : [...(form.zielgruppen||[]),z])} style={{ width:15,height:15,accentColor:C.blue }} />
                  {z}
                </label>
              );
            })}
          </div>
          <p style={{ margin:"6px 0 0", fontSize:12, color:C.muted }}>Steuert, wem diese Schulung automatisch zugewiesen wird (nach Mitarbeiter-Profil). Zusätzliche Personen lassen sich weiterhin über „Senden" hinzufügen.</p>
        </div>
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
function buildInviteMail(name, email, url, app) {
  const subject = app === "schulungen"
    ? "Einladung zu Schulungen & Wissen – Palliativ Netzwerk Rhein-Maas"
    : "Einladung zur Raumplanung – Palliativ Netzwerk Rhein-Maas";
  const label = app === "schulungen" ? "Schulungen & Wissen" : "Raumplanung";
  const body = `Hallo ${name},\n\nich lade dich herzlich zu ${label} der Palliativ Netzwerk Rhein-Maas ein.\n\nBitte klicke auf folgenden Link, um dein Passwort zu setzen und dich anzumelden:\n${url}\n\nDer Link ist 7 Tage gültig.\n\n`;
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function buildResetMail(name, email, code) {
  const subject = "Passwort zurücksetzen – Palliativ Netzwerk Rhein-Maas";
  const body = `Hallo ${name},\n\nauf deinen Wunsch hier dein Code, um dein Passwort für Schulungen & Wissen neu zu setzen.\n\nGeh auf die Login-Seite → "Passwort vergessen" → "Ich habe bereits einen Code" und gib dort diesen Code ein:\n\n${code}\n\nDer Code ist aus Sicherheitsgründen nur begrenzt gültig. Falls du das nicht angefordert hast, kannst du diese Mail ignorieren.\n\n`;
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}


// Feste Spaltenreihenfolge: Nachname, Vorname, E-Mail, Abteilung. Erste Zeile
// gilt immer als Kopfzeile und wird übersprungen (Inhalt egal).
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
          rows = lines.slice(1).map(line => {
            const c = line.split(delim);
            return {
              nachname: (c[0] || "").trim(),
              vorname: (c[1] || "").trim(),
              email: (c[2] || "").trim(),
              abteilung: (c[3] || "").trim(),
            };
          });
        } else {
          const wb = XLSX.read(ev.target.result, { type: "binary" });
          const raw = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
          rows = raw.slice(1).map(c => ({
            nachname: String(c?.[0] ?? "").trim(),
            vorname: String(c?.[1] ?? "").trim(),
            email: String(c?.[2] ?? "").trim(),
            abteilung: String(c?.[3] ?? "").trim(),
          }));
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
  const [selected, setSelected] = useState(new Set());
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
      setSelected(new Set(parsed.map(r => r.email)));
    } catch (err) {
      showToast(`Fehler beim Lesen: ${err.message}`);
    }
    e.target.value = "";
  };

  const removeRow = i => setRows(r => r.filter((_, idx) => idx !== i));
  const toggleRow = email => setSelected(s => { const n = new Set(s); n.has(email) ? n.delete(email) : n.add(email); return n; });
  const allSelected = rows.length > 0 && rows.every(r => selected.has(r.email));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(rows.map(r => r.email)));

  const createAll = async () => {
    const targets = rows.filter(r => selected.has(r.email));
    if (!targets.length) { showToast("Keine Mitarbeiter ausgewählt."); return; }
    setProcessing(true);
    const { data: { session } } = await supabase.auth.getSession();
    const out = [];
    for (const row of targets) {
      const name = `${row.vorname} ${row.nachname}`.trim() || row.email;
      const profil = matchProfil(row.abteilung);
      try {
        const data = await invokeFn("create_link_schulungen", { email: row.email, name, rolle, profil },
          { headers: { Authorization: `Bearer ${session.access_token}` } });
        out.push({ name, email: row.email, url: data.url, ok: true });
        if (onInviteSent) onInviteSent({ email: row.email, name, rolle, profil, id: `bulk_${Date.now()}_${row.email}`, bestaetigt: false });
      } catch (err) {
        out.push({ name, email: row.email, error: err.message, ok: false });
      }
    }
    setResults(out);
    setProcessing(false);
  };

  const copyLink = url => navigator.clipboard.writeText(url);
  const openMail = (name, email, url) => { window.location.href = buildInviteMail(name, email, url, "schulungen"); };

  return (
    <div style={{ fontFamily: FONT, color: C.text }}>
      <h2 style={{ margin: "0 0 6px", fontSize: 20 }}>Mehrere Mitarbeiter einladen</h2>
      <p style={{ margin: "0 0 16px", fontSize: 13, color: C.muted }}>CSV oder Excel hochladen, erste Zeile Kopfzeile, danach feste Spaltenreihenfolge: <strong>Nachname, Vorname, E-Mail, Abteilung</strong>.</p>

      {!results && (
        <>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14 }}>
            <button onClick={() => fileRef.current.click()} style={{ ...css.btnSec, fontSize: 13, padding: "8px 14px" }}>📁 Datei auswählen</button>
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleFile} style={{ display: "none" }} />
            {rows.length > 0 && <span style={{ fontSize: 13, color: C.muted }}>{rows.length} Person{rows.length !== 1 ? "en" : ""} erkannt, {selected.size} ausgewählt</span>}
            <div style={{ marginLeft: "auto" }}>
              <select value={rolle} onChange={e => setRolle(e.target.value)} style={{ ...css.inp, fontSize: 13, padding: "6px 10px" }}>
                <option value="user">Alle als Nutzer</option>
                <option value="admin">Alle als Admin</option>
              </select>
            </div>
          </div>

          {rows.length > 0 && (
            <>
              <div style={{ marginBottom: 8 }}>
                <button onClick={toggleAll} style={{ ...css.btnSec, fontSize: 12, padding: "5px 10px" }}>{allSelected ? "Keine auswählen" : "Alle auswählen"}</button>
              </div>
              <div style={{ maxHeight: 280, overflowY: "auto", border: `1px solid ${C.border}`, borderRadius: 10 }}>
                {rows.map((r, i) => {
                  const profil = matchProfil(r.abteilung);
                  return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderBottom: i < rows.length - 1 ? `1px solid ${C.border}` : "none" }}>
                    <input type="checkbox" checked={selected.has(r.email)} onChange={() => toggleRow(r.email)} style={{ accentColor: C.blue, width: 16, height: 16 }} />
                    <div style={{ flex: 1, fontSize: 13 }}><strong>{r.vorname} {r.nachname}</strong></div>
                    <div style={{ flex: 1, fontSize: 13, color: C.muted }}>{r.email}</div>
                    <div style={{ flex: 1, fontSize: 12, display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {profil.map(p => <span key={p} style={{ background: "#f3f4f6", color: "#6b7280", padding: "1px 7px", borderRadius: 20, fontWeight: 700 }}>{p}</span>)}
                    </div>
                    <button onClick={() => removeRow(i)} style={{ ...css.btnDanger, padding: "3px 9px", fontSize: 12 }}>✕</button>
                  </div>
                  );
                })}
              </div>
            </>
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
                  <button onClick={() => copyLink(r.url)} style={{ ...css.btnSec, fontSize: 12, padding: "5px 10px" }}>Link kopieren</button>
                  <button onClick={() => openMail(r.name, r.email, r.url)} style={{ ...css.btn, fontSize: 12, padding: "5px 10px" }}>In Outlook öffnen</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 18 }}>
        <button onClick={onClose} style={css.btnSec}>Schließen</button>
        {!results && rows.length > 0 && (
          <button onClick={createAll} disabled={processing || selected.size === 0} style={{ ...css.btn, opacity: (processing || selected.size === 0) ? 0.65 : 1 }}>
            {processing ? "Erstelle Links…" : selected.size === 0 ? "Keine Auswahl" : `${selected.size} Einladungslinks erstellen`}
          </button>
        )}
      </div>
    </div>
  );
}

function InviteModal({ onClose, showToast, onInviteSent }) {
  const [form, setForm] = useState({ name:"", email:"", rolle:"user", profil:[] });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [inviteUrl, setInviteUrl] = useState(null);
  const [copied, setCopied] = useState(false);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const handleInvite = async () => {
    if (!form.email.trim() || !form.name.trim()) return;
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const data = await invokeFn("create_link_schulungen", { email: form.email, name: form.name, rolle: form.rolle, profil: form.profil },
        { headers: { Authorization: `Bearer ${session.access_token}` } });
      const url = data.url;
      setInviteUrl(url);
      setResult(`Link für ${form.email} erstellt.`);
      if (onInviteSent) onInviteSent({ email: form.email, name: form.name, rolle: form.rolle, profil: form.profil, id: `sent_${Date.now()}`, bestaetigt: false });
      window.location.href = buildInviteMail(form.name, form.email, url, "schulungen");
    } catch (e) {
      setResult(`Fehler: ${e.message}`);
    }
    setLoading(false);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(()=>setCopied(false), 2000);
  };

  return (
    <div style={{ fontFamily:FONT, color:C.text }}>
      <h2 style={{ margin:"0 0 18px", fontSize:20 }}>Mitarbeiter einladen</h2>
      {result
        ? <div>
            <div style={css.good}>{result}</div>
            {inviteUrl && (
              <div style={{ marginTop:14 }}>
                <p style={{ fontSize:13, color:C.muted, margin:"0 0 8px" }}>Outlook sollte sich mit fertigem Einladungstext geöffnet haben. Falls nicht, Link manuell kopieren:</p>
                <div style={{ display:"flex", gap:8 }}>
                  <input readOnly value={inviteUrl} style={{ ...css.inp, fontSize:12, flex:1 }} onClick={e=>e.target.select()} />
                  <button onClick={copyLink} style={{ ...css.btnSec, padding:"8px 14px", fontSize:13 }}>{copied?"Kopiert!":"Kopieren"}</button>
                </div>
              </div>
            )}
          </div>
        : <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <div><label style={css.lbl}>Name</label><input value={form.name} onChange={e=>set("name",e.target.value)} style={css.inp} placeholder="Vor- und Nachname" /></div>
            <div><label style={css.lbl}>E-Mail</label><input type="email" value={form.email} onChange={e=>set("email",e.target.value)} style={css.inp} placeholder="email@pallinetz.de" /></div>
            <div><label style={css.lbl}>Zugriff</label><select value={form.rolle} onChange={e=>set("rolle",e.target.value)} style={css.inp}><option value="user">Nutzer – nur Schulungen ansehen</option><option value="admin">Admin – Schulungen verwalten & Mitarbeiter einladen</option></select></div>
            <div>
              <label style={css.lbl}>Profil (Mehrfachauswahl möglich)</label>
              <div style={{ display:"flex", gap:14, flexWrap:"wrap" }}>
                {PROFILE.map(p => (
                  <label key={p} style={{ display:"flex", alignItems:"center", gap:6, fontSize:13, cursor:"pointer" }}>
                    <input type="checkbox" checked={form.profil.includes(p)} onChange={()=>set("profil", form.profil.includes(p) ? form.profil.filter(x=>x!==p) : [...form.profil,p])} />
                    {p}
                  </label>
                ))}
              </div>
            </div>
          </div>
      }
      <div style={{ display:"flex", gap:8, justifyContent:"flex-end", marginTop:18 }}>
        <button onClick={onClose} style={css.btnSec}>Schließen</button>
        {!result && <button onClick={handleInvite} disabled={loading||!form.email||!form.name} style={{ ...css.btn, opacity:(loading||!form.email||!form.name)?0.65:1 }}>{loading?"Wird erstellt…":"Einladung erstellen & in Outlook öffnen"}</button>}
      </div>
    </div>
  );
}

function ActionsMenu({ items }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onClick = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);
  const visible = items.filter(Boolean);
  return (
    <div ref={ref} className="relative inline-block text-left">
      <button type="button" onClick={() => setOpen(o => !o)} aria-label="Aktionen" className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
        <MoreHorizontal size={16} />
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-44 rounded-lg border border-slate-200 bg-white shadow-lg py-1">
          {visible.map((it, i) => (
            <button
              key={i}
              type="button"
              disabled={it.disabled}
              onClick={() => { setOpen(false); it.onClick(); }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed ${it.danger ? "text-red-600" : "text-slate-700"}`}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function MitarbeiterView({ ma, setMa, showToast, isAdmin, isSuperAdmin, user, onRefresh }) {
  const [loading, setLoading] = useState(false);
  const [maSearch, setMaSearch] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [resending, setResending] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [editId, setEditId] = useState(null);
  const [draft, setDraft] = useState({});

  // ── Mehrfachauswahl für bestehende Mitarbeiter (bearbeiten/einladen in Serie) ──
  const [selected, setSelected] = useState(new Set());
  const toggleSelect = id => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allSelected = ma.length > 0 && ma.every(m => selected.has(m.id));
  const toggleSelectAll = () => setSelected(allSelected ? new Set() : new Set(ma.map(m => m.id)));

  const [bulkProfil, setBulkProfil] = useState([]);
  const [bulkRolle, setBulkRolle] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkResending, setBulkResending] = useState(false);
  const [bulkResults, setBulkResults] = useState(null);

  const applyBulkEdit = async () => {
    const patch = {};
    if (bulkProfil.length) patch.profil = bulkProfil;
    if (bulkRolle) patch.rolle = bulkRolle;
    if (!Object.keys(patch).length) { showToast("Bitte Profil und/oder Rolle wählen."); return; }
    setBulkSaving(true);
    const ids = [...selected];
    const { error } = await supabase.from("mitarbeiter").update(patch).in("id", ids);
    setBulkSaving(false);
    if (error) { showToast(`Fehler: ${error.message}`); return; }
    setMa(m => m.map(x => selected.has(x.id) ? { ...x, ...patch } : x));
    showToast(`${ids.length} Mitarbeiter aktualisiert.`);
    setBulkProfil([]); setBulkRolle("");
  };

  const bulkResendInvites = async () => {
    setBulkResending(true);
    const { data: { session } } = await supabase.auth.getSession();
    const targets = ma.filter(m => selected.has(m.id));
    const out = [];
    for (const m of targets) {
      try {
        const data = await invokeFn("create_link_schulungen", { email: m.email, name: m.name, rolle: m.rolle, profil: m.profil },
          { headers: { Authorization: `Bearer ${session.access_token}` } });
        out.push({ name: m.name, email: m.email, url: data.url, ok: true });
      } catch (err) {
        out.push({ name: m.name, email: m.email, error: err.message, ok: false });
      }
    }
    setBulkResults(out);
    setBulkResending(false);
  };

  const updateMitarbeiter = async (id, patch) => {
    setSavingId(id);
    const { error } = await supabase.from("mitarbeiter").update(patch).eq("id", id);
    if (error) { showToast(`Fehler: ${error.message}`); setSavingId(null); return false; }
    setMa(m => m.map(x => x.id === id ? { ...x, ...patch } : x));
    setSavingId(null);
    return true;
  };

  const startEdit = m => { setEditId(m.id); setDraft({ name: m.name, email: m.email, rolle: m.rolle, profil: m.profil || [] }); };
  const cancelEdit = () => { setEditId(null); setDraft({}); };
  const saveEdit = async m => {
    if (!draft.name?.trim() || !draft.email?.trim()) { showToast("Name und E-Mail dürfen nicht leer sein."); return; }
    const patch = { name: draft.name.trim(), email: draft.email.trim() };
    if (isSuperAdmin) { patch.rolle = draft.rolle; patch.profil = draft.profil?.length ? draft.profil : null; }
    const ok = await updateMitarbeiter(m.id, patch);
    if (ok) { showToast("Gespeichert."); cancelEdit(); }
  };

  const resendInvite = async (email, name, rolle, profil) => {
    setResending(email);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const data = await invokeFn("create_link_schulungen", { email, name, rolle, profil },
        { headers: { Authorization: `Bearer ${session.access_token}` } });
      const url = data.url;
      showToast(`Link für ${email} erstellt – Outlook öffnet sich.`);
      window.location.href = buildInviteMail(name, email, url, "schulungen");
    } catch (e) {
      showToast(`Fehler: ${e.message}`);
    }
    setResending(null);
  };

  const sendResetLink = async (email, name) => {
    setResending(email);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const data = await invokeFn("admin_reset_password_link", { email },
        { headers: { Authorization: `Bearer ${session.access_token}` } });
      showToast(`Reset-Code für ${email} erstellt – Outlook öffnet sich.`);
      window.location.href = buildResetMail(name, email, data.code);
    } catch (e) {
      showToast(`Fehler: ${e.message}`);
    }
    setResending(null);
  };

  const visibleMa = ma.filter(m => {
    const q = maSearch.trim().toLowerCase();
    if (!q) return true;
    return m.name?.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q) || m.rolle?.toLowerCase().includes(q);
  });

  const deleteUser = async (id, email) => {
    const { error } = await supabase.from("mitarbeiter").delete().eq("id", id);
    if (error) { showToast(`Fehler: ${error.message}`); return; }
    setMa(m => m.filter(x => x.id !== id));
    showToast(`${email} entfernt.`);
  };

  return (
    <div className="font-sans">
      <div className="flex justify-between items-center mb-5 gap-3 flex-wrap">
        <h2 className="m-0 text-xl font-semibold text-slate-900">Mitarbeiter</h2>
        <div className="flex gap-2">
          {isAdmin && <button onClick={() => setBulkOpen(true)} className={`${twBtnSecondary} text-sm px-3.5 py-2`}>Importieren (Excel/CSV)</button>}
          {isAdmin && <button onClick={() => setInviteOpen(true)} className={`${twBtnPrimary} text-sm px-3.5 py-2`}>+ Mitarbeiter einladen</button>}
        </div>
      </div>

      {ma.length > 0 && (
        <input value={maSearch} onChange={e=>setMaSearch(e.target.value)} placeholder="Name, E-Mail oder Rolle suchen…" className={`${twInput} mb-3 max-w-sm`} />
      )}

      {isAdmin && ma.length > 0 && (
        <div className="flex items-center gap-3 mb-3">
          <label className="flex items-center gap-2 text-sm text-slate-500 cursor-pointer select-none">
            <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} className="w-4 h-4 rounded border-slate-300 accent-slate-900" />
            Alle auswählen
          </label>
          {selected.size > 0 && <span className="text-sm text-slate-500">{selected.size} ausgewählt</span>}
        </div>
      )}

      {selected.size > 0 && (
        <div className="rounded-lg border border-blue-200 bg-blue-50/60 px-4 py-3 mb-4">
          <div className="flex gap-3 flex-wrap items-center">
            <button onClick={bulkResendInvites} disabled={bulkResending} className={`${twBtnPrimary} text-sm px-3.5 py-2`}>
              {bulkResending ? "Erstelle Links…" : `Einladung an ${selected.size} erneut senden`}
            </button>
            <button onClick={() => setSelected(new Set())} className={`${twBtnSecondary} text-sm px-3.5 py-2`}>Auswahl aufheben</button>
          </div>
          {isSuperAdmin && (
            <div className="flex gap-5 flex-wrap items-end mt-3 pt-3 border-t border-blue-200">
              <div>
                <label className={twLabel}>Profil für alle {selected.size} setzen</label>
                <div className="flex gap-3 flex-wrap">
                  {PROFILE.map(p => (
                    <label key={p} className="flex items-center gap-1.5 text-sm text-slate-700 cursor-pointer select-none">
                      <input type="checkbox" checked={bulkProfil.includes(p)} onChange={() => setBulkProfil(v => v.includes(p) ? v.filter(x => x !== p) : [...v, p])} className="rounded border-slate-300" />
                      {p}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className={twLabel}>Rolle für alle setzen</label>
                <select value={bulkRolle} onChange={e => setBulkRolle(e.target.value)} className={`${twInput} py-2 px-3 w-auto`}>
                  <option value="">– unverändert –</option>
                  <option value="user">Nutzer</option>
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super-Admin</option>
                </select>
              </div>
              <button onClick={applyBulkEdit} disabled={bulkSaving || (!bulkProfil.length && !bulkRolle)} className={`${twBtnPrimary} text-sm px-3.5 py-2`}>
                {bulkSaving ? "Speichert…" : "Übernehmen"}
              </button>
            </div>
          )}
        </div>
      )}

      {ma.length === 0 ? (
        <EmptyState icon={Users} text="Noch keine Mitarbeiter. Laden Sie welche ein!" />
      ) : visibleMa.length === 0 ? (
        <EmptyState icon={SearchX} text="Keine Mitarbeiter gefunden." />
      ) : (
        <div className="border border-slate-200 rounded-lg bg-white shadow-sm overflow-x-auto">
          <table className="w-full text-sm border-collapse min-w-[640px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100/70">
                {isAdmin && <th className="w-10 px-4 py-2.5"><input type="checkbox" checked={allSelected} onChange={toggleSelectAll} className="w-4 h-4 rounded border-slate-300 accent-slate-900" /></th>}
                <th className="text-left px-3 py-2.5 font-medium text-slate-500 text-xs uppercase tracking-wide">Name</th>
                <th className="text-left px-3 py-2.5 font-medium text-slate-500 text-xs uppercase tracking-wide">Rollen</th>
                <th className="text-left px-3 py-2.5 font-medium text-slate-500 text-xs uppercase tracking-wide">Status</th>
                <th className="w-10 px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {visibleMa.map(m => {
                const bestaetigt = m.bestaetigt || false;
                const editing = editId === m.id;
                const colCount = isAdmin ? 5 : 4;

                if (editing) return (
                  <tr key={m.email || m.id} className="border-b border-slate-100 last:border-b-0 bg-slate-50/60">
                    <td colSpan={colCount} className="p-4">
                      <div className="flex flex-col gap-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div><label className={twLabel}>Name</label><input value={draft.name} onChange={e=>setDraft(d=>({...d,name:e.target.value}))} className={twInput} /></div>
                          <div>
                            <label className={twLabel}>E-Mail</label>
                            <input type="email" value={draft.email} onChange={e=>setDraft(d=>({...d,email:e.target.value}))} className={twInput} />
                            {draft.email !== m.email && <div className="text-xs text-amber-700 mt-1">Hinweis: der Login-Zugang bleibt an die bisherige Adresse gebunden – bei dauerhafter Änderung ggf. neu einladen.</div>}
                          </div>
                        </div>
                        {isSuperAdmin && (
                          <div className="flex gap-4 flex-wrap">
                            <div>
                              <label className={twLabel}>Rolle</label>
                              <select
                                value={draft.rolle}
                                disabled={m.email === user.email}
                                title={m.email === user.email ? "Eigene Rolle nicht über die eigene Ansicht änderbar" : undefined}
                                onChange={e=>setDraft(d=>({...d,rolle:e.target.value}))}
                                className={`${twInput} py-2 px-3 w-auto`}
                              >
                                <option value="user">Nutzer</option>
                                <option value="admin">Admin</option>
                                <option value="super_admin">Super-Admin</option>
                              </select>
                            </div>
                            <div>
                              <label className={twLabel}>Profil (Mehrfachauswahl möglich)</label>
                              <div className="flex gap-3 flex-wrap pt-1.5">
                                {PROFILE.map(p => (
                                  <label key={p} className="flex items-center gap-1.5 text-sm text-slate-700 cursor-pointer select-none">
                                    <input type="checkbox" checked={draft.profil.includes(p)} onChange={()=>setDraft(d=>({...d, profil: d.profil.includes(p) ? d.profil.filter(x=>x!==p) : [...d.profil,p]}))} className="rounded border-slate-300" />
                                    {p}
                                  </label>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                        <div className="flex gap-2 justify-end">
                          <button onClick={cancelEdit} className={`${twBtnSecondary} text-sm px-3.5 py-2`}>Abbrechen</button>
                          <button onClick={()=>saveEdit(m)} disabled={savingId===m.id} className={`${twBtnPrimary} text-sm px-3.5 py-2`}>{savingId===m.id?"Speichert…":"Speichern"}</button>
                        </div>
                      </div>
                    </td>
                  </tr>
                );

                return (
                  <tr key={m.email || m.id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/80 transition-colors">
                    {isAdmin && (
                      <td className="px-4 py-3">
                        <input type="checkbox" checked={selected.has(m.id)} onChange={() => toggleSelect(m.id)} className="w-4 h-4 rounded border-slate-300 accent-slate-900" />
                      </td>
                    )}
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${avatarColorClass(m.name)}`}>{avatarInitials(m.name)}</span>
                        <div className="min-w-0">
                          <div className="font-medium text-slate-900 truncate">{m.name}</div>
                          <div className="text-xs text-slate-500 mt-0.5 truncate">{m.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex gap-1.5 flex-wrap">
                        <span className={twBadge}>{m.rolle === "super_admin" ? "Super-Admin" : m.rolle === "admin" ? "Admin" : "Nutzer"}</span>
                        {m.profil?.map(p => <span key={p} className={twBadge}>{p}</span>)}
                      </div>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${bestaetigt ? "text-emerald-700" : "text-amber-600"}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${bestaetigt ? "bg-emerald-500" : "bg-amber-400"}`} />
                        {bestaetigt ? "Bestätigt" : "Einladung ausstehend"}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <ActionsMenu items={[
                        isAdmin && { label: "Bearbeiten", onClick: () => startEdit(m) },
                        { label: resending === m.email ? "Wird gesendet…" : "Erneut senden", onClick: () => resendInvite(m.email, m.name, m.rolle, m.profil), disabled: resending === m.email },
                        isAdmin && { label: "Passwort-Link senden", onClick: () => sendResetLink(m.email, m.name), disabled: resending === m.email },
                        isAdmin && { label: "Löschen", onClick: () => deleteUser(m.id, m.email), danger: true },
                      ]} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {inviteOpen && (
        <Modal onClose={() => setInviteOpen(false)}>
          <InviteModal
            onClose={() => setInviteOpen(false)}
            showToast={showToast}
            onInviteSent={() => {
              onRefresh();
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
            onInviteSent={onRefresh}
          />
        </Modal>
      )}

      {bulkResults && (
        <Modal onClose={() => { setBulkResults(null); setSelected(new Set()); }}>
          <h2 style={{ margin: "0 0 14px", fontSize: 20 }}>Einladungslinks erstellt</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 340, overflowY: "auto" }}>
            {bulkResults.map((r, i) => (
              <div key={i} style={{ ...css.section, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", borderLeft: `4px solid ${r.ok ? C.blue : "#dc2626"}` }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{r.name}</div>
                  <div style={{ fontSize: 12, color: C.muted }}>{r.email}</div>
                  {!r.ok && <div style={{ fontSize: 12, color: "#dc2626", marginTop: 3 }}>Fehler: {r.error}</div>}
                </div>
                {r.ok && (
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => navigator.clipboard.writeText(r.url)} style={{ ...css.btnSec, fontSize: 12, padding: "5px 10px" }}>Link kopieren</button>
                    <button onClick={() => { window.location.href = buildInviteMail(r.name, r.email, r.url, "schulungen"); }} style={{ ...css.btn, fontSize: 12, padding: "5px 10px" }}>In Outlook öffnen</button>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}>
            <button onClick={() => { setBulkResults(null); setSelected(new Set()); }} style={css.btnSec}>Schließen</button>
          </div>
        </Modal>
      )}

      <div style={{ marginTop: 14, padding: "10px 14px", background: "#fbfcff", border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 12, color: C.muted }}>
        Import-Format (.csv, .xlsx, .xls), erste Zeile Kopfzeile, feste Spaltenreihenfolge: <strong style={{ color: C.text }}>Nachname, Vorname, E-Mail, Abteilung</strong>
      </div>
    </div>
  );
}

// ─── Protokoll (Admin) – wer hat wann was geändert ───────────────────────────
const AUDIT_TABLE_LABELS = {
  mitarbeiter: "Mitarbeiter", schulungen: "Schulungen", wissen_artikel: "Wissen",
  wissen_dateien: "Wissen-Dateien", wissen_kategorien: "Wissen-Kategorien", invite_tokens: "Einladungen",
};
const AUDIT_ACTION_STYLE = { INSERT: C.good, UPDATE: C.warn, DELETE: C.bad };

function fmtDateTime(d) {
  if (!d) return "—";
  try { return new Date(d).toLocaleString("de-DE"); } catch { return d; }
}

function ProtokollView() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterTable, setFilterTable] = useState("");
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.from("schulungen_audit_log").select("*").order("changed_at", { ascending: false }).limit(300);
      if (!error) setRows(data || []);
      setLoading(false);
    })();
  }, []);

  const filtered = filterTable ? rows.filter(r => r.table_name === filterTable) : rows;

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14, flexWrap:"wrap", gap:10 }}>
        <div>
          <h2 style={{ margin:0, fontSize:18, fontWeight:700, color:C.text }}>Protokoll</h2>
          <p style={{ margin:"3px 0 0", fontSize:13, color:C.muted }}>Wer hat wann was geändert – letzte 300 Einträge.</p>
        </div>
        <select value={filterTable} onChange={e=>setFilterTable(e.target.value)} style={{ ...css.inp, width:"auto", padding:"7px 12px", fontSize:13 }}>
          <option value="">Alle Bereiche</option>
          {Object.entries(AUDIT_TABLE_LABELS).map(([k,l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </div>

      {loading ? (
        <p style={{ color:C.muted, fontSize:14 }}>Lädt…</p>
      ) : filtered.length === 0 ? (
        <EmptyState icon={ClipboardList} text="Noch keine Einträge." />
      ) : (
        <div style={{ ...css.section, padding:0, overflow:"hidden" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13.5 }}>
            <thead>
              <tr style={{ background:C.blueDim }}>
                <th style={{ textAlign:"left", padding:"10px 14px", color:C.muted, fontWeight:600, fontSize:12 }}>Zeitpunkt</th>
                <th style={{ textAlign:"left", padding:"10px 14px", color:C.muted, fontWeight:600, fontSize:12 }}>Bereich</th>
                <th style={{ textAlign:"left", padding:"10px 14px", color:C.muted, fontWeight:600, fontSize:12 }}>Aktion</th>
                <th style={{ textAlign:"left", padding:"10px 14px", color:C.muted, fontWeight:600, fontSize:12 }}>Von</th>
                <th style={{ width:90 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(row => {
                const s = AUDIT_ACTION_STYLE[row.action] || { bg:"#EAECEF", border:C.border, text:C.muted };
                return (
                  <tr key={row.id} style={{ borderTop:`1px solid ${C.border}` }}>
                    <td style={{ padding:"10px 14px", color:C.text }}>{fmtDateTime(row.changed_at)}</td>
                    <td style={{ padding:"10px 14px", color:C.text }}>{AUDIT_TABLE_LABELS[row.table_name] || row.table_name}</td>
                    <td style={{ padding:"10px 14px" }}>
                      <span style={{ ...css.badge, background:s.bg, color:s.text }}>{row.action}</span>
                    </td>
                    <td style={{ padding:"10px 14px", color:C.text }}>{row.actor_email || "—"}</td>
                    <td style={{ padding:"8px 14px", textAlign:"right" }}>
                      <button onClick={()=>setDetail(row)} style={{ ...css.btnSec, padding:"5px 10px", fontSize:12 }}>Details</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {detail && (
        <Modal onClose={()=>setDetail(null)} wide>
          <h3 style={{ margin:"0 0 4px", fontSize:16, fontWeight:700 }}>{AUDIT_TABLE_LABELS[detail.table_name] || detail.table_name} – {detail.action}</h3>
          <p style={{ fontSize:12.5, color:C.muted, margin:"0 0 14px" }}>{fmtDateTime(detail.changed_at)} · {detail.actor_email || "unbekannt"}</p>
          <div style={{ display:"flex", gap:14, flexWrap:"wrap" }}>
            {detail.old_data && (
              <div style={{ flex:"1 1 260px" }}>
                <div style={css.lbl}>Vorher</div>
                <pre style={{ ...css.inp, fontFamily:"monospace", whiteSpace:"pre-wrap", fontSize:11.5, maxHeight:340, overflow:"auto" }}>{JSON.stringify(detail.old_data, null, 2)}</pre>
              </div>
            )}
            {detail.new_data && (
              <div style={{ flex:"1 1 260px" }}>
                <div style={css.lbl}>Nachher</div>
                <pre style={{ ...css.inp, fontFamily:"monospace", whiteSpace:"pre-wrap", fontSize:11.5, maxHeight:340, overflow:"auto" }}>{JSON.stringify(detail.new_data, null, 2)}</pre>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Fortschritt (nur Super-Admin) ────────────────────────────────────────────
function FortschrittView({ schulungen, ma }) {
  const [sortBy, setSortBy] = useState("pct");
  const [search, setSearch] = useState("");

  const rows = ma.map(m => {
    const assigned = schulungen.filter(s => effectiveEmpfaenger(s, ma).includes(m.id));
    const done = assigned.filter(s => s.nachweise?.[m.id]);
    const open = assigned.filter(s => !s.nachweise?.[m.id]);
    const pct = assigned.length ? Math.round((done.length/assigned.length)*100) : null;
    return { m, assigned, done, open, pct };
  });
  const sorted = [...rows].sort((a,b) => {
    if (sortBy === "name") return a.m.name.localeCompare(b.m.name);
    if (a.pct===null && b.pct===null) return a.m.name.localeCompare(b.m.name);
    if (a.pct===null) return 1;
    if (b.pct===null) return -1;
    return a.pct - b.pct;
  });
  const q = search.trim().toLowerCase();
  const visible = !q ? sorted : sorted.filter(({m}) => m.name?.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q) || m.profil?.some(p=>p.toLowerCase().includes(q)));
  const gesamtAssigned = rows.reduce((sum,r)=>sum+r.assigned.length,0);
  const gesamtDone = rows.reduce((sum,r)=>sum+r.done.length,0);
  const gesamtPct = gesamtAssigned ? Math.round((gesamtDone/gesamtAssigned)*100) : 0;

  return (
    <div style={{ fontFamily: FONT }}>
      <h2 style={{ margin: "0 0 4px", fontSize: 20 }}>📊 Fortschritt</h2>
      <p style={{ margin: "0 0 18px", fontSize: 13, color: C.muted }}>Wer hat welche zugewiesenen Schulungen abgeschlossen, wer hat noch offene.</p>

      <div className="grid grid-cols-3 gap-3 mb-5">
        {[["Zuweisungen gesamt", gesamtAssigned, ClipboardList, "bg-blue-50", "text-blue-600"],["Abgeschlossen", gesamtDone, CheckCircle2, "bg-emerald-50", "text-emerald-600"],["Quote gesamt", `${gesamtPct}%`, Percent, "bg-indigo-50", "text-indigo-600"]].map(([label,value,Icon,iconBg,iconColor])=>(
          <div key={label} className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${iconBg} ${iconColor}`}><Icon size={17} /></div>
            <div className="min-w-0">
              <div className="text-2xl font-bold text-slate-900 leading-none tabular-nums">{value}</div>
              <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-1 truncate">{label}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap:"wrap", alignItems:"center" }}>
        {[["pct","Niedrigste Quote zuerst"],["name","Nach Name"]].map(([id,label])=>(
          <button key={id} onClick={()=>setSortBy(id)} style={{ background: sortBy===id?C.navy:"transparent", color: sortBy===id?C.white:C.muted, border:`1px solid ${sortBy===id?C.navy:C.border}`, padding:"5px 13px", borderRadius:999, cursor:"pointer", fontSize:13, fontFamily:FONT }}>{label}</button>
        ))}
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Name, E-Mail oder Profil suchen…" style={{ ...css.inp, flex:1, minWidth:160, padding:"7px 12px", fontSize:13 }} />
      </div>

      {ma.length===0 && <EmptyState icon={Users} text="Noch keine Mitarbeiter." />}
      {ma.length>0 && visible.length===0 && <EmptyState icon={SearchX} text="Keine Mitarbeiter gefunden." />}

      {visible.map(({ m, assigned, done, open, pct }) => (
        <details key={m.id} className="fortschritt-row" style={{ ...css.section, padding: "12px 16px", transition:"box-shadow .15s ease, border-color .15s ease" }}>
          <summary style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, minWidth:0 }}>
              <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${avatarColorClass(m.name)}`}>{avatarInitials(m.name)}</span>
              <div style={{ minWidth:0 }}>
                <strong style={{ fontSize: 14 }}>{m.name}</strong>
                <div style={{ color: C.muted, fontSize: 12 }}>{m.email}{m.profil?.length?` · ${m.profil.join(", ")}`:""}</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink:0 }}>
              <span style={{ fontSize: 12, color: C.muted }}>{done.length}/{assigned.length}</span>
              <div style={{ width: 90, height: 8, background: "#e7edf7", borderRadius: 999, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct ?? 0}%`, background: pct===null?C.border:pct===100?C.good.text:pct<50?C.bad.text:C.blueAccent, borderRadius: 999, transition:"width .3s ease" }} />
              </div>
              <strong style={{ fontSize: 13, minWidth: 36, textAlign: "right" }}>{pct===null?"–":`${pct}%`}</strong>
            </div>
          </summary>
          {assigned.length === 0 ? (
            <p style={{ margin: "10px 0 0", fontSize: 13, color: C.muted }}>Keine Schulungen zugewiesen.</p>
          ) : (
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
              {open.map(s => {
                const fs = fristStatus(s.frist);
                return (
                  <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems:"center", gap:10, fontSize: 13, padding: "6px 10px", background: C.warn.bg, border: `1px solid ${C.warn.border}`, borderRadius: 8 }}>
                    <span>{s.titel}{s.pflicht?" · Pflicht":""}</span>
                    <span style={{ display:"flex", alignItems:"center", gap:8 }}>
                      {fs==="over"&&<span style={{ ...css.badge, background:C.bad.bg, color:C.bad.text }}>Überfällig</span>}
                      {fs==="soon"&&<span style={{ ...css.badge, background:C.warn.bg, color:C.warn.text }}>Bald fällig</span>}
                      <span style={{ color: C.warn.text, fontWeight: 600 }}>Offen</span>
                    </span>
                  </div>
                );
              })}
              {done.map(s => {
                const nw = s.nachweise[m.id];
                return (
                  <div key={s.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "6px 10px", background: C.good.bg, border: `1px solid ${C.good.border}`, borderRadius: 8 }}>
                    <span>{s.titel}</span>
                    <span style={{ color: C.good.text, fontWeight: 600 }}>✓ {nw.ts||"–"}</span>
                  </div>
                );
              })}
            </div>
          )}
        </details>
      ))}
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
      <p style={{ margin:"0 0 8px", fontSize:12, color:C.muted }}>Personen mit passendem Profil (Zielgruppe: {(sc.zielgruppen||[]).join(", ")||"–"}) sind automatisch zugeordnet und lassen sich hier nicht abwählen.</p>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:14 }}>
        {ma.map(m=>{
          const auto = matchesZielgruppe(sc.zielgruppen, m.profil);
          const checked = auto || sel.has(m.id);
          return (
          <label key={m.id} style={{ display:"flex", alignItems:"center", gap:10, border:`1px solid ${checked?C.blue:C.border}`, background:checked?C.blueDim:"#fbfcff", borderRadius:11, padding:"9px 13px", cursor:auto?"default":"pointer", opacity:auto?0.85:1 }}>
            <input type="checkbox" checked={checked} disabled={auto} onChange={()=>toggle(m.id)} style={{ accentColor:C.blue, width:17, height:17 }} />
            <div><div style={{ fontWeight:700, fontSize:13 }}>{m.name}{auto&&<span style={{ marginLeft:8, fontSize:11, fontWeight:700, color:C.blue }}>· Zielgruppe</span>}</div><div style={{ fontSize:11, color:C.muted }}>{m.rolle} · {m.team}</div></div>
          </label>
          );
        })}
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

function ReminderModal({ sc, ma, onClose }) {
  const open = effectiveEmpfaenger(sc, ma).map(id=>ma.find(m=>m.id===id)).filter(Boolean).filter(m=>!sc.nachweise?.[m.id]);
  const [msg, setMsg] = useState(`Kurze Erinnerung: Die Selbstlern-Unterweisung „${sc.titel}"${sc.pflicht?" (Pflichtschulung)":""} ist noch offen. Bitte zeitnah abschließen und den digitalen Nachweis absenden.\n\nViele Grüße`);
  const [aiL, setAiL] = useState(false);
  const [copied, setCopied] = useState(false);
  const genMsg = async () => {
    setAiL(true);
    const t = await callAI("Kurze, freundliche Teams-Erinnerung für SAPV-Team. Nur Text, kein Betreff.", `Erinnerung an die noch offene Selbstlern-Unterweisung "${sc.titel}"${sc.pflicht?", Pflichtschulung":""}. Freundlich, knapp, professionell, nicht mahnend.`).catch(()=>"");
    if (t) setMsg(t);
    setAiL(false);
  };
  const copy = () => { navigator.clipboard.writeText(msg); setCopied(true); setTimeout(()=>setCopied(false),2000); };
  return (
    <div style={{ fontFamily:FONT, color:C.text }}>
      <h2 style={{ margin:"0 0 4px", fontSize:20 }}>🔔 Erinnerung senden</h2>
      <p style={{ color:C.muted, margin:"0 0 18px", fontSize:14 }}>{sc.titel} · {sc.dokNr} · {open.length} noch offen</p>
      {open.length===0 ? (
        <p style={{ color:C.muted }}>Alle zugewiesenen Personen haben die Schulung bereits abgeschlossen.</p>
      ) : (<>
        <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:14 }}>
          {open.map(m=><span key={m.id} style={css.badge}>{m.name}</span>)}
        </div>
        <p style={{ margin:"0 0 8px", fontSize:12, color:C.muted }}>Text kopieren und wie üblich in Microsoft Teams an die offene Personen versenden.</p>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
          <label style={css.lbl}>Teams-Nachricht</label>
          <AIBtn onClick={genMsg} loading={aiL} label="Formulieren" />
        </div>
        <textarea value={msg} onChange={e=>setMsg(e.target.value)} style={{ ...css.inp, minHeight:100, resize:"vertical" }} />
      </>)}
      <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:14 }}>
        <button onClick={onClose} style={css.btnSec}>Schließen</button>
        {open.length>0 && <button onClick={copy} style={css.btn}>{copied?"✓ Kopiert":"In Zwischenablage kopieren"}</button>}
      </div>
    </div>
  );
}

// ─── Nachweisübersicht ────────────────────────────────────────────────────────
function NachweisModal({ sc, ma, onClose }) {
  const empf=effectiveEmpfaenger(sc, ma).map(id=>ma.find(m=>m.id===id)).filter(Boolean);
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
const FILE_ICONS = { pdf:"📄", word:"📝", excel:"📊", powerpoint:"📑", image:"🖼️", datei:"📎" };
const FILE_COLORS = { pdf:"#c0392b", word:"#2459b8", excel:"#27ae60", powerpoint:"#e67e22", image:"#8e44ad", datei:"#666" };

function getFileType(filename) {
  const ext = (filename||"").split(".").pop().toLowerCase();
  if (ext==="pdf") return "pdf";
  if (["doc","docx"].includes(ext)) return "word";
  if (["xls","xlsx"].includes(ext)) return "excel";
  if (["ppt","pptx"].includes(ext)) return "powerpoint";
  if (["jpg","jpeg","png","gif","webp"].includes(ext)) return "image";
  return "datei";
}
function formatSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024*1024) return `${(bytes/1024).toFixed(0)} KB`;
  return `${(bytes/1024/1024).toFixed(1)} MB`;
}

// ─── Drag&Drop-Zone (Anhänge-Box, Inhalt-Textarea, Detailansicht) ─────────────
function DropZone({ onFiles, children, style }) {
  const [active, setActive] = useState(false);
  return (
    <div
      onDragOver={e=>{ e.preventDefault(); setActive(true); }}
      onDragLeave={()=>setActive(false)}
      onDrop={e=>{
        e.preventDefault(); setActive(false);
        const files = Array.from(e.dataTransfer.files||[]);
        if (files.length) onFiles(files);
      }}
      style={{ ...style, outline: active ? "2px dashed #3b82f6" : "2px dashed transparent", outlineOffset:2, borderRadius:8 }}
    >
      {children}
    </div>
  );
}

// ─── Inhalt mit eingebetteten Bildern (![alt](storage-pfad =breite) wird zu <img>) ─
// Bild-Token-Syntax: ![alt](pfad) oder ![alt](pfad =360) fuer eine Breite in px (Default 260).
// Direkt aufeinanderfolgende Bild-Token (nur Whitespace dazwischen) werden nebeneinander gerendert.
const IMG_TOKEN_RE = /(!\[[^\]]*\]\([^)\s]+(?:\s+=\d+)?\))/g;
const IMG_TOKEN_MATCH_RE = /^!\[([^\]]*)\]\(([^)\s]+)(?:\s+=(\d+))?\)$/;

function parseSegments(text) {
  return (text||"").split(IMG_TOKEN_RE).map(raw => {
    const m = raw.match(IMG_TOKEN_MATCH_RE);
    return m ? { type:"img", alt:m[1], path:m[2], width:m[3]?Number(m[3]):260 } : { type:"text", raw };
  });
}
function serializeSegments(segments) {
  return segments.map(s => s.type==="img" ? `![${s.alt}](${s.path}${s.width!==260?` =${s.width}`:""})` : s.raw).join("");
}
function moveImage(segments, imgIdx, dir) {
  const positions = segments.map((s,i)=>s.type==="img"?i:-1).filter(i=>i>=0);
  const from = positions[imgIdx], to = positions[imgIdx+dir];
  if (to===undefined) return segments;
  const copy = [...segments];
  [copy[from], copy[to]] = [copy[to], copy[from]];
  return copy;
}

function WissenInlineImage({ alt, path, width=260 }) {
  const [url, setUrl] = useState(null);
  const [big, setBig] = useState(false);
  useEffect(() => { getSignedUrl(path).then(setUrl).catch(console.error); }, [path]);
  // ponytail: kein Fehler-Fallback im UI, falls Upload zuvor fehlschlug (path="pending:..." existiert nicht im Bucket) —
  // bleibt dann dauerhaft als leerer Platzhalter stehen; Admin merkt es beim Ansehen des Artikels.
  if (!url) return <div style={{ width, height:width*0.55, maxWidth:"100%", background:"#f1f5f9", borderRadius:8 }} />;
  return (
    <>
      <img src={url} alt={alt} onClick={()=>setBig(true)} title="Zum Vergrößern klicken" style={{ width, maxWidth:"100%", borderRadius:8, display:"block", cursor:"zoom-in" }} />
      {big && (
        <Modal onClose={()=>setBig(false)} wide>
          <img src={url} alt={alt} style={{ maxWidth:"100%", maxHeight:"85vh", display:"block", borderRadius:8, margin:"0 auto" }} />
          {alt && <p style={{ margin:"12px 0 0", textAlign:"center", color:C.muted, fontSize:13 }}>{alt}</p>}
        </Modal>
      )}
    </>
  );
}
function WissenInhalt({ text }) {
  const segments = parseSegments(text);
  const rows = [];
  for (let i=0; i<segments.length; i++) {
    const seg = segments[i];
    if (seg.type==="text") { if (seg.raw.trim()) rows.push({ type:"text", raw:seg.raw }); continue; }
    const group = [seg];
    while (segments[i+1]?.type==="text" && !segments[i+1].raw.trim() && segments[i+2]?.type==="img") { group.push(segments[i+2]); i+=2; }
    rows.push({ type:"imgrow", images:group });
  }
  return (
    <div style={{ marginBottom:20 }}>
      {rows.map((row,i) => row.type==="text"
        ? <p key={i} style={{ margin:"0 0 12px", whiteSpace:"pre-wrap", lineHeight:1.7 }}>{row.raw}</p>
        : <div key={i} style={{ display:"flex", flexWrap:"wrap", gap:10, marginBottom:12 }}>
            {row.images.map((img,j) => <WissenInlineImage key={j} alt={img.alt} path={img.path} width={img.width} />)}
          </div>
      )}
    </div>
  );
}

// ─── Bilder-Verwaltung im Formular: Reihenfolge, Größe, nebeneinander ─────────
function WissenBilderPanel({ inhalt, onChange }) {
  const segments = parseSegments(inhalt);
  const images = segments.filter(s=>s.type==="img");
  if (!images.length) return null;
  const setWidth = (i,w) => { const s=parseSegments(inhalt); const pos=s.map((x,idx)=>x.type==="img"?idx:-1).filter(idx=>idx>=0)[i]; s[pos].width=w; onChange(serializeSegments(s)); };
  const move = (i,dir) => onChange(serializeSegments(moveImage(parseSegments(inhalt), i, dir)));
  return (
    <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:14, marginBottom:14 }}>
      <label style={css.lbl}>🖼️ Bilder im Text <span style={{ fontWeight:400, color:C.muted, fontSize:11 }}>– Größe, Reihenfolge; direkt hintereinander (Pfeil ▶ ohne Absatz dazwischen) = nebeneinander</span></label>
      <div style={{ display:"flex", flexDirection:"column", gap:6, marginTop:8 }}>
        {images.map((img,i) => (
          <div key={i} style={{ display:"flex", alignItems:"center", gap:10, background:"#f7f9fc", border:`1px solid ${C.border}`, borderRadius:8, padding:"7px 11px" }}>
            <button onClick={()=>move(i,-1)} disabled={i===0} style={{ ...css.btnSec, padding:"2px 8px", fontSize:12, opacity:i===0?0.4:1 }}>▲</button>
            <button onClick={()=>move(i,1)} disabled={i===images.length-1} style={{ ...css.btnSec, padding:"2px 8px", fontSize:12, opacity:i===images.length-1?0.4:1 }}>▼</button>
            <span style={{ flex:1, fontSize:13, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{img.alt}</span>
            <input type="range" min="80" max="600" step="20" value={img.width} onChange={e=>setWidth(i,Number(e.target.value))} style={{ width:100 }} />
            <span style={{ fontSize:11, color:C.muted, width:40 }}>{img.width}px</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function WissenView({ isAdmin, showToast }) {
  const [artikel, setArtikel] = useState([]);
  const [kategorieMap, setKategorieMap] = useState({});
  const [wissenLoading, setWissenLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ titel:"", kategorie_id:"", inhalt:"" });
  const [pendingFiles, setPendingFiles] = useState([]);
  const [uploadingDetail, setUploadingDetail] = useState(false);
  const formFileRef = useRef();
  const detailFileRef = useRef();

  useEffect(() => {
    Promise.all([
      supabase.from("wissen_artikel").select("*, wissen_dateien(*)").order("created_at"),
      supabase.from("wissen_kategorien").select("*"),
    ]).then(([artRes, katRes]) => {
      if (artRes.error) console.error("Wissen-Fehler:", artRes.error);
      if (katRes.error) console.error("Kategorien-Fehler:", katRes.error);
      if (katRes.data) {
        const map = {};
        katRes.data.forEach(k => { map[k.id] = k; });
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
    let artikelId;
    if (editing==="neu") {
      const { data, error } = await supabase.from("wissen_artikel").insert(payload).select("*, wissen_dateien(*)").single();
      if (error) { showToast(`Fehler: ${error.message}`); return; }
      artikelId = data.id;
      setArtikel(a=>[...a,{ ...data, dateien:data.wissen_dateien ?? [] }]);
      showToast("Artikel erstellt.");
    } else {
      const { data, error } = await supabase.from("wissen_artikel").update(payload).eq("id",editing).select("*, wissen_dateien(*)").single();
      if (error) { showToast(`Fehler: ${error.message}`); return; }
      artikelId = editing;
      setArtikel(a=>a.map(x=>x.id===editing?{ ...data, dateien:data.wissen_dateien ?? [] }:x));
      showToast("Gespeichert.");
    }
    let inhaltMitBildern = payload.inhalt;
    for (const file of pendingFiles) {
      try {
        const result = await uploadDokument(file);
        const { data:d, error:e } = await supabase.from("wissen_dateien")
          .insert({ artikel_id:artikelId, name:file.name, typ:getFileType(file.name), url:result.path, groesse:file.size })
          .select().single();
        if (!e && d) {
          setArtikel(a=>a.map(x=>x.id===artikelId?{ ...x, dateien:[...x.dateien,d] }:x));
          // Im Textarea per Drag&Drop eingefügte Bilder stehen als "pending:<dateiname>" im Text,
          // bis der echte Storage-Pfad da ist (siehe Inhalt-DropZone unten).
          inhaltMitBildern = inhaltMitBildern.replaceAll(`pending:${file.name}`, d.url);
        }
      } catch (fe) { showToast(`"${file.name}" Upload fehlgeschlagen.`); }
    }
    if (inhaltMitBildern !== payload.inhalt) {
      const { data:updated, error:ue } = await supabase.from("wissen_artikel").update({ inhalt:inhaltMitBildern }).eq("id",artikelId).select().single();
      if (!ue) setArtikel(a=>a.map(x=>x.id===artikelId?{ ...x, inhalt:updated.inhalt }:x));
    }
    setPendingFiles([]);
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

  const addFileInDetail = async (file) => {
    if (!selected) return;
    setUploadingDetail(true);
    try {
      const result = await uploadDokument(file);
      const { data, error } = await supabase.from("wissen_dateien")
        .insert({ artikel_id:selected, name:file.name, typ:getFileType(file.name), url:result.path, groesse:file.size })
        .select().single();
      if (error) throw error;
      setArtikel(a=>a.map(x=>x.id===selected ? { ...x, dateien:[...x.dateien,data] } : x));
      showToast(`"${file.name}" angehängt.`);
    } catch (err) { showToast(`Upload fehlgeschlagen: ${err.message}`); }
    finally { setUploadingDetail(false); }
  };

  const removeDatei = async (artikelId, datei) => {
    const { error } = await supabase.from("wissen_dateien").delete().eq("id",datei.id);
    if (error) { showToast(`Fehler: ${error.message}`); return; }
    setArtikel(a=>a.map(x=>x.id===artikelId ? { ...x, dateien:x.dateien.filter(d=>d.id!==datei.id) } : x));
    if (datei.url) deleteDokument(datei.url).catch(console.error);
    showToast("Datei entfernt.");
  };

  if (wissenLoading) return (
    <div style={{ fontFamily:FONT }}>
      <h2 style={{ margin:"0 0 18px", fontSize:20 }}>📚 Wissensdatenbank</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({length:6}).map((_,i)=><WissenSkeletonCard key={i} />)}
      </div>
    </div>
  );

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
                {Object.entries(kategorieMap).map(([id,k])=><option key={id} value={id}>{k.name}</option>)}
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

          <label style={css.lbl}>Inhalt <span style={{ fontWeight:400, color:C.muted, fontSize:11 }}>– Bilder per Drag&Drop direkt in den Text ziehen</span></label>
          <DropZone
            style={{ marginBottom:14 }}
            onFiles={files=>{
              setPendingFiles(p=>[...p,...files]);
              const bilder = files.filter(f=>f.type.startsWith("image/"));
              if (bilder.length) setF("inhalt", form.inhalt + bilder.map(f=>`\n![${f.name}](pending:${f.name})\n`).join(""));
            }}
          >
            <textarea value={form.inhalt} onChange={e=>setF("inhalt",e.target.value)} style={{ ...css.inp, minHeight:100, resize:"vertical" }} />
          </DropZone>

          <WissenBilderPanel inhalt={form.inhalt} onChange={v=>setF("inhalt",v)} />
          {parseSegments(form.inhalt).some(s=>s.type==="img") && (
            <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:14, marginBottom:14 }}>
              <label style={css.lbl}>👁️ Vorschau</label>
              <div style={{ border:`1px solid ${C.border}`, borderRadius:8, padding:14, marginTop:6 }}>
                <WissenInhalt text={form.inhalt} />
              </div>
            </div>
          )}

          <DropZone onFiles={files=>setPendingFiles(p=>[...p,...files])} style={{ borderTop:`1px solid ${C.border}`, paddingTop:14, marginBottom:14 }}>
            <label style={{ ...css.lbl, display:"flex", justifyContent:"space-between" }}>
              <span>📎 Anhänge</span>
              <span style={{ fontWeight:400, color:C.muted, fontSize:11 }}>PDF, Word, Excel, PowerPoint, Bilder – auch per Drag&Drop</span>
            </label>
            <input ref={formFileRef} type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.gif" style={{ display:"none" }}
              onChange={e=>{ setPendingFiles(p=>[...p,...Array.from(e.target.files)]); e.target.value=""; }} />
            <button onClick={()=>formFileRef.current?.click()} style={{ ...css.btnSec, fontSize:13, marginBottom:pendingFiles.length?10:0 }}>+ Datei hinzufügen</button>
            {pendingFiles.length>0 && (
              <div style={{ display:"flex", flexDirection:"column", gap:6, marginTop:8 }}>
                {pendingFiles.map((f,i)=>(
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:8, background:"#f0f4f8", borderRadius:7, padding:"7px 11px" }}>
                    <span style={{ fontSize:16 }}>{FILE_ICONS[getFileType(f.name)]||"📎"}</span>
                    <span style={{ flex:1, fontSize:13, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{f.name}</span>
                    <span style={{ fontSize:11, color:C.muted, whiteSpace:"nowrap" }}>{formatSize(f.size)}</span>
                    <button onClick={()=>setPendingFiles(p=>p.filter((_,j)=>j!==i))} style={{ ...css.btnDanger, padding:"2px 8px", fontSize:12 }}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </DropZone>

          <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
            <button onClick={()=>{ setEditing(null); setPendingFiles([]); }} style={css.btnSec}>Abbrechen</button>
            <button onClick={saveArtikel} style={css.btn}>{`Speichern${pendingFiles.length>0?` + ${pendingFiles.length} Datei(en)`:""}`}</button>
          </div>
        </div>
      )}

      {/* Detailansicht */}
      {selected && art && !editing && (
        <div style={css.section}>
          <span style={{ ...css.badge, marginBottom:10, marginRight:6, display:"inline-block" }}>{kategorieMap[art.kategorie_id]?.name ?? art.kategorie ?? "—"}</span>
          {isAdmin && art.status && art.status!=="Freigegeben" && <span style={{ ...css.badge, marginBottom:10, display:"inline-block", background:"#fde68a", color:"#92400e" }}>{art.status}</span>}
          <h2 style={{ margin:"0 0 14px", fontSize:20 }}>{art.titel}</h2>
          <WissenInhalt text={art.inhalt} />
          {art.dateien.filter(d=>d.typ==="video").map(d=>(
            <div key={d.id} style={{ position:"relative", marginBottom:8 }}>
              <WissenVideoBlock datei={d} />
              {isAdmin && (
                <button onClick={()=>removeVideo(art.id,d.id,d.url)} style={{ ...css.btnDanger, position:"absolute", top:0, right:0, padding:"3px 9px", fontSize:12 }}>✕</button>
              )}
            </div>
          ))}

          {art.dateien.filter(d=>d.typ!=="video").length>0 && (
            <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:14, marginBottom:16 }}>
              <p style={{ margin:"0 0 10px", fontSize:12, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:.5 }}>Anhänge</p>
              <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
                {art.dateien.filter(d=>d.typ!=="video").map(d=>{
                  const typ = d.typ || getFileType(d.name||"");
                  const col = FILE_COLORS[typ]||"#666";
                  return (
                    <div key={d.id} style={{ display:"flex", alignItems:"center", gap:10, background:"#f7f9fc", border:`1px solid ${C.border}`, borderLeft:`3px solid ${col}`, borderRadius:8, padding:"9px 12px" }}>
                      <span style={{ fontSize:20 }}>{FILE_ICONS[typ]||"📎"}</span>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{d.name}</div>
                        {d.groesse && <div style={{ fontSize:11, color:C.muted }}>{formatSize(d.groesse)}</div>}
                      </div>
                      <button onClick={async()=>{ try { window.open(await getSignedUrl(d.url), "_blank"); } catch(e) { alert("Datei konnte nicht geöffnet werden: "+e.message); } }} style={{ ...css.btnSec, fontSize:12, padding:"5px 11px" }}>⬇ Öffnen</button>
                      {isAdmin && <button onClick={()=>removeDatei(art.id,d)} style={{ ...css.btnDanger, padding:"5px 9px", fontSize:12 }}>✕</button>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {isAdmin && (
            <div style={{ marginTop:16, borderTop:`1px solid ${C.border}`, paddingTop:14 }}>
              <p style={{ margin:"0 0 8px", fontSize:13, fontWeight:700, color:C.muted }}>Video anhängen</p>
              <VideoUploader label="Video hochladen (MP4)" onUploaded={({path,name})=>addVideo(art.id,{path,name})} />
              <p style={{ margin:"14px 0 8px", fontSize:13, fontWeight:700, color:C.muted }}>Datei anhängen <span style={{fontWeight:400,color:C.muted}}>– auch per Drag&Drop, mehrere gleichzeitig</span></p>
              <DropZone onFiles={async files=>{ for (const f of files) await addFileInDetail(f); }}>
                <input ref={detailFileRef} type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg" style={{ display:"none" }}
                  onChange={async e=>{ for (const f of Array.from(e.target.files)) await addFileInDetail(f); e.target.value=""; }} />
                <button onClick={()=>detailFileRef.current?.click()} disabled={uploadingDetail} style={{ ...css.btnSec, fontSize:13, opacity:uploadingDetail?0.6:1 }}>
                  {uploadingDetail ? "⏳ Wird hochgeladen…" : "📎 Datei anhängen"}
                </button>
              </DropZone>
            </div>
          )}
        </div>
      )}

      {/* Artikelliste */}
      {!selected && !editing && (
        <div>
          {artikel.length===0 && <EmptyState icon={BookOpen} text="Noch keine Artikel." />}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {artikel.map(a=>{
              const videos=a.dateien.filter(d=>d.typ==="video").length;
              const docs=a.dateien.filter(d=>d.typ!=="video").length;
              const kat = kategorieMap[a.kategorie_id];
              const preview = stripMd(a.inhalt);
              const lesedauer = Math.max(1, Math.round(preview.split(/\s+/).filter(Boolean).length / 200));
              return (
                <div key={a.id}
                  className="group relative bg-white border border-slate-200/80 rounded-xl shadow-sm p-5 cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_28px_-6px_rgba(59,130,246,0.25)] hover:border-blue-200"
                  onClick={()=>setSelected(a.id)}>
                  {isAdmin && (
                    <button onClick={e=>{e.stopPropagation();deleteArtikel(a.id);}} className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-red-600 text-sm">✕</button>
                  )}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg shrink-0" style={{ background: kat?.farbe ? `${kat.farbe}1a` : "#f1f5f9" }}>
                      {kat?.icon || "📄"}
                    </div>
                    <span className="text-xs font-medium text-slate-500 truncate">{kat?.name ?? a.kategorie ?? "—"}</span>
                  </div>
                  {isAdmin && a.status && a.status!=="Freigegeben" && <span style={{ ...css.badge, marginBottom:6, display:"inline-block", background:"#fde68a", color:"#92400e" }}>{a.status}</span>}
                  <h3 className="text-[15px] font-semibold text-slate-900 mb-1.5 leading-snug">{a.titel}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed mb-3">{preview.slice(0,110)}{preview.length>110?"…":""}</p>
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <span>⏱ {lesedauer} Min. Lesezeit</span>
                    {videos>0 && <span className="text-blue-600">▶ {videos} Video{videos!==1?"s":""}</span>}
                    {docs>0 && <span>📎 {docs} Anhang{docs!==1?"e":""}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────
function exportExcel(schulungen, ma) {
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(schulungen.map(s=>({Titel:s.titel,"Dok-Nr":s.dokNr,Version:s.version,Status:s.status,Kategorie:s.kategorie,Pflicht:s.pflicht?"Ja":"Nein","Gültig ab":s.gueltigAb,"Nächste Prüfung":s.naechstePruefung,Versendet:effectiveEmpfaenger(s,ma).length,Nachweise:Object.keys(s.nachweise||{}).length}))),"Schulungen");
  const rows2=[]; schulungen.forEach(s=>effectiveEmpfaenger(s,ma).forEach(id=>{const m=ma.find(x=>x.id===id);const n=s.nachweise?.[id];rows2.push({Schulung:s.titel,"Dok-Nr":s.dokNr,Version:s.version,Name:m?.name||id,Team:m?.team||"",Rolle:m?.rolle||"",Bestanden:n?"Ja":"Ausstehend",Datum:n?.ts||"–",Punkte:n?`${n.score}/${n.maxP}`:"–",Prüfcode:n?.code||"–"});}));
  if(rows2.length)XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows2),"Nachweise");
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(ma.map(({id,...m})=>m)),"Mitarbeiter");
  XLSX.writeFile(wb,`PNRM_Schulungen_${new Date().toISOString().slice(0,10)}.xlsx`);
}

function EyeIcon({ off }) {
  return off ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.8 21.8 0 0 1 5.06-6.06M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a21.8 21.8 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function PwField({ label, value, onChange, placeholder, autoFocus, autoComplete, inputClassName, labelClassName }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className={labelClassName} style={labelClassName ? undefined : css.lbl}>{label}</label>
      <div style={{ position:"relative" }}>
        <input
          type={show?"text":"password"} value={value} onChange={onChange} placeholder={placeholder} required autoFocus={autoFocus} autoComplete={autoComplete}
          className={inputClassName}
          style={inputClassName ? undefined : { ...css.inp, padding:"12px 42px 12px 16px" }}
        />
        <button type="button" onClick={()=>setShow(s=>!s)} aria-label={show?"Passwort verbergen":"Passwort anzeigen"} style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", padding:6, display:"flex", color: inputClassName ? "#94a3b8" : C.muted }}>
          <EyeIcon off={show} />
        </button>
      </div>
    </div>
  );
}

function SetPasswordView({ token, onDone }) {
  const [status, setStatus] = useState("loading"); // loading | ready | error | success
  const [invite, setInvite] = useState(null);
  const [errMsg, setErrMsg] = useState("");
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr] = useState(null);

  useEffect(() => {
    invokeFn("validate_invite", { token })
      .then(data => { setInvite(data); setStatus("ready"); })
      .catch(e => { setErrMsg(e.message); setStatus("error"); });
  }, [token]);

  const submit = async e => {
    e.preventDefault();
    setSubmitErr(null);
    if (pw1.length < 12) { setSubmitErr("Das Passwort muss mindestens 12 Zeichen lang sein."); return; }
    if (pw1 !== pw2) { setSubmitErr("Die Passwörter stimmen nicht überein."); return; }
    setSubmitting(true);
    try {
      await invokeFn("redeem_invite", { token, password: pw1 });
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email: invite.email, password: pw1 });
      if (signInErr) throw new Error(signInErr.message);
      setStatus("success");
      setTimeout(() => onDone(), 900);
    } catch (e) {
      setSubmitErr(e.message);
    }
    setSubmitting(false);
  };

  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:C.bg, fontFamily:FONT, padding:24 }}>
      <div style={{ width:"100%", maxWidth:400, background:C.white, borderRadius:16, padding:"36px 34px", boxShadow:"0 1px 2px rgba(22,35,58,.05), 0 12px 40px rgba(46,75,110,.1)", border:`1px solid ${C.border}` }}>
        <div style={{ textAlign:"center", marginBottom:22 }}>
          <img src="/logo.png" alt="PNRM" style={{ height:44, marginBottom:14 }} />
        </div>

        {status === "loading" && <p style={{ textAlign:"center", color:C.muted, fontSize:14 }}>Einladung wird geprüft…</p>}

        {status === "error" && (
          <div>
            <h2 style={{ margin:"0 0 10px", fontSize:19, fontWeight:700 }}>Einladung ungültig</h2>
            <div style={css.bad}>{errMsg}</div>
            <button onClick={onDone} style={{ ...css.btnSec, width:"100%", marginTop:16, padding:"11px 16px" }}>Zur Anmeldung</button>
          </div>
        )}

        {status === "ready" && (
          <form onSubmit={submit}>
            <h2 style={{ margin:"0 0 4px", fontSize:19, fontWeight:700, letterSpacing:"-0.01em" }}>Willkommen, {invite.name.split(" ")[0]}!</h2>
            <p style={{ margin:"0 0 22px", fontSize:14, color:C.muted }}>Lege ein Passwort für <strong style={{ color:C.text }}>{invite.email}</strong> fest.</p>
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              <PwField label="Neues Passwort" value={pw1} onChange={e=>setPw1(e.target.value)} placeholder="Mindestens 12 Zeichen" autoFocus autoComplete="new-password" />
              <PwField label="Passwort bestätigen" value={pw2} onChange={e=>setPw2(e.target.value)} placeholder="Wiederholen" autoComplete="new-password" />
              {submitErr && <p style={{ margin:0, fontSize:13, color:C.bad.text }}>{submitErr}</p>}
              <button type="submit" disabled={submitting} style={{ ...css.btn, padding:"12px 16px", fontSize:14.5, width:"100%", marginTop:4, opacity:submitting?0.65:1 }}>{submitting?"Wird gespeichert…":"Passwort setzen & anmelden"}</button>
            </div>
          </form>
        )}

        {status === "success" && (
          <div>
            <h2 style={{ margin:"0 0 8px", fontSize:19, fontWeight:700 }}>Fertig! ✓</h2>
            <p style={{ margin:0, fontSize:14, color:C.muted }}>Du wirst angemeldet…</p>
          </div>
        )}
      </div>
    </div>
  );
}

function NewPasswordView({ onDone }) {
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr] = useState(null);
  const [done, setDone] = useState(false);

  const submit = async e => {
    e.preventDefault();
    setSubmitErr(null);
    if (pw1.length < 12) { setSubmitErr("Das Passwort muss mindestens 12 Zeichen lang sein."); return; }
    if (pw1 !== pw2) { setSubmitErr("Die Passwörter stimmen nicht überein."); return; }
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password: pw1 });
    if (error) { setSubmitErr(error.message); setSubmitting(false); return; }
    await supabase.auth.signOut();
    setDone(true);
    setTimeout(() => onDone(), 900);
  };

  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:C.bg, fontFamily:FONT, padding:24 }}>
      <div style={{ width:"100%", maxWidth:400, background:C.white, borderRadius:16, padding:"36px 34px", boxShadow:"0 1px 2px rgba(22,35,58,.05), 0 12px 40px rgba(46,75,110,.1)", border:`1px solid ${C.border}` }}>
        <div style={{ textAlign:"center", marginBottom:22 }}>
          <img src="/logo.png" alt="PNRM" style={{ height:44, marginBottom:14 }} />
        </div>
        {done ? (
          <div>
            <h2 style={{ margin:"0 0 8px", fontSize:19, fontWeight:700 }}>Fertig! ✓</h2>
            <p style={{ margin:0, fontSize:14, color:C.muted }}>Du kannst dich jetzt mit dem neuen Passwort anmelden…</p>
          </div>
        ) : (
          <form onSubmit={submit}>
            <h2 style={{ margin:"0 0 4px", fontSize:19, fontWeight:700, letterSpacing:"-0.01em" }}>Neues Passwort setzen</h2>
            <p style={{ margin:"0 0 22px", fontSize:14, color:C.muted }}>Wähle ein neues Passwort für dein Konto.</p>
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              <PwField label="Neues Passwort" value={pw1} onChange={e=>setPw1(e.target.value)} placeholder="Mindestens 12 Zeichen" autoFocus autoComplete="new-password" />
              <PwField label="Passwort bestätigen" value={pw2} onChange={e=>setPw2(e.target.value)} placeholder="Wiederholen" autoComplete="new-password" />
              {submitErr && <p style={{ margin:0, fontSize:13, color:C.bad.text }}>{submitErr}</p>}
              <button type="submit" disabled={submitting} style={{ ...css.btn, padding:"12px 16px", fontSize:14.5, width:"100%", marginTop:4, opacity:submitting?0.65:1 }}>{submitting?"Wird gespeichert…":"Passwort setzen"}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
function HeaderProfileMenu({ user, isAdmin, onSignOut }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onClick = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(o => !o)} className="flex items-center gap-2 rounded-full pl-1 pr-2.5 py-1 hover:bg-white/10 transition-colors">
        <span className="w-7 h-7 rounded-full bg-white/90 text-slate-900 flex items-center justify-center text-xs font-bold shrink-0">
          {(user?.email || "?")[0].toUpperCase()}
        </span>
        <span className="text-sm text-white/90 hidden sm:inline max-w-[180px] truncate">{user?.email}</span>
        <ChevronDown size={14} className="text-white/70" />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-56 rounded-lg border border-slate-200 bg-white shadow-lg py-1 z-30 text-left">
          <div className="px-3 py-2 border-b border-slate-100">
            <div className="text-sm font-medium text-slate-900 truncate">{user?.email}</div>
            <div className="text-xs text-slate-500">{isAdmin ? "Administrator" : "Nutzer"}</div>
          </div>
          <button onClick={() => { setOpen(false); onSignOut(); }} className="w-full flex items-center gap-2 text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
            <LogOut size={15} /> Abmelden
          </button>
        </div>
      )}
    </div>
  );
}

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
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [myId, setMyId] = useState(null);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginView, setLoginView] = useState("login");
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetResult, setResetResult] = useState(null);
  const [codeEmail, setCodeEmail] = useState("");
  const [codeValue, setCodeValue] = useState("");
  const [codePw1, setCodePw1] = useState("");
  const [codePw2, setCodePw2] = useState("");
  const [codeError, setCodeError] = useState(null);
  const [codeLoading, setCodeLoading] = useState(false);
  const [codeDone, setCodeDone] = useState(false);
  const [inviteToken] = useState(() => new URLSearchParams(window.location.search).get("token"));
  // Synchron beim ersten Render prüfen, nicht erst im onAuthStateChange-Listener:
  // supabase-js verarbeitet den Recovery-Hash aus der URL bereits beim Erstellen
  // des Clients (Modul-Ebene, vor React) und feuert PASSWORD_RECOVERY oft, BEVOR
  // unser Listener im useEffect überhaupt angemeldet ist - das Event kam dadurch
  // nie an und man landete stattdessen auf der normalen Login-Seite.
  const [recoveryMode, setRecoveryMode] = useState(() => window.location.hash.includes("type=recovery"));
  // verifyOtp(type:"recovery") in der "Code eingeben"-Ansicht feuert INTERN
  // dasselbe PASSWORD_RECOVERY-Event wie der Link-Weg. Ohne diese Sperre
  // würde der globale Listener unten mitten im eigenen Code-Formular
  // plötzlich auf NewPasswordView umschalten - Passwort dann doppelt gefragt.
  const skipRecoveryEventRef = useRef(false);

  useEffect(() => {
    // Supabase-Recovery-Link im PKCE-Format (?code=...) - wird von supabase-js
    // anders als der Hash-basierte Legacy-Flow NICHT automatisch eingelöst.
    const code = new URLSearchParams(window.location.search).get("code");
    if (code) {
      supabase.auth.exchangeCodeForSession(window.location.href).then(({ error }) => {
        if (!error) setRecoveryMode(true);
      });
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) checkAdmin(session.user.email);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (_event === "PASSWORD_RECOVERY") { if (!skipRecoveryEventRef.current) setRecoveryMode(true); return; }
      setUser(session?.user ?? null);
      if (session?.user) checkAdmin(session.user.email);
      else { setIsAdmin(false); setIsSuperAdmin(false); }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    setSchulungenLoading(true);
    supabase.from("schulungen").select("*").order("created_at", { ascending: false }).then(({ data, error }) => {
      if (!error && data) setSchulungen(data.map(schulungFromDb));
      setSchulungenLoading(false);
    });
  }, [user]);

  // Admins laden die volle Tabelle (Name/E-Mail/Rolle, für die Mitarbeiter-Verwaltung).
  // Alle anderen laden nur die schlanke Public-View (id+profil) - das reicht für
  // effectiveEmpfaenger() und die Kennzahl "Mitarbeiter", ohne Kolleg:innen-Daten
  // preiszugeben (auf Datenbankebene abgesichert, nicht nur in der Oberfläche versteckt).
  const loadMitarbeiter = () => {
    const query = isAdmin
      ? supabase.from("mitarbeiter").select("*").order("name")
      : supabase.from("mitarbeiter_profile_public").select("*");
    query.then(({ data, error }) => {
      if (!error && data) setMa(data.map(m => ({ ...m, bestaetigt: m.bestaetigt || false })));
    });
  };
  useEffect(() => { if (user) loadMitarbeiter(); }, [user, isAdmin]);

  // Eigene mitarbeiter-Zeile ermitteln (jede:r darf laut RLS die eigene Zeile lesen,
  // unabhängig von der Rolle) - für die persönliche "Meine offenen Schulungen"-Ansicht.
  useEffect(() => {
    if (!user) { setMyId(null); return; }
    supabase.from("mitarbeiter").select("id").eq("email", user.email).single().then(({ data }) => setMyId(data?.id ?? null));
  }, [user]);

  async function checkAdmin(email) {
    const { data, error } = await supabase.from("mitarbeiter").select("rolle").eq("email", email).single();
    if (error || !data) {
      // Angemeldet bei Supabase Auth, aber kein Eintrag in der Mitarbeiter-Tabelle
      // (z.B. Selbstregistrierung falls Auth-Signup nicht deaktiviert ist, oder entfernter Mitarbeiter).
      setIsAdmin(false);
      setIsSuperAdmin(false);
      setLoginError("Dieses Konto ist nicht für die Schulungsplattform freigeschaltet. Bitte wende dich an das Admin-Team.");
      await supabase.auth.signOut();
      return;
    }
    setIsAdmin(data.rolle === "admin" || data.rolle === "super_admin");
    setIsSuperAdmin(data.rolle === "super_admin");
  }

  const showToast=(msg,type="success")=>{setToast({msg,type});setTimeout(()=>setToast(null),5000);};
  const saveSchul=async data=>{
    if(active&&modal==="edit"){
      const {error}=await supabase.from("schulungen").update(schulungToDb(data)).eq("id",active.id);
      if(error){showToast(`Fehler beim Speichern: ${error.message}`);return;}
      setSchulungen(s=>s.map(x=>x.id===active.id?{...active,...data}:x));
      showToast("Gespeichert.");
    }else{
      const payload={...data,empfaenger:data.empfaenger||[],nachweise:{}};
      const {data:inserted,error}=await supabase.from("schulungen").insert(schulungToDb(payload)).select().single();
      if(error){showToast(`Fehler beim Anlegen: ${error.message}`);return;}
      setSchulungen(s=>[schulungFromDb(inserted),...s]);
      showToast("Schulung angelegt.");
    }
    setModal(null);setActive(null);
  };
  const sendSchul=async(id,empf)=>{
    const {error}=await supabase.from("schulungen").update({empfaenger:empf}).eq("id",id);
    if(error){showToast(`Fehler: ${error.message}`);return;}
    setSchulungen(s=>s.map(x=>x.id===id?{...x,empfaenger:empf}:x));
    setModal(null);setActive(null);
    const hasC=empf.some(eid=>ma.find(m=>m.id===eid)?.team==="Caritas");
    showToast(`✓ An ${empf.length} Personen versendet.`);
    if(hasC)setTimeout(()=>showToast("⚠️ Caritas-Partnerteam einbezogen — bitte offizielle Weitergabe sicherstellen.","warn"),5500);
  };
  const saveNachweis=async(schulungId,nw)=>{
    const sc=schulungen.find(x=>x.id===schulungId);
    const maMatch=ma.find(m=>m.name.toLowerCase()===nw.name.toLowerCase());
    const key=maMatch?.id||nw.name;
    const newNachweise={...(sc.nachweise||{}),[key]:nw};
    const {error}=await supabase.from("schulungen").update({nachweise:newNachweise}).eq("id",schulungId);
    if(error){showToast(`Fehler: ${error.message}`);return;}
    setSchulungen(s=>s.map(x=>x.id===schulungId?{...x,nachweise:newNachweise}:x));
    showToast(`✓ Nachweis gespeichert. Code: ${nw.code}`);
  };
  const filtered=schulungen.filter(s=>{const mF=filter==="alle"||s.status===filter||(filter==="Pflicht"&&s.pflicht)||(filter==="Versendet"&&effectiveEmpfaenger(s,ma).length>0);const mS=!search||s.titel.toLowerCase().includes(search.toLowerCase())||s.dokNr?.toLowerCase().includes(search.toLowerCase());return mF&&mS;});
  const myOpen = myId ? schulungen.filter(s=>s.status==="Freigegeben"&&effectiveEmpfaenger(s,ma).includes(myId)&&!s.nachweise?.[myId]) : [];

  if (inviteToken && !user) return (
    <SetPasswordView token={inviteToken} onDone={() => { window.history.replaceState({}, "", window.location.pathname); window.location.reload(); }} />
  );

  if (recoveryMode) return (
    <NewPasswordView onDone={() => { window.history.replaceState({}, "", window.location.pathname); window.location.reload(); }} />
  );

  const twInputLg = `${twInput} py-3 px-4`;
  const twLabelLg = "block text-sm font-medium text-slate-700 mb-1.5";
  const twBtnPrimaryLg = `${twBtnPrimary} w-full py-3`;

  if (!user) return (
    <div className="min-h-screen flex font-sans">
      {/* Marken-Panel */}
      <div className="hidden md:flex md:w-[44%] flex-col justify-between p-12 lg:p-14 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white relative overflow-hidden">
        <PNRMLogo compact={false} white />
        <div className="relative z-10">
          <div className="text-xs font-semibold tracking-[0.2em] uppercase text-blue-200/60 mb-3.5">Schulungen &amp; Wissen</div>
          <h1 className="text-3xl font-semibold leading-relaxed tracking-tight max-w-sm">Wissen, das in der Versorgung ankommt.</h1>
          <p className="mt-3.5 text-sm leading-relaxed text-slate-300 max-w-sm">Die interne Schulungsplattform der Palliativ Netzwerk Rhein-Maas — Pflichtschulungen, Nachweise und Wissensdatenbank an einem Ort.</p>
        </div>
        <div className="text-xs text-slate-400 relative z-10">© Palliativ Netzwerk Rhein-Maas GmbH &amp; Co. KG</div>
      </div>

      {/* Formular-Panel */}
      <div className="flex-1 flex items-center justify-center bg-slate-50 px-6 py-10">
        <div className="w-full max-w-sm">
          <div className="md:hidden mb-8 text-center">
            <img src="/logo.png" alt="PNRM" className="h-12 mx-auto" />
          </div>
          {loginView==="reset" ? (
            <div>
              <h2 className="text-xl font-semibold text-slate-900 mb-1">Passwort zurücksetzen</h2>
              <p className="text-sm text-slate-600 mb-5 leading-relaxed">Gib deine E-Mail-Adresse ein. Du erhältst einen Code, um ein neues Passwort zu setzen.</p>
              {resetResult
                ? <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg px-4 py-3 text-sm">{resetResult}</div>
                : <div className="flex flex-col gap-3">
                    <input type="email" value={resetEmail} onChange={e=>setResetEmail(e.target.value)} placeholder="E-Mail" className={twInputLg} />
                    <button onClick={async()=>{ setResetLoading(true); const {error}=await supabase.auth.resetPasswordForEmail(resetEmail,{redirectTo:"https://pnrm-schulungen.vercel.app"}); if(error){alert(error.message?.includes("rate limit")?"Gerade zu viele Anfragen – bitte in ein paar Minuten erneut versuchen oder einen Admin um einen Passwort-Code bitten.":error.message);}else{setResetResult("Code wurde an deine Email gesendet.");} setResetLoading(false); }} disabled={resetLoading||!resetEmail} className={twBtnPrimaryLg}>{resetLoading?"Wird gesendet…":"Code senden"}</button>
                  </div>
              }
              <div className="flex justify-between mt-4">
                <button type="button" onClick={()=>{setLoginView("login");setResetResult(null);}} className={twLink}>← Zurück zur Anmeldung</button>
                <button type="button" onClick={()=>{setLoginView("code");setCodeEmail(resetEmail);}} className={twLink}>Ich habe bereits einen Code</button>
              </div>
            </div>
          ) : loginView==="code" ? (
            <div>
              <h2 className="text-xl font-semibold text-slate-900 mb-1">Code eingeben</h2>
              {codeDone ? (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg px-4 py-3 text-sm">Passwort geändert! Du kannst dich jetzt anmelden.</div>
              ) : (
                <>
                  <p className="text-sm text-slate-600 mb-5 leading-relaxed">Gib den Code aus der E-Mail (oder von deinem Admin) sowie dein neues Passwort ein.</p>
                  <form onSubmit={async e=>{
                    e.preventDefault(); setCodeError(null);
                    if (codePw1.length < 12) { setCodeError("Das Passwort muss mindestens 12 Zeichen lang sein."); return; }
                    if (codePw1 !== codePw2) { setCodeError("Die Passwörter stimmen nicht überein."); return; }
                    setCodeLoading(true);
                    skipRecoveryEventRef.current = true;
                    const { error: verifyErr } = await supabase.auth.verifyOtp({ email: codeEmail, token: codeValue.trim(), type: "recovery" });
                    if (verifyErr) { setCodeError(verifyErr.message); setCodeLoading(false); return; }
                    const { error: updateErr } = await supabase.auth.updateUser({ password: codePw1 });
                    if (updateErr) { setCodeError(updateErr.message); setCodeLoading(false); return; }
                    await supabase.auth.signOut();
                    setCodeDone(true);
                    setCodeLoading(false);
                  }} className="flex flex-col gap-3">
                    <div><label className={twLabelLg}>E-Mail</label><input type="email" value={codeEmail} onChange={e=>setCodeEmail(e.target.value)} placeholder="vorname.nachname@pallinetz.de" required className={twInputLg} /></div>
                    <div><label className={twLabelLg}>Code</label><input value={codeValue} onChange={e=>setCodeValue(e.target.value)} placeholder="z.B. 06473942" required className={twInputLg} /></div>
                    <PwField label="Neues Passwort" value={codePw1} onChange={e=>setCodePw1(e.target.value)} placeholder="Mindestens 12 Zeichen" autoComplete="new-password" labelClassName={twLabelLg} inputClassName={`${twInputLg} pr-11`} />
                    <PwField label="Passwort bestätigen" value={codePw2} onChange={e=>setCodePw2(e.target.value)} placeholder="Wiederholen" autoComplete="new-password" labelClassName={twLabelLg} inputClassName={`${twInputLg} pr-11`} />
                    {codeError && <p className="text-sm text-red-600 m-0">{codeError}</p>}
                    <button type="submit" disabled={codeLoading} className={`${twBtnPrimaryLg} mt-1`}>{codeLoading?"Wird gespeichert…":"Passwort setzen"}</button>
                  </form>
                </>
              )}
              <button type="button" onClick={()=>{setLoginView("login");setCodeDone(false);setCodeError(null);}} className={`${twLink} mt-4`}>← Zurück zur Anmeldung</button>
            </div>
          ) : (
            <div>
              <h2 className="text-xl font-semibold text-slate-900 mb-1">Anmeldung</h2>
              <p className="text-sm text-slate-600 mb-6">Mit deinem PNRM-Konto fortfahren</p>
              <form onSubmit={async e=>{ e.preventDefault(); setLoginLoading(true); setLoginError(null); const {error}=await supabase.auth.signInWithPassword({email:loginEmail,password:loginPassword}); if(error){setLoginError(error.message);} setLoginLoading(false); }} className="flex flex-col gap-3">
                <div><label className={twLabelLg}>E-Mail</label><input type="email" value={loginEmail} onChange={e=>setLoginEmail(e.target.value)} placeholder="vorname.nachname@pallinetz.de" required autoComplete="email" className={twInputLg} /></div>
                <PwField label="Passwort" value={loginPassword} onChange={e=>setLoginPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" labelClassName={twLabelLg} inputClassName={`${twInputLg} pr-11`} />
                {loginError&&<p className="text-sm text-red-600 m-0">{loginError}</p>}
                <button type="submit" disabled={loginLoading} className={`${twBtnPrimaryLg} mt-1`}>{loginLoading?"Anmelden…":"Anmelden"}</button>
                <button type="button" onClick={()=>{setLoginView("reset");setResetEmail(loginEmail);}} className={`${twLink} text-center`}>Passwort vergessen?</button>
              </form>
            </div>
          )}
          <p className="text-center text-xs text-slate-500 mt-6">Zugang nur auf Einladung · Fragen an das Admin-Team</p>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:FONT, color:C.text, fontSize:15 }}>
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-black/10" style={{ background:`linear-gradient(90deg, ${C.navyDark} 0%, ${C.navy} 100%)` }}>
        <div className="max-w-[1400px] mx-auto min-h-14 px-3 sm:px-6 py-2 sm:py-0 flex flex-wrap items-center justify-between gap-3">
          <div style={{ display:"flex", alignItems:"center", gap:14 }}>
            <PNRMLogo compact white />
            <div className="hidden sm:block" style={{ width:1, height:22, background:"rgba(255,255,255,.22)" }} />
            <span className="hidden sm:inline" style={{ color:C.white, fontSize:13.5, fontWeight:600, letterSpacing:"0.02em", opacity:0.92 }}>Schulungen &amp; Wissen</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {isAdmin && <button className="hdrbtn" onClick={()=>exportExcel(schulungen,ma)} style={{ appearance:"none", background:"transparent", color:C.white, border:"1px solid rgba(255,255,255,.3)", borderRadius:8, padding:"6px 12px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:FONT }}>Excel-Export</button>}
            {isAdmin&&<button className="hdrbtn-solid" onClick={()=>{setActive(null);setModal("neu");setTab("schulungen");}} style={{ appearance:"none", background:C.white, color:C.navy, border:0, borderRadius:8, padding:"6px 14px", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:FONT, boxShadow:"0 1px 4px rgba(0,0,0,.15)" }}>+ Neue Schulung</button>}
            {user && <HeaderProfileMenu user={user} isAdmin={isAdmin} onSignOut={()=>supabase.auth.signOut()} />}
          </div>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto px-6 py-6">
        {/* Stats */}
        <div className={`grid grid-cols-2 ${isAdmin ? "sm:grid-cols-5" : "sm:grid-cols-4"} gap-3 mb-6`}>
          {[
            ["Schulungen", schulungen.length, GraduationCap, "bg-blue-50", "text-blue-600"],
            ["Freigegeben", schulungen.filter(s=>s.status==="Freigegeben").length, CheckCircle2, "bg-emerald-50", "text-emerald-600"],
            ["Versendet", schulungen.filter(s=>effectiveEmpfaenger(s,ma).length>0).length, Send, "bg-indigo-50", "text-indigo-600"],
            ["Nachweise", schulungen.reduce((a,s)=>a+Object.keys(s.nachweise||{}).length,0), FileCheck2, "bg-teal-50", "text-teal-600"],
            ...(isAdmin ? [["Mitarbeiter", ma.length, Users, "bg-amber-50", "text-amber-600"]] : []),
          ].map(([label, value, Icon, iconBg, iconColor]) => (
            <div key={label} className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${iconBg} ${iconColor}`}><Icon size={17} /></div>
              <div className="min-w-0">
                <div className="text-2xl font-bold text-slate-900 leading-none tabular-nums">{value}</div>
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-1 truncate">{label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display:"flex", gap:4, borderBottom:`1px solid ${C.border}`, marginBottom:20, overflowX:"auto", WebkitOverflowScrolling:"touch" }}>
          {[["schulungen","Schulungen"],["wissen","Wissen"],...(isAdmin?[["mitarbeiter","Mitarbeiter"]]:[]),...(isAdmin?[["fortschritt","Fortschritt"]]:[]),...(isAdmin?[["protokoll","Protokoll"]]:[])]  .map(([id,label])=>(
            <button key={id} onClick={()=>setTab(id)} className="ptab" style={{ background: tab===id ? C.blueDim : "none", color:tab===id?C.navy:C.muted, padding:"10px 18px", cursor:"pointer", fontSize:14, fontWeight:tab===id?700:500, border:"none", borderBottom: tab===id ? `2px solid ${C.navy}` : "2px solid transparent", marginBottom:-1, borderRadius:"8px 8px 0 0", fontFamily:FONT, transition:"color .15s, background .15s", whiteSpace:"nowrap", flexShrink:0 }}>{label}</button>
          ))}
        </div>

        {tab==="schulungen"&&<>
          {myOpen.length>0&&<div style={{ ...css.section, borderColor:C.warn.border, background:C.warn.bg, padding:16, marginTop:0 }}>
            <h3 style={{ margin:"0 0 10px", fontSize:14, color:C.warn.text, textTransform:"uppercase", letterSpacing:".5px" }}>⏳ Meine offenen Schulungen ({myOpen.length})</h3>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {myOpen.map(sc=>{
                const fs=fristStatus(sc.frist);
                return <div key={sc.id} onClick={()=>{setActive(sc);setModal("player");}} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:10, background:C.white, border:`1px solid ${C.border}`, borderRadius:8, padding:"10px 14px", cursor:"pointer" }}>
                  <div><strong style={{ fontSize:14 }}>{sc.titel}</strong>{sc.pflicht&&<span style={{ marginLeft:8, fontSize:11, color:C.warn.text, fontWeight:700 }}>Pflicht</span>}</div>
                  {fs==="over"&&<span style={{ ...css.badge, background:C.bad.bg, color:C.bad.text }}>Überfällig · Frist {sc.frist}</span>}
                  {fs==="soon"&&<span style={{ ...css.badge, background:C.warn.bg, color:C.warn.text }}>Bald fällig · Frist {sc.frist}</span>}
                </div>;
              })}
            </div>
          </div>}
          <div style={{ display:"flex", gap:6, marginBottom:14, flexWrap:"wrap", alignItems:"center" }}>
            {["alle","Freigegeben","Entwurf","Pflicht","Versendet"].map(f=>(
              <button key={f} onClick={()=>setFilter(f)} style={{ background:filter===f?C.navy:"transparent", color:filter===f?C.white:C.muted, border:`1px solid ${filter===f?C.navy:C.border}`, padding:"5px 13px", borderRadius:999, cursor:"pointer", fontSize:13, fontWeight:filter===f?600:400, fontFamily:FONT }}>{f}</button>
            ))}
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Titel oder Dok.-Nr. suchen…" style={{ ...css.inp, flex:1, minWidth:160, padding:"7px 12px", fontSize:13 }} />
          </div>
          {schulungenLoading&&Array.from({length:4}).map((_,i)=><SchulungSkeletonCard key={i} />)}
          {!schulungenLoading&&filtered.length===0&&<EmptyState icon={search||filter!=="alle"?SearchX:GraduationCap} text={search||filter!=="alle"?"Keine Schulungen gefunden.":"Noch keine Schulungen angelegt."} />}
          {filtered.map(sc=>{
            const nwCount=Object.keys(sc.nachweise||{}).length; const sent=effectiveEmpfaenger(sc,ma).length;
            const fs=fristStatus(sc.frist);
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
                    {fs==="over"&&<span style={{ ...css.badge, background:C.bad.bg, color:C.bad.text }}>Überfällig · Frist {sc.frist}</span>}
                    {fs==="soon"&&<span style={{ ...css.badge, background:C.warn.bg, color:C.warn.text }}>Bald fällig · Frist {sc.frist}</span>}
                  </div>
                  <h3 style={{ margin:"0 0 4px", fontSize:17, fontWeight:600, color:C.text }}>{sc.titel}</h3>
                  <p style={{ margin:0, fontSize:13, color:C.muted }}>{sc.dokNr} · v{sc.version} · {sc.gueltigAb}{sent>0?` · ${sent} Empf. · ${nwCount}/${sent} Nachweise`:""}</p>
                </div>
                <div style={{ display:"flex", gap:7, flexWrap:"wrap", justifyContent:"flex-end" }} onClick={e=>e.stopPropagation()}>
                  {isAdmin&&<button onClick={()=>{setActive(sc);setModal("edit");}} style={{ ...css.btnSec, padding:"6px 12px", fontSize:13 }}>Bearbeiten</button>}
                  {isAdmin&&sent>0&&<button onClick={()=>{setActive(sc);setModal("nw");}} style={{ ...css.btnSec, padding:"6px 12px", fontSize:13 }}>Nachweise</button>}
                  {isAdmin&&sent>0&&nwCount<sent&&<button onClick={()=>{setActive(sc);setModal("reminder");}} style={{ ...css.btnSec, padding:"6px 12px", fontSize:13 }}>🔔 Erinnerung</button>}
                  {isAdmin&&sc.status==="Freigegeben"&&<button onClick={()=>{setActive(sc);setModal("send");}} style={{ ...css.btn, padding:"6px 12px", fontSize:13 }}>✉ Senden</button>}
                </div>
              </div>
            </div>;
          })}
        </>}
        {tab==="wissen"&&<WissenView isAdmin={isAdmin} showToast={showToast} />}
        {tab==="mitarbeiter"&&isAdmin&&<MitarbeiterView ma={ma} setMa={setMa} showToast={showToast} isAdmin={isAdmin} isSuperAdmin={isSuperAdmin} user={user} onRefresh={loadMitarbeiter} />}
        {tab==="fortschritt"&&<FortschrittView schulungen={schulungen} ma={ma} />}
        {tab==="protokoll"&&isAdmin&&<ProtokollView />}

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
      {modal==="reminder"&&active&&<Modal onClose={()=>setModal(null)}><ReminderModal sc={active} ma={ma} onClose={()=>setModal(null)} /></Modal>}

      {toast&&<div style={{ position:"fixed",bottom:22,right:22,display:"flex",alignItems:"flex-start",gap:10,background:C.white,borderLeft:`4px solid ${toast.type==="warn"?"#E8A317":"#2E9E5B"}`,border:`1px solid ${C.border}`,color:C.text,padding:"13px 18px",borderRadius:12,fontSize:14,fontWeight:500,boxShadow:"0 4px 12px rgba(22,35,58,.08), 0 16px 48px rgba(22,35,58,.16)",zIndex:200,maxWidth:400,animation:"fadeIn .3s" }}><span style={{ fontSize:16, lineHeight:1.3 }}>{toast.type==="warn"?"⚠️":"✓"}</span><span style={{ lineHeight:1.45 }}>{toast.msg}</span></div>}
      <style>{`
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes skelShimmer{0%{background-position:100% 50%}100%{background-position:0 50%}}
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
        .fortschritt-row:hover{box-shadow:0 2px 4px rgba(22,35,58,.05), 0 8px 20px rgba(46,75,110,.08);border-color:#3A7CA5}
        input:focus,textarea:focus,select:focus{border-color:#3A7CA5;outline:none;box-shadow:0 0 0 3px rgba(58,124,165,.13)}
        ::-webkit-scrollbar{width:10px;height:10px}
        ::-webkit-scrollbar-thumb{background:#C5D0DE;border-radius:99px;border:2px solid #F0F4F8}
        ::-webkit-scrollbar-thumb:hover{background:#A8B8CC}
        ::-webkit-scrollbar-track{background:transparent}
        @media (prefers-reduced-motion: reduce){
          *,*::before,*::after{animation-duration:.01ms!important;transition-duration:.01ms!important}
        }
      `}</style>
    </div>
  );
}
