const { 
  Client, 
  GatewayIntentBits, 
  ActionRowBuilder, 
  StringSelectMenuBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  EmbedBuilder,
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  REST,
  Routes
} = require('discord.js');
const express = require('express');
const fs = require('fs');
const path = require('path');
const https = require('https');

process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
});

const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ] 
});

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = '1538484436272676954';
const ROLE_ID = '1538940771967700992';
const OFF_SALE_ROLE_ID = '1539633713133125813';
const ALLOWED_USER_ID = '1417227496251981895';
const DB_FILE = path.join(__dirname, 'accounts.json');

// ==========================================================================
// 🛠️ 7 METHODS GUIDE OPTIONS
// ==========================================================================
const GUIDE_SELECT_OPTIONS_PART1 = [
  { label: '123 Method', description: 'Usernames with 123 at the end or start', value: 'guide_method_123', emoji: '🔢', responseText: '🔢 **123 Method Details:**\n- Usernames with 123 at the end or start' },
  { label: '2 Number Method', description: 'Usernames that contain 2 numbers', value: 'guide_method_2num', emoji: '💡', responseText: '💡 **2 Number Method Details:**\n- Usernames that contain 2 numbers' },
  { label: '321 Method', description: 'Usernames with 321 at the end or start', value: 'guide_method_321', emoji: '🔄', responseText: '🔄 **321 Method Details:**\n- Usernames with 321 at the end or start' },
  { label: '4 Number Method', description: 'Usernames that contain 4 numbers', value: 'guide_method_4num', emoji: '🎰', responseText: '🎰 **4 Number Method Details:**\n- Usernames that contain 4 numbers' },
  { label: 'Cross Method', description: 'Usernames like 123acc123 or 1234acc1234', value: 'guide_method_cross', emoji: '❌', responseText: '❌ **Cross Method Details:**\n- Usernames like `123acc123`' }
];

const GUIDE_SELECT_OPTIONS_PART2 = [
  { label: 'Double Method', description: 'Usernames like acc123123 or 123123acc', value: 'guide_method_double', emoji: '👥', responseText: '👥 **Double Method Details:**\n- Usernames like `acc123123`' },
  { label: 'Year Method', description: 'Usernames that contain the year 1999 - 2026', value: 'guide_method_year', emoji: '📅', responseText: '📅 **Year Method Details:**\n- Usernames that contain the year' }
];

const ALL_GUIDE_OPTIONS = [...GUIDE_SELECT_OPTIONS_PART1, ...GUIDE_SELECT_OPTIONS_PART2];

const userGenCount = new Map();
const cooldownsGen = new Map();
const cooldownsBulk = new Map();
const cooldownsOffsale = new Map();

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
    if (err) console.error('Save error:', err);
  });
}

// 1. EXPRESS HEALTH CHECK SERVER (Port Sabitlendi)
const app = express();
app.use(express.json());

