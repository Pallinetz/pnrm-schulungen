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
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const token = authHeader.replace("Bearer ", "")
    const { data: { user: requestingUser }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !requestingUser) {
      return new Response(JSON.stringify({ error: "Ungültiger Token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Admin-Check
    const { data: mitarbeiter } = await supabaseAdmin
      .from("mitarbeiter")
      .select("rolle")
      .eq("email", requestingUser.email)
      .single()

    if (mitarbeiter?.rolle !== "admin") {
      return new Response(JSON.stringify({ error: `Nur Admins können einladen (aktuell: ${mitarbeiter?.rolle ?? "kein Eintrag"})` }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Einladungslink generieren (kein automatischer E-Mail-Versand durch Supabase)
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "invite",
      email,
      options: { redirectTo: "https://pnrm-schulungen.vercel.app" },
    })

    if (linkError) {
      return new Response(JSON.stringify({ error: linkError.message }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const inviteUrl = linkData.properties?.action_link

    // E-Mail via Resend API senden
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "PNRM Schulungen <onboarding@resend.dev>",
        to: email,
        subject: "Einladung zur PNRM Schulungsplattform",
        html: `
          <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1A2638">
            <div style="background:#2E4B6E;padding:24px 32px;border-radius:8px 8px 0 0">
              <h1 style="color:#fff;margin:0;font-size:20px">Palliativ Netzwerk Rhein-Maas</h1>
              <p style="color:#A8C4DC;margin:4px 0 0;font-size:13px">Schulungsverwaltung</p>
            </div>
            <div style="background:#F0F4F8;padding:32px;border-radius:0 0 8px 8px;border:1px solid #D1DCE8;border-top:none">
              <p style="margin:0 0 16px">Hallo ${name || email},</p>
              <p style="margin:0 0 16px">Sie wurden zur internen Schulungsplattform der PNRM eingeladen.</p>
              <p style="margin:0 0 24px">Klicken Sie auf den Button, um Ihr Konto zu aktivieren und Zugang zu erhalten:</p>
              <a href="${inviteUrl}" style="display:inline-block;background:#2E4B6E;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px">Einladung annehmen</a>
              <p style="margin:24px 0 0;font-size:12px;color:#5A6E85">Dieser Link ist 24 Stunden gültig. Falls Sie diese Einladung nicht erwartet haben, können Sie diese E-Mail ignorieren.</p>
            </div>
          </div>
        `,
      }),
    })

    if (!resendRes.ok) {
      const resendErr = await resendRes.json()
      return new Response(JSON.stringify({ error: `E-Mail-Fehler: ${resendErr.message}` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Mitarbeiter-Eintrag anlegen / aktualisieren
    const record: Record<string, string> = {
      email,
      name: name || email,
      rolle: rolle || "user",
    }
    if (team) record.team = team
    if (berufsrolle) record.berufsrolle = berufsrolle

    const { data: existing } = await supabaseAdmin
      .from("mitarbeiter").select("id").eq("email", email).single()

    if (!existing) {
      const { error: insertError } = await supabaseAdmin.from("mitarbeiter").insert(record)
      if (insertError) console.error("Insert-Warnung:", insertError.message)
    } else {
      await supabaseAdmin.from("mitarbeiter").update(record).eq("email", email)
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
