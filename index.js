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
const ROLE_ID = '1538940771967700992';

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

// 2. DISCORD BOT KOMUTLARI
const commands = [
  new SlashCommandBuilder().setName('gen').setDescription('Starts the RadarBlox generator.'),
  new SlashCommandBuilder().setName('bulk-gen').setDescription('Generate multiple accounts.')
];

client.once('ready', async () => {
  console.log(`${client.user.tag} is online and ready!`);
  try {
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log('Komutlar başarıyla yüklendi.');
  } catch (error) {
    console.error('Komut yükleme hatası:', error);
  }
});

client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      await interaction.deferReply({ ephemeral: true }).catch(() => {});
    } else if (interaction.isButton() || interaction.isStringSelectMenu()) {
      await interaction.deferUpdate().catch(() => {});
    }
  } catch (err) {
    console.error('Defer hatası:', err);
  }

  // --- /gen KOMUTU ---
  if (interaction.isChatInputCommand() && interaction.commandName === 'gen') {
    const yearSelect = new StringSelectMenuBuilder()
      .setCustomId(`select_year_${interaction.user.id}`)
      .setPlaceholder('Select Account Creation Year (2006 - 2016)')
      .addOptions(Array.from({ length: 11 }, (_, i) => {
        const year = (2006 + i).toString();
        return { label: year, value: year, description: `Accounts created in ${year}` };
      }));

    await interaction.editReply({
      content: 'Please select the creation year for the account:',
      components: [new ActionRowBuilder().addComponents(yearSelect)]
    });
  }

  // --- /bulk-gen KOMUTU ---
  if (interaction.isChatInputCommand() && interaction.commandName === 'bulk-gen') {
    if (!interaction.member.roles.cache.has(ROLE_ID)) {
      return await interaction.editReply({ content: '❌ You need the **Bulk-Gen Customer** role to use this command.' });
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`bulk_amt_5_${interaction.user.id}`).setLabel('5 Accounts').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`bulk_amt_10_${interaction.user.id}`).setLabel('10 Accounts').setStyle(ButtonStyle.Success)
    );

    await interaction.editReply({ content: 'Select amount to generate:', components: [row] });
  }

  // --- /bulk-gen Miktar Seçimi ---
  if (interaction.isButton() && interaction.customId.startsWith('bulk_amt_')) {
    const parts = interaction.customId.split('_');
    const amount = parts[2];
    const ownerId = parts[3];

    if (interaction.user.id !== ownerId) return;

    const yearSelect = new StringSelectMenuBuilder()
      .setCustomId(`bulk_year_${amount}_${interaction.user.id}`)
      .setPlaceholder('Select Account Creation Year (2006 - 2016)')
      .addOptions(Array.from({ length: 11 }, (_, i) => {
        const year = (2006 + i).toString();
        return { label: year, value: year, description: `Accounts created in ${year}` };
      }));

    await interaction.editReply({
      content: `Selected Amount: **${amount}**\nPlease select the creation year:`,
      components: [new ActionRowBuilder().addComponents(yearSelect)]
    });
  }

  // --- /bulk-gen Yıl Seçimi ---
  if (interaction.isStringSelectMenu() && interaction.customId.startsWith('bulk_year_')) {
    const parts = interaction.customId.split('_');
    const amount = parts[2];
    const ownerId = parts[3];

    if (interaction.user.id !== ownerId) return;

    const selectedYear = interaction.values[0];
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`bulk_gen_no_number_${selectedYear}_${amount}_${interaction.user.id}`).setLabel('no_number_user').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`bulk_gen_year_user_${selectedYear}_${amount}_${interaction.user.id}`).setLabel('year_user').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`bulk_gen_double_user_${selectedYear}_${amount}_${interaction.user.id}`).setLabel('double_user').setStyle(ButtonStyle.Danger)
    );

    await interaction.editReply({ content: `Selected Year: **${selectedYear}** | Amount: **${amount}**\nPlease select username pattern:`, components: [row] });
  }

  // --- /bulk-gen Hesap Çekme İşlemi ---
  if (interaction.isButton() && interaction.customId.startsWith('bulk_gen_')) {
    const parts = interaction.customId.split('_');
    const filterType = `${parts[2]}_${parts[3]}`;
    const targetYear = parts[4];
    const amount = parseInt(parts[5]);
    const ownerId = parts[6];

    if (interaction.user.id !== ownerId) return;

    const key = `${targetYear}_${filterType}`;
    const db = getDB();
    const stock = db[key] || [];

    if (stock.length < amount) {
      return await interaction.editReply({ content: `❌ Yetersiz stok! Gerekli: ${amount}, Mevcut: ${stock.length}`, components: [] });
    }

    const generatedAccounts = [];
    for (let i = 0; i < amount; i++) {
      generatedAccounts.push(stock.shift());
    }
    db[key] = stock;
    saveDB(db);

    const currentCount = (userGenCount.get(interaction.user.id) || 0) + amount;
    userGenCount.set(interaction.user.id, currentCount);

    const embeds = generatedAccounts.map((accountData, index) => {
      const isPublic = accountData.inventoryInfo ? accountData.inventoryInfo : 'Public';
      const statusText = accountData.isBanned ? '🔴 Banned' : '🟢 Active';
      
      return new EmbedBuilder()
        .setTitle(`👑 BULK PREMIUM ACCOUNT #${index + 1}`)
        .setURL(`https://www.roblox.com/users/${accountData.id}/profile`)
        .setColor('#2F3136')
        .setThumbnail(accountData.avatarUrl)
        .addFields(
          { name: '👤 Username', value: `\`\`\`${accountData.name}\`\`\``, inline: false },
          { name: '📅 Creation Date', value: `\`${accountData.createdDate}\``, inline: true },
          { name: '🛡️ Status', value: statusText, inline: true },
          { name: '🌐 Last Activity', value: `\`${accountData.lastOnline || 'Offline'}\``, inline: true },
          { name: '🎒 Inventory', value: `\`${isPublic}\``, inline: false }
        )
        .setFooter({ text: `RadarBlox Premium Bulk • Total Generations: ${currentCount}`, iconURL: client.user.displayAvatarURL() })
        .setTimestamp();
    });

    try {
      await interaction.user.send({ embeds: embeds });
      await interaction.editReply({ content: `✅ ${amount} accounts generated and sent to your DMs!`, components: [] });
    } catch (e) {
      await interaction.editReply({ content: '❌ Please open your DMs!', components: [] });
    }
  }

  // --- /gen Yıl Seçimi ---
  if (interaction.isStringSelectMenu() && interaction.customId.startsWith('select_year_')) {
    const ownerId = interaction.customId.split('_')[2];
    if (interaction.user.id !== ownerId) return;

    const selectedYear = interaction.values[0];
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`gen_no_number_${selectedYear}_${interaction.user.id}`).setLabel('no_number_user').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`gen_year_user_${selectedYear}_${interaction.user.id}`).setLabel('year_user').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`gen_double_user_${selectedYear}_${interaction.user.id}`).setLabel('double_user').setStyle(ButtonStyle.Danger)
    );

    await interaction.editReply({ content: `Selected Year: **/gen year: ${selectedYear}**\nPlease select username pattern:`, components: [row] });
  }

  // --- /gen Hesap Çekme İşlemi ---
  if (interaction.isButton() && interaction.customId.startsWith('gen_')) {
    const parts = interaction.customId.split('_');
    const filterType = `${parts[1]}_${parts[2]}`;
    const targetYear = parts[3];
    const ownerId = parts[4];

    if (interaction.user.id !== ownerId) return;

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

    const isPublic = accountData.inventoryInfo ? accountData.inventoryInfo : 'Public';
    const statusText = accountData.isBanned ? '🔴 Banned' : '🟢 Active';

    const embed = new EmbedBuilder()
      .setTitle(`👑 RADARBLOX PREMIUM ACCOUNT GENERATED`)
      .setURL(`https://www.roblox.com/users/${accountData.id}/profile`)
      .setColor('#2F3136')
      .setThumbnail(accountData.avatarUrl)
      .addFields(
        { name: '👤 Username', value: `\`\`\`${accountData.name}\`\`\``, inline: false },
        { name: '📅 Creation Date', value: `\`${accountData.createdDate}\``, inline: true },
        { name: '🛡️ Status', value: statusText, inline: true },
        { name: '🌐 Last Activity', value: `\`${accountData.lastOnline || 'Offline'}\``, inline: true },
        { name: '🎒 Inventory', value: `\`${isPublic}\``, inline: false }
      )
      .setFooter({ text: `RadarBlox Premium • Total Generations by you: ${currentCount}`, iconURL: client.user.displayAvatarURL() })
      .setTimestamp();

    try {
      await interaction.user.send({ embeds: [embed] });
      await interaction.editReply({ content: '✅ Account generated! Check your DMs.' });
    } catch (e) {
      await interaction.editReply({ content: '❌ Please open your DMs!' });
    }
  }
});

require('./generator.js');
client.login(TOKEN);
ilder()
      .setTitle(`✨ RADARBLOX PREMIUM ACCOUNT GENERATED`)
      .setURL(`https://www.roblox.com/users/${accountData.id}/profile`)
      .setColor('#2B2D31')
      .setThumbnail(accountData.avatarUrl)
      .addFields(
        { name: '👤 Username', value: `\`${accountData.name}\``, inline: true },
        { name: '📅 Creation Date', value: `\`${accountData.createdDate}\``, inline: true },
        { name: '🛡️ Status', value: accountData.isBanned ? '❌ Banned' : '✅ Active', inline: true },
        { name: '🌐 Last Online', value: `\`${accountData.lastOnline}\``, inline: true },
        { name: '🎒 Inventory / Items', value: `\`${accountData.inventoryInfo}\``, inline: false }
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
require('./generator.js');
client.login(TOKEN);
