const express = require('express')
const { Client, GatewayIntentBits, REST, Routes, MessageFlags } = require('discord.js')
require('dotenv').config()

const kerrigan = require('./ke')
const clear = require('./commands/clear')

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
})

// Kerrigan's Eyes integration (optional: only enabled when KE_URL is set in .env)
const ke = kerrigan.setup(client)

const app = express()
const PORT = process.env.PORT || 3000
app.get('/', (_, res) => res.send('🤖 Discord bot is running'))
ke.mountWebhook(app) // POST /webhooks/ke (or KE_WEBHOOK_PATH): events sent by Kerrigan's Eyes
app.listen(PORT, () => console.log(`🌐 HTTP server listening on port ${PORT}`))

// this list replaces the commands previously registered on Discord
const commands = [clear.data.toJSON(), ...ke.commands.map(c => c.toJSON())]

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN)

;(async () => {
  try {
    if (process.env.GUILD_ID) {
      console.log('🔄 Registering slash commands for the server...')
      await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
        { body: commands }
      )
      console.log('✅ Slash commands registered for the server')
    } else {
      console.log('🔄 Registering global slash commands...')
      await rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID),
        { body: commands }
      )
      console.log('✅ Global slash commands registered')
    }
  } catch (error) {
    console.error('❌ Could not register the slash commands:', error)
  }
})()

async function replyError (interaction) {
  const payload = { content: '❌ Something went wrong.', flags: MessageFlags.Ephemeral }
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
    if (interaction.commandName === clear.data.name) await clear.execute(interaction)
    else await ke.handleCommand(interaction)
  } catch (error) {
    console.error(error)
    await replyError(interaction)
  }
})

client.once('ready', () => {
  console.log(`🤖 Logged in as ${client.user.tag}`)
  ke.start()
})

client.login(process.env.DISCORD_BOT_TOKEN)
