import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { SocksProxyAgent } from 'socks-proxy-agent';

const ROOT = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PORT = 8080;
const GIFT_CACHE_TTL = 5 * 60 * 1000;
const MEDIA_CACHE_TTL = 60 * 60 * 1000;
const MAX_MEDIA_BYTES = 5 * 1024 * 1024;
const MAX_TELEGRAM_JSON_BYTES = 2 * 1024 * 1024;
const TELEGRAM_REQUEST_TIMEOUT = 12_000;

const MIME_TYPES = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.jpg', 'image/jpeg'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.webp', 'image/webp']
]);

const giftCache = { expiresAt: 0, payload: null, pending: null };
const mediaRegistry = new Map();
const mediaCache = new Map();
let cachedProxyUrl = null;
let cachedProxyAgent = null;

const json = (response, status, body, cacheControl = 'no-store') => {
  response.writeHead(status, {
    'Cache-Control': cacheControl,
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff'
  });
  response.end(JSON.stringify(body));
};

const getTelegramProxyAgent = (proxyUrl) => {
  if (!proxyUrl) return undefined;
  if (proxyUrl === cachedProxyUrl && cachedProxyAgent) return cachedProxyAgent;

  const parsedUrl = new URL(proxyUrl);
  if (!['socks5:', 'socks5h:'].includes(parsedUrl.protocol) || !parsedUrl.hostname || !parsedUrl.port) {
    throw new Error('TELEGRAM_PROXY_URL must be a valid socks5:// URL');
  }

  cachedProxyAgent?.destroy();
  cachedProxyUrl = proxyUrl;
  cachedProxyAgent = new SocksProxyAgent(proxyUrl);
  return cachedProxyAgent;
};

const requestTelegramUrl = (url, proxyUrl, maxBytes, accept) => new Promise((resolve, reject) => {
  let settled = false;

  const fail = (error) => {
    if (settled) return;
    settled = true;
    reject(error);
  };

  const succeed = (value) => {
    if (settled) return;
    settled = true;
    resolve(value);
  };

  const request = httpsRequest(url, {
    agent: getTelegramProxyAgent(proxyUrl),
    headers: { Accept: accept }
  }, (response) => {
    const chunks = [];
    let receivedBytes = 0;

    response.once('error', fail);
    response.on('data', (chunk) => {
      receivedBytes += chunk.byteLength;
      if (receivedBytes > maxBytes) {
        const error = new Error('Telegram response is too large');
        fail(error);
        response.destroy(error);
        request.destroy(error);
        return;
      }
      chunks.push(chunk);
    });
    response.once('end', () => {
      succeed({
        body: Buffer.concat(chunks),
        headers: response.headers,
        status: response.statusCode || 0
      });
    });
  });

  request.setTimeout(TELEGRAM_REQUEST_TIMEOUT, () => {
    request.destroy(new Error('Telegram request timed out'));
  });
  request.once('error', fail);
  request.end();
});

const getTelegramConfig = () => {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const userId = process.env.TELEGRAM_USER_ID?.trim();
  const proxyUrl = process.env.TELEGRAM_PROXY_URL?.trim() || null;
  const requestedLimit = Number(process.env.TELEGRAM_GIFT_LIMIT || 6);
  const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 6) : 6;

  if (!token || !userId || !/^-?\d+$/.test(userId)) return null;
  return { token, userId, limit, proxyUrl };
};

const telegramRequest = async (config, method, params) => {
  const url = new URL(`https://api.telegram.org/bot${config.token}/${method}`);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }

  const response = await requestTelegramUrl(
    url,
    config.proxyUrl,
    MAX_TELEGRAM_JSON_BYTES,
    'application/json'
  );

  let payload;
  try {
    payload = JSON.parse(response.body.toString('utf8'));
  } catch {
    throw new Error('Telegram returned invalid JSON');
  }

  if (response.status < 200 || response.status >= 300 || !payload.ok) {
    const error = new Error(payload.description || `Telegram returned HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return payload.result;
};

export const normalizeGifts = (ownedGifts, limit = 6) => {
  if (!Array.isArray(ownedGifts)) return [];

  return ownedGifts.flatMap((ownedGift, index) => {
    const unique = ownedGift?.type === 'unique';
    const gift = ownedGift?.gift;
    const sticker = unique ? gift?.model?.sticker : gift?.sticker;
    const thumbnail = sticker?.thumbnail;

    if (!thumbnail?.file_id) return [];

    return [{
      id: `${sticker.file_unique_id || gift?.id || 'gift'}-${index}`,
      fileId: thumbnail.file_id,
      type: unique ? 'unique' : 'regular',
      name: unique ? gift?.base_name || null : null,
      link: unique && gift?.name ? `https://t.me/nft/${encodeURIComponent(gift.name)}` : null
    }];
  }).slice(0, limit);
};

