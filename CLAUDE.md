# CLAUDE.md – PNRM Schulungs-App

## Projektübersicht

Interne Schulungsverwaltung der Palliativ Netzwerk Rhein-Maas GmbH & Co. KG (SAPV).

| Schicht | Technologie |
|---|---|
| Frontend | React 19 + Vite, Inline-Styles (kein CSS-Framework) |
| Datenhaltung | Aktuell: `useState` mit Seed-Daten in `App.jsx` — geplant: Supabase |
| KI | Anthropic Claude API (direkter Browser-Aufruf, `callAI`-Funktion) |
| Export | `xlsx`-Bibliothek |

Schlüsseldateien:
- `src/App.jsx` — gesamte App (Komponenten, Seed-Daten, Styles, KI-Aufruf)
- Schulungsdaten: `SEED_SCHULUNGEN` (Zeile 24) und `SEED_MA` (Zeile 15) in `App.jsx`
- Sobald Supabase hinzukommt: `src/lib/supabase.js` oder `src/supabase/`

---

## Arbeitsweise

### Parallele Sub-Agenten bei unabhängigen Aufgaben

Wenn eine Aufgabe mehrere der folgenden Bereiche unabhängig voneinander betrifft, **parallel spawnen** (nicht nacheinander):

| Agent-Label | Zuständigkeit |
|---|---|
| `frontend` | React-Komponenten, Styling, UI-Logik in `src/` |
| `supabase` | Schema, Migrations, RLS-Policies, `src/lib/supabase.js` |
| `schulungsdaten` | JSON-Struktur der Schulungen (Fragen, Module, Checklisten) — aktuell in `SEED_SCHULUNGEN`, künftig separate Dateien |

Beispiel: "Neue Kategorie `Notfall` hinzufügen und in Supabase absichern" → `frontend`-Agent ändert die UI, `supabase`-Agent schreibt die Migration, `schulungsdaten`-Agent ergänzt das JSON-Schema. Alle drei parallel.

Wann **nicht** parallel: wenn Agent B das Ergebnis von Agent A braucht (z.B. erst Schema ändern, dann Komponente anpassen).

### Entscheidungsautonomie

Entscheidungen ohne Rückfrage treffen, wenn:
- Bestehende Muster im Code klar erkennbar sind (Stilkonventionen, Komponentenstruktur)
- Standard-Vite/React-Konventionen greifen
- Die Änderung reversibel ist

**Nur fragen** bei echten Weggabelungen: alternative Datenbankschemas, Breaking Changes an der Schulungsdaten-Struktur, neue externe Abhängigkeiten, oder wenn eine Entscheidung Auswirkungen auf das Caritas-Partnerteam hat.

---

## Obsidian-Dokumentation

Nach jeder abgeschlossenen Arbeitseinheit (Feature, Fix, Refaktor) den Arbeitsstand in Obsidian dokumentieren:

- **Vault**: aktiven Vault über `mcp__obsidian__list-available-vaults` ermitteln
- **Pfad**: `Sessions/PNRM-Schulungen/JJJJ-MM-TT_<kurztitel>.md`
- **Inhalt** (kompakt):
  - Was wurde geändert und warum
  - Welche Dateien betroffen
  - Offene Punkte / nächste Schritte
  - Ggf. Hinweis auf Caritas-Partnerteam, falls relevant

Dokumentation **nicht** erstellen bei: reinen Nachfragen, kurzen Erklärungen ohne Code-Änderung.

---

## Fachliche Regeln (PNRM-spezifisch)

- **Caritas-Partnerteam**: Alle freigegebenen Schulungen und Prozessänderungen müssen auch dort wirksam werden — bei jeder Änderung an Schulungsstatus "Freigegeben" oder an Pflichtschulungen explizit darauf hinweisen.
- **Datenschutz**: Keine echten Patientendaten in Seed-Daten, Testdaten oder Beispiel-Screenshots. Checklisten-Pflichtpunkt "Keine Patientendaten eingetragen" bleibt immer erhalten.
- **DIN EN 15224**: QM-relevante Schulungen benötigen Dok.-Nr., Version, Status, Freigabe, Geltungsbereich und Bezugsdokumente.
- **KI-Aufruf**: `callAI` kommuniziert direkt mit der Anthropic API aus dem Browser. API-Key darf nicht im Quellcode committet werden — Umgebungsvariable `VITE_ANTHROPIC_KEY` verwenden.

---

## Entwicklungsumgebung

```powershell
cd pnrm-schulungen
vercel dev       # Lokaler Dev-Server MIT Serverless Functions (http://localhost:3000) — bevorzugt
npm run build    # Produktions-Build
npm run lint     # ESLint
```

`vercel dev` ist nötig, damit `/api/anthropic` lokal erreichbar ist. Einmalig Vercel CLI installieren:
```powershell
npm install -g vercel
vercel login
vercel link      # Projekt mit Vercel-Deployment verknüpfen
```

`npm run dev` (Vite ohne Vercel) funktioniert weiterhin für rein UI-seitige Arbeit ohne KI-Funktionen.

## API-Key-Setup

- **Lokal**: `ANTHROPIC_KEY` in `.env` eintragen (wird nie committet)
- **Produktion**: In Vercel Dashboard unter **Settings → Environment Variables** → `ANTHROPIC_KEY` anlegen
- Der Key steht ausschließlich in der Serverless Function (`api/anthropic.js`) — nie im Browser-Bundle

## Deployment-Checkliste (Supabase)

Änderungen an `supabase/functions/` oder `supabase/migrations/` werden durch `git push`
**nicht** automatisch live — Vercel deployt nur das Frontend. Nach jedem Merge, der eine
dieser beiden Stellen betrifft, zusätzlich:

```powershell
npx supabase login      # einmalig, öffnet Browser-Login
npx supabase link       # einmalig, Projekt verknüpfen
npm run deploy:functions   # Edge Function send-invitation-email deployen
npm run db:push             # neue RLS-Policies/Migrationen anwenden
```

Ohne diesen Schritt läuft im Live-Betrieb weiterhin die alte Function-Version bzw.
fehlen neue RLS-Policies — das war bereits einmal die Ursache dafür, dass sich niemand
anmelden konnte (Function hieß im Code anders als deployt).
