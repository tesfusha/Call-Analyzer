import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import type { NextFunction, Request, Response } from 'express';

const PORT = Number(process.env.PORT) || 3000;
const ADDIS_API_BASE = 'https://api.addisassistant.com';

const ALLOWED_LANGUAGES = new Set(['am', 'om', 'ti', 'sw', 'ha', 'sid', 'wal']);
const VOICE_ID_PATTERN = /^[a-z0-9_-]{2,64}$/i;
const MAX_TTS_TEXT_LENGTH = 2500;
const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 18;

const ALLOWED_AUDIO_HOSTS = [
  'api.addisassistant.com',
  '.addisassistant.com',
  'storage.googleapis.com',
  '.cloudfront.net',
  '.amazonaws.com',
];

const FALLBACK_VOICES_BY_LANG: Record<string, Array<{ id: string; name: string; language: string; gender?: string }>> = {
  am: [
    { id: 'am-hamen', name: 'Hamen (Amharic)', language: 'am' },
  ],
  om: [
    { id: 'om-bikila', name: 'Bikila (Afaan Oromo)', language: 'om' },
  ],
  ti: [
    { id: 'ti-berhane', name: 'Berhane (Tigrinya)', language: 'ti' },
  ],
  sw: [
    { id: 'sw-rashid', name: 'Rashid (Swahili)', language: 'sw' },
  ],
  ha: [
    { id: 'ha-mustapha', name: 'Mustapha (Hausa)', language: 'ha' },
  ],
  sid: [
    { id: 'sid-tigist', name: 'Tigist (Sidama)', language: 'sid' },
  ],
  wal: [
    { id: 'wal-tona', name: 'Tona (Wolaytta)', language: 'wal' },
  ],
};

