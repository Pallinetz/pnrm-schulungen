import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const { email, name, rolle, team, berufsrolle } = await req.json()

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    // Anfragenden User prüfen
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Nicht autorisiert" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const token = authHeader.replace("Bearer ", "")
    const { data: { user: requestingUser }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !requestingUser) {
      return new Response(JSON.stringify({ error: "Ungültiger Token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Admin-Check
    const { data: mitarbeiter } = await supabaseAdmin
      .from("mitarbeiter")
      .select("rolle")
      .eq("email", requestingUser.email)
      .single()

    if (mitarbeiter?.rolle !== "admin") {
      return new Response(JSON.stringify({ error: "Nur Admins können einladen" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // User einladen
    const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo: "https://pnrm-schulungen.vercel.app",
    })

    if (inviteError) {
      return new Response(JSON.stringify({ error: inviteError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Mitarbeiter-Eintrag anlegen falls nicht vorhanden
    const { data: existing } = await supabaseAdmin
      .from("mitarbeiter")
      .select("id")
      .eq("email", email)
      .single()

    if (!existing) {
      await supabaseAdmin.from("mitarbeiter").insert({
        email,
        name: name || email,
        rolle: rolle || "user",
        team: team || "PNRM",
        berufsrolle: berufsrolle || "Pflegefachkraft",
      })
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
