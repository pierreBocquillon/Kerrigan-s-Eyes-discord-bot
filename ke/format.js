// Discord formatting of the Kerrigan's Eyes data.
//  - events (session started, new bot...): one simple sentence
//  - /status, /sessions, recaps: airy cards, over several messages when needed
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js')

const COLORS = {
  brand: 0x8b5cf6, start: 0x3b82f6, end: 0x22c55e, warn: 0xf59e0b, stop: 0x64748b, error: 0xef4444, ok: 0x22c55e
}

const STATUS = {
  running: { icon: '▶️', label: 'Running', color: COLORS.start },
  paused: { icon: '⏸️', label: 'Paused', color: COLORS.stop },
  stopped: { icon: '⏹️', label: 'Stopped', color: COLORS.stop },
  completed: { icon: '✅', label: 'Finished', color: COLORS.end },
  completed_with_errors: { icon: '⚠️', label: 'Finished with errors', color: COLORS.warn }
}
const MODES = {
  training: { icon: '🧪', label: 'Training', noun: 'training', a: 'A' },
  duel: { icon: '⚖️', label: 'Duel', noun: 'duel', a: 'A' },
  battle: { icon: '🏆', label: 'Battle', noun: 'battle', a: 'A' }
}

const st = s => STATUS[s] || { icon: '•', label: s || '?', color: COLORS.brand }
const md = m => MODES[m || 'training'] || { ...MODES.training, icon: '•', label: m, noun: m }
const isEnded = s => s === 'completed' || s === 'completed_with_errors'
const num = n => Number(n || 0).toLocaleString('en-US')
const isHttp = u => /^https?:\/\//.test(u || '')
const plural = (n, one, many) => `${num(n)} ${Number(n) === 1 ? one : many}`

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
  return [d ? `${d} d` : '', h ? `${h} h` : '', m % 60 || (!d && !h) ? `${m % 60} min` : ''].filter(Boolean).slice(0, 2).join(' ')
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
// link without a site preview (the angle brackets stop Discord from showing the KE page under the message)
const link = (text, url) => (url ? `[${text}](<${url}>)` : text)

/** "Open in KE" button (none when KE_PUBLIC_URL is not an http(s) address). */
function linkRows (cfg, id) {
  const url = runUrl(cfg, id)
  if (!url) return []
  return [new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel('Open in KE').setEmoji('🔗').setStyle(ButtonStyle.Link).setURL(url))]
}

// ---------------------------------------------------------------- events: one sentence

/** Message text for a KE event (null: unknown or incomplete event). */
function eventText (cfg, event, data = {}) {
  const s = data.session
  if (event.startsWith('session.') && !s) return null
  const m = s ? md(s.mode) : null
  const name = s ? `**${link(s.name, runUrl(cfg, s.id))}**` : ''
  switch (event) {
    case 'ping':
      return "🔗 Kerrigan's Eyes webhook connected: the lab events will be posted in this channel."
    case 'session.started':
      return `▶️ ${m.a} ${m.noun} has just been started: ${name}`
    case 'session.resumed':
      return `🔁 ${m.a} ${m.noun} has just been resumed: ${name}`
    case 'session.stopped':
      return `⏹️ ${m.a} ${m.noun} has just been stopped: ${name}`
    case 'session.ended':
      return s.status === 'completed_with_errors'
        ? `⚠️ ${m.a} ${m.noun} has just finished with errors: ${name} (${plural(s.failed_games, 'failed game', 'failed games')})`
        : `✅ ${m.a} ${m.noun} has just finished: ${name}`
    case 'session.processed':
      return `🔬 Analyses and 2D renders done for the ${m.noun} ${name}`
    case 'bot.added': {
      const b = data.bot
      return b ? `🤖 A new bot has just been added: **${b.display || b.name}**` : null
    }
    case 'bot.version_added': {
      const b = data.bot
      return b ? `🆕 A new version of **${b.name}** has just been added: **${b.version || b.display}**` : null
    }
    case 'map.added':
      return data.map ? `🗺️ A new map has just been added: **${data.map.name}**` : null
    default:
      return null
  }
}

// ---------------------------------------------------------------- lab status

function statusEmbed (cfg, s, title = '📊 Lab status') {
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
  if (s.docker && s.docker.ok === false) lines.push('⚠️ Docker is unreachable from KE', '')
  if (s.reset && s.reset.running) lines.push('⚠️ Lab reset in progress', '')
  lines.push(
    '**🎮  Games**',
    `> **${num(sum('running_games'))}** running${finishing ? ` (+${num(finishing)} finishing)` : ''} · **${num(queued)}** queued · up to ${s.max_parallel_matches ?? '?'} in parallel`,
    `> ⚡ ${s.throughput && s.throughput.per_hour != null ? `**${s.throughput.per_hour}** games / hour` : 'no game finished in the last hour'}`,
    '',
    '**🔬  Processing**',
    `> Analyses: **${len(rep.running)}** running · ${num(rep.pending)} waiting`,
    `> 2D renders: **${len(mov.running)}** running · ${num(mov.pending)} waiting`,
    '',
    '**📋  Sessions**',
    `> **${active.length}** running · ${paused.length} paused · ${exps.filter(e => isEnded(e.status)).length} finished`,
    '',
    '**🖥️  Machine**',
    `> ${level(cpu)} CPU  \`${bar(cpu)}\`  **${cpu ?? '…'} %**${auto.cpus ? ` · ${auto.cpus} cores` : ''}`,
    `> ${level(mem)} RAM  \`${bar(mem)}\`  **${mem ?? '…'} %** · ${gb(memUsed)} / ${gb(auto.mem_total)} GB`
  )
  const embed = new EmbedBuilder()
    .setColor(worst >= 90 ? COLORS.error : worst >= 70 ? COLORS.warn : COLORS.brand)
    .setTitle(title)
    .setDescription(lines.join('\n'))
    .setTimestamp(new Date())
  if (isHttp(cfg.publicUrl)) embed.setURL(`${cfg.publicUrl}/overview`)
  return embed
}

