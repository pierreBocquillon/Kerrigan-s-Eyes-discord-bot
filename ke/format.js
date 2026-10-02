// Mise en forme Discord (embeds, boutons) des données de Kerrigan's Eyes.
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js')

const COLORS = {
  brand: 0x8b5cf6, start: 0x3b82f6, end: 0x22c55e, warn: 0xf59e0b, stop: 0x64748b,
  bot: 0xa855f7, map: 0x14b8a6, error: 0xef4444, ok: 0x22c55e
}

const STATUS = {
  running: { icon: '▶️', label: 'En cours', color: COLORS.start },
  paused: { icon: '⏸️', label: 'En pause', color: COLORS.stop },
  stopped: { icon: '⏹️', label: 'Arrêtée', color: COLORS.stop },
  completed: { icon: '✅', label: 'Terminée', color: COLORS.end },
  completed_with_errors: { icon: '⚠️', label: 'Terminée avec erreurs', color: COLORS.warn }
}
const MODES = { training: { icon: '🧪', label: 'Training' }, duel: { icon: '⚖️', label: 'Duel' }, battle: { icon: '🏆', label: 'Battle' } }
const RACES = {
  t: '🔵 Terran', z: '🟣 Zerg', p: '🟡 Protoss', r: '🎲 Random',
  terran: '🔵 Terran', zerg: '🟣 Zerg', protoss: '🟡 Protoss', random: '🎲 Random'
}

const st = s => STATUS[s] || { icon: '•', label: s || '?', color: COLORS.brand }
const md = m => MODES[m || 'training'] || { icon: '•', label: m }
const statusLabel = s => `${st(s).icon} ${st(s).label}`
const isEnded = s => s === 'completed' || s === 'completed_with_errors'
const num = n => Number(n || 0).toLocaleString('fr-FR')
const isHttp = u => /^https?:\/\//.test(u || '')

function parseIso (iso) {
  if (!iso) return NaN
  return Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`)
}

function ts (iso, style = 'R') {
  const t = parseIso(iso)
  return Number.isNaN(t) ? '—' : `<t:${Math.floor(t / 1000)}:${style}>`
}

function duration (fromIso, toIso) {
  const ms = parseIso(toIso) - parseIso(fromIso)
  if (!(ms > 0)) return '—'
  const m = Math.round(ms / 60000)
  const d = Math.floor(m / 1440)
  const h = Math.floor((m % 1440) / 60)
  return [d ? `${d} j` : '', h ? `${h} h` : '', `${m % 60} min`].filter(Boolean).slice(0, 2).join(' ')
}

/** ▰▰▰▰▰▱▱▱▱▱ */
function bar (pct, width = 12) {
  const n = Math.max(0, Math.min(width, Math.round((pct / 100) * width)))
  return '▰'.repeat(n) + '▱'.repeat(width - n)
}

function level (pct) {
  if (pct == null) return '⚪'
  return pct >= 90 ? '🔴' : pct >= 70 ? '🟠' : '🟢'
}

const running = e => (e.running_games || 0) + (e.finishing_games || 0)
const done = e => (e.completed_games || 0) + (e.failed_games || 0)
const percent = e => (e.total_games ? Math.floor((100 * done(e)) / e.total_games) : 0)

function subjects (e) {
  if (e.mode === 'battle') return `${e.bots_count} bots en round-robin`
  if (e.mode === 'duel') return `**${e.subject_name}** vs **${e.subject2_name || '?'}**`
  const n = Math.max(0, (e.bots_count || 1) - 1)
  return `**${e.subject_name}** vs ${n} adversaire${n > 1 ? 's' : ''}`
}

function runUrl (cfg, id) {
  return isHttp(cfg.publicUrl) ? `${cfg.publicUrl}/campaign/${id}` : null
}

/** Embed avec l'en-tête Kerrigan's Eyes (logo + lien). */
function base (cfg, color, authorSuffix = '') {
  const e = new EmbedBuilder().setColor(color).setTimestamp(new Date())
  const author = { name: `Kerrigan's Eyes${authorSuffix ? ` · ${authorSuffix}` : ''}` }
  if (isHttp(cfg.publicUrl)) {
    author.url = cfg.publicUrl
    author.iconURL = `${cfg.publicUrl}/apple-touch-icon.png`
  }
  return e.setAuthor(author)
}

