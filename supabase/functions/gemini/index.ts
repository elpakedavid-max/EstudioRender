// Función de Supabase (Deno) que reenvía las peticiones a la API de Gemini.
// La clave queda en el servidor (secreto GEMINI_API_KEY) y no en el iPad.
// Despliegue:
//   supabase secrets set GEMINI_API_KEY=AIza...
//   supabase functions deploy gemini
// En la app: Ajustes → URL función = https://<proyecto>.supabase.co/functions/v1/gemini y la clave anon.

const ALLOWED_MODELS = (Deno.env.get('ALLOWED_MODELS') ?? 'gemini-3-pro-image,gemini-3-pro-image-preview,gemini-3.1-flash-image,gemini-3-flash-preview,gemini-2.5-flash-image')
  .split(',').map((s) => s.trim());

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors });
  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) return Response.json({ error: { message: 'Falta el secreto GEMINI_API_KEY' } }, { status: 500, headers: cors });
  try {
    const { model, body } = await req.json();
    if (!ALLOWED_MODELS.includes(model)) {
      return Response.json({ error: { message: `Modelo no permitido: ${model}` } }, { status: 400, headers: cors });
    }
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(body),
    });
    const text = await r.text();
    return new Response(text, { status: r.status, headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (e) {
    return Response.json({ error: { message: String(e) } }, { status: 500, headers: cors });
  }
});
