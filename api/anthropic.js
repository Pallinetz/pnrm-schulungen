const MAX_INPUT_LENGTH = 8000;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { system, user } = req.body ?? {};

  if (typeof system !== "string" || typeof user !== "string") {
    return res.status(400).json({ error: "Fehlende Felder: system und user erwartet." });
  }

  if (system.length > MAX_INPUT_LENGTH || user.length > MAX_INPUT_LENGTH) {
    return res.status(400).json({ error: "Eingabe zu lang." });
  }

  const key = process.env.ANTHROPIC_KEY;
  if (!key) {
    return res.status(500).json({ error: "ANTHROPIC_KEY nicht konfiguriert." });
  }

  const upstream = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });

  if (!upstream.ok) {
    const text = await upstream.text();
    return res.status(upstream.status).json({ error: text });
  }

  const data = await upstream.json();
  return res.status(200).json(data);
}
