// Prekladová funkcia: kontroluje limity, prepošle na Gemini.
// Limity uloží do Cloudflare KV (per IP+cookie + globálny strop).
// Konvertované z Netlify Functions na Cloudflare Pages Functions.

const MAX_DOCS_PER_DAY         = 10;
const MAX_PAGES_PER_DAY        = 400;
const MAX_DOCS_PER_DAY_PER_IP  = 30;
const MAX_PAGES_PER_DAY_PER_IP = 1200;
const MAX_PAGES_PER_DOC        = 150;
const MAX_BLOCKS_DOC           = 750;
const MAX_BLOCKS_CHUNK         = 40;
const COOLDOWN_MS              = 3000;
const GLOBAL_DAILY_CAP         = 3000;
const BATCH_SIZE               = 25;
const PARALLEL_BATCHES         = 4;
const SESSION_TTL_MS           = 5 * 60 * 1000;

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, 'INVALID_JSON');
  }

  const {
    texts,
    pageCount,
    fromLang,
    toLang,
    sessionToken,
    cookieId,
    chunkIndex,
    totalChunks,
  } = body;

  const isChunked = typeof chunkIndex === 'number' && typeof totalChunks === 'number' && totalChunks > 1;
  const isFirstChunk  = isChunked && chunkIndex === 0;
  const isMiddleOrLastChunk = isChunked && chunkIndex > 0;
  const isLastChunk   = isChunked && chunkIndex === totalChunks - 1;

  if (!Array.isArray(texts) || texts.length === 0) return jsonError(400, 'NO_TEXTS');
  if (texts.length > MAX_BLOCKS_CHUNK) return jsonError(400, 'TOO_MANY_BLOCKS', { count: texts.length, max: MAX_BLOCKS_CHUNK });
  if (!cookieId || typeof cookieId !== 'string' || cookieId.length > 100) return jsonError(400, 'INVALID_COOKIE');
  if (!toLang || typeof toLang !== 'string') return jsonError(400, 'INVALID_TOLANG');

  // Cloudflare poskytuje skutočnú IP cez CF-Connecting-IP
  const ip = (
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    'unknown'
  );
  const ipKey = hashId(ip);

  const kv    = env.LIMITS_KV;
  const today = new Date().toISOString().slice(0, 10);
  const userKey     = `u_${hashId(ip + '_' + cookieId)}_${today}`;
  const ipDailyKey  = `ip_${ipKey}_${today}`;
  const globalKey   = `g_${today}`;
  const cooldownKey = `cd_${ipKey}`;

  // ═══════════════════════════════════════════════════
  // BRANCH A: Middle / Last chunk (validate session)
  // ═══════════════════════════════════════════════════
  if (isMiddleOrLastChunk) {
    if (!sessionToken || typeof sessionToken !== 'string') return jsonError(401, 'SESSION_REQUIRED');

    const sessionKey = `sess_${sessionToken}`;
    const session    = await safeGet(kv, sessionKey);
    if (!session) return jsonError(401, 'SESSION_EXPIRED');
    if (session.expiresAt < Date.now()) {
      await safeDelete(kv, sessionKey);
      return jsonError(401, 'SESSION_EXPIRED');
    }
    if (session.cookieId !== cookieId)             return jsonError(401, 'SESSION_MISMATCH');
    if (session.expectedNextChunk !== chunkIndex)  return jsonError(400, 'CHUNK_ORDER', { expected: session.expectedNextChunk, got: chunkIndex });
    if (session.totalChunks !== totalChunks)       return jsonError(400, 'CHUNK_TOTAL_MISMATCH');

    let translated;
    try {
      translated = await translateAll(texts, session.fromLang, session.toLang, env);
    } catch (e) {
      console.error('Translate error (chunk):', e.message);
      return jsonError(500, 'TRANSLATE_FAILED', { detail: e.message });
    }

    if (!Array.isArray(translated) || translated.length !== texts.length) return jsonError(500, 'TRANSLATE_MISMATCH');

    const estimatedRequests = Math.ceil(texts.length / BATCH_SIZE);

    if (isLastChunk) {
      const user     = (await safeGet(kv, userKey))    || { docs: 0, pages: 0 };
      const ipDaily  = (await safeGet(kv, ipDailyKey)) || { docs: 0, pages: 0 };
      const global   = (await safeGet(kv, globalKey))  || { requests: 0 };

      user.docs    += 1;
      user.pages   += session.pageCount;
      ipDaily.docs += 1;
      ipDaily.pages += session.pageCount;
      global.requests += (session.totalEstimatedRequests || 0) + estimatedRequests;

      await safeSet(kv, userKey, user);
      await safeSet(kv, ipDailyKey, ipDaily);
      await safeSet(kv, globalKey, global);
      await safeSet(kv, cooldownKey, { t: Date.now() });
      await safeDelete(kv, sessionKey);

      return jsonOK({ translated, done: true, used: user });
    } else {
      session.expectedNextChunk = chunkIndex + 1;
      session.totalEstimatedRequests = (session.totalEstimatedRequests || 0) + estimatedRequests;
      await safeSet(kv, sessionKey, session);
      return jsonOK({ translated });
    }
  }

  // ═══════════════════════════════════════════════════
  // BRANCH B: Single call OR First chunk
  // ═══════════════════════════════════════════════════
  if (typeof pageCount !== 'number' || pageCount < 1) return jsonError(400, 'INVALID_PAGECOUNT');
  if (pageCount > MAX_PAGES_PER_DOC) return jsonError(400, 'TOO_MANY_PAGES', { pageCount, max: MAX_PAGES_PER_DOC });

  // Turnstile odstránený — ochrana proti zneužitiu cez IP/cookie limity nižšie.

  const cd = await safeGet(kv, cooldownKey);
  if (cd && Date.now() - cd.t < COOLDOWN_MS) {
    const retryIn = Math.ceil((COOLDOWN_MS - (Date.now() - cd.t)) / 1000);
    return jsonError(429, 'COOLDOWN', { retryIn });
  }

  const user = (await safeGet(kv, userKey)) || { docs: 0, pages: 0 };
  if (user.docs >= MAX_DOCS_PER_DAY) return jsonError(429, 'DAILY_DOCS_EXCEEDED', { used: user.docs, max: MAX_DOCS_PER_DAY });
  if (user.pages + pageCount > MAX_PAGES_PER_DAY) return jsonError(429, 'DAILY_PAGES_EXCEEDED', {
    used: user.pages, requested: pageCount, max: MAX_PAGES_PER_DAY, remaining: MAX_PAGES_PER_DAY - user.pages,
  });

  const ipDaily = (await safeGet(kv, ipDailyKey)) || { docs: 0, pages: 0 };
  if (ipDaily.docs >= MAX_DOCS_PER_DAY_PER_IP) return jsonError(429, 'DAILY_DOCS_EXCEEDED', { used: ipDaily.docs, max: MAX_DOCS_PER_DAY_PER_IP, scope: 'ip' });
  if (ipDaily.pages + pageCount > MAX_PAGES_PER_DAY_PER_IP) return jsonError(429, 'DAILY_PAGES_EXCEEDED', {
    used: ipDaily.pages, requested: pageCount, max: MAX_PAGES_PER_DAY_PER_IP,
    remaining: MAX_PAGES_PER_DAY_PER_IP - ipDaily.pages, scope: 'ip',
  });

  const global = (await safeGet(kv, globalKey)) || { requests: 0 };
  const estimatedRequests = Math.ceil(texts.length / BATCH_SIZE);
  const fullEstimate = isFirstChunk
    ? Math.ceil((totalChunks * MAX_BLOCKS_CHUNK) / BATCH_SIZE)
    : estimatedRequests;
  if (global.requests + fullEstimate > GLOBAL_DAILY_CAP) return jsonError(503, 'GLOBAL_CAP');

  let translated;
  try {
    translated = await translateAll(texts, fromLang, toLang, env);
  } catch (e) {
    console.error('Translate error:', e.message);
    return jsonError(500, 'TRANSLATE_FAILED', { detail: e.message });
  }

  if (!Array.isArray(translated) || translated.length !== texts.length) return jsonError(500, 'TRANSLATE_MISMATCH');

  if (isFirstChunk) {
    const newSessionToken = generateToken();
    await safeSet(kv, `sess_${newSessionToken}`, {
      cookieId, ipKey, fromLang, toLang, pageCount, totalChunks,
      expectedNextChunk: 1,
      totalEstimatedRequests: estimatedRequests,
      expiresAt: Date.now() + SESSION_TTL_MS,
    });
    return jsonOK({ translated, sessionToken: newSessionToken });
  }

  // Single call: commit immediately
  user.docs     += 1;
  user.pages    += pageCount;
  ipDaily.docs  += 1;
  ipDaily.pages += pageCount;
  global.requests += estimatedRequests;
  await safeSet(kv, userKey, user);
  await safeSet(kv, ipDailyKey, ipDaily);
  await safeSet(kv, globalKey, global);
  await safeSet(kv, cooldownKey, { t: Date.now() });

  return jsonOK({ translated, used: user });
}