/** Bouton "Ouvrir dans KE" (aucun si KE_PUBLIC_URL n'est pas une adresse http(s)). */
function linkRows (cfg, id) {
  const url = runUrl(cfg, id)
  if (!url) return []
  return [new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel('Ouvrir dans KE').setEmoji('🔗').setStyle(ButtonStyle.Link).setURL(url))]
}

// ---------------------------------------------------------------- sessions

const KIND_TITLES = {
  start: 'Session lancée',
  resume: 'Session reprise',
  stop: 'Session arrêtée',
  end: 'Session terminée',
  info: 'Session'
}

function sessionEmbed (cfg, e, kind) {
  const s = st(e.status)
  const color = kind === 'start' || kind === 'resume' ? COLORS.start : kind === 'stop' ? COLORS.stop : s.color
  const icon = { start: '▶️', resume: '🔁', stop: '⏹️', end: s.icon, info: s.icon }[kind]
  const m = md(e.mode)
  const embed = base(cfg, color, `${icon} ${kind === 'end' && e.status === 'completed_with_errors' ? 'Session terminée avec erreurs' : KIND_TITLES[kind]}`)
    .setTitle(e.name.slice(0, 256))
    .setDescription(`${m.icon} ${m.label} · ${subjects(e)}\n**${s.icon} ${s.label}**`)
  const url = runUrl(cfg, e.id)
  if (url) embed.setURL(url)

  embed.addFields({
    name: 'Avancement',
    value: `\`\`\`\n${bar(percent(e), 20)}  ${percent(e)} %\n${num(done(e))} / ${num(e.total_games)} games\n\`\`\``
  })
  embed.addFields(
    { name: '✅ Finies', value: `**${num(e.completed_games)}**`, inline: true },
    { name: '❌ Échecs', value: `**${num(e.failed_games)}**`, inline: true },
    { name: '▶️ En cours', value: `**${num(running(e))}**`, inline: true }
  )
  if (kind === 'end' || kind === 'info' && isEnded(e.status)) {
    const post = (n, label) => (n ? `**${num(n)}** en attente` : `✔︎ ${label}`)
    embed.addFields(
      { name: '🔬 Analyses', value: post(e.analysing_games, `${num(e.reports_done)} faites`), inline: true },
      { name: '🎬 Rendus 2D', value: post(e.rendering_games, `${num(e.movies_done)} faits`), inline: true },
      { name: '⏱️ Durée', value: duration(e.created_at, e.finished_at), inline: true }
    )
    if (e.post_failed_games) embed.setDescription(`${embed.data.description}\n⚠️ ${num(e.post_failed_games)} analyse(s) / rendu(s) en échec`)
  } else {
    const rate = e.throughput && e.throughput.per_hour != null ? `**${e.throughput.per_hour}** g/h` : '—'
    const round = e.rounds_total > 1 ? `**${e.round_current || e.rounds_total}** / ${e.rounds_total}` : null
    embed.addFields(
      { name: '⏳ En file', value: `**${num(e.queued_games)}**`, inline: true },
      round ? { name: '🔁 Round', value: round, inline: true } : { name: '🕒 Créée', value: ts(e.created_at), inline: true },
      { name: '⚡ Débit', value: rate, inline: true }
    )
  }
  return embed.setFooter({ text: `Session #${e.id} · ${m.label}` })
}

function processedEmbed (cfg, e) {
  const embed = base(cfg, COLORS.end, '🔬 Post-traitement terminé')
    .setTitle(e.name.slice(0, 256))
  if (runUrl(cfg, e.id)) embed.setURL(runUrl(cfg, e.id))
  return embed
    .addFields(
      { name: '🔬 Analyses', value: `**${num(e.reports_done)}**`, inline: true },
      { name: '🎬 Rendus 2D', value: `**${num(e.movies_done)}**`, inline: true },
      { name: '❌ Échecs', value: `**${num(e.post_failed_games)}**`, inline: true }
    )
    .setFooter({ text: `Session #${e.id} · ${md(e.mode).label}` })
}

// ---------------------------------------------------------------- bots, maps, ping

