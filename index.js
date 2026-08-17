const { 
  Client, 
  GatewayIntentBits, 
  ActionRowBuilder, 
  StringSelectMenuBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  EmbedBuilder,
  SlashCommandBuilder,
  REST,
  Routes
} = require('discord.js');
const express = require('express');
const fs = require('fs');
const path = require('path');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = '1538484436272676954';
const WEBHOOK_SECRET = 'GIZLI_SIFRE_12345';
const DB_FILE = path.join(__dirname, 'accounts.json');
const ROLE_ID = '1538940771967700992'; // Senin verdiğin rol ID

const userGenCount = new Map();

function getDB() {
  if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, '{}');
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch (e) { return {}; }
}

function saveDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// Webhook
const app = express();
app.use(express.json());
app.post('/api/add-account', (req, res) => {
  const { secret, targetYear, filterType, accountData } = req.body;
  if (secret !== WEBHOOK_SECRET) return res.status(403).json({ error: 'Unauthorized' });
  const db = getDB();
  const key = `${targetYear}_${filterType}`;
  if (!db[key]) db[key] = [];
  if (!db[key].some(acc => acc.id === accountData.id)) {
    db[key].push(accountData);
    saveDB(db);
  }
  return res.json({ success: true, stockCount: db[key].length });
});
app.listen(process.env.PORT || 3000, () => console.log('Server online.'));

// Komutlar
const commands = [
  new SlashCommandBuilder().setName('gen').setDescription('Starts the RadarBlox generator.'),
  new SlashCommandBuilder().setName('bulk-gen').setDescription('Generate multiple accounts.')
];

const rest = new REST({ version: '10' }).setToken(TOKEN);

client.once('ready', async () => {
  console.log(`${client.user.tag} is online!`);
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
});

client.on('interactionCreate', async (interaction) => {
  
  // --- BULK-GEN MANTIĞI ---
  if (interaction.isChatInputCommand() && interaction.commandName === 'bulk-gen') {
    if (!interaction.member.roles.cache.has(ROLE_ID)) {
      return await interaction.reply({ content: '❌ You need the **Bulk-Gen Customer** role.', ephemeral: true });
    }
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`bulk_amt_5_${interaction.user.id}`).setLabel('5 Accounts').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`bulk_amt_10_${interaction.user.id}`).setLabel('10 Accounts').setStyle(ButtonStyle.Success)
    );
    await interaction.reply({ content: 'Select amount:', components: [row], ephemeral: true });
  }

  if (interaction.isButton() && interaction.customId.startsWith('bulk_amt_')) {
    const [_, __, amount, ownerId] = interaction.customId.split('_');
    if (interaction.user.id !== ownerId) return;
    const menu = new StringSelectMenuBuilder()
      .setCustomId(`bulk_year_${amount}_${ownerId}`)
      .setPlaceholder('Select year')
      .addOptions(Array.from({ length: 11 }, (_, i) => ({ label: `${2006 + i}`, value: `${2006 + i}` })));
    await interaction.update({ content: `Selected **${amount}**. Choose year:`, components: [new ActionRowBuilder().addComponents(menu)] });
  }

  if (interaction.isStringSelectMenu() && interaction.customId.startsWith('bulk_year_')) {
    const [_, __, amount, ownerId] = interaction.customId.split('_');
    if (interaction.user.id !== ownerId) return;
    const year = interaction.values[0];
    const db = getDB();
    const categories = [`${year}_no_number`, `${year}_year_user`, `${year}_double_user`];
    let accounts = [];
    for (const cat of categories) {
      while (db[cat] && db[cat].length > 0 && accounts.length < amount) accounts.push(db[cat].shift());
    }
    saveDB(db);
    if (accounts.length < amount) return await interaction.update({ content: '❌ Not enough stock!', components: [] });
    
    const embed = new EmbedBuilder().setTitle('✨ Bulk Generated Accounts').setDescription(accounts.map(a => `• ${a.name}`).join('\n'));
    try { await interaction.user.send({ embeds: [embed] }); await interaction.update({ content: '✅ Check DMs!', components: [] }); }
    catch (e) { await interaction.update({ content: '❌ Open your DMs!', components: [] }); }
  }

  // --- NORMAL GEN MANTIĞI ---
  if (interaction.isChatInputCommand() && interaction.commandName === 'gen') {
    const menu = new StringSelectMenuBuilder().setCustomId(`select_year_${interaction.user.id}`)
      .setPlaceholder('Select Year').addOptions(Array.from({ length: 11 }, (_, i) => ({ label: `${2006 + i}`, value: `${2006 + i}` })));
    await interaction.reply({ components: [new ActionRowBuilder().addComponents(menu)] });
  }

  if (interaction.isStringSelectMenu() && interaction.customId.startsWith('select_year_')) {
    const ownerId = interaction.customId.split('_')[2];
    if (interaction.user.id !== ownerId) return;
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`gen_no_number_${interaction.values[0]}_${ownerId}`).setLabel('no_number').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`gen_year_user_${interaction.values[0]}_${ownerId}`).setLabel('year_user').setStyle(ButtonStyle.Success)
    );
    await interaction.update({ content: 'Select pattern:', components: [row] });
  }

  if (interaction.isButton() && interaction.customId.startsWith('gen_')) {
    const [_, p1, p2, year, ownerId] = interaction.customId.split('_');
    if (interaction.user.id !== ownerId) return;
    await interaction.deferReply({ ephemeral: true });
    const db = getDB();
    const key = `${year}_${p1}_${p2}`;
    if (!db[key] || db[key].length === 0) return await interaction.editReply('❌ No stock!');
    const acc = db[key].shift(); saveDB(db);
    try { await interaction.user.send({ content: `Account: ${acc.name}` }); await interaction.editReply('✅ Sent to DMs!'); }
    catch (e) { await interaction.editReply('❌ Open DMs!'); }
  }
});

client.login(TOKEN);
