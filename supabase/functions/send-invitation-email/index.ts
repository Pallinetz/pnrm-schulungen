import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const body = await req.json()
    const { action } = body

    // ── Öffentliche Aktionen: kein Admin-Login nötig (Einladung wird erst eingelöst) ──

    if (action === 'validate_invite') {
      const { token } = body
      const { data, error } = await admin.from('invite_tokens').select('*').eq('token', token).single()
      if (error || !data) throw new Error('Diese Einladung wurde nicht gefunden.')
      if (data.used) throw new Error('Diese Einladung wurde bereits verwendet. Bitte melde dich mit deinem Passwort an oder nutze "Passwort vergessen".')
      if (new Date(data.expires_at) < new Date()) throw new Error('Diese Einladung ist abgelaufen. Bitte bitte deinen Admin um eine neue Einladung.')
      return new Response(JSON.stringify({ name: data.name, email: data.email, app: data.app }), { headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    if (action === 'redeem_invite') {
      const { token, password } = body
      if (!password || password.length < 12) throw new Error('Das Passwort muss mindestens 12 Zeichen lang sein.')

      const { data: invite, error: invErr } = await admin.from('invite_tokens').select('*').eq('token', token).single()
      if (invErr || !invite) throw new Error('Diese Einladung wurde nicht gefunden.')
      if (invite.used) throw new Error('Diese Einladung wurde bereits verwendet.')
      if (new Date(invite.expires_at) < new Date()) throw new Error('Diese Einladung ist abgelaufen.')

      const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000 })
      let authUser = users?.find(u => u.email === invite.email)

      if (authUser) {
        const { error: updErr } = await admin.auth.admin.updateUserById(authUser.id, { password, email_confirm: true })
        if (updErr) throw new Error(updErr.message)
      } else {
        const { data: created, error: createErr } = await admin.auth.admin.createUser({
          email: invite.email, password, email_confirm: true,
        })
        if (createErr) throw new Error(createErr.message)
        authUser = created.user
      }

      await admin.from('invite_tokens').update({ used: true, used_at: new Date().toISOString() }).eq('token', token)

      return new Response(JSON.stringify({ success: true, email: invite.email }), { headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    // ── Ab hier: Admin-Aktionen, Login erforderlich ──────────────────────────

    const authToken = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
    const { data: { user }, error: authErr } = await admin.auth.getUser(authToken)
    if (authErr || !user) throw new Error('Nicht angemeldet')

    const { data: caller } = await admin.from('mitarbeiter').select('rolle').eq('email', user.email).single()
    if (caller?.rolle !== 'admin') throw new Error('Nur Admins koennen Einladungen erstellen')

    const { email, name, rolle } = body

    const makeLink = async (app: string, baseUrl: string) => {
      const inviteToken = crypto.randomUUID()
      const { error: insertErr } = await admin.from('invite_tokens').insert({
        token: inviteToken,
        email, name, rolle, app,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
      if (insertErr) throw new Error(insertErr.message)

      const id = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '') + '-' + Date.now().toString(36)
      const { error: dbErr } = await admin.from('mitarbeiter').upsert(
        { id, email, name, rolle },
        { onConflict: 'email' }
      )
      if (dbErr) throw new Error(dbErr.message)

      return `${baseUrl}/invite?token=${inviteToken}`
    }

    if (action === 'create_link_raumplanung') {
      const url = await makeLink('raumplanung', 'https://pnrm-raumplanung.vercel.app')
      return new Response(JSON.stringify({ url }), { headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    if (action === 'create_link_schulungen') {
      const url = await makeLink('schulungen', 'https://pnrm-schulungen.vercel.app')
      return new Response(JSON.stringify({ url }), { headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    throw new Error('Unbekannte Aktion')

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }
})
