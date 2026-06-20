// Proxy for the unsubscribe-digest Edge Function.
// Keeps the Supabase project URL out of digest emails — links point to the
// app domain (/api/unsubscribe) and are forwarded here server-side.
export default async function handler(req, res) {
  const { token } = req.query;
  if (!token) return res.status(400).send('Missing unsubscribe token.');

  try {
    const target = new URL(
      `${process.env.SUPABASE_URL}/functions/v1/unsubscribe-digest`,
    );
    target.searchParams.set('token', token);

    const response = await fetch(target.toString(), {
      signal: AbortSignal.timeout(10000),
    });

    const text = await response.text();
    res.status(response.status).send(text);
  } catch (err) {
    console.error('[unsubscribe] proxy error:', err);
    res.status(500).send('Something went wrong. Please try again later.');
  }
}