// ─── Pomocné funkcie ──────────────────────────────

async function translateAll(texts, fromLang, toLang, env) {
  const batches = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    batches.push({ idx: i, items: texts.slice(i, i + BATCH_SIZE) });
  }
  const result = new Array(texts.length);
  for (let i = 0; i < batches.length; i += PARALLEL_BATCHES) {
    const slice = batches.slice(i, i + PARALLEL_BATCHES);
    const translatedSlices = await Promise.all(
      slice.map((b) => translateBatch(b.items, fromLang, toLang, env))
    );
    translatedSlices.forEach((tr, k) => {
      const startIdx = slice[k].idx;
      tr.forEach((t, j) => { result[startIdx + j] = t; });
    });
  }
  return result;
}

async function translateBatch(items, fromLang, toLang, env) {
  const fromLabel = fromLang === 'auto' ? 'the detected language' : fromLang;
  const numbered  = items.map((t, i) => `[${i + 1}] ${t}`).join('\n');
  const prompt =
    `Translate each numbered item from ${fromLabel} to ${toLang}. ` +
    `Return ONLY the numbered items in the EXACT same [1] text [2] text format. ` +
    `Do NOT add explanations, headers, or any other text. ` +
    `Preserve any inline whitespace. If an item is just punctuation or numbers, leave it as-is.\n\n` +
    numbered;

  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 8192 },
    }),
  });

  if (!resp.ok) {
    const errBody = await resp.text();
    throw new Error(`Gemini API ${resp.status}: ${errBody.slice(0, 200)}`);
  }

  const data = await resp.json();
  const raw  = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) throw new Error('Empty Gemini response');

  const map = {};
  const re  = /\[(\d+)\]\s*([\s\S]*?)(?=\n\s*\[\d+\]|$)/g;
  let m;
  while ((m = re.exec(raw)) !== null) {
    map[+m[1] - 1] = m[2].trim();
  }
  return items.map((orig, i) => map[i] ?? orig);
}

async function safeGet(kv, key) {
  try { return await kv.get(key, { type: 'json' }); }
  catch { return null; }
}

async function safeSet(kv, key, value) {
  try { await kv.put(key, JSON.stringify(value)); }
  catch (e) { console.error('KV set error:', e.message); }
}

async function safeDelete(kv, key) {
  try { await kv.delete(key); }
  catch (e) { console.error('KV delete error:', e.message); }
}

function hashId(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function generateToken() {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return Array.from(a, b => b.toString(16).padStart(2, '0')).join('');
}

function jsonOK(obj) {
  return new Response(JSON.stringify(obj), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function jsonError(status, code, extra = {}) {
  return new Response(JSON.stringify({ error: code, ...extra }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
