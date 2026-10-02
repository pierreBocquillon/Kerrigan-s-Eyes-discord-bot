// Optional Kerrigan's Eyes integration: only enabled when KE_URL is set.
//  - notifications: KE calls the bot's webhook (Settings > Webhooks in KE), no polling
//  - /status, /sessions, /campaigns: read from the KE API when the command is run
const { SlashCommandBuilder, MessageFlags } = require('discord.js')
const { loadConfig } = require('./config')
const { KEClient } = require('./client')
const { Notifier } = require('./notifier')
const { mountWebhook } = require('./webhook')
const fmt = require('./format')

const SESSION_FILTERS = [
  { name: 'All', value: 'all' },
  { name: 'Active (running + paused)', value: 'active' },
  { name: 'Running', value: 'running' },
  { name: 'Paused / stopped', value: 'paused' },
  { name: 'Finished', value: 'ended' }
]

function sessionsCommand (name, description) {
  return new SlashCommandBuilder()
    .setName(name)
    .setDescription(description)
    .addStringOption(o => o.setName('filter').setDescription('Which sessions to show').addChoices(...SESSION_FILTERS))
    .addIntegerOption(o => o.setName('limit').setDescription('Maximum number of sessions (default 10)').setMinValue(1).setMaxValue(25))
    .addIntegerOption(o => o.setName('id').setDescription('Details of one session').setMinValue(1))
}

function setup (client, env = process.env) {
  const cfg = loadConfig(env)
  if (!cfg.enabled) {
    console.log('ℹ️ Kerrigan\'s Eyes integration disabled (KE_URL is not set)')
    return { enabled: false, commands: [], handleCommand: async () => false, mountWebhook () {}, start () {} }
  }
  const ke = new KEClient({ baseUrl: cfg.url, username: cfg.username, password: cfg.password, token: cfg.token })
  const notifier = new Notifier(client, cfg)

  const commands = [
    new SlashCommandBuilder().setName('status').setDescription('Kerrigan\'s Eyes: running games, analyses and renders, CPU and RAM'),
    sessionsCommand('sessions', 'Kerrigan\'s Eyes: sessions with their status and progress'),
    sessionsCommand('campaigns', 'Kerrigan\'s Eyes: campaigns with their status and progress (same as /sessions)')
  ]
  const names = new Set(commands.map(c => c.name))

  function allowed (interaction) {
    if (!cfg.roleId) return true
    const roles = interaction.member && interaction.member.roles
    if (!roles) return false
    return Array.isArray(roles) ? roles.includes(cfg.roleId) : roles.cache.has(cfg.roleId)
  }

  async function handleCommand (interaction) {
    if (!names.has(interaction.commandName)) return false
    if (!allowed(interaction)) {
      await interaction.reply({ content: '⛔ You do not have the role required to use Kerrigan\'s Eyes here.', flags: MessageFlags.Ephemeral })
      return true
    }
    await interaction.deferReply()
    let s
    try {
      s = await ke.state()
    } catch (err) {
      await interaction.editReply(`❌ Kerrigan's Eyes is unreachable: \`${String(err.message).slice(0, 300)}\``)
      return true
    }
    if (interaction.commandName === 'status') {
      await interaction.editReply({ embeds: [fmt.statusEmbed(cfg, s)] })
      return true
    }
    const id = interaction.options.getInteger('id')
    if (id) {
      const e = (s.experiments || []).find(x => x.id === id)
      if (!e) {
        await interaction.editReply(`❓ Session #${id} not found (KE lists the 100 most recent ones).`)
        return true
      }
      await interaction.editReply({ embeds: [fmt.sessionCard(cfg, e)], components: fmt.linkRows(cfg, e.id) })
      return true
    }
    const filter = interaction.options.getString('filter') || 'all'
    const limit = interaction.options.getInteger('limit') || 10
    const [first, ...rest] = fmt.sessionsMessages(cfg, s, filter, limit,
      interaction.commandName === 'campaigns' ? '📋 **Campaigns**' : '📋 **Sessions**')
    await interaction.editReply(first)
    for (const msg of rest) await interaction.followUp(msg)
    return true
  }

  return {
    enabled: true,
    commands,
    handleCommand,
    mountWebhook: app => mountWebhook(app, cfg, notifier),
    start: () => {
      console.log(`🔗 Kerrigan's Eyes integration: ${cfg.url} — webhook POST ${cfg.webhookPath} → channel ${cfg.channelId || '(none)'}`)
      if (!cfg.webhookSecret) console.warn('[KE] KE_WEBHOOK_SECRET is not set: the KE webhooks will be refused')
      if (!cfg.channelId) console.warn('[KE] KE_CHANNEL_ID is not set: no notifications')
    },
    notifier,
    ke,
    cfg
  }
}

module.exports = { setup }
