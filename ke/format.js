// Mise en forme Discord des données de Kerrigan's Eyes.
//  - évènements (session lancée, nouveau bot...) : une phrase simple
//  - /status, /sessions, récap : des cartes aérées, sur plusieurs messages si besoin
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js')

const COLORS = {
  brand: 0x8b5cf6, start: 0x3b82f6, end: 0x22c55e, warn: 0xf59e0b, stop: 0x64748b, error: 0xef4444, ok: 0x22c55e
}

const STATUS = {
  running: { icon: '▶️', label: 'En cours', color: COLORS.start },
  paused: { icon: '⏸️', label: 'En pause', color: COLORS.stop },
  stopped: { icon: '⏹️', label: 'Arrêtée', color: COLORS.stop },
  completed: { icon: '✅', label: 'Terminée', color: COLORS.end },
  completed_with_errors: { icon: '⚠️', label: 'Terminée avec erreurs', color: COLORS.warn }
}
// genre et nom de chaque type de session, pour les phrases ("Un duel vient d'être lancé")
const MODES = {
  training: { icon: '🧪', label: 'Training', noun: 'training', un: 'Un', e: '', le: 'le' },
  duel: { icon: '⚖️', label: 'Duel', noun: 'duel', un: 'Un', e: '', le: 'le' },
  battle: { icon: '🏆', label: 'Battle', noun: 'battle', un: 'Une', e: 'e', le: 'la' }
}
const RACES = { t: 'Terran', z: 'Zerg', p: 'Protoss', r: 'Random', terran: 'Terran', zerg: 'Zerg', protoss: 'Protoss', random: 'Random' }

const st = s => STATUS[s] || { icon: '•', label: s || '?', color: COLORS.brand }
const md = m => MODES[m || 'training'] || { ...MODES.training, icon: '•', label: m, noun: m }
const isEnded = s => s === 'completed' || s === 'completed_with_errors'
const num = n => Number(n || 0).toLocaleString('fr-FR')
const isHttp = u => /^https?:\/\//.test(u || '')
const plural = (n, one, many) => `${num(n)} ${Number(n) > 1 ? many : one}`

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
  if (!(ms > 0)) return null
  const m = Math.round(ms / 60000)
  const d = Math.floor(m / 1440)
  const h = Math.floor((m % 1440) / 60)
  return [d ? `${d} j` : '', h ? `${h} h` : '', m % 60 || (!d && !h) ? `${m % 60} min` : ''].filter(Boolean).slice(0, 2).join(' ')
}

/** ▰▰▰▰▰▱▱▱▱▱ */
function bar (pct, width = 10) {
  const n = Math.max(0, Math.min(width, Math.round(((pct || 0) / 100) * width)))
  return '▰'.repeat(n) + '▱'.repeat(width - n)
}

const level = pct => (pct == null ? '⚪' : pct >= 90 ? '🔴' : pct >= 70 ? '🟠' : '🟢')
const running = e => (e.running_games || 0) + (e.finishing_games || 0)
const done = e => (e.completed_games || 0) + (e.failed_games || 0)
const percent = e => (e.total_games ? Math.floor((100 * done(e)) / e.total_games) : 0)
const runUrl = (cfg, id) => (isHttp(cfg.publicUrl) ? `${cfg.publicUrl}/campaign/${id}` : null)
// lien sans aperçu de site (les chevrons empêchent Discord d'afficher la page de KE sous le message)
const link = (text, url) => (url ? `[${text}](<${url}>)` : text)

/** Bouton "Ouvrir dans KE" (aucun si KE_PUBLIC_URL n'est pas une adresse http(s)). */
function linkRows (cfg, id) {
  const url = runUrl(cfg, id)
  if (!url) return []
  return [new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel('Ouvrir dans KE').setEmoji('🔗').setStyle(ButtonStyle.Link).setURL(url))]
}

// ---------------------------------------------------------------- évènements : une phrase

