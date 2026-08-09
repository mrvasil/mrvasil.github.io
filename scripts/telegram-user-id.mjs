const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
const requestedUsername = (process.env.TELEGRAM_USERNAME || 'mrvasil').replace(/^@/, '').toLowerCase();

if (!token) {
  process.stderr.write('Set TELEGRAM_BOT_TOKEN in .env first.\n');
  process.exit(1);
}

const url = new URL(`https://api.telegram.org/bot${token}/getUpdates`);
url.searchParams.set('limit', '100');
url.searchParams.set('allowed_updates', JSON.stringify(['message']));

const response = await fetch(url, { signal: AbortSignal.timeout(12_000) });
const payload = await response.json();

if (!response.ok || !payload.ok) {
  process.stderr.write(`${payload.description || `Telegram returned HTTP ${response.status}`}\n`);
  process.exit(1);
}

const users = payload.result
  .map((update) => update.message?.from)
  .filter(Boolean);
const user = users.find((candidate) => candidate.username?.toLowerCase() === requestedUsername);

if (!user) {
  process.stderr.write(`No update from @${requestedUsername}. Send /start to your bot and run this command again.\n`);
  process.exit(1);
}

process.stdout.write(`TELEGRAM_USER_ID=${user.id}\n`);
