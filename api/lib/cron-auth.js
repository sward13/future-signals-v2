import { timingSafeEqual } from 'node:crypto';

// Cron-secret check shared by the cron-triggered Vercel routes.
//
// Fails closed: if CRON_SECRET is unset in the deployment environment, every
// request is rejected — previously `header !== process.env.CRON_SECRET` passed
// when both sides were undefined, leaving the endpoint publicly triggerable.
//
// Callers pass the candidate value(s) they accept (e.g. the x-cron-secret
// header, or a stripped Bearer token) so each route keeps its existing set of
// accepted headers.
export function cronSecretOk(...provided) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const secretBuf = Buffer.from(secret);
  return provided.some((value) => {
    if (typeof value !== 'string' || value.length === 0) return false;
    const buf = Buffer.from(value);
    return buf.length === secretBuf.length && timingSafeEqual(buf, secretBuf);
  });
}

// Extracts the token from an `Authorization: Bearer <token>` header, or
// undefined when the header is absent or not Bearer-shaped.
export function bearerToken(req) {
  const auth = req.headers['authorization'];
  return auth?.startsWith('Bearer ') ? auth.slice(7) : undefined;
}
