const express = require('express')
const { Client, GatewayIntentBits, REST, Routes, MessageFlags } = require('discord.js')
require('dotenv').config()

const kerrigan = require('./ke')

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
})

// Intégration Kerrigan's Eyes (optionnelle : active seulement si KE_URL est défini dans .env)
const ke = kerrigan.setup(client)

const app = express()
const PORT = process.env.PORT || 3000
app.get('/', (_, res) => res.send('🤖 Bot Discord actif'))
ke.mountWebhook(app) // POST /webhooks/ke : évènements envoyés par Kerrigan's Eyes
app.listen(PORT, () => console.log(`🌐 Serveur HTTP sur le port ${PORT}`))

// la liste envoyée à Discord remplace l'ancienne : /ping, /coin et /pill disparaissent du serveur
const commands = ke.commands.map(c => c.toJSON())

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN)

;(async () => {
  try {
    if(process.env.GUILD_ID) {
      console.log('🔄 Enregistrement des commandes slash local...')
      await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
        { body: commands }
      )
      console.log('✅ Commandes enregistrées en local avec succès')
    }else{
      console.log('🔄 Enregistrement des commandes slash global...')
      await rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID),
        { body: commands }
      )
      console.log('✅ Commandes enregistrées en global avec succès')
    }
  } catch (error) {
    console.error('❌ Erreur lors de l\'enregistrement des commandes :', error)
  }
})()

async function replyError (interaction) {
  const payload = { content: '❌ Une erreur est survenue.', flags: MessageFlags.Ephemeral }
  try {
    if (interaction.deferred || interaction.replied) await interaction.followUp(payload)
    else await interaction.reply(payload)
  } catch (e) {
    console.error(e)
  }
}

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return

  try {
    await ke.handleCommand(interaction)
  } catch (error) {
    console.error(error)
    await replyError(interaction)
  }
})

client.once('ready', () => {
  console.log(`🤖 Connecté en tant que ${client.user.tag}`)
  ke.start()
})

client.login(process.env.DISCORD_BOT_TOKEN)
