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
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ],
});

// CONFIGURATION
const TOKEN = 'BURAYA_BOT_TOKENINI_YAPIŞTIR';
const CLIENT_ID = '1538484436272676954';
const DB_FILE = path.join(__dirname, 'accounts.json');

const userGenCount = new Map();

const YEAR_ID_RANGES = {
  '2006': { min: 1, max: 20000 },
  '2007': { min: 20001, max: 200000 },
  '2008': { min: 200001, max: 1500000 },
  '2009': { min: 1500001, max: 5000000 },
  '2010': { min: 5000001, max: 13000000 },
  '2011': { min: 13000001, max: 25000000 },
  '2012': { min: 25000001, max: 40000000 },
  '2013': { min: 40000001, max: 60000000 },
  '2014': { min: 60000001, max: 80000000 },
  '2015': { min: 80000001, max: 110000000 },
  '2016': { min: 110000001, max: 180000000 }
};

// JSON Dosya Yönetim Fonksiyonları
function getDB() {
  if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, '{}');
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (e) {
    return {};
  }
}

function saveDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

const commands = [
  new SlashCommandBuilder()
    .setName('gen')
    .setDescription('Starts the RadarBlox generator.')
];

const rest = new REST({ version: '10' }).setToken(TOKEN);

client.once('ready', async () => {
  console.log(`${client.user.tag} is online and ready!`);
  try {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log('Slash command (/gen) successfully registered.');
  } catch (error) {
    console.error('Error registering slash command:', error);
  }

  // Arka Plan Stoklama Motoru Başlatılır
  startAutoStocker();
});

client.on('interactionCreate', async (interaction) => {
  
  if (interaction.isChatInputCommand() && interaction.commandName === 'gen') {
    const yearSelect = new StringSelectMenuBuilder()
      .setCustomId(`select_year_${interaction.user.id}`)
      .setPlaceholder('Select Account Creation Year (2006 - 2016)')
      .addOptions(
        Array.from({ length: 11 }, (_, i) => {
          const year = (2006 + i).toString();
          return { label: year, value: year, description: `Accounts created in ${year}` };
        })
      );

    const row = new ActionRowBuilder().addComponents(yearSelect);

    await interaction.reply({
      content: 'Please select the creation year for the account:',
      components: [row],
      ephemeral: false
    });
  }

  if (interaction.isStringSelectMenu() && interaction.customId.startsWith('select_year_')) {
    const ownerId = interaction.customId.split('_')[2];

    if (interaction.user.id !== ownerId) {
      return await interaction.reply({ content: '❌ This menu is not for you! Run `/gen` to start your own.', ephemeral: true });
    }

    const selectedYear = interaction.values[0];

    const btnNoNumber = new ButtonBuilder()
      .setCustomId(`gen_no_number_${selectedYear}_${interaction.user.id}`)
      .setLabel('no_number_user')
      .setStyle(ButtonStyle.Primary);

    const btnYearUser = new ButtonBuilder()
      .setCustomId(`gen_year_user_${selectedYear}_${interaction.user.id}`)
      .setLabel('year_user')
      .setStyle(ButtonStyle.Success);

    const btnDoubleUser = new ButtonBuilder()
      .setCustomId(`gen_double_user_${selectedYear}_${interaction.user.id}`)
      .setLabel('double_user')
      .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder().addComponents(btnNoNumber, btnYearUser, btnDoubleUser);

    await interaction.update({
      content: `Selected Year: **/gen year: ${selectedYear}**\nPlease select username pattern:`,
      components: [row]
    });
  }

  if (interaction.isButton() && interaction.customId.startsWith('gen_')) {
    const parts = interaction.customId.split('_');
    const filterType = `${parts[1]}_${parts[2]}`;
    const targetYear = parts[3];
    const ownerId = parts[4];

    if (interaction.user.id !== ownerId) {
      return await interaction.reply({ content: '❌ These buttons are not for you! Run `/gen` to start your own.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const key = `${targetYear}_${filterType}`;
    const db = getDB();
    const stock = db[key] || [];

    if (stock.length === 0) {
      return await interaction.editReply({ 
        content: '⏳ **Stock is currently empty for this combination! System is finding new accounts in background. Please try again in 15 seconds.**' 
      });
    }

    // Stoktan en eski hesabı çek ve kaydet
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
      await interaction.editReply({ content: '✅ Account generated successfully! Check your DMs.' });
    } catch (e) {
      await interaction.editReply({ content: '❌ Could not send DM! Please enable direct messages in your privacy settings.' });
    }
  }
});

// Roblox API Güvenli Arama Fonksiyonu
async function fetchSingleRobloxAccount(targetYear, filterType) {
  const range = YEAR_ID_RANGES[targetYear] || { min: 1, max: 50000000 };

  for (let i = 0; i < 20; i++) {
    const randomUserId = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;

    try {
      const res = await axios.get(`https://users.roblox.com/v1/users/${randomUserId}`, { timeout: 2500 });
      const data = res.data;
      const accountYear = new Date(data.created).getFullYear().toString();

      if (accountYear !== targetYear) continue;

      const username = data.name;

      if (filterType === 'no_number' && /\d/.test(username)) continue;
      if (filterType === 'year_user' && !/(19\d{2}|20\d{2})/.test(username)) continue;
      if (filterType === 'double_user' && !/(\d{2})\1/.test(username)) continue;

      return {
        id: data.id,
        name: data.name,
        createdDate: new Date(data.created).toLocaleDateString('en-US'),
        isBanned: data.isBanned,
        lastOnline: 'Hidden / Private',
        inventoryInfo: 'Scanned (Public/Private)',
        avatarUrl: `https://www.roblox.com/headshot-thumbnail/image?userId=${data.id}&width=420&height=420&format=png`
      };

    } catch (err) {
      // Rate Limit durumunda dinlenme
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }
  return null;
}

// Render/Sunucu Üzerinde 7/24 Kesintisiz Arka Plan Stoklayıcı
async function startAutoStocker() {
  const years = Object.keys(YEAR_ID_RANGES);
  const filters = ['no_number', 'year_user', 'double_user'];

  while (true) {
    for (const year of years) {
      for (const filter of filters) {
        const key = `${year}_${filter}`;
        const db = getDB();
        const currentStock = db[key] || [];

        // Her kategori için maksimum 3 hazır stok tutar
        if (currentStock.length < 3) {
          const acc = await fetchSingleRobloxAccount(year, filter);
          if (acc) {
            currentStock.push(acc);
            db[key] = currentStock;
            saveDB(db);
            console.log(`[STOK EKLENDI] ${key} -> Toplam Stok: ${currentStock.length}`);
          }
        }
        // Roblox IP engeli yememek için istekler arası güvenli bekleme
        await new Promise(resolve => setTimeout(resolve, 1200));
      }
    }
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
}

client.login(TOKEN);
