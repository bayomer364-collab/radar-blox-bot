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
const bulkModule = require('./bulk.js'); // bulk.js modülü dahil edildi

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

const TOKEN = 'BURAYA_BOT_TOKENINI_YAPIŞTIR';
const CLIENT_ID = '1538484436272676954';
const WEBHOOK_SECRET = 'GIZLI_SIFRE_12345';
const DB_FILE = path.join(__dirname, 'accounts.json');

const userGenCount = new Map();

function getDB() {
  if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, '{}');
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch (e) { return {}; }
}

function saveDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// 1. EXPRESS WEBHOOK SUNUCUSU
const app = express();
app.use(express.json());

app.post('/api/add-account', (req, res) => {
  const { secret, targetYear, filterType, accountData } = req.body;

  if (secret !== WEBHOOK_SECRET) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const db = getDB();
  const key = `${targetYear}_${filterType}`;
  if (!db[key]) db[key] = [];

  if (!db[key].some(acc => acc.id === accountData.id)) {
    db[key].push(accountData);
    saveDB(db);
    console.log(`[WEBHOOK ALINDI] ${key} katmanına hesap eklendi. Toplam: ${db[key].length}`);
  }

  return res.json({ success: true, stockCount: db[key].length });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Webhook server listening on port ${PORT}`));

// 2. DISCORD BOT KOMUTLARI REGISTER
const commands = [
  new SlashCommandBuilder().setName('gen').setDescription('Starts the RadarBlox generator.'),
  bulkModule.data // /bulk-gen komutu da Discord'a kayıt ediliyor
];

const rest = new REST({ version: '10' }).setToken(TOKEN);

client.once('ready', async () => {
  console.log(`${client.user.tag} is online and ready!`);
  try {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log('Komutlar başarıyla kaydedildi.');
  } catch (error) {
    console.error(error);
  }
});

client.on('interactionCreate', async (interaction) => {
  // Eğer etkileşim /bulk-gen ile ilgiliyse doğrudan bulk.js yönetir
  if (
    (interaction.isChatInputCommand() && interaction.commandName === 'bulk-gen') ||
    (interaction.isButton() && interaction.customId.startsWith('bulk_')) ||
    (interaction.isStringSelectMenu() && interaction.customId.startsWith('bulk_'))
  ) {
    return await bulkModule.handleInteraction(interaction, userGenCount);
  }

  // Normal /gen komutu ve buton mantığı (Dokunulmadı)
  if (interaction.isChatInputCommand() && interaction.commandName === 'gen') {
    const yearSelect = new StringSelectMenuBuilder()
      .setCustomId(`select_year_${interaction.user.id}`)
      .setPlaceholder('Select Account Creation Year (2006 - 2016)')
      .addOptions(Array.from({ length: 11 }, (_, i) => {
        const year = (2006 + i).toString();
        return { label: year, value: year, description: `Accounts created in ${year}` };
      }));

    await interaction.reply({
      content: 'Please select the creation year for the account:',
      components: [new ActionRowBuilder().addComponents(yearSelect)]
    });
  }

  if (interaction.isStringSelectMenu() && interaction.customId.startsWith('select_year_')) {
    const ownerId = interaction.customId.split('_')[2];
    if (interaction.user.id !== ownerId) return;

    const selectedYear = interaction.values[0];
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`gen_no_number_${selectedYear}_${interaction.user.id}`).setLabel('no_number_user').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`gen_year_user_${selectedYear}_${interaction.user.id}`).setLabel('year_user').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`gen_double_user_${selectedYear}_${interaction.user.id}`).setLabel('double_user').setStyle(ButtonStyle.Danger)
    );

    await interaction.update({ content: `Selected Year: **/gen year: ${selectedYear}**\nPlease select username pattern:`, components: [row] });
  }

  if (interaction.isButton() && interaction.customId.startsWith('gen_')) {
    const parts = interaction.customId.split('_');
    const filterType = `${parts[1]}_${parts[2]}`;
    const targetYear = parts[3];
    const ownerId = parts[4];

    if (interaction.user.id !== ownerId) return;

    await interaction.deferReply({ ephemeral: true });

    const key = `${targetYear}_${filterType}`;
    const db = getDB();
    const stock = db[key] || [];

    if (stock.length === 0) {
      return await interaction.editReply({ content: '❌ Stok geçici olarak boş! Scraper yeni hesaplar arıyor, lütfen 10 saniye sonra tekrar deneyin.' });
    }

    const accountData = stock.shift();
    db[key] = stock;
    saveDB(db);

    const currentCount = (userGenCount.get(interaction.user.id) || 0) + 1;
    userGenCount.set(interaction.user.id, currentCount);

    const embed = new EmbedBuilder()
      .setTitle(`✨ RADARBLOX PREMIUM ACCOUNT GENERATED`)
      .setURL(`https://www.roblox.com/users/${accountData.id}/profile`)
      .setColor('#2B2D31')
      .setThumbnail(accountData.avatarUrl)
      .addFields(
        { name: '👤 Username', value: `\`${accountData.name}\``, inline: true },
        { name: '📅 Creation Date', value: `\`${accountData.createdDate}\``, inline: true }
      )
      .setImage(accountData.avatarUrl)
      .setFooter({ text: `RadarBlox Generator • Total Generations by you: ${currentCount}` })
      .setTimestamp();

    try {
      await interaction.user.send({ embeds: [embed] });
      await interaction.editReply({ content: '✅ Account generated! Check your DMs.' });
    } catch (e) {
      await interaction.editReply({ content: '❌ Please open your DMs!' });
    }
  }
});

client.login(TOKEN);
