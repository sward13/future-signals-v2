export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  if (req.headers['x-cron-secret'] !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorised' });
  }

  try {
    const response = await fetch(
      `${process.env.SUPABASE_URL}/functions/v1/check-scanner-health`,
      {
        method: 'GET',
        headers: { 'x-cron-secret': process.env.CRON_SECRET },
      },
    );
    const data = await response.json();
    return res.status(response.ok ? 200 : 502).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
