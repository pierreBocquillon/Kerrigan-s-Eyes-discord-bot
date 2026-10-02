// Receiver of the Kerrigan's Eyes webhooks: signed JSON POST (HMAC-SHA256 of "<timestamp>.<body>").
const crypto = require('crypto')
const express = require('express')

const MAX_SKEW_SECONDS = 5 * 60

function verify (secret, req) {
  const ts = req.get('x-ke-timestamp') || ''
  const sig = req.get('x-ke-signature') || ''
  if (!/^\d+$/.test(ts) || Math.abs(Date.now() / 1000 - Number(ts)) > MAX_SKEW_SECONDS) return false
  const want = 'sha256=' + crypto.createHmac('sha256', secret).update(`${ts}.`).update(req.body).digest('hex')
  const a = Buffer.from(sig)
  const b = Buffer.from(want)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

function mountWebhook (app, cfg, notifier) {
  const seen = new Set() // deliveries already handled (KE sends the same id when it retries)
  app.post(cfg.webhookPath, express.raw({ type: '*/*', limit: '1mb' }), async (req, res) => {
    if (!cfg.webhookSecret) return res.status(503).json({ error: 'KE_WEBHOOK_SECRET is not set on the bot' })
    if (!Buffer.isBuffer(req.body) || !verify(cfg.webhookSecret, req)) return res.status(401).json({ error: 'invalid signature' })
    let payload
    try {
      payload = JSON.parse(req.body.toString('utf8'))
    } catch {
      return res.status(400).json({ error: 'invalid JSON' })
    }
    const id = req.get('x-ke-delivery') || payload.id
    if (id && seen.has(id)) return res.json({ ok: true, duplicate: true })
    try {
      const handled = await notifier.handle(payload.event, payload.data)
      if (id) {
        seen.add(id)
        if (seen.size > 1000) seen.delete(seen.values().next().value)
      }
      console.log(`[KE] webhook ${payload.event}${handled ? '' : ' (ignored)'}`)
      res.json({ ok: true, handled })
    } catch (err) {
      console.error(`[KE] webhook ${payload.event}: ${err.message}`)
      res.status(502).json({ error: err.message }) // KE will retry
    }
  })
}

module.exports = { mountWebhook, verify }
