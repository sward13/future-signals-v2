import { createClient } from '@supabase/supabase-js';
import dns from 'node:dns/promises';
import net from 'node:net';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const MAX_BODY_BYTES = 512 * 1024; // 512 KB
const MAX_REDIRECTS = 3;

// ─── IP range checks ─────────────────────────────────────────────────────────
// Ranges are checked against the *canonical* form of a resolved/normalised IP,
// never against the raw hostname string — so decimal/hex/octal/short IPv4
// literals and IPv4-mapped IPv6 all collapse to a form these ranges catch.

const V4_BLOCKED = [
  ['0.0.0.0', 8],        // "this host" / 0.0.0.0
  ['10.0.0.0', 8],       // RFC1918
  ['100.64.0.0', 10],    // CGNAT (RFC6598)
  ['127.0.0.0', 8],      // loopback
  ['169.254.0.0', 16],   // link-local + cloud IMDS (169.254.169.254)
  ['172.16.0.0', 12],    // RFC1918
  ['192.168.0.0', 16],   // RFC1918
];

function ipv4ToInt(ip) {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const o = Number(p);
    if (o > 255) return null;
    n = (n * 256) + o;
  }
  return n >>> 0;
}

function isBlockedIpv4(ip) {
  const addr = ipv4ToInt(ip);
  if (addr === null) return true; // unparseable → treat as unsafe
  for (const [base, bits] of V4_BLOCKED) {
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    if ((addr & mask) === (ipv4ToInt(base) & mask)) return true;
  }
  return false;
}

// Expand an IPv6 literal (including `::` compression and embedded IPv4) to 16
// bytes. Returns null if it doesn't parse.
function ipv6ToBytes(ip) {
  ip = ip.split('%')[0]; // drop zone id

  // Embedded IPv4 tail, e.g. ::ffff:127.0.0.1 → rewrite the tail as two hextets
  const lastColon = ip.lastIndexOf(':');
  const tail = ip.slice(lastColon + 1);
  if (tail.includes('.')) {
    const v4 = ipv4ToInt(tail);
    if (v4 === null) return null;
    ip = ip.slice(0, lastColon + 1) +
      ((v4 >>> 16) & 0xffff).toString(16) + ':' + (v4 & 0xffff).toString(16);
  }

  const halves = ip.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const tailGroups = halves.length === 2 ? (halves[1] ? halves[1].split(':') : []) : [];

  let groups;
  if (halves.length === 1) {
    if (head.length !== 8) return null;
    groups = head;
  } else {
    const missing = 8 - (head.length + tailGroups.length);
    if (missing < 1) return null; // `::` must stand for at least one group
    groups = [...head, ...Array(missing).fill('0'), ...tailGroups];
  }
  if (groups.length !== 8) return null;

  const bytes = [];
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/i.test(g)) return null;
    const val = parseInt(g, 16);
    bytes.push((val >> 8) & 0xff, val & 0xff);
  }
  return bytes;
}

function isBlockedIpv6(ip) {
  const b = ipv6ToBytes(ip);
  if (!b) return true; // unparseable → treat as unsafe

  // ::  unspecified  and  ::1  loopback
  if (b.every((x) => x === 0)) return true;
  if (b.slice(0, 15).every((x) => x === 0) && b[15] === 1) return true;

  // fe80::/10  link-local
  if (b[0] === 0xfe && (b[1] & 0xc0) === 0x80) return true;

  // fc00::/7  unique-local — covers fc00::/8 AND fd00::/8 (incl. fd00:ec2::254)
  if ((b[0] & 0xfe) === 0xfc) return true;

  // IPv4-mapped (::ffff:0:0/96) and IPv4-compatible (::/96) — check embedded v4
  const first10Zero = b.slice(0, 10).every((x) => x === 0);
  if (first10Zero && ((b[10] === 0xff && b[11] === 0xff) || (b[10] === 0 && b[11] === 0))) {
    return isBlockedIpv4(`${b[12]}.${b[13]}.${b[14]}.${b[15]}`);
  }

  return false;
}

// ─── IPv4-literal normalisation (inet_aton semantics) ────────────────────────
// Returns the canonical dotted form for any numeric IPv4 literal — decimal
// (2130706433), hex (0x7f000001), octal (0177.0.0.1), and short forms
// (127.1, 127.0.1) — or null when the host isn't a numeric IPv4 literal (i.e.
// it's a real domain name and must go through DNS).

function parseIpPart(s) {
  if (/^0x[0-9a-f]+$/i.test(s)) return parseInt(s, 16);
  if (/^0[0-7]+$/.test(s))      return parseInt(s, 8);
  if (/^[0-9]+$/.test(s))       return parseInt(s, 10);
  return null;
}

