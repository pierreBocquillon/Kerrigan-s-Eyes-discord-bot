// Évènements envoyés par Kerrigan's Eyes (webhooks) -> messages dans le salon configuré.
const fmt = require('./format')

class Notifier {
  constructor (client, cfg) {
    this.client = client
    this.cfg = cfg
  }

  async channel () {
    if (!this.cfg.channelId) throw new Error('KE_CHANNEL_ID non défini')
    if (!this._channel) {
      const ch = await this.client.channels.fetch(this.cfg.channelId)
      if (!ch || !ch.isTextBased()) throw new Error(`KE_CHANNEL_ID ${this.cfg.channelId} n'est pas un salon textuel`)
      this._channel = ch
    }
    return this._channel
  }

  async send (payload) {
    return (await this.channel()).send({ allowedMentions: { parse: [] }, ...payload })
  }

  /** Traite un évènement ; lève une erreur si un message n'a pas pu être posté (KE renverra l'évènement). */
  async handle (event, data = {}) {
    if (event === 'lab.recap') {
      if (!data.state) return false
      for (const msg of fmt.recapMessages(this.cfg, data.state, data.schedule)) await this.send(msg)
      return true
    }
    const text = fmt.eventText(this.cfg, event, data)
    if (!text) return false // évènement inconnu (version plus récente de KE) : ignoré
    await this.send({ content: text })
    return true
  }
}

module.exports = { Notifier }