const loadGifts = async () => {
  const config = getTelegramConfig();
  if (!config) {
    const error = new Error('Telegram integration is not configured');
    error.code = 'TELEGRAM_NOT_CONFIGURED';
    throw error;
  }

  const now = Date.now();
  if (giftCache.payload && giftCache.expiresAt > now) return giftCache.payload;
  if (giftCache.pending) return giftCache.pending;

  giftCache.pending = (async () => {
    const result = await telegramRequest(config, 'getUserGifts', {
      user_id: config.userId,
      limit: config.limit
    });
    const normalizedGifts = normalizeGifts(result.gifts, config.limit);

    const gifts = normalizedGifts.map(({ fileId, ...gift }) => {
      const mediaKey = createHash('sha256').update(fileId).digest('hex').slice(0, 24);
      mediaRegistry.set(mediaKey, fileId);
      return { ...gift, image: `/api/gifts/media/${mediaKey}` };
    });

    const payload = {
      configured: true,
      gifts,
      totalCount: result.total_count,
      fetchedAt: new Date().toISOString()
    };

    giftCache.payload = payload;
    giftCache.expiresAt = Date.now() + GIFT_CACHE_TTL;
    return payload;
  })();

  try {
    return await giftCache.pending;
  } finally {
    giftCache.pending = null;
  }
};

const loadMedia = async (mediaKey) => {
  const cached = mediaCache.get(mediaKey);
  if (cached?.expiresAt > Date.now()) return cached;

  if (!mediaRegistry.has(mediaKey)) await loadGifts();
  const fileId = mediaRegistry.get(mediaKey);
  const config = getTelegramConfig();
  if (!fileId || !config) return null;

  const file = await telegramRequest(config, 'getFile', { file_id: fileId });
  const fileUrl = `https://api.telegram.org/file/bot${config.token}/${file.file_path}`;
  const response = await requestTelegramUrl(fileUrl, config.proxyUrl, MAX_MEDIA_BYTES, 'image/*');

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Telegram media returned HTTP ${response.status}`);
  }

  const buffer = response.body;
  if (buffer.byteLength > MAX_MEDIA_BYTES) throw new Error('Telegram media is too large');

  const responseContentType = response.headers['content-type'];
  const contentType = Array.isArray(responseContentType) ? responseContentType[0] : responseContentType;

  const entry = {
    body: buffer,
    contentType: contentType || 'image/webp',
    expiresAt: Date.now() + MEDIA_CACHE_TTL
  };

  mediaCache.set(mediaKey, entry);
  return entry;
};

const serveStatic = async (requestPath, response, headOnly = false) => {
  const publicPath = requestPath === '/' ? '/index.html' : requestPath;
  const decodedPath = decodeURIComponent(publicPath);
  const safePath = normalize(decodedPath).replace(/^([/\\])+/, '');
  const isPublicAsset = safePath === 'index.html'
    || safePath === 'styles.css'
    || safePath === 'script.js'
    || /^assets[/\\][^/\\]+\.(?:jpg|png|svg|webp)$/.test(safePath);

  if (!isPublicAsset) return false;

  const filePath = join(ROOT, safePath);
  const fileStat = await stat(filePath).catch(() => null);
  if (!fileStat?.isFile()) return false;

  const contentType = MIME_TYPES.get(extname(filePath).toLowerCase()) || 'application/octet-stream';
  response.writeHead(200, {
    'Cache-Control': safePath === 'index.html' ? 'no-cache' : 'public, max-age=3600',
    'Content-Length': fileStat.size,
    'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; script-src 'self'; style-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    'Content-Type': contentType,
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY'
  });
  if (headOnly) response.end();
  else createReadStream(filePath).pipe(response);
  return true;
};

export const createApp = () => createServer(async (request, response) => {
  try {
    if (!['GET', 'HEAD'].includes(request.method)) {
      json(response, 405, { error: 'method_not_allowed' });
      return;
    }

    const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);

    if (url.pathname === '/healthz') {
      json(response, 200, { status: 'ok' });
      return;
    }

    if (url.pathname === '/api/gifts') {
      try {
        const payload = await loadGifts();
        json(response, 200, payload, 'public, max-age=60, stale-while-revalidate=240');
      } catch (error) {
        const notConfigured = error.code === 'TELEGRAM_NOT_CONFIGURED';
        if (notConfigured) json(response, 200, { configured: false, gifts: [] });
        else json(response, 502, { error: 'telegram_unavailable' });
      }
      return;
    }

    const mediaMatch = url.pathname.match(/^\/api\/gifts\/media\/([a-f0-9]{24})$/);
    if (mediaMatch) {
      const media = await loadMedia(mediaMatch[1]);
      if (!media) {
        json(response, 404, { error: 'gift_media_not_found' });
        return;
      }

      response.writeHead(200, {
        'Cache-Control': 'public, max-age=3600, immutable',
        'Content-Length': media.body.byteLength,
        'Content-Type': media.contentType,
        'X-Content-Type-Options': 'nosniff'
      });
      response.end(request.method === 'HEAD' ? undefined : media.body);
      return;
    }

    if (await serveStatic(url.pathname, response, request.method === 'HEAD')) return;

    json(response, 404, { error: 'not_found' });
  } catch {
    json(response, 500, { error: 'internal_error' });
  }
});

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  const port = Number(process.env.PORT || DEFAULT_PORT);
  const host = process.env.HOST?.trim() || '127.0.0.1';
  const server = createApp();

  server.listen(port, host, () => {
    process.stdout.write(`mrvasil site: http://${host}:${port}\n`);
  });
}