function loadLocalEnvIfPresent(): void {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  try {
    const raw = fs.readFileSync(envPath, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx <= 0) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      if (!key || process.env[key] !== undefined) continue;
      let val = trimmed.slice(eqIdx + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  } catch {
    // Ignore optional local .env read errors
  }
}

loadLocalEnvIfPresent();

type FirebaseAppletConfig = {
  apiKey: string;
  projectId: string;
  firestoreDatabaseId: string;
};

function readFirebaseConfig(): FirebaseAppletConfig | null {
  try {
    const cfgPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    if (!fs.existsSync(cfgPath)) return null;
    const parsed = JSON.parse(fs.readFileSync(cfgPath, 'utf8')) as Record<string, unknown>;
    const apiKey = typeof parsed.apiKey === 'string' ? parsed.apiKey.trim() : '';
    const projectId = typeof parsed.projectId === 'string' ? parsed.projectId.trim() : '';
    const firestoreDatabaseId =
      typeof parsed.firestoreDatabaseId === 'string' && parsed.firestoreDatabaseId.trim()
        ? parsed.firestoreDatabaseId.trim()
        : '(default)';
    if (!apiKey || !projectId) return null;
    return { apiKey, projectId, firestoreDatabaseId };
  } catch {
    return null;
  }
}

const FIREBASE_CONFIG = readFirebaseConfig();

type AuthenticatedUser = {
  uid: string;
  email: string;
};

type AuthedRequest = Request & {
  authUser?: AuthenticatedUser;
};

const tokenVerifyCache = new Map<string, { user: AuthenticatedUser; expiresAt: number }>();
const ttsRateWindow = new Map<string, number[]>();

async function verifyAdminDoc(uid: string, idToken: string): Promise<boolean> {
  if (!FIREBASE_CONFIG) return false;
  const docUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(FIREBASE_CONFIG.projectId)}/databases/${encodeURIComponent(FIREBASE_CONFIG.firestoreDatabaseId)}/documents/admins/${encodeURIComponent(uid)}`;
  try {
    const res = await fetch(docUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
      signal: AbortSignal.timeout(8000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function verifyFirebaseBearer(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
  const header = req.header('authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  const idToken = match?.[1]?.trim() ?? '';

  if (!idToken || idToken.length > 8192) {
    res.status(401).json({ error: 'Sign in is required to use voice generation.' });
    return;
  }

  if (!FIREBASE_CONFIG) {
    res.status(503).json({ error: 'Authentication verification is unavailable on this server.' });
    return;
  }

  const cached = tokenVerifyCache.get(idToken);
  if (cached && cached.expiresAt > Date.now()) {
    req.authUser = cached.user;
    next();
    return;
  }

  try {
    const verifyRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(FIREBASE_CONFIG.apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
        signal: AbortSignal.timeout(8000),
      },
    );

    if (!verifyRes.ok) {
      res.status(401).json({ error: 'Invalid or expired sign-in session. Please refresh and try again.' });
      return;
    }

    const payload = (await verifyRes.json()) as {
      users?: Array<{ localId?: string; email?: string; emailVerified?: boolean; disabled?: boolean }>;
    };
    const account = payload.users?.[0];
    if (!account?.localId || account.disabled) {
      res.status(401).json({ error: 'Invalid user session.' });
      return;
    }
    if (!account.emailVerified) {
      res.status(403).json({ error: 'Verified admin account is required for voice generation.' });
      return;
    }

    const isAdmin = await verifyAdminDoc(account.localId, idToken);
    if (!isAdmin) {
      res.status(403).json({ error: 'Admin access is required to generate Addis AI promo narration.' });
      return;
    }

    const user: AuthenticatedUser = {
      uid: account.localId,
      email: (account.email ?? '').toLowerCase(),
    };
    tokenVerifyCache.set(idToken, { user, expiresAt: Date.now() + 2 * 60 * 1000 });
    if (tokenVerifyCache.size > 200) {
      const now = Date.now();
      for (const [k, v] of tokenVerifyCache.entries()) {
        if (v.expiresAt <= now) tokenVerifyCache.delete(k);
      }
    }
    req.authUser = user;
    next();
  } catch {
    res.status(502).json({ error: 'Could not verify your session right now. Please retry.' });
  }
}

function checkRateLimit(uid: string): boolean {
  const now = Date.now();
  const recent = (ttsRateWindow.get(uid) ?? []).filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX_REQUESTS) {
    ttsRateWindow.set(uid, recent);
    return false;
  }
  recent.push(now);
  ttsRateWindow.set(uid, recent);
  return true;
}

function getAddisApiKey(): string {
  return (process.env.ADDIS_API_KEY ?? '').trim();
}

function isTrustedAudioDownloadUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host === '169.254.169.254' ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
    ) {
      return false;
    }
    return ALLOWED_AUDIO_HOSTS.some((allowed) =>
      allowed.startsWith('.') ? host.endsWith(allowed) : host === allowed,
    );
  } catch {
    return false;
  }
}

function detectAudioMimeFromBytes(buf: Buffer, fallback = 'audio/mpeg'): string {
  if (buf.length >= 12 && buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WAVE') {
    return 'audio/wav';
  }
  if (buf.length >= 4 && buf.subarray(0, 4).toString('ascii') === 'OggS') {
    return 'audio/ogg';
  }
  if (buf.length >= 4 && buf.subarray(0, 4).toString('ascii') === 'fLaC') {
    return 'audio/flac';
  }
  if (buf.length >= 3 && (buf.subarray(0, 3).toString('ascii') === 'ID3' || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0))) {
    return 'audio/mpeg';
  }
  return fallback;
}

function extractStringField(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const val = obj[key];
    if (typeof val === 'string' && val.trim()) return val.trim();
  }
  const nested = obj.data;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    const nestedRec = nested as Record<string, unknown>;
    for (const key of keys) {
      const val = nestedRec[key];
      if (typeof val === 'string' && val.trim()) return val.trim();
    }
  }
  return null;
}

function normalizeVoicesResponse(payload: unknown, language: string): Array<{ id: string; name: string; language: string; gender?: string }> {
  let rawList: unknown[] = [];
  if (Array.isArray(payload)) {
    rawList = payload;
  } else if (payload && typeof payload === 'object') {
    const rec = payload as Record<string, unknown>;
    if (Array.isArray(rec.voices)) rawList = rec.voices;
    else if (Array.isArray(rec.data)) rawList = rec.data;
    else if (rec.data && typeof rec.data === 'object' && Array.isArray((rec.data as Record<string, unknown>).voices)) {
      rawList = (rec.data as Record<string, unknown>).voices as unknown[];
    }
  }

  const parsed: Array<{ id: string; name: string; language: string; gender?: string }> = [];
  for (const item of rawList) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const idRaw = rec.voice_id ?? rec.id ?? rec.voiceId ?? rec.slug;
    if (typeof idRaw !== 'string' || !VOICE_ID_PATTERN.test(idRaw.trim())) continue;
    const id = idRaw.trim();
    const nameRaw = rec.name ?? rec.display_name ?? rec.label ?? id;
    const name = typeof nameRaw === 'string' && nameRaw.trim() ? nameRaw.trim().slice(0, 80) : id;
    const langRaw = rec.language ?? rec.lang ?? language;
    const lang = typeof langRaw === 'string' && langRaw.trim() ? langRaw.trim().slice(0, 12) : language;
    const genderRaw = rec.gender;
    const gender = typeof genderRaw === 'string' && genderRaw.trim() ? genderRaw.trim().slice(0, 24) : undefined;
    parsed.push({ id, name, language: lang, gender });
  }

  return parsed.length > 0 ? parsed : (FALLBACK_VOICES_BY_LANG[language] ?? FALLBACK_VOICES_BY_LANG.am);
}

async function startServer(): Promise<void> {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '64kb' }));

  app.get('/api/tts/addis/status', verifyFirebaseBearer, (_req, res) => {
    res.json({
      configured: Boolean(getAddisApiKey()),
      provider: 'Addis AI',
    });
  });

  app.get('/api/tts/addis/voices', verifyFirebaseBearer, async (req, res) => {
    const langParam = typeof req.query.language === 'string' ? req.query.language.trim().toLowerCase() : 'am';
    const language = ALLOWED_LANGUAGES.has(langParam) ? langParam : 'am';
    const apiKey = getAddisApiKey();

    if (!apiKey) {
      res.json({
        configured: false,
        voices: FALLBACK_VOICES_BY_LANG[language] ?? FALLBACK_VOICES_BY_LANG.am,
      });
      return;
    }

    try {
      const upstream = await fetch(
        `${ADDIS_API_BASE}/api/v1/voice/voices?language=${encodeURIComponent(language)}`,
        {
          method: 'GET',
          headers: {
            'x-api-key': apiKey,
            Accept: 'application/json',
          },
          signal: AbortSignal.timeout(12000),
        },
      );

      if (!upstream.ok) {
        res.json({
          configured: true,
          voices: FALLBACK_VOICES_BY_LANG[language] ?? FALLBACK_VOICES_BY_LANG.am,
          fallback: true,
        });
        return;
      }

      const payload: unknown = await upstream.json();
      res.json({
        configured: true,
        voices: normalizeVoicesResponse(payload, language),
      });
    } catch {
      res.json({
        configured: true,
        voices: FALLBACK_VOICES_BY_LANG[language] ?? FALLBACK_VOICES_BY_LANG.am,
        fallback: true,
      });
    }
  });

  app.post('/api/tts/addis/generate', verifyFirebaseBearer, async (req: AuthedRequest, res) => {
    const apiKey = getAddisApiKey();
    if (!apiKey) {
      res.status(503).json({
        error: 'ADDIS_API_KEY is not configured yet. Add ADDIS_API_KEY in AI Studio Settings -> Secrets, then retry.',
        code: 'KEY_NOT_CONFIGURED',
      });
      return;
    }

    const uid = req.authUser?.uid ?? 'unknown';
    if (!checkRateLimit(uid)) {
      res.status(429).json({
        error: 'Too many voice generations in a short time. Please wait a minute and try again.',
      });
      return;
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    const langInput = typeof body.language === 'string' ? body.language.trim().toLowerCase() : 'am';
    const voiceInput = typeof body.voiceId === 'string' ? body.voiceId.trim() : '';

    if (!text) {
      res.status(400).json({ error: 'Enter a narration script before generating voice.' });
      return;
    }
    if (text.length > MAX_TTS_TEXT_LENGTH) {
      res.status(400).json({ error: `Narration script is too long (max ${MAX_TTS_TEXT_LENGTH} characters).` });
      return;
    }
    if (!ALLOWED_LANGUAGES.has(langInput)) {
      res.status(400).json({ error: 'Unsupported language selected for Addis AI voice.' });
      return;
    }

    const defaultVoice = (FALLBACK_VOICES_BY_LANG[langInput]?.[0]?.id) ?? 'am-hamen';
    const voiceId = voiceInput && VOICE_ID_PATTERN.test(voiceInput) ? voiceInput : defaultVoice;

    try {
      const upstream = await fetch(`${ADDIS_API_BASE}/api/v1/voice/generations`, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
          Accept: 'audio/*, application/json',
        },
        body: JSON.stringify({
          text,
          voice_id: voiceId,
          language: langInput,
        }),
        signal: AbortSignal.timeout(45000),
      });

      const contentType = (upstream.headers.get('content-type') ?? '').toLowerCase();

      if (!upstream.ok) {
        let detail = `Addis AI returned status ${upstream.status}.`;
        try {
          if (contentType.includes('application/json')) {
            const errJson = (await upstream.json()) as Record<string, unknown>;
            const msg = extractStringField(errJson, ['message', 'detail', 'error']);
            if (msg) detail = msg.slice(0, 220);
          } else {
            const errTxt = (await upstream.text()).trim();
            if (errTxt) detail = errTxt.slice(0, 220);
          }
        } catch {
          // keep default message
        }
        const statusOut = upstream.status === 401 || upstream.status === 403 ? 502 : upstream.status;
        res.status(statusOut).json({ error: detail });
        return;
      }

      // Case 1: Direct binary audio stream
      if (contentType.startsWith('audio/') || contentType.includes('application/octet-stream')) {
        const arrayBuf = await upstream.arrayBuffer();
        if (arrayBuf.byteLength === 0 || arrayBuf.byteLength > MAX_AUDIO_BYTES) {
          res.status(502).json({ error: 'Received an invalid audio payload from Addis AI.' });
          return;
        }
        const audioBuffer = Buffer.from(arrayBuf);
        const mime = contentType.startsWith('audio/')
          ? contentType.split(';')[0]
          : detectAudioMimeFromBytes(audioBuffer);
        res.setHeader('Content-Type', mime);
        res.setHeader('Cache-Control', 'no-store');
        res.send(audioBuffer);
        return;
      }

      // Case 2: JSON payload with base64 audio or downloadable HTTPS URL
      const jsonPayload = (await upstream.json()) as Record<string, unknown>;
      const base64Audio = extractStringField(jsonPayload, [
        'audio_base64',
        'audioContent',
        'audio_content',
        'audio',
        'base64',
      ]);

      if (base64Audio && !/^https?:\/\//i.test(base64Audio)) {
        const cleaned = base64Audio.replace(/^data:audio\/[a-z0-9.+-]+;base64,/i, '');
        const audioBuffer = Buffer.from(cleaned, 'base64');
        if (audioBuffer.byteLength === 0 || audioBuffer.byteLength > MAX_AUDIO_BYTES) {
          res.status(502).json({ error: 'Decoded Addis AI audio was empty or too large.' });
          return;
        }
        const mime = detectAudioMimeFromBytes(audioBuffer);
        res.setHeader('Content-Type', mime);
        res.setHeader('Cache-Control', 'no-store');
        res.send(audioBuffer);
        return;
      }

      const audioUrl = extractStringField(jsonPayload, [
        'audio_url',
        'audioUrl',
        'download_url',
        'downloadUrl',
        'url',
        'file_url',
      ]) ?? (base64Audio && /^https?:\/\//i.test(base64Audio) ? base64Audio : null);

      if (audioUrl && isTrustedAudioDownloadUrl(audioUrl)) {
        const downloadRes = await fetch(audioUrl, {
          method: 'GET',
          signal: AbortSignal.timeout(30000),
        });
        if (!downloadRes.ok) {
          res.status(502).json({ error: 'Could not download generated audio clip from Addis AI.' });
          return;
        }
        const arrayBuf = await downloadRes.arrayBuffer();
        if (arrayBuf.byteLength === 0 || arrayBuf.byteLength > MAX_AUDIO_BYTES) {
          res.status(502).json({ error: 'Downloaded Addis AI audio was empty or too large.' });
          return;
        }
        const audioBuffer = Buffer.from(arrayBuf);
        const dlType = (downloadRes.headers.get('content-type') ?? '').toLowerCase();
        const mime = dlType.startsWith('audio/')
          ? dlType.split(';')[0]
          : detectAudioMimeFromBytes(audioBuffer);
        res.setHeader('Content-Type', mime);
        res.setHeader('Cache-Control', 'no-store');
        res.send(audioBuffer);
        return;
      }

      res.status(502).json({
        error: 'Addis AI responded without playable audio data. Please try again or check your voice selection.',
      });
    } catch (err) {
      const isTimeout = err instanceof Error && err.name === 'TimeoutError';
      res.status(504).json({
        error: isTimeout
          ? 'Addis AI took too long to generate the voice clip. Try a shorter script and retry.'
          : 'Could not reach Addis AI right now. Please try again shortly.',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
