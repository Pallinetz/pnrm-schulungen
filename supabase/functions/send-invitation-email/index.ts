import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// Nur diese Origins dürfen die Function per Browser-fetch aufrufen (statt "*").
const ALLOWED_ORIGINS = [
  "https://pnrm-schulungen.vercel.app",
  "http://localhost:5173",
  "http://localhost:3000",
]

function buildCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") ?? ""
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
  }
}

// ponytail: 12 Zeichen ohne verwechselbare Buchstaben/Ziffern (~69 Bit) – Einmalpasswort, muss sofort geändert werden.
const PW_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"
function generatePassword(length = 12) {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, b => PW_CHARS[b % PW_CHARS.length]).join("")
}

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req)
  const ok  = (data: unknown) => new Response(JSON.stringify(data),           { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } })
  const err = (msg: string)   => new Response(JSON.stringify({ error: msg }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } })

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const { email, name, rolle, team, berufsrolle } = await req.json()
    if (!email) return err("E-Mail fehlt")

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    // Auth-Token prüfen
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) return err("Nicht autorisiert – kein Token")

    const token = authHeader.replace("Bearer ", "")
    const { data: { user: requestingUser }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !requestingUser) return err("Ungültiger Token: " + (authError?.message ?? ""))

    // Admin-Check
    const { data: maDaten, error: maError } = await supabaseAdmin
      .from("mitarbeiter").select("rolle").eq("email", requestingUser.email).single()
    if (maError) return err("Admin-Check fehlgeschlagen: " + maError.message)
    if (maDaten?.rolle !== "admin") return err(`Nur Admins können einladen (Rolle: ${maDaten?.rolle ?? "kein Eintrag"})`)

    // Einmalpasswort setzen: neuen Auth-User anlegen oder bestehenden aktualisieren
    const password = generatePassword()
    // ponytail: perPage:1000 deckt das gesamte PNRM-Team ab; bei >1000 Auth-Nutzern bräuchte es Paginierung.
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
    if (listError) return err("Nutzer-Suche fehlgeschlagen: " + listError.message)
    const existingAuthUser = users.find(u => u.email?.toLowerCase() === email.toLowerCase())

    if (existingAuthUser) {
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(existingAuthUser.id, {
        password,
        email_confirm: true,
        user_metadata: { ...existingAuthUser.user_metadata, must_change_password: true },
      })
      if (updateError) return err("Passwort-Update fehlgeschlagen: " + updateError.message)
    } else {
      const { error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { must_change_password: true },
      })
      if (createError) return err("Nutzer-Erstellung fehlgeschlagen: " + createError.message)
    }

    // Mitarbeiter-Eintrag anlegen / aktualisieren
    const record: Record<string, string> = { email, name: name || email, rolle: rolle || "user" }
    if (team) record.team = team
    if (berufsrolle) record.berufsrolle = berufsrolle

    const { data: existing } = await supabaseAdmin.from("mitarbeiter").select("id").eq("email", email).single()
    if (!existing) {
      const { error: insertError } = await supabaseAdmin.from("mitarbeiter").insert(record)
      if (insertError) console.error("Insert-Warnung:", insertError.message)
    } else {
      await supabaseAdmin.from("mitarbeiter").update(record).eq("email", email)
    }

    return ok({ success: true, password })

  } catch (e) {
    return err("Unbekannter Fehler: " + e.message)
  }
})
