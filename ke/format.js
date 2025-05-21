// Mise en forme Discord (embeds, boutons) des données de Kerrigan's Eyes.
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js')

const COLORS = { start: 0x3b82f6, end: 0x22c55e, warn: 0xf59e0b, stop: 0x6b7280, bot: 0xa855f7, map: 0x14b8a6, info: 0x7c3aed, error: 0xef4444 }

const STATUS = {
  running: '▶️ En cours',
  paused: '⏸️ En pause',
  stopped: '⏹️ Arrêtée',
  completed: '✅ Terminée',
  completed_with_errors: '⚠️ Terminée avec erreurs'
}
const MODES = { training: '🧪 Training', duel: '⚖️ Duel', battle: '🏆 Battle' }
const RACES = { t: 'Terran', z: 'Zerg', p: 'Protoss', r: 'Random', terran: 'Terran', zerg: 'Zerg', protoss: 'Protoss', random: 'Random' }

const statusLabel = s => STATUS[s] || s
const modeLabel = m => MODES[m || 'training'] || m
const isEnded = s => s === 'completed' || s === 'completed_with_errors'

function ts (iso, style = 'R') {
  if (!iso) return '—'
  const t = Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`)
  return Number.isNaN(t) ? iso : `<t:${Math.floor(t / 1000)}:${style}>`
}

function gb (bytes) {
  return bytes == null ? '?' : `${(bytes / 1024 ** 3).toFixed(1)} Go`
}

function bar (done, total, width = 12) {
  if (!total) return ''
  const n = Math.round((done / total) * width)
  return '█'.repeat(n) + '░'.repeat(width - n)
}

function runningOf (e) {
  return (e.running_games || 0) + (e.finishing_games || 0)
}

/** "155 finished · 2 failed · 5 running · 15 queued" */
function progressLine (e) {
  const parts = [`**${e.completed_games}** finished`]
  if (e.failed_games) parts.push(`**${e.failed_games}** failed`)
  if (runningOf(e)) parts.push(`**${runningOf(e)}** running`)
  if (e.queued_games) parts.push(`**${e.queued_games}** queued`)
  return parts.join(' · ')
}

function percent (e) {
  const done = (e.completed_games || 0) + (e.failed_games || 0)
  return e.total_games ? Math.floor((100 * done) / e.total_games) : 0
}

function subjects (e) {
  if (e.mode === 'battle') return `${e.bots_count} bots`
  if (e.mode === 'duel') return `${e.subject_name} vs ${e.subject2_name || '?'}`
  return `${e.subject_name} vs ${Math.max(0, (e.bots_count || 1) - 1)} adversaire(s)`
}

function runUrl (cfg, id) {
  return cfg.publicUrl ? `${cfg.publicUrl}/campaign/${id}` : null
}

function postLine (e) {
  const parts = []
  if (e.analysing_games) parts.push(`🔬 ${e.analysing_games} analyse(s)`)
  if (e.rendering_games) parts.push(`🎬 ${e.rendering_games} rendu(s) 2D`)
  if (parts.length) return `${parts.join(' · ')} en attente`
  const done = [`🔬 ${e.reports_done || 0} rapport(s)`, `🎬 ${e.movies_done || 0} rendu(s)`]
  if (e.post_failed_games) done.push(`❌ ${e.post_failed_games} échec(s)`)
  return `${done.join(' · ')} — terminé`
}

function sessionEmbed (cfg, e, kind) {
  const title = {
    start: '▶️ Session lancée',
    resume: '▶️ Session reprise',
    end: isEnded(e.status) && e.status === 'completed_with_errors' ? '⚠️ Session terminée (avec erreurs)' : '✅ Session terminée',
    stop: '⏹️ Session arrêtée',
    info: `${statusLabel(e.status)}`
  }[kind]
  const color = { start: COLORS.start, resume: COLORS.start, end: e.status === 'completed_with_errors' ? COLORS.warn : COLORS.end, stop: COLORS.stop, info: COLORS.info }[kind]
  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`${title} — #${e.id} ${e.name}`.slice(0, 256))
    .addFields(
      { name: 'Type', value: modeLabel(e.mode), inline: true },
      { name: 'Bots', value: subjects(e).slice(0, 1024), inline: true },
      { name: 'Statut', value: statusLabel(e.status), inline: true },
      { name: `Avancement — ${percent(e)} % (${e.total_games} games)`, value: `${bar((e.completed_games || 0) + (e.failed_games || 0), e.total_games)}\n${progressLine(e)}` }
    )
  if (e.rounds_total > 1) {
    embed.addFields({ name: 'Rounds', value: `${e.rounds_done}/${e.rounds_total}${e.round_current ? ` (round ${e.round_current} en cours)` : ''}`, inline: true })
  }
  if (e.throughput && e.throughput.per_hour != null && kind !== 'end') {
    embed.addFields({ name: 'Débit', value: `${e.throughput.per_hour} games/h`, inline: true })
  }
  if (kind === 'end' || kind === 'info') {
    embed.addFields({ name: 'Post-traitement', value: postLine(e) })
  }
  embed.addFields({ name: 'Dates', value: `Créée ${ts(e.created_at)}${e.finished_at ? ` · finie ${ts(e.finished_at)}` : ''}` })
  const url = runUrl(cfg, e.id)
  if (url) embed.setURL(url)
  return embed.setTimestamp(new Date())
}

