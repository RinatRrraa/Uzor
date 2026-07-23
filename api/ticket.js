const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_IP = 5;
const MAX_PER_CONTACT = 3;
const MAX_BODY_BYTES = 4096;
const { createHash } = require('node:crypto');
const attempts = globalThis.__uzorTicketAttempts || new Map();
globalThis.__uzorTicketAttempts = attempts;

const json = (res, status, body) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(body));
};

const clean = (value, max) => String(value || '')
  .normalize('NFKC')
  .replace(/[\u0000-\u001F\u007F]/g, '')
  .trim()
  .slice(0, max);

const clientIp = (req) => clean(
  req.headers['x-vercel-forwarded-for'] || req.headers['x-forwarded-for'] || req.socket?.remoteAddress,
  128
).split(',')[0].trim();

const fingerprint = (value) => createHash('sha256').update(String(value)).digest('hex');

const consumeMemoryLimit = (key, limit, now) => {
  if (attempts.size > 2000) {
    for (const [storedKey, times] of attempts) {
      if (!times.some((time) => now - time < WINDOW_MS)) attempts.delete(storedKey);
    }
    if (attempts.size > 2000) attempts.clear();
  }
  const recent = (attempts.get(key) || []).filter((time) => now - time < WINDOW_MS);
  if (recent.length >= limit) return false;
  recent.push(now);
  attempts.set(key, recent);
  return true;
};

const consumeLimit = async (key, limit, now) => {
  const redisUrl = String(
    process.env.RATE_LIMIT_REDIS_URL ||
      process.env.UPSTASH_REDIS_REST_URL ||
      process.env.UPSTASH_REDIS_REST_KV_REST_API_URL ||
      ''
  ).replace(/\/$/, '');
  const redisToken = String(
    process.env.RATE_LIMIT_REDIS_TOKEN ||
      process.env.UPSTASH_REDIS_REST_TOKEN ||
      process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN ||
      ''
  );
  if (!redisUrl || !redisToken) return consumeMemoryLimit(key, limit, now);
  try {
    const parsedRedisUrl = new URL(redisUrl);
    if (parsedRedisUrl.protocol !== 'https:' || !parsedRedisUrl.hostname.endsWith('.upstash.io')) {
      throw new Error('RATE_LIMIT_REDIS_URL must be an Upstash HTTPS endpoint');
    }
  } catch (error) {
    console.error('Invalid durable rate limit configuration', error instanceof Error ? error.message : 'unknown');
    return consumeMemoryLimit(key, limit, now);
  }

  const windowSeconds = Math.ceil(WINDOW_MS / 1000);
  const script = 'local n=redis.call("INCR",KEYS[1]); if n==1 then redis.call("EXPIRE",KEYS[1],ARGV[1]) end; return n';
  try {
    const response = await fetch(redisUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${redisToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(['EVAL', script, '1', `uzor:ticket:${key}`, String(windowSeconds)]),
      signal: AbortSignal.timeout(2500)
    });
    if (!response.ok) throw new Error(`rate limit store returned ${response.status}`);
    const result = await response.json();
    const count = Number(result.result);
    if (!Number.isFinite(count)) throw new Error('rate limit store returned an invalid count');
    return count <= limit;
  } catch (error) {
    console.error('Durable rate limit unavailable', error instanceof Error ? error.message : 'unknown');
    return consumeMemoryLimit(key, limit, now);
  }
};

const validContact = (contact) => {
  if (/[<>{}"'`]/.test(contact)) return false;
  if (/^\+?[\d\s()\-]{7,24}$/.test(contact)) return true;
  if (/^@[A-Za-z0-9_\.]{3,64}$/.test(contact)) return true;
  try {
    const url = new URL(contact);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    return url.protocol === 'https:' && [
      't.me', 'telegram.me', 'vk.com', 'vk.ru', 'instagram.com'
    ].includes(host);
  } catch {
    return false;
  }
};

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { ok: false, message: 'Метод не поддерживается' });
  }

  const origin = clean(req.headers.origin, 256);
  const fetchSite = clean(req.headers['sec-fetch-site'], 32);
  const allowedOrigins = new Set(
    String(process.env.ALLOWED_ORIGINS || 'https://uzor.vercel.app')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
  );
  if (process.env.VERCEL_URL) allowedOrigins.add(`https://${process.env.VERCEL_URL}`);
  if (!allowedOrigins.has(origin) || (fetchSite && fetchSite !== 'same-origin')) {
    return json(res, 403, { ok: false, message: 'Запрос отклонён' });
  }

  if (!String(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) {
    return json(res, 415, { ok: false, message: 'Неверный формат запроса' });
  }

  const contentLength = Number(req.headers['content-length'] || 0);
  if (!Number.isFinite(contentLength) || contentLength <= 0 || contentLength > MAX_BODY_BYTES) {
    return json(res, 413, { ok: false, message: 'Запрос слишком большой' });
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const name = clean(body.name, 80);
  const contact = clean(body.contact, 160);
  const ticket = clean(body.ticket, 32);
  const website = clean(body.website, 200);
  const privacyAccepted = body.privacyAccepted === true;
  const submissionId = clean(body.submissionId, 100);
  const openedAt = Number(body.openedAt);
  const now = Date.now();

  if (website || !privacyAccepted || !submissionId || !Number.isFinite(openedAt) || now - openedAt < 1200 || now - openedAt > 2 * 60 * 60 * 1000) {
    return json(res, 400, { ok: false, message: 'Не удалось проверить форму' });
  }

  if (!/^[\p{L}\p{M}][\p{L}\p{M}\s.'’\-]{1,79}$/u.test(name) || !validContact(contact)) {
    return json(res, 422, { ok: false, message: 'Проверьте имя и контакт' });
  }

  if (!['1 день', 'Полный билет'].includes(ticket)) {
    return json(res, 422, { ok: false, message: 'Выберите вариант билета' });
  }

  const ip = clientIp(req);
  const [ipAllowed, contactAllowed, submissionAllowed] = await Promise.all([
    consumeLimit(`ip:${fingerprint(ip)}`, MAX_PER_IP, now),
    consumeLimit(`contact:${fingerprint(contact.toLowerCase())}`, MAX_PER_CONTACT, now),
    consumeLimit(`submission:${fingerprint(submissionId)}`, 1, now)
  ]);
  if (!ipAllowed || !contactAllowed || !submissionAllowed) {
    return json(res, 429, { ok: false, message: 'Слишком много попыток. Попробуйте позже' });
  }

  const webhook = process.env.MAKE_WEBHOOK_URL;
  if (!webhook || !/^https:\/\/hook\.[a-z0-9.-]*make\.com\//i.test(webhook)) {
    console.error('MAKE_WEBHOOK_URL is missing or invalid');
    return json(res, 503, { ok: false, message: 'Отправка временно недоступна' });
  }

  try {
    const upstream = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, contact, ticket, privacyAccepted: true, source: origin }),
      signal: AbortSignal.timeout(8000)
    });
    if (!upstream.ok) throw new Error(`Make returned ${upstream.status}`);
    return json(res, 200, { ok: true });
  } catch (error) {
    console.error('Ticket delivery failed', error instanceof Error ? error.message : 'unknown');
    return json(res, 502, { ok: false, message: 'Не удалось отправить заявку' });
  }
};