/** Texte du message pour un évènement de KE (null : évènement inconnu ou incomplet). */
function eventText (cfg, event, data = {}) {
  const s = data.session
  if (event.startsWith('session.') && !s) return null
  const m = s ? md(s.mode) : null
  const name = s ? `**${link(s.name, runUrl(cfg, s.id))}**` : ''
  switch (event) {
    case 'ping':
      return "🔗 Webhook Kerrigan's Eyes connecté : les évènements du labo arriveront dans ce salon."
    case 'session.started':
      return `▶️ ${m.un} ${m.noun} vient d'être lancé${m.e} : ${name}`
    case 'session.resumed':
      return `🔁 ${m.un} ${m.noun} vient de reprendre : ${name}`
    case 'session.stopped':
      return `⏹️ ${m.un} ${m.noun} vient d'être arrêté${m.e} : ${name}`
    case 'session.ended':
      return s.status === 'completed_with_errors'
        ? `⚠️ ${m.un} ${m.noun} vient de se terminer avec des erreurs : ${name} (${plural(s.failed_games, 'game en échec', 'games en échec')})`
        : `✅ ${m.un} ${m.noun} vient de se terminer : ${name}`
    case 'session.processed':
      return `🔬 Analyses et rendus 2D terminés pour ${m.le} ${m.noun} ${name}`
    case 'bot.added': {
      const b = data.bot
      return b ? `🤖 Un nouveau bot vient d'être ajouté : **${b.display || b.name}**` : null
    }
    case 'bot.version_added': {
      const b = data.bot
      return b ? `🆕 Une nouvelle version de **${b.name}** vient d'être ajoutée : **${b.version || b.display}**` : null
    }
    case 'map.added':
      return data.map ? `🗺️ Une nouvelle map vient d'être ajoutée : **${data.map.name}**` : null
    default:
      return null
  }
}

// ---------------------------------------------------------------- statut du labo

function statusEmbed (cfg, s, title = '📊 État du labo') {
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
  const paused = exps.filter(e => e.status === 'paused' || e.status === 'stopped')
  const queued = active.reduce((n, e) => n + (e.queued_games || 0), 0)
  const worst = Math.max(cpu ?? 0, mem ?? 0)
  const finishing = sum('finishing_games')

  const lines = []
  if (auto.auto_status) lines.push(`*${auto.auto_status}*`, '')
  if (s.docker && s.docker.ok === false) lines.push('⚠️ Docker injoignable depuis KE', '')
  if (s.reset && s.reset.running) lines.push('⚠️ Réinitialisation du labo en cours', '')
  lines.push(
    '**🎮  Games**',
    `> **${num(sum('running_games'))}** en cours${finishing ? ` (+${num(finishing)} en finition)` : ''} · **${num(queued)}** en file · max ${s.max_parallel_matches ?? '?'} en parallèle`,
    `> ⚡ ${s.throughput && s.throughput.per_hour != null ? `**${s.throughput.per_hour}** games / heure` : 'pas de game terminée cette dernière heure'}`,
    '',
    '**🔬  Post-traitement**',
    `> Analyses : **${len(rep.running)}** en cours · ${num(rep.pending)} en attente`,
    `> Rendus 2D : **${len(mov.running)}** en cours · ${num(mov.pending)} en attente`,
    '',
    '**📋  Sessions**',
    `> **${active.length}** en cours · ${paused.length} en pause · ${exps.filter(e => isEnded(e.status)).length} terminée(s)`,
    '',
    '**🖥️  Machine**',
    `> ${level(cpu)} CPU  \`${bar(cpu)}\`  **${cpu ?? '…'} %**${auto.cpus ? ` · ${auto.cpus} cœurs` : ''}`,
    `> ${level(mem)} RAM  \`${bar(mem)}\`  **${mem ?? '…'} %** · ${gb(memUsed)} / ${gb(auto.mem_total)} Go`
  )
  const embed = new EmbedBuilder()
    .setColor(worst >= 90 ? COLORS.error : worst >= 70 ? COLORS.warn : COLORS.brand)
    .setTitle(title)
    .setDescription(lines.join('\n'))
    .setTimestamp(new Date())
  if (isHttp(cfg.publicUrl)) embed.setURL(`${cfg.publicUrl}/overview`)
  return embed
}

// ---------------------------------------------------------------- sessions : une carte chacune

function subjects (e) {
  if (e.mode === 'battle') return `${e.bots_count} bots en round-robin`
  if (e.mode === 'duel') return `**${e.subject_name}** vs **${e.subject2_name || '?'}**`
  const n = Math.max(0, (e.bots_count || 1) - 1)
  return `**${e.subject_name}** vs ${plural(n, 'adversaire', 'adversaires')}`
}