function botEmbed (cfg, b, isVersion) {
  const name = b.display || b.name
  const race = RACES[String(b.race || '').toLowerCase()] || String(b.race || '?')
  const embed = base(cfg, COLORS.bot, isVersion ? '🆕 Nouvelle version' : '🤖 Nouveau bot')
    .setTitle(name.slice(0, 256))
    .addFields({ name: 'Race', value: race, inline: true })
  if (b.bot_type === 'computer') {
    embed.addFields({ name: 'Type', value: 'IA intégrée', inline: true }, { name: 'Niveau', value: `${b.difficulty || '?'}${b.ai_build && b.ai_build !== 'RandomBuild' ? ` · ${b.ai_build}` : ''}`, inline: true })
  } else {
    embed.addFields({ name: 'Type', value: `\`${b.bot_type || '?'}\``, inline: true }, { name: 'Version', value: `\`${b.version || '—'}\``, inline: true })
  }
  if (isVersion) embed.setDescription(`${b.versions || '?'}ᵉ version de **${b.name}**`)
  if (isHttp(cfg.publicUrl)) embed.setURL(`${cfg.publicUrl}/bots`)
  return embed
}

function mapEmbed (cfg, m) {
  const embed = base(cfg, COLORS.map, '🗺️ Nouvelle map').setTitle(m.name.slice(0, 256))
  if (m.filename) embed.setDescription(`\`${m.filename}\``)
  if (isHttp(cfg.publicUrl)) embed.setURL(`${cfg.publicUrl}/maps`)
  return embed
}

function pingEmbed (cfg) {
  return base(cfg, COLORS.ok, '🔗 Webhook connecté')
    .setDescription('Les évènements du labo arriveront dans ce salon.')
}

// ---------------------------------------------------------------- statut, liste, récap

function statusEmbed (cfg, s, authorSuffix = '📊 État du labo') {
  const exps = s.experiments || []
  const sum = k => exps.reduce((n, e) => n + (e[k] || 0), 0)
  const auto = s.auto || {}
  const rep = (s.post && s.post.reports) || {}
  const mov = (s.post && s.post.movies) || {}
  const len = v => (Array.isArray(v) ? v.length : 0)
  const cpu = auto.cpu_percent == null ? null : Math.round(auto.cpu_percent)
  const memUsed = auto.mem_total != null && auto.mem_available != null ? auto.mem_total - auto.mem_available : null
  const mem = memUsed != null && auto.mem_total ? Math.round((100 * memUsed) / auto.mem_total) : null
  const gb = b => (b == null ? '?' : (b / 1024 ** 3).toFixed(1))
  const active = exps.filter(e => e.status === 'running')
  const queued = active.reduce((n, e) => n + (e.queued_games || 0), 0)
  const worst = Math.max(cpu ?? 0, mem ?? 0)

  const pad = (t, n) => String(t).padStart(n)
  const machine = [
    `CPU  ${bar(cpu ?? 0)} ${cpu == null ? '  …' : pad(cpu, 3) + ' %'}${auto.cpus ? `  ${auto.cpus} cœurs` : ''}`,
    `RAM  ${bar(mem ?? 0)} ${mem == null ? '  …' : pad(mem, 3) + ' %'}  ${gb(memUsed)} / ${gb(auto.mem_total)} Go`
  ].join('\n')

  const embed = base(cfg, worst >= 90 ? COLORS.error : worst >= 70 ? COLORS.warn : COLORS.brand, authorSuffix)
    .addFields(
      { name: '🎮 Games', value: `**${num(sum('running_games'))}** en cours${sum('finishing_games') ? `\n+${num(sum('finishing_games'))} en finition` : ''}`, inline: true },
      { name: '⏳ En file', value: `**${num(queued)}**\nmax ${s.max_parallel_matches ?? '?'} en parallèle`, inline: true },
      { name: '⚡ Débit', value: s.throughput && s.throughput.per_hour != null ? `**${s.throughput.per_hour}** games/h` : '—', inline: true },
      { name: '🔬 Analyses', value: `**${len(rep.running)}** en cours\n${num(rep.pending)} en attente`, inline: true },
      { name: '🎬 Rendus 2D', value: `**${len(mov.running)}** en cours\n${num(mov.pending)} en attente`, inline: true },
      { name: '📋 Sessions', value: `**${active.length}** en cours\n${exps.filter(e => e.status === 'paused').length} en pause`, inline: true },
      { name: `${level(worst)} Machine`, value: `\`\`\`\n${machine}\n\`\`\`` }
    )
  const notes = []
  if (auto.auto_status) notes.push(`*${auto.auto_status}*`)
  if (s.docker && s.docker.ok === false) notes.push('⚠️ Docker injoignable depuis KE')
  if (s.reset && s.reset.running) notes.push('⚠️ Réinitialisation du labo en cours')
  if (notes.length) embed.setDescription(notes.join('\n'))
  return embed
}

