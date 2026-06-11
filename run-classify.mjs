import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf-8')
    .split('\n')
    .filter(l => l && !l.startsWith('#'))
    .map(l => [l.split('=')[0].trim(), l.slice(l.indexOf('=') + 1).trim()])
);

const APP_URL     = env.VITE_APP_URL;
const CRON_SECRET = env.CRON_SECRET;
const REST_URL    = env.VITE_SUPABASE_URL + '/rest/v1/candidates';
const REST_HEADERS = {
  apikey: env.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY,
  Prefer: 'count=exact',
};

const sb = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

if (!APP_URL || !CRON_SECRET) {
  console.error('Missing VITE_APP_URL or CRON_SECRET'); process.exit(1);
}

// Use raw REST API for counts — the JS client count:exact returns null unreliably
async function count(status) {
  const r = await fetch(`${REST_URL}?status=eq.${status}&select=status&limit=1`, {
    method: 'HEAD', headers: REST_HEADERS,
  });
  const range = r.headers.get('content-range'); // "0-0/N" or "*/0"
  if (!range) return 0;
  const m = range.match(/\/(\d+)$/);
  return m ? parseInt(m[1], 10) : 0;
}

async function callClassify() {
  const res = await fetch(`${APP_URL}/api/classify`, {
    method: 'GET', headers: { 'x-cron-secret': CRON_SECRET },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const totals    = { classified: 0, embedded: 0, errors: [] };
const timeouts  = [];
const startedAt = Date.now();

const initialPending  = await count('pending');
const initialRejected = await count('rejected');
const initialScored   = await count('scored');

console.log('Manual classification pass starting…\n');
console.log(`Pending:  ${initialPending}  Scored: ${initialScored}  Rejected: ${initialRejected}\n`);

if (initialPending === 0) {
  console.log('No pending candidates — queue is already empty.');
  process.exit(0);
}

let batch = 0;
let emptyStreak = 0;
const RETRY_DELAY_MS  = 60000; // longer gap between 504 retries — wait for any in-flight functions to clear
const BATCH_DELAY_MS  = 30000; // pause between successful batches — prevents overlapping Vercel invocations

while (true) {
  batch++;
  const t0 = Date.now();
  let result;

  try {
    result = await callClassify();
  } catch (err) {
    const msg = err.message;
    if (msg.includes('504') || msg.includes('timeout')) {
      timeouts.push(batch);
      // 504 often means the function ran past the HTTP deadline but may still
      // be processing — wait longer before next call to avoid pile-up
      console.log(`Batch ${String(batch).padStart(3)}  HTTP 504 — waiting ${RETRY_DELAY_MS/1000}s`);
      await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
      continue;
    }
    console.error(`Batch ${batch} — fatal: ${msg}`);
    break;
  }

  const ms = Date.now() - t0;
  const r  = result.results ?? {};
  const cl = r.candidates_classified ?? 0;
  const em = r.candidates_embedded   ?? 0;
  const er = r.errors?.length        ?? 0;
  totals.classified += cl;
  totals.embedded   += em;
  if (r.errors?.length) totals.errors.push(...r.errors);

  const remaining = await count('pending');
  console.log(
    `Batch ${String(batch).padStart(3)}  ` +
    `classified=${String(cl).padStart(3)}  embedded=${String(em).padStart(3)}  ` +
    `errors=${er}  ${ms}ms  pending=${remaining}`
  );

  if (cl === 0 && em === 0) {
    if (++emptyStreak >= 2) { console.log('\nQueue drained.'); break; }
  } else {
    emptyStreak = 0;
  }
  if (remaining === 0) { console.log('\nAll pending candidates processed.'); break; }

  await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
}

// ── Final DB counts ────────────────────────────────────────────────────────────
const wallSec       = ((Date.now() - startedAt) / 1000).toFixed(1);
const finalPending  = await count('pending');
const finalScored   = await count('scored');
const finalRejected = await count('rejected');
const newScored     = finalScored   - initialScored;
const newRejected   = finalRejected - initialRejected;
const total         = newScored + newRejected;

console.log('\n── Results ─────────────────────────────────────');
console.log(`  Batches run:       ${batch}  (${timeouts.length} timed out)`);
console.log(`  Wall-clock:        ${wallSec}s`);
console.log('');
console.log(`  Classified (scored):  ${newScored}`);
console.log(`  Rejected:             ${newRejected}`);
if (total > 0) console.log(`  Rejection rate:       ${((newRejected / total) * 100).toFixed(1)}%`);
console.log('');
console.log(`  Pending remaining: ${finalPending}`);
console.log(`  Total scored:      ${finalScored}`);
console.log(`  Total rejected:    ${finalRejected}`);

// ── Top sources by rejection count ────────────────────────────────────────────
if (finalRejected > 0) {
  const { data: rejected } = await sb
    .from('candidates')
    .select('source_id')
    .eq('status', 'rejected')
    .limit(5000);

  if (rejected?.length) {
    const freq = {};
    for (const c of rejected) freq[c.source_id] = (freq[c.source_id] ?? 0) + 1;
    const topIds = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 5).map(e => e[0]);
    const { data: sources } = await sb.from('sources').select('id, name, domain, credibility').in('id', topIds);
    const nameMap = Object.fromEntries((sources ?? []).map(s => [s.id, s]));
    console.log('\n── Top sources by rejection count ──────────────');
    topIds.forEach(id => {
      const src = nameMap[id];
      console.log(`  ${String(freq[id]).padStart(4)}  ${src?.name ?? id}  [${src?.domain ?? '?'}, ${src?.credibility ?? '?'}]`);
    });
  }
}

if (totals.errors.length > 0) {
  console.log('\n── Sample errors ────────────────────────────────');
  totals.errors.slice(0, 10).forEach(e => console.log(' ', e));
  if (totals.errors.length > 10) console.log(`  … and ${totals.errors.length - 10} more`);
}
