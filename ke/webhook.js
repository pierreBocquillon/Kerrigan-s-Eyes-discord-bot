// Récepteur des webhooks de Kerrigan's Eyes : POST JSON signé (HMAC-SHA256 de "<timestamp>.<corps>").
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
  const seen = new Set() // livraisons déjà traitées (KE renvoie le même id en cas de nouvel essai)
  app.post(cfg.webhookPath, express.raw({ type: '*/*', limit: '1mb' }), async (req, res) => {
    if (!cfg.webhookSecret) return res.status(503).json({ error: 'KE_WEBHOOK_SECRET non configuré sur le bot' })
    if (!Buffer.isBuffer(req.body) || !verify(cfg.webhookSecret, req)) return res.status(401).json({ error: 'signature invalide' })
    let payload
    try {
      payload = JSON.parse(req.body.toString('utf8'))
    } catch {
      return res.status(400).json({ error: 'JSON invalide' })
    }
    const id = req.get('x-ke-delivery') || payload.id
    if (id && seen.has(id)) return res.json({ ok: true, duplicate: true })
    try {
      const handled = await notifier.handle(payload.event, payload.data)
      if (id) {
        seen.add(id)
        if (seen.size > 1000) seen.delete(seen.values().next().value)
      }
      console.log(`[KE] webhook ${payload.event}${handled ? '' : ' (ignoré)'}`)
      res.json({ ok: true, handled })
    } catch (err) {
      console.error(`[KE] webhook ${payload.event} : ${err.message}`)
      res.status(502).json({ error: err.message }) // KE réessaiera
    }
  })
}

module.exports = { mountWebhook, verify }
