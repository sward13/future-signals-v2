import { createClient } from '@supabase/supabase-js';
import { cronSecretOk } from './lib/cron-auth.js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Accept either the cron secret (server-to-server) or a valid user session (client)
  const cronOk = cronSecretOk(req.headers['x-cron-secret']);
  if (!cronOk) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorised' });
    }
    const { data: { user }, error } = await supabase.auth.getUser(authHeader.slice(7));
    if (error || !user) return res.status(401).json({ error: 'Unauthorised' });
  }

  try {
    const response = await fetch(`${process.env.APP_URL}/api/score`, {
      method: 'GET',
      headers: { 'x-cron-secret': process.env.CRON_SECRET },
    });
    const data = await response.json();
    return res.status(200).json({ triggered: true, results: data });
  } catch (e) {
    return res.status(200).json({ triggered: false, error: e.message });
  }
}
