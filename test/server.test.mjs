import assert from 'node:assert/strict';
import test from 'node:test';

import { createApp, normalizeGifts } from '../server.mjs';

test('normalizes Telegram regular and unique gift thumbnails', () => {
  const gifts = normalizeGifts([
    {
      type: 'regular',
      gift: {
        id: 'regular-1',
        sticker: {
          file_unique_id: 'regular-file',
          thumbnail: { file_id: 'regular-thumbnail' }
        }
      }
    },
    {
      type: 'unique',
      gift: {
        base_name: 'Heart Key',
        name: 'HeartKey-169983',
        model: {
          sticker: {
            file_unique_id: 'unique-file',
            thumbnail: { file_id: 'unique-thumbnail' }
          }
        }
      }
    }
  ]);

  assert.deepEqual(gifts, [
    {
      id: 'regular-file-0',
      fileId: 'regular-thumbnail',
      type: 'regular',
      name: null,
      link: null
    },
    {
      id: 'unique-file-1',
      fileId: 'unique-thumbnail',
      type: 'unique',
      name: 'Heart Key',
      link: 'https://t.me/nft/HeartKey-169983'
    }
  ]);
});

test('skips gifts without a static Telegram thumbnail and respects the limit', () => {
  const gifts = normalizeGifts([
    { type: 'regular', gift: { id: 'missing-thumbnail', sticker: {} } },
    {
      type: 'regular',
      gift: {
        id: 'visible',
        sticker: { file_unique_id: 'visible-file', thumbnail: { file_id: 'visible-thumb' } }
      }
    }
  ], 1);

  assert.equal(gifts.length, 1);
  assert.equal(gifts[0].fileId, 'visible-thumb');
});

test('returns an empty successful payload when Telegram is not configured', async (context) => {
  const previousToken = process.env.TELEGRAM_BOT_TOKEN;
  const previousUserId = process.env.TELEGRAM_USER_ID;
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.TELEGRAM_USER_ID;

  const server = createApp();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  context.after(() => {
    server.close();
    if (previousToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
    else process.env.TELEGRAM_BOT_TOKEN = previousToken;
    if (previousUserId === undefined) delete process.env.TELEGRAM_USER_ID;
    else process.env.TELEGRAM_USER_ID = previousUserId;
  });

  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/api/gifts`);
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(payload, { configured: false, gifts: [] });
});

test('exposes a container health endpoint', async (context) => {
  const server = createApp();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  context.after(() => server.close());

  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/healthz`);
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(payload, { status: 'ok' });
});
