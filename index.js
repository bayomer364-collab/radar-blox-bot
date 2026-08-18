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
const https = require('https');

// Prevent bot crashes due to unhandled promise rejections
process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
});

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

// Configs
const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = '1538484436272676954';
const WEBHOOK_SECRET = 'GIZLI_SIFRE_12345';
const ROLE_ID = '1538940771967700992';
const DB_FILE = path.join(__dirname, 'accounts.json');

const userGenCount = new Map();

// Separate Cooldowns (/gen: 25s, /bulk-gen: 50s)
const cooldownsGen = new Map();
const cooldownsBulk = new Map();

// --- MEMORY DB SETUP ---
let memoryDB = {};

if (fs.existsSync(DB_FILE)) {
  try { 
    memoryDB = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); 
  } catch (e) { 
    memoryDB = {}; 
  }
}

function getDB() {
  return memoryDB;
}

function saveDB() {
  fs.writeFile(DB_FILE, JSON.stringify(memoryDB, null, 2), 'utf8', (err) => {
    if (err) {
      console.error('Kayıt hatası:', err);
    }
  });
}

function fetchJSON(url) {
  return new Promise((resolve) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); } 
        catch (e) { resolve({ status: res.statusCode, data: null }); }
      });
    }).on('error', () => {
      resolve({ status: 500, data: null });
    });
  });
}

// Resimdeki Yeni ve Genişletilmiş Metod Doğrulama Mantığı
function validateUsernameByFilter(username, filterType) {
  if (/_/.test(username)) return null;

  switch (filterType) {
    case 'cross_user': {
      const crossMatch = username.match(/^([a-zA-Z0-9]{2,4}).*?\1$/);
      if (crossMatch && username.length > crossMatch[1].length * 2) return true;
      break;
    }
    case 'double_user': {
      if (/(\d{2})\1/.test(username)) return true;
      break;
    }
    case 'year_user': {
      if (/([a-zA-Z]+)(19\d{2}|20\d{2})(\d*)$/.test(username) || /(19\d{2}|20\d{2})/.test(username)) return true;
      break;
    }
    case '123_method': {
      if (/^123|123$/.test(username)) return true;
      break;
    }
    case '321_method': {
      if (/^321|321$/.test(username)) return true;
      break;
    }
    case '2_number_method': {
      const digits = username.match(/\d/g);
      if (digits && digits.length === 2) return true;
      break;
    }
    case '4_number_method': {
      const digits = username.match(/\d/g);
      if (digits && digits.length === 4) return true;
      break;
    }
  }
  return false;
}

// 1. EXPRESS WEBHOOK & HEALTH CHECK SERVER
const app = express();
app.use(express.json());