// ---------------------------------------------------------------- sessions: one card each

function subjects (e) {
  if (e.mode === 'battle') return `${e.bots_count} bots, round-robin`
  if (e.mode === 'duel') return `**${e.subject_name}** vs **${e.subject2_name || '?'}**`
  const n = Math.max(0, (e.bots_count || 1) - 1)
  return `**${e.subject_name}** vs ${plural(n, 'opponent', 'opponents')}`
}

function sessionCard (cfg, e) {
  const s = st(e.status)
  const m = md(e.mode)
  const lines = [
    `${m.icon} ${m.label} · ${subjects(e)}`,
    '',
    `\`${bar(percent(e), 16)}\`  **${percent(e)} %**  ·  ${num(done(e))} / ${num(e.total_games)} games`,
    '',
    `✅ **${num(e.completed_games)}** finished  ·  ❌ **${num(e.failed_games)}** failed`
  ]
  if (!isEnded(e.status)) {
    lines.push(`▶️ **${num(running(e))}** running  ·  ⏳ **${num(e.queued_games)}** queued`)
    if (e.status === 'running' && e.throughput && e.throughput.per_hour != null) lines.push(`⚡ **${e.throughput.per_hour}** games / hour`)
    if (e.rounds_total > 1) lines.push(`🔁 Round **${e.round_current || e.rounds_total}** / ${e.rounds_total}`)
  }
  if (isEnded(e.status)) {
    const pending = (e.analysing_games || 0) + (e.rendering_games || 0)
    lines.push('', pending
      ? `🔬 Processing: **${num(e.analysing_games)}** ${Number(e.analysing_games) === 1 ? 'analysis' : 'analyses'} and **${num(e.rendering_games)}** 2D ${Number(e.rendering_games) === 1 ? 'render' : 'renders'} waiting`
      : '🔬 Processing done')
  }
  const took = duration(e.created_at, e.finished_at)
  const when = isEnded(e.status) && e.finished_at
    ? `Finished ${ts(e.finished_at)}${took ? ` · took ${took}` : ''}`
    : `Created ${ts(e.created_at)}`
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

/** One card per session, 5 per message (active ones first). Returns a list of messages. */
function sessionsMessages (cfg, s, filter = 'all', limit = 10, header = '📋 **Sessions**') {
  const all = s.experiments || []
  const list = all.filter(FILTERS[filter] || FILTERS.all)
  const shown = [...list].sort((a, b) => ORDER(a) - ORDER(b) || b.id - a.id).slice(0, Math.min(limit, 25))
  const more = list.length > shown.length ? `\n-# ${shown.length} of ${list.length} shown` : ''
  const head = `${header}${all.length ? `\n${countsLine(all)}` : ''}${more}`
  if (!shown.length) return [{ content: `${head}\n\n*No session.*` }]
  const out = []
  for (let i = 0; i < shown.length; i += 5) {
    out.push({ content: i === 0 ? head : undefined, embeds: shown.slice(i, i + 5).map(e => sessionCard(cfg, e)) })
  }
  return out
}

// ---------------------------------------------------------------- scheduled recap

const DAYS = { daily: 'every day', mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' }

/** "Saturday 17:30 · Monday 09:00" (more than 3 times: "5 times") */
function scheduleLabel (schedule) {
  const list = Array.isArray(schedule) ? schedule : []
  if (!list.length) return ''
  if (list.length > 3) return `${list.length} times`
  return list.map(sl => `${DAYS[sl.day] || sl.day} ${sl.time}`).join(' · ')
}

/** Recap: one lab status message, then the sessions (active ones + the last 5 finished). */
function recapMessages (cfg, state, schedule) {
  const label = scheduleLabel(schedule)
  const exps = state.experiments || []
  const active = exps.filter(e => !isEnded(e.status))
  const ended = exps.filter(e => isEnded(e.status)).sort((a, b) => b.id - a.id).slice(0, 5)
  const picked = { ...state, experiments: [...active, ...ended] }
  return [
    { content: `## 🗞️ Kerrigan's Eyes recap${label ? `\n-# ${label}` : ''}`, embeds: [statusEmbed(cfg, state, '📊 Lab status')] },
    ...sessionsMessages(cfg, picked, 'all', 25, '📋 **Running sessions and the last finished ones**')
  ]
}

module.exports = {
  COLORS, STATUS, isEnded, linkRows, eventText, statusEmbed, sessionCard, sessionsMessages, recapMessages, scheduleLabel
}
