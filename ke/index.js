// Intégration optionnelle avec Kerrigan's Eyes : activée seulement si KE_URL est défini.
//  - notifications : KE appelle le webhook du bot (Settings > Webhooks dans KE), aucun sondage
//  - /status, /sessions, /campaigns : lus dans l'API de KE au moment de la commande
const { SlashCommandBuilder, MessageFlags } = require('discord.js')
const { loadConfig } = require('./config')
const { KEClient } = require('./client')
const { Notifier } = require('./notifier')
const { mountWebhook } = require('./webhook')
const fmt = require('./format')

const SESSION_FILTERS = [
  { name: 'Toutes', value: 'all' },
  { name: 'Actives (en cours + en pause)', value: 'active' },
  { name: 'En cours', value: 'running' },
  { name: 'En pause / arrêtées', value: 'paused' },
  { name: 'Terminées', value: 'ended' }
]

function sessionsCommand (name, description) {
  return new SlashCommandBuilder()
    .setName(name)
    .setDescription(description)
    .addStringOption(o => o.setName('filtre').setDescription('Quelles sessions afficher').addChoices(...SESSION_FILTERS))
    .addIntegerOption(o => o.setName('limite').setDescription('Nombre maximum de sessions (défaut 10)').setMinValue(1).setMaxValue(25))
    .addIntegerOption(o => o.setName('id').setDescription('Détail d\'une session').setMinValue(1))
}

function setup (client, env = process.env) {
  const cfg = loadConfig(env)
  if (!cfg.enabled) {
    console.log('ℹ️ Intégration Kerrigan\'s Eyes désactivée (KE_URL non défini)')
    return { enabled: false, commands: [], handleCommand: async () => false, mountWebhook () {}, start () {} }
  }
  const ke = new KEClient({ baseUrl: cfg.url, username: cfg.username, password: cfg.password, token: cfg.token })
  const notifier = new Notifier(client, cfg)

  const commands = [
    new SlashCommandBuilder().setName('status').setDescription('Kerrigan\'s Eyes : games, analyses et rendus en cours, CPU et RAM'),
    sessionsCommand('sessions', 'Kerrigan\'s Eyes : liste des sessions, leur statut et leur avancement'),
    sessionsCommand('campaigns', 'Kerrigan\'s Eyes : liste des campagnes (alias de /sessions)')
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
      await interaction.reply({ content: '⛔ Tu n\'as pas le rôle requis pour utiliser Kerrigan\'s Eyes ici.', flags: MessageFlags.Ephemeral })
      return true
    }
    await interaction.deferReply()
    let s
    try {
      s = await ke.state()
    } catch (err) {
      await interaction.editReply(`❌ Kerrigan's Eyes injoignable : \`${String(err.message).slice(0, 300)}\``)
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
        await interaction.editReply(`❓ Session #${id} introuvable (KE liste les 100 plus récentes).`)
        return true
      }
      await interaction.editReply({ embeds: [fmt.sessionCard(cfg, e)], components: fmt.linkRows(cfg, e.id) })
      return true
    }
    const filter = interaction.options.getString('filtre') || 'all'
    const limit = interaction.options.getInteger('limite') || 10
    const [first, ...rest] = fmt.sessionsMessages(cfg, s, filter, limit,
      interaction.commandName === 'campaigns' ? '📋 **Campagnes**' : '📋 **Sessions**')
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
      console.log(`🔗 Intégration Kerrigan's Eyes : ${cfg.url} — webhook POST ${cfg.webhookPath} → salon ${cfg.channelId || '(aucun)'}`)
      if (!cfg.webhookSecret) console.warn('[KE] KE_WEBHOOK_SECRET absent : les webhooks de KE seront refusés')
      if (!cfg.channelId) console.warn('[KE] KE_CHANNEL_ID absent : pas de notifications')
    },
    notifier,
    ke,
    cfg
  }
}

module.exports = { setup }
