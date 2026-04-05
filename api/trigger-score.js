export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const response = await fetch(`${process.env.VITE_APP_URL}/api/score`, {
      method: 'GET',
      headers: { 'x-cron-secret': process.env.CRON_SECRET },
    });
    const data = await response.json();
    return res.status(200).json({ triggered: true, results: data });
  } catch (e) {
    return res.status(200).json({ triggered: false, error: e.message });
  }
}