const FILTERS = {
  all: () => true,
  active: e => e.status === 'running' || e.status === 'paused',
  running: e => e.status === 'running',
  paused: e => e.status === 'paused' || e.status === 'stopped',
  ended: e => isEnded(e.status)
}

function sessionField (cfg, e) {
  const s = st(e.status)
  const m = md(e.mode)
  const url = runUrl(cfg, e.id)
  const rate = e.status === 'running' && e.throughput && e.throughput.per_hour != null ? ` · ⚡ ${e.throughput.per_hour} g/h` : ''
  const counts = [`✅ **${num(e.completed_games)}**`]
  if (e.failed_games) counts.push(`❌ **${num(e.failed_games)}**`)
  if (running(e)) counts.push(`▶️ **${num(running(e))}**`)
  if (e.queued_games) counts.push(`⏳ **${num(e.queued_games)}**`)
  return {
    name: `${s.icon} ${e.name}`.slice(0, 256),
    value: [
      `\`${bar(percent(e), 14)} ${String(percent(e)).padStart(3)} %\` ${m.icon} ${m.label}${rate}`,
      `${counts.join(' · ')} *sur ${num(e.total_games)}*${url ? ` · [#${e.id}](${url})` : ` · #${e.id}`}`
    ].join('\n').slice(0, 1024)
  }
}

function sessionsEmbed (cfg, s, filter = 'all', limit = 10, authorSuffix = '📋 Sessions') {
  const all = s.experiments || []
  const list = all.filter(FILTERS[filter] || FILTERS.all)
  // les sessions actives d'abord, puis les plus récentes
  const order = e => (e.status === 'running' ? 0 : e.status === 'paused' ? 1 : 2)
  const shown = [...list].sort((a, b) => order(a) - order(b) || b.id - a.id).slice(0, Math.min(limit, 25))
  const counts = Object.keys(STATUS)
    .map(k => [STATUS[k], all.filter(e => e.status === k).length])
    .filter(([, n]) => n).map(([v, n]) => `${v.icon} ${n} ${v.label.toLowerCase()}`).join('  ·  ')
  // authorSuffix null : pas d'en-tête (2e embed du récap), juste un titre
  const embed = (authorSuffix === null ? new EmbedBuilder().setColor(COLORS.brand).setTitle('📋 Sessions') : base(cfg, COLORS.brand, authorSuffix))
    .setFooter({ text: counts || 'Aucune session' })
  if (!shown.length) return embed.setDescription('*Aucune session.*')
  embed.addFields(shown.map(e => sessionField(cfg, e)))
  if (list.length > shown.length) embed.setDescription(`*${shown.length} sur ${list.length} affichées*`)
  return embed
}

const DAYS_FR = { daily: 'tous les jours', mon: 'lun.', tue: 'mar.', wed: 'mer.', thu: 'jeu.', fri: 'ven.', sat: 'sam.', sun: 'dim.' }

/** "lun. 09:00 · sam. 17:30" (au-delà de 3 horaires : "5 horaires") */
function scheduleLabel (schedule) {
  const list = Array.isArray(schedule) ? schedule : []
  if (!list.length) return ''
  if (list.length > 3) return `${list.length} horaires`
  return list.map(sl => `${DAYS_FR[sl.day] || sl.day} ${String(sl.time).replace(':', 'h')}`).join(' · ')
}

/** Récap planifié : statut + sessions, dans un seul message. */
function recapEmbeds (cfg, state, schedule) {
  const label = scheduleLabel(schedule)
  const title = `🗞️ Récap${label ? ` · ${label}` : ''}`
  const status = statusEmbed(cfg, state, title)
  const sessions = sessionsEmbed(cfg, state, 'all', 8, null).setTimestamp(new Date())
  return [status, sessions]
}

module.exports = {
  COLORS, STATUS, isEnded, statusLabel, linkRows, sessionEmbed, processedEmbed, botEmbed, mapEmbed, pingEmbed,
  statusEmbed, sessionsEmbed, recapEmbeds
}
