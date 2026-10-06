// /clear: deletes every message posted by the bot in the current channel.
const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js')

const SCAN_LIMIT = 10000 // most recent messages looked at
const BULK_MAX_AGE = 14 * 24 * 3600 * 1000 - 60 * 1000 // Discord only bulk-deletes messages younger than 14 days

const data = new SlashCommandBuilder()
  .setName('clear')
  .setDescription('Delete every message posted by the bot in this channel')
  // only members who can manage messages see and use the command (server admins can change it)
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .setDMPermission(false)

/** Messages of the bot in the channel, newest first (at most SCAN_LIMIT messages looked at). */
async function botMessages (channel, botId) {
  const found = []
  let before
  for (let scanned = 0; scanned < SCAN_LIMIT;) {
    const batch = await channel.messages.fetch({ limit: 100, ...(before ? { before } : {}) })
    if (!batch.size) break
    scanned += batch.size
    for (const m of batch.values()) if (m.author.id === botId) found.push(m)
    before = batch.last().id
    if (batch.size < 100) break
  }
  return found
}

async function execute (interaction) {
  const channel = interaction.channel
  if (!channel || !channel.messages) {
    await interaction.reply({ content: '❌ This command only works in a server text channel.', flags: MessageFlags.Ephemeral })
    return
  }
  // private answer: it is not a bot message of the channel, so it is not deleted and nobody else sees it
  await interaction.deferReply({ flags: MessageFlags.Ephemeral })
  const messages = await botMessages(channel, interaction.client.user.id)
  if (!messages.length) {
    await interaction.editReply('🧹 No bot message to delete in this channel.')
    return
  }

  let deleted = 0
  let failed = 0
  const now = Date.now()
  const recent = messages.filter(m => now - m.createdTimestamp < BULK_MAX_AGE)
  const old = messages.filter(m => now - m.createdTimestamp >= BULK_MAX_AGE)

  // recent ones: by 100 (needs the "Manage Messages" permission), otherwise one by one
  for (let i = 0; i < recent.length; i += 100) {
    const chunk = recent.slice(i, i + 100)
    try {
      if (chunk.length === 1) throw new Error('single')
      const res = await channel.bulkDelete(chunk.map(m => m.id), true)
      deleted += res.size
    } catch {
      old.push(...chunk)
    }
  }
  // older than 14 days (or no bulk permission): one by one, the bot can always delete its own messages
  for (const m of old) {
    try {
      await m.delete()
      deleted++
    } catch {
      failed++
    }
  }
  await interaction.editReply(`🧹 ${deleted} bot message${deleted === 1 ? '' : 's'} deleted${failed ? ` (${failed} could not be deleted)` : ''}.`)
}

module.exports = { data, execute }
