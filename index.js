const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
require('dotenv').config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

// Définir les commandes slash
const commands = [
  new SlashCommandBuilder().setName('ping').setDescription('Renvoie Pong!'),
  new SlashCommandBuilder().setName('coin').setDescription('Pile ou Face aléatoire'),
].map(command => command.toJSON());

// Enregistrer les commandes
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);

(async () => {
  try {
    console.log('Enregistrement des commandes slash...');

    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });

    console.log('Commandes enregistrées avec succès.');
  } catch (error) {
    console.error(error);
  }
})();

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'ping') {
    await interaction.reply('Pong!');
  }

  if (interaction.commandName === 'coin') {
    const result = Math.random() < 0.5 ? 'Pile 🪙' : 'Face 🪙';
    await interaction.reply(result);
  }
});

client.once('ready', () => {
  console.log('🤖 Bot Discord actif et prêt !');
});

client.login(process.env.DISCORD_BOT_TOKEN);