function sessionCard (cfg, e) {
  const s = st(e.status)
  const m = md(e.mode)
  const lines = [
    `${m.icon} ${m.label} · ${subjects(e)}`,
    '',
    `\`${bar(percent(e), 16)}\`  **${percent(e)} %**  ·  ${num(done(e))} / ${num(e.total_games)} games`,
    '',
    `✅ **${num(e.completed_games)}** finies  ·  ❌ **${num(e.failed_games)}** en échec`
  ]
  if (!isEnded(e.status)) {
    lines.push(`▶️ **${num(running(e))}** en cours  ·  ⏳ **${num(e.queued_games)}** en file`)
    if (e.status === 'running' && e.throughput && e.throughput.per_hour != null) lines.push(`⚡ **${e.throughput.per_hour}** games / heure`)
    if (e.rounds_total > 1) lines.push(`🔁 Round **${e.round_current || e.rounds_total}** / ${e.rounds_total}`)
  }
  if (isEnded(e.status)) {
    const pending = (e.analysing_games || 0) + (e.rendering_games || 0)
    lines.push('', pending
      ? `🔬 Post-traitement : **${num(e.analysing_games)}** analyse(s) et **${num(e.rendering_games)}** rendu(s) 2D en attente`
      : '🔬 Post-traitement terminé')
  }
  const when = isEnded(e.status) && e.finished_at
    ? `Terminée ${ts(e.finished_at)}${duration(e.created_at, e.finished_at) ? ` · durée ${duration(e.created_at, e.finished_at)}` : ''}`
    : `Créée ${ts(e.created_at)}`
  lines.push('', `-# #${e.id} · ${when}`)
  const embed = new EmbedBuilder()
    .setColor(s.color)
    .setTitle(`${s.icon}  ${e.name}`.slice(0, 256))
    .setDescription(lines.join('\n'))
  const url = runUrl(cfg, e.id)
  if (url) embed.setURL(url)
  return embed
}

const FILTERS = {
  all: () => true,
  active: e => e.status === 'running' || e.status === 'paused' || e.status === 'stopped',
  running: e => e.status === 'running',
  paused: e => e.status === 'paused' || e.status === 'stopped',
  ended: e => isEnded(e.status)
}
const ORDER = e => (e.status === 'running' ? 0 : e.status === 'paused' || e.status === 'stopped' ? 1 : 2)

function countsLine (all) {
  return Object.keys(STATUS)
    .map(k => [STATUS[k], all.filter(e => e.status === k).length])
    .filter(([, n]) => n).map(([v, n]) => `${v.icon} ${n} ${v.label.toLowerCase()}`).join('  ·  ')
}

/** Une carte par session, 5 par message (les actives d'abord). Renvoie une liste de messages. */
function sessionsMessages (cfg, s, filter = 'all', limit = 10, header = '📋 **Sessions**') {
  const all = s.experiments || []
  const list = all.filter(FILTERS[filter] || FILTERS.all)
  const shown = [...list].sort((a, b) => ORDER(a) - ORDER(b) || b.id - a.id).slice(0, Math.min(limit, 25))
  const more = list.length > shown.length ? `\n-# ${shown.length} sur ${list.length} affichées` : ''
  const head = `${header}${all.length ? `\n${countsLine(all)}` : ''}${more}`
  if (!shown.length) return [{ content: `${head}\n\n*Aucune session.*` }]
  const out = []
  for (let i = 0; i < shown.length; i += 5) {
    out.push({ content: i === 0 ? head : undefined, embeds: shown.slice(i, i + 5).map(e => sessionCard(cfg, e)) })
  }
  return out
}

// ---------------------------------------------------------------- récap planifié

const DAYS_FR = { daily: 'tous les jours', mon: 'lundi', tue: 'mardi', wed: 'mercredi', thu: 'jeudi', fri: 'vendredi', sat: 'samedi', sun: 'dimanche' }

/** "samedi 17h30 · lundi 09h00" (au-delà de 3 horaires : "5 horaires") */
function scheduleLabel (schedule) {
  const list = Array.isArray(schedule) ? schedule : []
  if (!list.length) return ''
  if (list.length > 3) return `${list.length} horaires`
  return list.map(sl => `${DAYS_FR[sl.day] || sl.day} ${String(sl.time).replace(':', 'h')}`).join(' · ')
}

/** Récap : un message d'état du labo, puis les sessions (actives + 5 dernières terminées). */
function recapMessages (cfg, state, schedule) {
  const label = scheduleLabel(schedule)
  const exps = state.experiments || []
  const active = exps.filter(e => !isEnded(e.status))
  const ended = exps.filter(e => isEnded(e.status)).sort((a, b) => b.id - a.id).slice(0, 5)
  const picked = { ...state, experiments: [...active, ...ended] }
  return [
    { content: `## 🗞️ Récap Kerrigan's Eyes${label ? `\n-# ${label}` : ''}`, embeds: [statusEmbed(cfg, state, '📊 État du labo')] },
    ...sessionsMessages(cfg, picked, 'all', 25, '📋 **Sessions en cours et dernières terminées**')
  ]
}

module.exports = {
  COLORS, STATUS, isEnded, linkRows, eventText, statusEmbed, sessionCard, sessionsMessages, recapMessages, scheduleLabel
}