app.get('/', (req, res) => {
  res.status(200).send('Bot is active and running!');
});

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Webhook/Health server listening on port ${PORT}`);
});

// ==========================================================================
// 🔍 EMBEDDED GENERATOR / SCANNER LOGIC (Direct Memory Integration)
// ==========================================================================
const YEAR_ID_RANGES = {
  '2006': 100000, '2007': 500000, '2008': 1500000, '2009': 3000000,
  '2010': 5000001, '2011': 13000001, '2012': 25000001, '2013': 40000001,
  '2014': 60000001, '2015': 80000001, '2016': 110000000
};

const YEARS = Object.keys(YEAR_ID_RANGES);
const addedAccountIds = new Set();
const scannedIds = new Set();

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function fetchJSON(url) {
  return new Promise((resolve) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); } 
        catch (e) { resolve({ status: res.statusCode, data: null }); }
      });
    }).on('error', () => { resolve({ status: 500, data: null }); });
  });
}

function validateUsernameByFilter(username) {
  const lowerName = username.toLowerCase();
  const crossMatch = lowerName.match(/^([a-zA-Z0-9]{2,5}).*?\1$/) || lowerName.match(/^([a-zA-Z]{3,}).*?\1.*?\1$/);
  if (crossMatch && lowerName.length > crossMatch[1].length * 2) return 'cross_user';
  if (/([a-zA-Z]+)(19\d{2}|20\d{2})(\d*)/.test(lowerName) || /([a-zA-Z]+)(\d{4,8})/.test(lowerName)) return 'year_user';
  if (/(\d{2})\1/.test(lowerName)) return 'double_user';
  if (/^(123|1234|123123|789|999)\d*$|^\d*(123|1234|123123|789|999)$/.test(lowerName)) return '123_method';
  if (/^(321|4321|321321|543|876)\d*$|^\d*(321|4321|321321|543|876)$/.test(lowerName)) return '321_method';
  const digits = lowerName.match(/\d/g);
  if (digits && digits.length === 2) return '2_number_method';
  if (digits && digits.length === 4) return '4_number_method';
  return null;
}

async function runGeneratorLoop() {
  console.log('[DEBUG] Embedded Generator (Turbo & Hızlı Üretim Modu) Başlatıldı!');
  while (true) {
    try {
      const targetYear = YEARS[Math.floor(Math.random() * YEARS.length)];
      const randomOffset = Math.floor(Math.random() * 2000000); 
      const testId = YEAR_ID_RANGES[targetYear] + randomOffset;

      if (scannedIds.has(testId)) continue;
      scannedIds.add(testId);

      const res = await fetchJSON(`https://users.roblox.com/v1/users/${testId}`);
      if (res.status === 429) {
        await sleep(15000);
        continue;
      }
      if (!res.data || !res.data.name) {
        continue;
      }

      const accountIdStr = res.data.id.toString();
      if (addedAccountIds.has(accountIdStr)) continue;

      const username = res.data.name;
      const matchedFilter = validateUsernameByFilter(username);
      if (!matchedFilter) continue;

      const inventoryRes = await fetchJSON(`https://inventory.roblox.com/v1/users/${testId}/assets/collectibles?limit=10`);
      let itemCount = 0;
      let isOffSaleAccount = false;

      if (inventoryRes.status === 200 && inventoryRes.data && inventoryRes.data.data) {
        itemCount = inventoryRes.data.data.length;
        if (itemCount >= 2) {
          isOffSaleAccount = true;
        }
      }

      addedAccountIds.add(accountIdStr);

      const avatarRes = await fetchJSON(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${testId}&size=150x150&format=Png&isCircular=false`);
      const avatarUrl = (avatarRes.data?.data?.[0]) ? avatarRes.data.data[0].imageUrl : 'https://tr.rbxcdn.com/30day-avatar-headshot/150/150/Avatar/Png';

      const accountYear = new Date(res.data.created).getFullYear().toString();
      const db = getDB();
      const prefix = isOffSaleAccount ? 'offsale' : 'gen';
      const genKey = `${prefix}_${accountYear}_${matchedFilter}`;
      const bulkKey = `bulk_${accountYear}_${matchedFilter}`;

      if (!db[genKey]) db[genKey] = [];
      if (!isOffSaleAccount && !db[bulkKey]) db[bulkKey] = [];

      let added = false;
      const accountData = {
        id: accountIdStr,
        name: username,
        createdDate: res.data.created.split('T')[0],
        isBanned: res.data.isBanned || false,
        itemCount: itemCount,
        avatarUrl: avatarUrl
      };

      if (!db[genKey].some(acc => acc.id === accountData.id)) {
        db[genKey].push(accountData);
        added = true;
      }
      if (!isOffSaleAccount && !db[bulkKey].some(acc => acc.id === accountData.id)) {
        db[bulkKey].push(accountData);
        added = true;
      }

      if (added) saveDB();

      if (isOffSaleAccount || itemCount > 0) {
        console.log(`[TURBO BAŞARILI] ${isOffSaleAccount ? 'OFF-SALE' : 'EŞYALI'} Hesap: ${username} | Eşya: ${itemCount} | Tip: ${matchedFilter}`);
      }
      
      await sleep(60);

    } catch (err) {
      console.error('[HATA]:', err);
      await sleep(2000);
    }
  }
}

// ==========================================================================
// 2. DISCORD BOT COMMANDS & INTERACTIONS
// ==========================================================================
const commands = [
  new SlashCommandBuilder().setName('gen').setDescription('Generates a single premium account.'),
  new SlashCommandBuilder().setName('bulk-gen').setDescription('Generates multiple bulk premium accounts.'),
  new SlashCommandBuilder().setName('offsale-gen').setDescription('Generates a premium off-sale account with min 2 items.'),
  new SlashCommandBuilder().setName('stock').setDescription('Shows current interactive pool stocks.'),
  new SlashCommandBuilder().setName('guide').setDescription('Creates the interactive guide message panel.')
].map(command => command.toJSON());

client.once('ready', async () => {
  console.log(`${client.user.tag} is online and ready!`);
  try {
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log('Commands successfully loaded.');
  } catch (error) {
    console.error('Command loading error:', error);
  }

  runGeneratorLoop();
});

client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isChatInputCommand() && interaction.commandName === 'guide') {
      if (interaction.user.id !== ALLOWED_USER_ID) {
        return await interaction.reply({ content: '❌ You do not have permission to use this command!', ephemeral: true });
      }

      const modal = new ModalBuilder()
        .setCustomId('guide_main_modal')
        .setTitle('Create Custom Guide Panel');

      const messageInput = new TextInputBuilder()
        .setCustomId('guide_main_text')
        .setLabel('Enter custom guide description/text:')
        .setStyle(TextInputStyle.Paragraph)
        .setValue('📌 **Welcome to the Guide!**\nSelect an option from the menus below to view specific methods and details.')
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(messageInput));
      return await interaction.showModal(modal);
    }

    if (interaction.isChatInputCommand()) {
      const now = Date.now();
      const isBulk = interaction.commandName === 'bulk-gen';
      const isOffsale = interaction.commandName === 'offsale-gen';
      const cooldownMap = isBulk ? cooldownsBulk : (isOffsale ? cooldownsOffsale : cooldownsGen);
      const timeLimit = isBulk ? 50000 : (isOffsale ? 30000 : 25000);

      const lastUsed = cooldownMap.get(interaction.user.id);
      if (lastUsed && (now - lastUsed < timeLimit)) {
        const remaining = ((timeLimit - (now - lastUsed)) / 1000).toFixed(1);
        return await interaction.reply({
          content: `⏱️ Please wait **${remaining}s** before using this command again.`,
          ephemeral: true
        });
      }

      if (interaction.commandName !== 'stock') {
        cooldownMap.set(interaction.user.id, now);
      }
      
      if (!interaction.deferred && !interaction.replied) {
        await interaction.reply({ content: '⏳ Processing your request...', ephemeral: false }).catch(() => {});
      }
    } else if (interaction.isButton() || interaction.isStringSelectMenu() || interaction.isModalSubmit()) {
      const customIdParts = interaction.customId.split('_');
      const ownerId = customIdParts[customIdParts.length - 1];

      if (interaction.customId === 'guide_main_modal' || interaction.customId.startsWith('setup_')) {
        if (interaction.user.id !== ALLOWED_USER_ID) {
          return await interaction.reply({ content: '❌ You do not have permission to use this!', ephemeral: true });
        }
      } else if (!interaction.customId.startsWith('guide_menu_select') && ownerId && ownerId !== interaction.user.id && !interaction.customId.startsWith('action_')) {
        return await interaction.reply({ 
          content: '❌ You cannot use this menu or buttons as you did not run the command!', 
          ephemeral: true 
        });
      }

      if (interaction.isButton() || (interaction.isStringSelectMenu() && !interaction.customId.startsWith('guide_menu_select'))) {
        if (!interaction.deferred && !interaction.replied) {
          await interaction.deferUpdate().catch(() => {});
        }
      }
    }

    if (interaction.isModalSubmit() && interaction.customId === 'guide_main_modal') {
      const mainText = interaction.fields.getTextInputValue('guide_main_text');
      const channel = interaction.channel;

      const guideEmbed = new EmbedBuilder()
        .setTitle('📌 Available Methods & Guide')
        .setDescription(mainText)
        .setColor('#2F3136')
        .setTimestamp();

      const selectMenu1 = new StringSelectMenuBuilder().setCustomId('guide_menu_select_1').setPlaceholder('Select methods (1-5)...').addOptions(GUIDE_SELECT_OPTIONS_PART1);
      const selectMenu2 = new StringSelectMenuBuilder().setCustomId('guide_menu_select_2').setPlaceholder('Select methods (6-7)...').addOptions(GUIDE_SELECT_OPTIONS_PART2);

      await channel.send({ embeds: [guideEmbed], components: [new ActionRowBuilder().addComponents(selectMenu1), new ActionRowBuilder().addComponents(selectMenu2)] });
      return await interaction.reply({ content: '✅ Guide panel successfully sent!', ephemeral: true });
    }

    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('guide_menu_select_')) {
      const selectedValue = interaction.values[0];
      const selectedOption = ALL_GUIDE_OPTIONS.find(opt => opt.value === selectedValue);
      return await interaction.reply({ content: selectedOption ? selectedOption.responseText : '❌ Content not found.', ephemeral: true });
    }

    if (interaction.isChatInputCommand() && interaction.commandName === 'stock') {
      const categorySelect = new StringSelectMenuBuilder()
        .setCustomId(`stock_cat_${interaction.user.id}`)
        .setPlaceholder('Select Stock Category')
        .addOptions([
          { label: 'Gen Stock', value: 'gen', description: 'View single gen stock counts' },
          { label: 'Bulk-Gen Stock', value: 'bulk', description: 'View bulk gen stock counts' },
          { label: 'Offsale Gen Stock', value: 'offsale', description: 'View offsale gen stock counts' }
        ]);

      return await interaction.editReply({
        content: '📊 **Stock Panel:** Please select a category to inspect:',
        components: [new ActionRowBuilder().addComponents(categorySelect)]
      });
    }

    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('stock_cat_')) {
      const category = interaction.values[0];
      const ownerId = interaction.customId.split('_')[2];

      const yearSelect = new StringSelectMenuBuilder()
        .setCustomId(`stock_year_${category}_${ownerId}`)
        .setPlaceholder('Select Year (2006 - 2016)')
        .addOptions(Array.from({ length: 11 }, (_, i) => {
          const year = (2006 + i).toString();
          return { label: year, value: year, description: `View stocks for ${year}` };
        }));

      return await interaction.editReply({
        content: `Category: **${category.toUpperCase()}**\nNow select the creation year:`,
        components: [new ActionRowBuilder().addComponents(yearSelect)]
      });
    }

    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('stock_year_')) {
      const parts = interaction.customId.split('_');
      const category = parts[2];
      const ownerId = parts[3];
      const selectedYear = interaction.values[0];

      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`stock_view_${category}_${selectedYear}_cross_user_${ownerId}`).setLabel('cross_user').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`stock_view_${category}_${selectedYear}_double_user_${ownerId}`).setLabel('double_user').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`stock_view_${category}_${selectedYear}_year_user_${ownerId}`).setLabel('year_user').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`stock_view_${category}_${selectedYear}_123_method_${ownerId}`).setLabel('123_method').setStyle(ButtonStyle.Danger)
      );
      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`stock_view_${category}_${selectedYear}_321_method_${ownerId}`).setLabel('321_method').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`stock_view_${category}_${selectedYear}_2_number_method_${ownerId}`).setLabel('2_number_method').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`stock_view_${category}_${selectedYear}_4_number_method_${ownerId}`).setLabel('4_number_method').setStyle(ButtonStyle.Secondary)
      );

      return await interaction.editReply({
        content: `Category: **${category.toUpperCase()}** | Year: **${selectedYear}**\nNow select the method/pattern to view exact stock:`,
        components: [row1, row2]
      });
    }

    if (interaction.isButton() && interaction.customId.startsWith('stock_view_')) {
      const parts = interaction.customId.split('_');
      const category = parts[2];
      const targetYear = parts[3];
      
      let filterType = '';
      if (parts[4] === 'cross' && parts[5] === 'user') filterType = 'cross_user';
      else if (parts[4] === 'double' && parts[5] === 'user') filterType = 'double_user';
      else if (parts[4] === 'year' && parts[5] === 'user') filterType = 'year_user';
      else if (parts[5] === 'method') filterType = `${parts[4]}_method`;
      else if (parts[6] === 'method') filterType = `${parts[4]}_${parts[5]}_method`;

      let prefix = category === 'bulk' ? 'bulk' : (category === 'offsale' ? 'offsale' : 'gen');
      const key = `${prefix}_${targetYear}_${filterType}`;
      const db = getDB();
      const stockArray = db[key] || [];

      const embed = new EmbedBuilder()
        .setTitle(`📦 Stock Information: ${category.toUpperCase()} (${targetYear})`)
        .setColor('#00FFCC')
        .addFields(
          { name: '🔍 Method / Pattern', value: `\`${filterType}\``, inline: true },
          { name: '📊 Available Stock', value: `**${stockArray.length}** accounts`, inline: true }
        )
        .setTimestamp();

      return await interaction.editReply({ content: `✅ Here is your exact stock result:`, embeds: [embed], components: [] });
    }

    if (interaction.isChatInputCommand() && interaction.commandName === 'gen') {
      const yearSelect = new StringSelectMenuBuilder()
        .setCustomId(`select_year_${interaction.user.id}`)
        .setPlaceholder('Select Account Creation Year (2006 - 2016)')
        .addOptions(Array.from({ length: 11 }, (_, i) => {
          const year = (2006 + i).toString();
          return { label: year, value: year, description: `Accounts created in ${year}` };
        }));

      return await interaction.editReply({ content: 'Please select the account creation year:', components: [new ActionRowBuilder().addComponents(yearSelect)] });
    }

    if (interaction.isChatInputCommand() && interaction.commandName === 'bulk-gen') {
      if (!interaction.member.roles.cache.has(ROLE_ID)) {
        return await interaction.editReply({ content: '❌ You must have the **Bulk-Gen Customer** role to use this command.' });
      }

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`bulk_amt_5_${interaction.user.id}`).setLabel('5 Accounts').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`bulk_amt_10_${interaction.user.id}`).setLabel('10 Accounts').setStyle(ButtonStyle.Success)
      );

      return await interaction.editReply({ content: 'Select the amount to generate:', components: [row] });
    }

    if (interaction.isChatInputCommand() && interaction.commandName === 'offsale-gen') {
      if (!interaction.member.roles.cache.has(OFF_SALE_ROLE_ID)) {
        return await interaction.editReply({ content: '❌ You do not have the required role to use this command!' });
      }

      const yearSelect = new StringSelectMenuBuilder()
        .setCustomId(`select_offsale_year_${interaction.user.id}`)
        .setPlaceholder('Select Off-Sale Year (2006 - 2016)')
        .addOptions(Array.from({ length: 11 }, (_, i) => {
          const year = (2006 + i).toString();
          return { label: year, value: year, description: `Off-sale accounts created in ${year}` };
        }));

      return await interaction.editReply({ content: 'Please select the account creation year for Off-Sale Gen:', components: [new ActionRowBuilder().addComponents(yearSelect)] });
    }

    if (interaction.isButton() && interaction.customId.startsWith('bulk_amt_')) {
      const amount = interaction.customId.split('_')[2];
      const yearSelect = new StringSelectMenuBuilder()
        .setCustomId(`bulk_year_${amount}_${interaction.user.id}`)
        .setPlaceholder('Select Account Creation Year (2006 - 2016)')
        .addOptions(Array.from({ length: 11 }, (_, i) => {
          const year = (2006 + i).toString();
          return { label: year, value: year, description: `Accounts created in ${year}` };
        }));

      return await interaction.editReply({ content: `Selected Amount: **${amount}**\nPlease select the creation year:`, components: [new ActionRowBuilder().addComponents(yearSelect)] });
    }

    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('bulk_year_')) {
      const parts = interaction.customId.split('_');
      const amount = parts[2];
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

    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('select_offsale_year_')) {
      const selectedYear = interaction.values[0];
      const ownerId = interaction.customId.split('_')[3];

      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`offsale_cross_user_${selectedYear}_${ownerId}`).setLabel('cross_user').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`offsale_double_user_${selectedYear}_${ownerId}`).setLabel('double_user').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`offsale_year_user_${selectedYear}_${ownerId}`).setLabel('year_user').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`offsale_123_method_${selectedYear}_${ownerId}`).setLabel('123_method').setStyle(ButtonStyle.Danger)
      );
      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`offsale_321_method_${selectedYear}_${ownerId}`).setLabel('321_method').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`offsale_2_number_method_${selectedYear}_${ownerId}`).setLabel('2_number_method').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`offsale_4_number_method_${selectedYear}_${ownerId}`).setLabel('4_number_method').setStyle(ButtonStyle.Secondary)
      );

      return await interaction.editReply({ content: `[OFF-SALE] Selected Year: **${selectedYear}**\nNow select a username pattern:`, components: [row1, row2] });
    }

    if (interaction.isButton() && interaction.customId.startsWith('bulk_gen_')) {
      const parts = interaction.customId.split('_');
      let filterType = '';
      let targetYear = '';
      let amount = 0;

      if (parts[2] === 'cross' && parts[3] === 'user') { filterType = 'cross_user'; targetYear = parts[4]; amount = parseInt(parts[5]); }
      else if (parts[2] === 'double' && parts[3] === 'user') { filterType = 'double_user'; targetYear = parts[4]; amount = parseInt(parts[5]); }
      else if (parts[2] === 'year' && parts[3] === 'user') { filterType = 'year_user'; targetYear = parts[4]; amount = parseInt(parts[5]); }
      else if (parts[3] === 'method') { filterType = `${parts[2]}_method`; targetYear = parts[4]; amount = parseInt(parts[5]); }
      else if (parts[4] === 'method') { filterType = `${parts[2]}_${parts[3]}_method`; targetYear = parts[5]; amount = parseInt(parts[6]); }

      const key = `bulk_${targetYear}_${filterType}`;
      const db = getDB();
      const stock = db[key] || [];

      if (stock.length < amount) {
        return await interaction.editReply({ content: `❌ Not enough stock for bulk generation! Current stock: **${stock.length}**`, components: [] });
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
        return new EmbedBuilder()
          .setTitle(`👑 BULK PREMIUM ACCOUNT #${index + 1}`)
          .setURL(`https://www.roblox.com/users/${accountData.id}/profile`)
          .setColor('#2F3136')
          .setThumbnail(accountData.avatarUrl)
          .addFields(
            { name: '👤 Username', value: `\`\`\`${accountData.name}\`\`\``, inline: false },
            { name: '📅 Creation Date', value: `\`${accountData.createdDate}\``, inline: true },
            { name: '🛡️ Status', value: accountData.isBanned ? '🔴 Banned' : '🟢 Active', inline: true },
            { name: '🎒 Inventory', value: `\`Public\``, inline: false }
          )
          .setTimestamp();
      });

      try {
        for (const embed of embeds) {
          await interaction.user.send({ embeds: [embed] });
        }
        await interaction.editReply({ content: '✅ Accounts successfully sent to your DMs!', components: [] });
      } catch (e) {
        await interaction.editReply({ content: '❌ Please open your DMs!', components: [] });
      }
    }

    if (interaction.isButton() && interaction.customId.startsWith('offsale_')) {
      const parts = interaction.customId.split('_');
      let filterType = '';
      let targetYear = '';

      if (parts[1] === 'cross' && parts[2] === 'user') { filterType = 'cross_user'; targetYear = parts[3]; }
      else if (parts[1] === 'double' && parts[2] === 'user') { filterType = 'double_user'; targetYear = parts[3]; }
      else if (parts[1] === 'year' && parts[2] === 'user') { filterType = 'year_user'; targetYear = parts[3]; }
      else if (parts[2] === 'method') { filterType = `${parts[1]}_method`; targetYear = parts[3]; }
      else if (parts[3] === 'method') { filterType = `${parts[1]}_${parts[2]}_method`; targetYear = parts[4]; }

      const key = `offsale_${targetYear}_${filterType}`;
      const db = getDB();
      const stock = db[key] || [];

      if (stock.length === 0) {
        return await interaction.editReply({ content: `❌ Out of stock for Off-Sale **${targetYear} - ${filterType}**.`, components: [] });
      }

      const accountData = stock.shift();
      db[key] = stock;
      saveDB();

      const embed = new EmbedBuilder()
        .setTitle('👑 OFFSALE PREMIUM ACCOUNT GENERATED')
        .setURL(`https://www.roblox.com/users/${accountData.id}/profile`)
        .setColor('#FFD700')
        .setThumbnail(accountData.avatarUrl)
        .addFields(
          { name: '👤 Username', value: `\`\`\`${accountData.name}\`\`\``, inline: false },
          { name: '📅 Creation Date', value: `\`${accountData.createdDate}\``, inline: true },
          { name: '🎒 Inventory Items', value: `\`${accountData.itemCount || '2+'}\` items`, inline: true }
        )
        .setTimestamp();

      try {
        await interaction.user.send({ embeds: [embed] });
        await interaction.editReply({ content: '✅ Off-sale account successfully sent to your DMs!', components: [] });
      } catch (e) {
        db[key].unshift(accountData);
        saveDB();
        return await interaction.editReply({ content: '❌ Please open your DMs!', components: [] });
      }
    }

    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('select_year_')) {
      const selectedYear = interaction.values[0];
      const ownerId = interaction.customId.split('_')[2];

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

      return await interaction.editReply({ content: `Selected Year: **${selectedYear}**\nNow select a username pattern:`, components: [row1, row2] });
    }

    if (interaction.isButton() && interaction.customId.startsWith('gen_')) {
      const parts = interaction.customId.split('_');
      let filterType = '';
      let targetYear = '';

      if (parts[1] === 'cross' && parts[2] === 'user') { filterType = 'cross_user'; targetYear = parts[3]; }
      else if (parts[1] === 'double' && parts[2] === 'user') { filterType = 'double_user'; targetYear = parts[3]; }
      else if (parts[1] === 'year' && parts[2] === 'user') { filterType = 'year_user'; targetYear = parts[3]; }
      else if (parts[2] === 'method') { filterType = `${parts[1]}_method`; targetYear = parts[3]; }
      else if (parts[3] === 'method') { filterType = `${parts[1]}_${parts[2]}_method`; targetYear = parts[4]; }

      const key = `gen_${targetYear}_${filterType}`;
      const db = getDB();
      const stock = db[key] || [];

      if (stock.length === 0) {
        return await interaction.editReply({ content: `❌ Out of stock for **${targetYear} - ${filterType}**.`, components: [] });
      }

      const accountData = stock.shift();
      db[key] = stock;
      saveDB();

      const currentCount = (userGenCount.get(interaction.user.id) || 0) + 1;
      userGenCount.set(interaction.user.id, currentCount);

      const embed = new EmbedBuilder()
        .setTitle('👑 PREMIUM ACCOUNT GENERATED')
        .setURL(`https://www.roblox.com/users/${accountData.id}/profile`)
        .setColor('#2F3136')
        .setThumbnail(accountData.avatarUrl)
        .addFields(
          { name: '👤 Username', value: `\`\`\`${accountData.name}\`\`\``, inline: false },
          { name: '📅 Creation Date', value: `\`${accountData.createdDate}\``, inline: true },
          { name: '🛡️ Status', value: accountData.isBanned ? '🔴 Banned' : '🟢 Active', inline: true }
        )
        .setTimestamp();

      try {
        await interaction.user.send({ embeds: [embed] });
        await interaction.editReply({ content: '✅ Account successfully sent to your DMs!', components: [] });
      } catch (e) {
        db[key].unshift(accountData);
        saveDB();
        return await interaction.editReply({ content: '❌ Please open your DMs!', components: [] });
      }
    }

  } catch (err) {
    console.error('Interaction error:', err);
  }
});

if (!TOKEN) {
  console.error("CRITICAL ERROR: DISCORD_TOKEN is not defined or empty!");
} else {
  console.log("Connecting to Discord... Token length:", TOKEN.length);
  client.login(TOKEN).catch(err => console.error("DISCORD CONNECTION ERROR:", err));
}
