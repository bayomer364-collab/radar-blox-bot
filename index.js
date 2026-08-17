const { 
  Client, GatewayIntentBits, ActionRowBuilder, StringSelectMenuBuilder, 
  ButtonBuilder, ButtonStyle, EmbedBuilder, SlashCommandBuilder, REST, Routes 
} = require('discord.js');
const express = require('express');
const fs = require('fs');
const path = require('path');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = '1538484436272676954';
const WEBHOOK_SECRET = 'GIZLI_SIFRE_12345';
const DB_FILE = path.join(__dirname, 'accounts.json');
const ROLE_ID = '1538940771967700992';

function getDB() {
  if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, '{}');
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch (e) { return {}; }
}

function saveDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// --- OTOMATİK STOK DOLDURUCU (Her 1.5 saniyede çalışır) ---
setInterval(() => {
  const db = getDB();
  const years = [2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016];
  const types = ['no_number', 'year_user', 'double_user'];
  
  const randomYear = years[Math.floor(Math.random() * years.length)];
  const randomType = types[Math.floor(Math.random() * types.length)];
  const key = `${randomYear}_${randomType}`;

  if (!db[key]) db[key] = [];
  
  // Örnek hesap oluştur (Webhook gelmediğinde boş kalmaması için)
  if (db[key].length < 100) { 
      db[key].push({ id: Date.now(), name: `AutoAcc_${randomYear}_${Math.floor(Math.random()*9999)}` });
      saveDB(db);
  }
}, 1500);

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
  return res.json({ success: true });
});
app.listen(process.env.PORT || 3000, () => console.log('Server online.'));

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
    if (!interaction.member.roles.cache.has(ROLE_ID)) return await interaction.reply({ content: '❌ Role missing.', ephemeral: true });
    
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`b_amt_5_${interaction.user.id}`).setLabel('5 Accounts').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`b_amt_10_${interaction.user.id}`).setLabel('10 Accounts').setStyle(ButtonStyle.Success)
    );
    await interaction.reply({ content: 'Select amount:', components: [row], ephemeral: true });
  }

  // Miktar seçildi -> Yıl seçimi
  if (interaction.isButton() && interaction.customId.startsWith('b_amt_')) {
    const [_, __, amount, ownerId] = interaction.customId.split('_');
    if (interaction.user.id !== ownerId) return;
    const menu = new StringSelectMenuBuilder().setCustomId(`b_year_${amount}_${ownerId}`)
      .setPlaceholder('Select year').addOptions(Array.from({ length: 11 }, (_, i) => ({ label: `${2006 + i}`, value: `${2006 + i}` })));
    await interaction.update({ content: `Selected ${amount}. Choose year:`, components: [new ActionRowBuilder().addComponents(menu)] });
  }

  // Yıl seçildi -> Tür seçimi (no_number, year_user, double_user)
  if (interaction.isStringSelectMenu() && interaction.customId.startsWith('b_year_')) {
    const [_, __, amount, ownerId] = interaction.customId.split('_');
    const year = interaction.values[0];
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`b_type_no_number_${amount}_${year}_${ownerId}`).setLabel('No Number').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`b_type_year_user_${amount}_${year}_${ownerId}`).setLabel('Year User').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`b_type_double_user_${amount}_${year}_${ownerId}`).setLabel('Double User').setStyle(ButtonStyle.Secondary)
    );
    await interaction.update({ content: `Year ${year} selected. Choose type:`, components: [row] });
  }

  // Tür seçildi -> Hesapları gönder
  if (interaction.isButton() && interaction.customId.startsWith('b_type_')) {
    const [_, __, type, amount, year, ownerId] = interaction.customId.split('_');
    if (interaction.user.id !== ownerId) return;
    const db = getDB();
    const key = `${year}_${type}`;
    if (!db[key] || db[key].length < amount) return await interaction.update({ content: '❌ Not enough stock!', components: [] });
    
    let accounts = [];
    for(let i=0; i<amount; i++) accounts.push(db[key].shift());
    saveDB(db);
    
    const embed = new EmbedBuilder().setTitle('✨ Bulk Accounts').setDescription(accounts.map(a => `• ${a.name}`).join('\n'));
    await interaction.user.send({ embeds: [embed] }).then(() => interaction.update({ content: '✅ Sent to DMs!', components: [] }))
      .catch(() => interaction.update({ content: '❌ Open DMs!', components: [] }));
  }

  // --- NORMAL GEN MANTIĞI ---
  if (interaction.isChatInputCommand() && interaction.commandName === 'gen') {
    const menu = new StringSelectMenuBuilder().setCustomId(`select_year_${interaction.user.id}`)
      .setPlaceholder('Select Year').addOptions(Array.from({ length: 11 }, (_, i) => ({ label: `${2006 + i}`, value: `${2006 + i}` })));
    await interaction.reply({ components: [new ActionRowBuilder().addComponents(menu)] });
  }
  // ... (Geri kalan gen mantığı aynı)
});

client.login(TOKEN);
