// Évènements envoyés par Kerrigan's Eyes (webhooks) -> messages dans le salon configuré.
const fs = require('fs')
const path = require('path')
const { EmbedBuilder } = require('discord.js')
const fmt = require('./format')

const KINDS = { 'session.started': 'start', 'session.resumed': 'resume', 'session.stopped': 'stop' }

class Notifier {
  constructor (client, cfg) {
    this.client = client
    this.cfg = cfg
    this.messages = this._load() // id de session -> message "terminée" (mis à jour au post-traitement)
  }

  _load () {
    try {
      return JSON.parse(fs.readFileSync(this.cfg.stateFile, 'utf8')) || {}
    } catch {
      return {}
    }
  }

  _save () {
    try {
      const ids = Object.keys(this.messages)
      for (const id of ids.slice(0, Math.max(0, ids.length - 200))) delete this.messages[id] // garde les 200 dernières
      fs.mkdirSync(path.dirname(this.cfg.stateFile), { recursive: true })
      const tmp = `${this.cfg.stateFile}.tmp`
      fs.writeFileSync(tmp, JSON.stringify(this.messages))
      fs.renameSync(tmp, this.cfg.stateFile)
    } catch (err) {
      console.error('[KE] impossible d\'écrire l\'état :', err.message)
    }
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
    return (await this.channel()).send(payload)
  }

  /** Traite un évènement ; lève une erreur si le message n'a pas pu être posté (KE renverra l'évènement). */
  async handle (event, data = {}) {
    const s = data.session
    switch (event) {
      case 'ping':
        await this.send({ embeds: [new EmbedBuilder().setColor(fmt.COLORS.end).setTitle('🔗 Webhook Kerrigan\'s Eyes connecté').setDescription('Les évènements du labo arriveront dans ce salon.').setTimestamp(new Date())] })
        return true
      case 'session.started':
      case 'session.resumed':
      case 'session.stopped':
        if (!s) return false
        if (event !== 'session.stopped') delete this.messages[s.id]
        await this.send({ embeds: [fmt.sessionEmbed(this.cfg, s, KINDS[event])], components: fmt.linkRows(this.cfg, s.id) })
        return true
      case 'session.ended': {
        if (!s) return false
        const msg = await this.send({ embeds: [fmt.sessionEmbed(this.cfg, s, 'end')], components: fmt.linkRows(this.cfg, s.id) })
        this.messages[s.id] = { channelId: msg.channelId, messageId: msg.id }
        this._save()
        return true
      }
      case 'session.processed': {
        if (!s) return false
        const ref = this.messages[s.id]
        if (ref) {
          try {
            const ch = await this.client.channels.fetch(ref.channelId)
            const msg = await ch.messages.fetch(ref.messageId)
            await msg.edit({ embeds: [fmt.sessionEmbed(this.cfg, s, 'end')], components: fmt.linkRows(this.cfg, s.id) })
            return true
          } catch {
            // message supprimé : on en poste un nouveau
          }
        }
        await this.send({
          embeds: [new EmbedBuilder().setColor(fmt.COLORS.end).setTitle(`🔬 Post-traitement terminé — #${s.id} ${s.name}`.slice(0, 256))
            .setDescription(`${s.reports_done} rapport(s) · ${s.movies_done} rendu(s) 2D${s.post_failed_games ? ` · ❌ ${s.post_failed_games} échec(s)` : ''}`)
            .setTimestamp(new Date())],
          components: fmt.linkRows(this.cfg, s.id)
        })
        return true
      }
      case 'bot.added':
      case 'bot.version_added':
        if (!data.bot) return false
        await this.send({ embeds: [fmt.botEmbed({ ...data.bot, family_id: event === 'bot.version_added' ? -1 : data.bot.id })] })
        return true
      case 'map.added':
        if (!data.map) return false
        await this.send({ embeds: [fmt.mapEmbed(data.map)] })
        return true
      default:
        return false // évènement inconnu (version plus récente de KE) : ignoré
    }
  }
}

module.exports = { Notifier }