app.get('/', (req, res) => {
  res.status(200).send('Bot aktif ve çalışıyor!');
});

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.post('/api/add-account', (req, res) => {
  const { secret, targetYear, filterType, accountData } = req.body;
  console.log('Webhook received (Dual-Stock):', { targetYear, filterType, accountId: accountData?.id });

  if (secret !== WEBHOOK_SECRET) {
    console.warn('Invalid webhook secret (Unauthorized)');
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const db = getDB();
  const genKey = `gen_${targetYear}_${filterType}`;
  const bulkKey = `bulk_${targetYear}_${filterType}`;

  if (!db[genKey]) db[genKey] = [];
  if (!db[bulkKey]) db[bulkKey] = [];

  let added = false;

  if (!db[genKey].some(acc => acc.id === accountData.id)) {
    db[genKey].push(accountData);
    added = true;
  }

  if (!db[bulkKey].some(acc => acc.id === accountData.id)) {
    db[bulkKey].push(accountData);
    added = true;
  }

  if (added) {
    saveDB();
  }

  return res.json({ success: true, genStockCount: db[genKey].length, bulkStockCount: db[bulkKey].length });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Webhook server listening on port ${PORT}`);

  // Otomatik Kendini Uyandırma (Self-Ping) - Her 4 dakikada bir bot kendine istek atar
  const SELF_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
  setInterval(() => {
    https.get(SELF_URL, (res) => {
      res.on('data', () => {});
    }).on('error', (err) => {
      // Sessizce geç veya logla
    });
  }, 4 * 60 * 1000);
});

// 2. DISCORD BOT COMMANDS
const commands = [
  new SlashCommandBuilder().setName('gen').setDescription('Generate a single premium account.'),
  new SlashCommandBuilder().setName('bulk-gen').setDescription('Generate multiple premium accounts.'),
  new SlashCommandBuilder().setName('stock').setDescription('Check current detailed pool stocks.')
];

client.once('ready', async () => {
  console.log(`${client.user.tag} is online and ready!`);
  try {
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log('Commands successfully loaded.');
  } catch (error) {
    console.error('Command loading error:', error);
  }
});

client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const now = Date.now();
      const isBulk = interaction.commandName === 'bulk-gen';
      const cooldownMap = isBulk ? cooldownsBulk : cooldownsGen;
      const timeLimit = isBulk ? 50000 : 25000;

      const lastUsed = cooldownMap.get(interaction.user.id);
      if (lastUsed && (now - lastUsed < timeLimit)) {
        const remaining = ((timeLimit - (now - lastUsed)) / 1000).toFixed(1);
        return await interaction.reply({
          content: `⏱️ Please wait **${remaining}s** before using this command again`,
          flags: [1 << 6]
        });
      }

      if (interaction.commandName !== 'stock') {
        cooldownMap.set(interaction.user.id, now);
      }
      
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ flags: [1 << 6] }).catch(() => {});
      }
    } else if (interaction.isButton() || interaction.isStringSelectMenu()) {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferUpdate().catch(() => {});
      }
    }

    // --- /stock COMMAND ---
    if (interaction.isChatInputCommand() && interaction.commandName === 'stock') {
      const db = getDB();
      const years = Array.from({ length: 11 }, (_, i) => (2006 + i).toString());
      const filterTypes = ['cross_user', 'double_user', 'year_user', '123_method', '321_method', '2_number_method', '4_number_method'];

      let genText = '';
      let bulkText = '';

      for (const year of years) {
        for (const filter of filterTypes) {
          const genCount = (db[`gen_${year}_${filter}`] || []).length;
          const bulkCount = (db[`bulk_${year}_${filter}`] || []).length;

          genText += `• **${year}** ${filter}: \`${genCount}\`\n`;
          bulkText += `• **${year}** ${filter}: \`${bulkCount}\`\n`;
        }
      }

      const embed = new EmbedBuilder()
        .setTitle('📊 Detailed Stock Status')
        .setColor('#2F3136')
        .addFields(
          { name: '🔹 Gen Pool', value: genText.slice(0, 1024), inline: true },
          { name: '🔸 Bulk-Gen Pool', value: bulkText.slice(0, 1024), inline: true }
        )
        .setTimestamp();

      return await interaction.editReply({ embeds: [embed] });
    }

    // --- /gen COMMAND ---
    if (interaction.isChatInputCommand() && interaction.commandName === 'gen') {
      const yearSelect = new StringSelectMenuBuilder()
        .setCustomId(`select_year_${interaction.user.id}`)
        .setPlaceholder('Select Creation Year (2006 - 2016)')
        .addOptions(Array.from({ length: 11 }, (_, i) => {
          const year = (2006 + i).toString();
          return { label: year, value: year, description: `Accounts created in ${year}` };
        }));

      return await interaction.editReply({
        content: 'Please choose the creation year:',
        components: [new ActionRowBuilder().addComponents(yearSelect)]
      });
    }

    // --- /bulk-gen COMMAND ---
    if (interaction.isChatInputCommand() && interaction.commandName === 'bulk-gen') {
      if (!interaction.member.roles.cache.has(ROLE_ID)) {
        return await interaction.editReply({ content: '❌ You need the **Bulk-Gen Customer** role to use this command.' });
      }

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`bulk_amt_5_${interaction.user.id}`).setLabel('5 Accounts').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`bulk_amt_10_${interaction.user.id}`).setLabel('10 Accounts').setStyle(ButtonStyle.Success)
      );

      return await interaction.editReply({ content: 'Select quantity to generate:', components: [row] });
    }

    // --- /bulk-gen Amount Selection ---
    if (interaction.isButton() && interaction.customId.startsWith('bulk_amt_')) {
      const parts = interaction.customId.split('_');
      const amount = parts[2];
      const ownerId = parts[3];

      if (interaction.user.id !== ownerId) {
        return await interaction.followUp({ content: '❌ You cannot interact with someone else\'s menu.', flags: [1 << 6] });
      }

      const yearSelect = new StringSelectMenuBuilder()
        .setCustomId(`bulk_year_${amount}_${interaction.user.id}`)
        .setPlaceholder('Select Creation Year (2006 - 2016)')
        .addOptions(Array.from({ length: 11 }, (_, i) => {
          const year = (2006 + i).toString();
          return { label: year, value: year, description: `Accounts created in ${year}` };
        }));

      return await interaction.editReply({
        content: `Selected Amount: **${amount}**\nPlease select the creation year:`,
        components: [new ActionRowBuilder().addComponents(yearSelect)]
      });
    }

    // --- /bulk-gen Year Selection ---
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('bulk_year_')) {
      const parts = interaction.customId.split('_');
      const amount = parts[2];
      const ownerId = parts[3];

      if (interaction.user.id !== ownerId) {
        return await interaction.followUp({ content: '❌ You cannot interact with someone else\'s menu.', flags: [1 << 6] });
      }

      const selectedYear = interaction.values[0];
      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`bulk_gen_cross_user_${selectedYear}_${amount}_${interaction.user.id}`).setLabel('cross_user').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`bulk_gen_double_user_${selectedYear}_${amount}_${interaction.user.id}`).setLabel('double_user').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`bulk_gen_year_user_${selectedYear}_${amount}_${interaction.user.id}`).setLabel('year_user').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`bulk_gen_123_method_${selectedYear}_${amount}_${interaction.user.id}`).setLabel('123_method').setStyle(ButtonStyle.Danger)
      );
      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`bulk_gen_321_method_${selectedYear}_${amount}_${interaction.user.id}`).setLabel('321_method').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`bulk_gen_2_number_method_${selectedYear}_${amount}_${interaction.user.id}`).setLabel('2_number_method').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`bulk_gen_4_number_method_${selectedYear}_${amount}_${interaction.user.id}`).setLabel('4_number_method').setStyle(ButtonStyle.Secondary)
      );

      return await interaction.editReply({ content: `Selected Year: **${selectedYear}** | Amount: **${amount}**\nPlease select username pattern:`, components: [row1, row2] });
    }

    // --- /bulk-gen Account Generation Process ---
    if (interaction.isButton() && interaction.customId.startsWith('bulk_gen_')) {
      const parts = interaction.customId.split('_');
      let filterType = '';
      let targetYear = '';
      let amount = 0;
      let ownerId = '';

      if (parts[2] === 'cross' && parts[3] === 'user') {
        filterType = 'cross_user';
        targetYear = parts[4];
        amount = parseInt(parts[5]);
        ownerId = parts[6];
      } else if (parts[2] === 'double' && parts[3] === 'user') {
        filterType = 'double_user';
        targetYear = parts[4];
        amount = parseInt(parts[5]);
        ownerId = parts[6];
      } else if (parts[2] === 'year' && parts[3] === 'user') {
        filterType = 'year_user';
        targetYear = parts[4];
        amount = parseInt(parts[5]);
        ownerId = parts[6];
      } else if (parts[3] === 'method') {
        filterType = `${parts[2]}_method`;
        targetYear = parts[4];
        amount = parseInt(parts[5]);
        ownerId = parts[6];
      } else if (parts[4] === 'method') {
        filterType = `${parts[2]}_${parts[3]}_method`;
        targetYear = parts[5];
        amount = parseInt(parts[6]);
        ownerId = parts[7];
      }

      if (interaction.user.id !== ownerId) {
        return await interaction.followUp({ content: '❌ You cannot interact with someone else\'s menu.', flags: [1 << 6] });
      }

      const key = `bulk_${targetYear}_${filterType}`;
      const db = getDB();
      const stock = db[key] || [];

      if (stock.length < amount) {
        return await interaction.editReply({ content: `❌ Not enough stock for bulk generation! Current bulk stock: **${stock.length}**`, components: [] });
      }

      const generatedAccounts = [];
      for (let i = 0; i < amount; i++) {
        generatedAccounts.push(stock.shift());
      }
      db[key] = stock;
      saveDB();

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
        await interaction.editReply({ content: '✅ Accounts successfully sent to your DMs!', components: [] });
      } catch (e) {
        await interaction.editReply({ content: '❌ Please open your DMs!', components: [] });
      }
    }

    // --- /gen Year Selection ---
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('select_year_')) {
      const selectedYear = interaction.values[0];
      const ownerId = interaction.customId.split('_')[2];
      
      if (interaction.user.id !== ownerId) {
        return await interaction.followUp({ content: '❌ You cannot interact with someone else\'s menu.', flags: [1 << 6] });
      }

      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`gen_cross_user_${selectedYear}_${ownerId}`).setLabel('cross_user').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`gen_double_user_${selectedYear}_${ownerId}`).setLabel('double_user').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`gen_year_user_${selectedYear}_${ownerId}`).setLabel('year_user').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`gen_123_method_${selectedYear}_${ownerId}`).setLabel('123_method').setStyle(ButtonStyle.Danger)
      );
      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`gen_321_method_${selectedYear}_${ownerId}`).setLabel('321_method').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`gen_2_number_method_${selectedYear}_${ownerId}`).setLabel('2_number_method').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`gen_4_number_method_${selectedYear}_${ownerId}`).setLabel('4_number_method').setStyle(ButtonStyle.Secondary)
      );

      return await interaction.editReply({ 
        content: `Selected Year: **${selectedYear}**\nNow, select a username pattern:`, 
        components: [row1, row2] 
      });
    }

    // --- /gen Account Generation Process (Stock + Live Fallback Scan) ---
    if (interaction.isButton() && interaction.customId.startsWith('gen_')) {
      const parts = interaction.customId.split('_');
      let filterType = '';
      let targetYear = '';
      let ownerId = '';

      if (parts[1] === 'cross' && parts[2] === 'user') {
        filterType = 'cross_user';
        targetYear = parts[3];
        ownerId = parts[4];
      } else if (parts[1] === 'double' && parts[2] === 'user') {
        filterType = 'double_user';
        targetYear = parts[3];
        ownerId = parts[4];
      } else if (parts[1] === 'year' && parts[2] === 'user') {
        filterType = 'year_user';
        targetYear = parts[3];
        ownerId = parts[4];
      } else if (parts[2] === 'method') {
        filterType = `${parts[1]}_method`;
        targetYear = parts[3];
        ownerId = parts[4];
      } else if (parts[3] === 'method') {
        filterType = `${parts[1]}_${parts[2]}_method`;
        targetYear = parts[4];
        ownerId = parts[5];
      }

      if (interaction.user.id !== ownerId) {
        return await interaction.followUp({ content: '❌ You cannot interact with someone else\'s menu.', flags: [1 << 6] });
      }

      const key = `gen_${targetYear}_${filterType}`;
      const db = getDB();
      const stock = db[key] || [];

      let accountData = null;

      if (stock.length > 0) {
        accountData = stock.shift();
        db[key] = stock;
        saveDB();
      } else {
        await interaction.editReply({ content: `🔄 Single-gen pool is empty! Scanning live for ${targetYear} - ${filterType}...` });

        const baseIdMap = {
          '2006': 100000, '2007': 500000, '2008': 1500000, '2009': 3000000,
          '2010': 5000001, '2011': 13000001, '2012': 25000001, '2013': 40000001,
          '2014': 60000001, '2015': 80000001, '2016': 110000000
        };

        let startId = baseIdMap[targetYear] || 5000000;
        let found = false;

        for (let i = 0; i < 25; i++) {
          const testId = startId + Math.floor(Math.random() * 5000);
          const res = await fetchJSON(`https://users.roblox.com/v1/users/${testId}`);

          if (res.status === 429) break;
          if (!res.data || !res.data.name) continue;

          const userDetails = res.data;
          const createdDate = new Date(userDetails.created);
          const accountYear = createdDate.getFullYear().toString();

          if (accountYear === targetYear && validateUsernameByFilter(userDetails.name, filterType)) {
            const avatarRes = await fetchJSON(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${testId}&size=150x150&format=Png&isCircular=false`);
            const avatarUrl = (avatarRes.data && avatarRes.data.data && avatarRes.data.data[0]) ? avatarRes.data.data[0].imageUrl : 'https://tr.rbxcdn.com/30day-avatar-headshot/150/150/Avatar/Png';

            accountData = {
              id: userDetails.id.toString(),
              name: userDetails.name,
              createdDate: userDetails.created.split('T')[0],
              isBanned: userDetails.isBanned || false,
              lastOnline: userDetails.isBanned ? 'Banned' : 'Active',
              inventoryInfo: 'Public',
              avatarUrl: avatarUrl
            };
            found = true;
            break;
          }
        }

        if (!found) {
          return await interaction.editReply({ content: `❌ Could not find an account matching ${targetYear} - ${filterType} live. Please try again later or wait for generator stock.` });
        }
      }

      const currentCount = (userGenCount.get(interaction.user.id) || 0) + 1;
      userGenCount.set(interaction.user.id, currentCount);

      const isPublic = accountData.inventoryInfo ? accountData.inventoryInfo : 'Public';
      const statusText = accountData.isBanned ? '🔴 Banned' : '🟢 Active';

      const embed = new EmbedBuilder()
        .setTitle('👑 PREMIUM ACCOUNT GENERATED')
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
        .setFooter({ text: `RadarBlox Premium • Total Generations: ${currentCount}`, iconURL: client.user.displayAvatarURL() })
        .setTimestamp();

      try {
        await interaction.user.send({ embeds: [embed] });
        await interaction.editReply({ content: '✅ Account successfully sent to your DMs!', components: [] });
      } catch (e) {
        await interaction.editReply({ content: '❌ Please open your DMs!', components: [] });
      }
    }

  } catch (err) {
    console.error('Interaction error:', err);
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: '❌ An error occurred while processing this command.', components: [] }).catch(() => {});
      } else {
        await interaction.reply({ content: '❌ An error occurred while processing this command.', flags: [1 << 6] }).catch(() => {});
      }
    } catch {}
  }
});

client.login(TOKEN);
