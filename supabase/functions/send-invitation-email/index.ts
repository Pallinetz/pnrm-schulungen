import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const ok  = (data: unknown) => new Response(JSON.stringify(data),           { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } })
const err = (msg: string)   => new Response(JSON.stringify({ error: msg }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } })

// ponytail: 10 Hex-Zeichen (~40 Bit) reichen für ein Einmalpasswort, das sofort geändert werden muss.
function generatePassword() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 10)
}

serve(async (req) => {
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
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers()
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