/** Bouton "Ouvrir dans KE" (aucun si KE_PUBLIC_URL n'est pas une adresse http(s)). */
function linkRows (cfg, id) {
  const url = runUrl(cfg, id)
  if (!url || !/^https?:\/\//.test(url)) return []
  return [new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel('Ouvrir dans KE').setStyle(ButtonStyle.Link).setURL(url))]
}

function botEmbed (b) {
  const isVersion = (b.family_id && b.family_id !== b.id) || (b.versions || 1) > 1
  const name = b.display || b.name
  const embed = new EmbedBuilder()
    .setColor(COLORS.bot)
    .setTitle(isVersion ? `🆕 Nouvelle version de bot — ${name}` : `🤖 Nouveau bot — ${name}`)
    .addFields(
      { name: 'Race', value: RACES[String(b.race).toLowerCase()] || String(b.race || '?'), inline: true },
      { name: 'Type', value: b.bot_type === 'computer' ? `IA intégrée (${b.difficulty || '?'}${b.ai_build ? `, ${b.ai_build}` : ''})` : String(b.bot_type || '?'), inline: true }
    )
  if (b.version) embed.addFields({ name: 'Version', value: String(b.version), inline: true })
  if (isVersion) embed.addFields({ name: 'Versions', value: `${b.versions || '?'} au total pour ${b.name}`, inline: true })
  return embed.setTimestamp(new Date())
}

function mapEmbed (m) {
  return new EmbedBuilder()
    .setColor(COLORS.map)
    .setTitle(`🗺️ Nouvelle map — ${m.name}`)
    .setDescription(m.filename ? `\`${m.filename}\`` : null)
    .setTimestamp(new Date())
}