function numericIpv4ToCanonical(host) {
  const parts = host.split('.');
  if (parts.length === 0 || parts.length > 4) return null;
  const nums = parts.map(parseIpPart);
  if (nums.some((n) => n === null || n < 0)) return null;

  let value;
  const caps = { 1: [0xffffffff], 2: [0xff, 0xffffff], 3: [0xff, 0xff, 0xffff], 4: [0xff, 0xff, 0xff, 0xff] };
  const limits = caps[nums.length];
  if (nums.some((n, i) => n > limits[i])) return null;

  switch (nums.length) {
    case 1: value = nums[0]; break;
    case 2: value = (nums[0] * 0x1000000) + nums[1]; break;
    case 3: value = (nums[0] * 0x1000000) + (nums[1] * 0x10000) + nums[2]; break;
    default: value = (nums[0] * 0x1000000) + (nums[1] * 0x10000) + (nums[2] * 0x100) + nums[3];
  }
  value = value >>> 0;
  return `${(value >>> 24) & 0xff}.${(value >>> 16) & 0xff}.${(value >>> 8) & 0xff}.${value & 0xff}`;
}

// ─── URL validation + DNS resolution ─────────────────────────────────────────
// Validates protocol, then resolves the host to IP(s) and validates every
// resolved address against the block lists. Called once per redirect hop.

async function validateUrl(raw) {
  let u;
  try { u = new URL(raw); } catch { return 'Invalid URL'; }
  if (u.protocol !== 'https:') return 'Only HTTPS URLs are supported';

  let host = u.hostname;
  if (host.startsWith('[') && host.endsWith(']')) host = host.slice(1, -1); // IPv6 literal

  // Numeric IPv4 literal (any encoding) — validate canonical form, no DNS.
  const numericV4 = numericIpv4ToCanonical(host);
  if (numericV4 !== null) {
    return isBlockedIpv4(numericV4) ? 'Disallowed host' : null;
  }

  // Standard IPv6 literal — validate directly, no DNS.
  if (net.isIP(host) === 6) {
    return isBlockedIpv6(host) ? 'Disallowed host' : null;
  }

  // Real domain — resolve and validate every returned address. getaddrinfo
  // returns canonical IPv4/IPv6 strings, so the block lists apply directly.
  let addrs;
  try {
    addrs = await dns.lookup(host, { all: true, verbatim: true });
  } catch {
    return 'Could not resolve host';
  }
  if (!addrs.length) return 'Could not resolve host';

  for (const { address, family } of addrs) {
    const blocked = family === 6 ? isBlockedIpv6(address) : isBlockedIpv4(address);
    if (blocked) return 'Disallowed host';
  }
  return null;
}

// Fetch the URL following redirects manually, re-validating each hop's target
// (protocol + resolved IP) before following it. Rejects past MAX_REDIRECTS.
async function fetchGuarded(startUrl, signal) {
  let currentUrl = startUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const urlError = await validateUrl(currentUrl);
    if (urlError) return { error: urlError };

    const response = await fetch(currentUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FutureSignals/1.0)' },
      redirect: 'manual',
      signal,
    });

    const isRedirect = response.status >= 300 && response.status < 400 &&
      response.headers.get('location');
    if (!isRedirect) return { response };

    // Resolve the (possibly relative) Location against the current URL and loop.
    try {
      currentUrl = new URL(response.headers.get('location'), currentUrl).toString();
    } catch {
      return { error: 'Invalid redirect location' };
    }
  }
  return { error: 'Too many redirects' };
}

export default async function handler(req, res) {
  // Require a valid Supabase session
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorised' });
  }
  const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.slice(7));
  if (authError || !user) return res.status(401).json({ error: 'Unauthorised' });

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'URL required' });

  try {
    // One 8s budget shared across all redirect hops.
    const signal = AbortSignal.timeout(8000);
    const { response, error: fetchError } = await fetchGuarded(url, signal);
    if (fetchError) return res.status(400).json({ error: fetchError });

    if (!response.ok) {
      return res.status(400).json({ error: `Failed to fetch: ${response.status}` });
    }

    // Stream with a size cap — prevents memory exhaustion on large/slow responses
    const reader = response.body.getReader();
    const chunks = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > MAX_BODY_BYTES) { reader.cancel(); break; }
      chunks.push(value);
    }
    const html = Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf-8');

    const titleMatch    = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const ogTitleMatch  = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
    const title         = ogTitleMatch?.[1] || titleMatch?.[1] || '';

    const ogDescMatch   = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
    const metaDescMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
    const description   = ogDescMatch?.[1] || metaDescMatch?.[1] || '';

    return res.status(200).json({ title: title.trim(), description: description.trim() });

  } catch (error) {
    console.error('[scrape] error:', error);
    return res.status(400).json({ error: 'Could not fetch URL' });
  }
}
