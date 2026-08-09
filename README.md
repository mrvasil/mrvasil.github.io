# mrvasil

- [mrvasil.com](https://mrvasil.com)
- [mrvasil.tech](https://mrvasil.tech)
- [mrvasil.ru](https://mrvasil.ru)
- [mrvasil.vercel.app](https://mrvasil.vercel.app)
- [mrvasil.github.io](https://mrvasil.github.io)

One-screen personal contact site. Telegram gifts are fetched at runtime from the official Bot API; the bot token stays server-side.

The previous website is preserved in [`legacy/`](legacy/).

## Portainer Stack

Create a stack from this Git repository and use `docker-compose.yml`. In Portainer, load an env file or add the same variables under **Environment variables**:

```dotenv
TELEGRAM_BOT_TOKEN=123456789:replace_with_bot_token
TELEGRAM_USER_ID=123456789
TELEGRAM_GIFT_LIMIT=6
PORT=8080
```

`TELEGRAM_BOT_TOKEN` and `TELEGRAM_USER_ID` are passed into the container at runtime and are never baked into the image.

## Local development

```bash
cp .env.example .env
npm start
```

Open <http://127.0.0.1:8080>.

## Docker

```bash
docker compose up --build -d
curl http://127.0.0.1:8080/healthz
```

## Verify

```bash
npm test
node --check script.js
node --check server.mjs
```
