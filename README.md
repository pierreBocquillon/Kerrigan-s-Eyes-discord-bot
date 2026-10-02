# Kerrigan's Eyes — Discord bot

[![License: PolyForm Noncommercial 1.0.0](https://img.shields.io/badge/license-PolyForm%20Noncommercial%201.0.0-8b5cf6)](LICENSE)

Discord bot for **Kerrigan's Eyes**. The integration is optional: it is only enabled when `KE_URL` is set in `.env`
(otherwise the bot signs in but has no command).

## Notifications (webhooks)

Kerrigan's Eyes **calls the bot** when something happens: no polling, no useless request.
The bot receives the events on `POST /webhooks/ke` (port `PORT`, path `KE_WEBHOOK_PATH`) and posts them in the `KE_CHANNEL_ID` channel:

| KE event | Message |
|---|---|
| `session.started` / `session.resumed` / `session.stopped` | ▶️ "A duel has just been started: **Duel name**" (same for resumed / stopped) |
| `session.ended` | ✅ "A training has just finished: **Name**" (⚠️ with the number of failed games) |
| `session.processed` | 🔬 "Analyses and 2D renders done for the duel **Name**" |
| `bot.added` / `bot.version_added` | 🤖 "A new bot has just been added: **Name**" / 🆕 new version |
| `map.added` | 🗺️ "A new map has just been added: **Name**" |
| `lab.recap` (recap scheduled in KE: days + times, e.g. Saturday 17:30 and Monday 09:00, or every day) | 🗞️ a "Lab status" message, then one card per session (running ones + the last 5 finished) |
| `ping` (*Test* button in KE) | 🔗 Webhook connected |

Every call is signed (`X-KE-Signature` = HMAC-SHA256 of `timestamp.body` with the secret): the bot refuses
any unsigned or too old call (> 5 min). When Discord fails, the bot answers an error and KE retries.

## Commands

- `/status` — running games, analyses and 2D renders (running / waiting), CPU, RAM, games per hour.
- `/sessions` (same as `/campaigns`) — one card per session: status, progress, finished / failed / running / queued games,
  5 cards per message (several messages when needed). Options: `filter`, `limit`, `id`.

These commands read the KE API when they are run, with the `KE_USERNAME` account (a **guest** account is enough).

## Setup

1. `.env` (see `.env.example`): `KE_URL`, `KE_PUBLIC_URL`, `KE_USERNAME`, `KE_PASSWORD`, `KE_CHANNEL_ID`.
2. Start the bot: `docker compose up --build -d`. Its `PORT` must be reachable from the KE server.
3. In KE: **Settings > Webhooks > Add a webhook**, URL `http(s)://<bot address>:<PORT>/webhooks/ke`
   (or the bot's root URL with `KE_WEBHOOK_PATH=/`).
4. Copy the secret shown by KE into `KE_WEBHOOK_SECRET` (`.env`), then restart the bot.
5. **Test** button (▶) in KE: the "webhook connected" message must show up in the channel.

When the bot and KE run on the same machine with Docker, the URL can be `http://host.docker.internal:<PORT>/webhooks/ke`
(or the bot container name when both are on the same Docker network).

## License

© 2026 T&T. All rights reserved. Licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE) (the same as Kerrigan's Eyes):
you may use, modify and share this software **for any noncommercial purpose**. **Commercial use requires a separate license from T&T.**