function statusEmbed (cfg, s) {
  const exps = s.experiments || []
  const sum = k => exps.reduce((n, e) => n + (e[k] || 0), 0)
  const auto = s.auto || {}
  const rep = (s.post && s.post.reports) || {}
  const mov = (s.post && s.post.movies) || {}
  const repRunning = Array.isArray(rep.running) ? rep.running.length : 0
  const movRunning = Array.isArray(mov.running) ? mov.running.length : 0
  const memUsed = auto.mem_total != null && auto.mem_available != null ? auto.mem_total - auto.mem_available : null
  const memPct = memUsed != null && auto.mem_total ? Math.round((100 * memUsed) / auto.mem_total) : null
  const active = exps.filter(e => e.status === 'running')
  const queuedActive = active.reduce((n, e) => n + (e.queued_games || 0), 0)

  const embed = new EmbedBuilder()
    .setColor(COLORS.info)
    .setTitle('📊 Kerrigan\'s Eyes — statut')
    .addFields(
      { name: '🎮 Games en cours', value: `**${sum('running_games')}**${sum('finishing_games') ? ` (+${sum('finishing_games')} en finition)` : ''}\n${queuedActive} en file · max ${s.max_parallel_matches ?? '?'}`, inline: true },
      { name: '🔬 Analyses', value: `**${repRunning}** en cours\n${rep.pending ?? 0} en attente`, inline: true },
      { name: '🎬 Rendus 2D', value: `**${movRunning}** en cours\n${mov.pending ?? 0} en attente`, inline: true },
      { name: '🖥️ CPU', value: auto.cpu_percent == null ? 'mesure en cours…' : `**${auto.cpu_percent.toFixed(0)} %**${auto.cpus ? ` (${auto.cpus} cœurs)` : ''}\n${bar(auto.cpu_percent, 100, 10)}`, inline: true },
      { name: '🧠 RAM', value: memUsed == null ? '?' : `**${gb(memUsed)} / ${gb(auto.mem_total)}** (${memPct} %)\n${bar(memPct, 100, 10)}`, inline: true },
      { name: '⚡ Débit', value: s.throughput && s.throughput.per_hour != null ? `${s.throughput.per_hour} games/h` : '—', inline: true },
      { name: '📋 Sessions', value: `${active.length} en cours · ${exps.filter(e => e.status === 'paused').length} en pause · ${exps.length} au total`, inline: false }
    )
  const notes = []
  if (auto.auto_status) notes.push(`Ordonnanceur : ${auto.auto_status}`)
  if (s.docker && s.docker.ok === false) notes.push('⚠️ Docker injoignable depuis KE')
  if (s.reset && s.reset.running) notes.push('⚠️ Réinitialisation du labo en cours')
  if (notes.length) embed.setDescription(notes.join('\n'))
  if (cfg.publicUrl && /^https?:\/\//.test(cfg.publicUrl)) embed.setURL(`${cfg.publicUrl}/overview`)
  return embed.setTimestamp(new Date())
}

const FILTERS = {
  all: () => true,
  active: e => e.status === 'running' || e.status === 'paused',
  running: e => e.status === 'running',
  paused: e => e.status === 'paused' || e.status === 'stopped',
  ended: e => isEnded(e.status)
}

function sessionsEmbed (cfg, s, filter = 'all', limit = 10) {
  const all = s.experiments || []
  const list = all.filter(FILTERS[filter] || FILTERS.all)
  const shown = list.slice(0, limit)
  const lines = shown.map(e => {
    const url = runUrl(cfg, e.id)
    const head = url && /^https?:\/\//.test(url) ? `[#${e.id} · ${e.name}](${url})` : `#${e.id} · ${e.name}`
    const rate = e.status === 'running' && e.throughput && e.throughput.per_hour != null ? ` · ${e.throughput.per_hour} g/h` : ''
    return `**${head}** — ${statusLabel(e.status)} · ${modeLabel(e.mode)}\n` +
      `${bar((e.completed_games || 0) + (e.failed_games || 0), e.total_games, 10)} ${percent(e)} % · ${progressLine(e)} *(/${e.total_games})*${rate}`
  })
  let desc = ''
  for (const l of lines) {
    if (desc.length + l.length + 2 > 3900) { desc += '\n…'; break }
    desc += (desc ? '\n\n' : '') + l
  }
  const counts = Object.entries(STATUS)
    .map(([k, v]) => [v, all.filter(e => e.status === k).length])
    .filter(([, n]) => n).map(([v, n]) => `${v} : ${n}`).join(' · ')
  return new EmbedBuilder()
    .setColor(COLORS.info)
    .setTitle(`📋 Sessions — ${list.length} résultat(s)${list.length > shown.length ? ` (${shown.length} affichées)` : ''}`)
    .setDescription(desc || '*Aucune session.*')
    .setFooter({ text: counts || 'Aucune session' })
    .setTimestamp(new Date())
}

module.exports = {
  COLORS, STATUS, isEnded, statusLabel, sessionEmbed, linkRows, botEmbed, mapEmbed, statusEmbed, sessionsEmbed, progressLine
}
