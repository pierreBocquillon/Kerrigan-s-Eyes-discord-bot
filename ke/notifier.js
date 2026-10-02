// Events sent by Kerrigan's Eyes (webhooks) -> messages in the configured channel.
const fmt = require('./format')

class Notifier {
  constructor (client, cfg) {
    this.client = client
    this.cfg = cfg
  }

  async channel () {
    if (!this.cfg.channelId) throw new Error('KE_CHANNEL_ID is not set')
    if (!this._channel) {
      const ch = await this.client.channels.fetch(this.cfg.channelId)
      if (!ch || !ch.isTextBased()) throw new Error(`KE_CHANNEL_ID ${this.cfg.channelId} is not a text channel`)
      this._channel = ch
    }
    return this._channel
  }

  async send (payload) {
    return (await this.channel()).send({ allowedMentions: { parse: [] }, ...payload })
  }

  /** Handles one event; throws when a message could not be posted (KE will send the event again). */
  async handle (event, data = {}) {
    if (event === 'lab.recap') {
      if (!data.state) return false
      for (const msg of fmt.recapMessages(this.cfg, data.state, data.schedule)) await this.send(msg)
      return true
    }
    const text = fmt.eventText(this.cfg, event, data)
    if (!text) return false // unknown event (newer KE version): ignored
    await this.send({ content: text })
    return true
  }
}

module.exports = { Notifier }
