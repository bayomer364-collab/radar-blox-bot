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
const WEBHOOK_SECRET = 'GIZLI_SIFRE_12345';
const ROLE_ID = '1538940771967700992';
const ALLOWED_USER_ID = '1417227496251981895'; // Only this user ID can use the /guide command and panel
const DB_FILE = path.join(__dirname, 'accounts.json');

// ==========================================================================
// 🛠️ YOU CAN EDIT GUIDE MENU OPTIONS AND DETAILED DESCRIPTIONS HERE
// ==========================================================================
const GUIDE_SELECT_OPTIONS = [
  {
    label: '123 Method',
    description: 'Usernames with 123 at the end or start',
    value: 'guide_method_123',
    emoji: '🔢',
    responseText: '🔢 **123 Method Details:**\n- The username must start or end with 123.\n- Example: `123john`, `alex123`'
  },
  {
    label: '2 Number Method',
    description: 'Usernames that contain 2 numbers',
    value: 'guide_method_2num',
    emoji: '💡',
    responseText: '💡 **2 Number Method Details:**\n- Contains 2 random numbers inside the username.\n- Example: `pro99gamer`'
  },
  {
    label: '321 Method',
    description: 'Usernames with 321 at the end or start',
    value: 'guide_method_321',
    emoji: '🔄',
    responseText: '🔄 **321 Method Details:**\n- The username includes 321 at the beginning or at the end.'
  },
  {
    label: '4 Number Method',
    description: 'Usernames with 4 numbers inside',
    value: 'guide_method_4num',
    emoji: '🎰',
    responseText: '🎰 **4 Number Method Details:**\n- Applicable rules and tactics for accounts containing a 4-digit number.'
  },
  {
    label: 'Cross Method',
    description: 'Cross pattern username rules',
    value: 'guide_method_cross',
    emoji: '❌',
    responseText: '❌ **Cross Method Details:**\n- It is a method for finding cross-matching usernames.'
  }
];

const userGenCount = new Map();
const cooldownsGen = new Map();
const cooldownsBulk = new Map();

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

// 1. EXPRESS WEBHOOK & HEALTH CHECK SERVER
const app = express();
app.use(express.json());

app.get('/', (req, res) => {
  res.status(200).send('Bot is active and running!');
});

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.post('/api/add-account', (req, res) => {
  const { secret, targetYear, filterType, accountData } = req.body;
  if (secret !== WEBHOOK_SECRET) {
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

  if (added) saveDB();
  return res.json({ success: true, genStockCount: db[genKey].length, bulkStockCount: db[bulkKey].length });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Webhook server listening on port ${PORT}`);
});

// 2. DISCORD BOT COMMANDS
const commands = [
  new SlashCommandBuilder().setName('gen').setDescription('Generates a single premium account.'),
  new SlashCommandBuilder().setName('bulk-gen').setDescription('Generates multiple bulk premium accounts.'),
  new SlashCommandBuilder().setName('stock').setDescription('Shows current detailed pool stocks.'),
  new SlashCommandBuilder().setName('guide').setDescription('Creates the interactive guide message panel.')
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
    // --- /guide Command Special Check (Should not be deferred because it opens a Modal) ---
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
        .setPlaceholder('You can write your custom main guide text here...')
        .setValue('📌 **Welcome to the Guide!**\nSelect an option from the menu below to view specific methods and details.')
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(messageInput));
      return await interaction.showModal(modal);
    }

    // --- Other Chat Input Commands ---
    if (interaction.isChatInputCommand()) {
      const now = Date.now();
      const isBulk = interaction.commandName === 'bulk-gen';
      const cooldownMap = isBulk ? cooldownsBulk : cooldownsGen;
      const timeLimit = isBulk ? 50000 : 25000;

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
      } else if (interaction.customId.startsWith('guide_menu_select')) {
        // Everyone can use the menu
      } else if (ownerId && ownerId !== interaction.user.id && !interaction.customId.startsWith('action_')) {
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

    // --- /guide Modal Submit (Send Embed + Custom Select Menu) ---
    if (interaction.isModalSubmit() && interaction.customId === 'guide_main_modal') {
      const mainText = interaction.fields.getTextInputValue('guide_main_text');
      const channel = interaction.channel;

      if (!channel) {
        return await interaction.reply({ content: '❌ Error: Channel not found!', ephemeral: true });
      }

      const guideEmbed = new EmbedBuilder()
        .setTitle('📌 Available Methods & Guide')
        .setDescription(mainText)
        .setColor('#2F3136')
        .setTimestamp();

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('guide_menu_select')
        .setPlaceholder('Make a selection...')
        .addOptions(
          GUIDE_SELECT_OPTIONS.map(opt => ({
            label: opt.label,
            description: opt.description,
            value: opt.value,
            emoji: opt.emoji
          }))
        );

      const row = new ActionRowBuilder().addComponents(selectMenu);

      await channel.send({
        embeds: [guideEmbed],
        components: [row]
      });

      return await interaction.reply({ content: '✅ Custom interactive guide panel successfully sent to this channel!', ephemeral: true });
    }

    // --- Guide Select Menu Interaction ---
    if (interaction.isStringSelectMenu() && interaction.customId === 'guide_menu_select') {
      const selectedValue = interaction.values[0];
      const selectedOption = GUIDE_SELECT_OPTIONS.find(opt => opt.value === selectedValue);

      const responseText = selectedOption ? selectedOption.responseText : '❌ Content not found.';

      return await interaction.reply({
        content: responseText,
        ephemeral: true
      });
    }

    // --- /stock COMMAND ---
    if (interaction.isChatInputCommand() && interaction.commandName === 'stock') {
      const db = getDB();
      const years = Array.from({ length: 11 }, (_, i) => (2006 + i).toString());
      const filterTypes = ['cross_user', 'double_user', 'year_user', '123_method', '321_method', '2_number_method', '4_number_method'];

      const yearsPart1 = years.slice(0, 6);   // 2006 - 2011
      const yearsPart2 = years.slice(6);      // 2012 - 2016

      let genText1 = '', bulkText1 = '';
      let genText2 = '', bulkText2 = '';

      for (const year of yearsPart1) {
        for (const filter of filterTypes) {
          const genCount = (db[`gen_${year}_${filter}`] || []).length;
          const bulkCount = (db[`bulk_${year}_${filter}`] || []).length;
          genText1 += `• **${year}** ${filter}: \`${genCount}\`\n`;
          bulkText1 += `• **${year}** ${filter}: \`${bulkCount}\`\n`;
        }
      }

      for (const year of yearsPart2) {
        for (const filter of filterTypes) {
          const genCount = (db[`gen_${year}_${filter}`] || []).length;
          const bulkCount = (db[`bulk_${year}_${filter}`] || []).length;
          genText2 += `• **${year}** ${filter}: \`${genCount}\`\n`;
          bulkText2 += `• **${year}** ${filter}: \`${bulkCount}\`\n`;
        }
      }

      const embed = new EmbedBuilder()
        .setTitle('📊 Detailed Stock Status (2006 - 2016)')
        .setColor('#2F3136')
        .addFields(
          { name: '🔹 Gen Pool (2006-2011)', value: genText1.slice(0, 1024), inline: true },
          { name: '🔸 Bulk-Gen Pool (2006-2011)', value: bulkText1.slice(0, 1024), inline: true },
          { name: '\u200B', value: '\u200B', inline: false },
          { name: '🔹 Gen Pool (2012-2016)', value: genText2.slice(0, 1024), inline: true },
          { name: '🔸 Bulk-Gen Pool (2012-2016)', value: bulkText2.slice(0, 1024), inline: true }
        )
        .setTimestamp();

      return await interaction.editReply({ content: '', embeds: [embed] });
    }

    // --- /gen COMMAND ---
    if (interaction.isChatInputCommand() && interaction.commandName === 'gen') {
      const yearSelect = new StringSelectMenuBuilder()
        .setCustomId(`select_year_${interaction.user.id}`)
        .setPlaceholder('Select Account Creation Year (2006 - 2016)')
        .addOptions(Array.from({ length: 11 }, (_, i) => {
          const year = (2006 + i).toString();
          return { label: year, value: year, description: `Accounts created in ${year}` };
        }));

      return await interaction.editReply({
        content: 'Please select the account creation year:',
        components: [new ActionRowBuilder().addComponents(yearSelect)]
      });
    }

    // --- /bulk-gen COMMAND ---
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

    // --- /bulk-gen Amount Selection ---
    if (interaction.isButton() && interaction.customId.startsWith('bulk_amt_')) {
      const parts = interaction.customId.split('_');
      const amount = parts[2];

      const yearSelect = new StringSelectMenuBuilder()
        .setCustomId(`bulk_year_${amount}_${interaction.user.id}`)
        .setPlaceholder('Select Account Creation Year (2006 - 2016)')
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

      if (parts[2] === 'cross' && parts[3] === 'user') {
        filterType = 'cross_user';
        targetYear = parts[4];
        amount = parseInt(parts[5]);
      } else if (parts[2] === 'double' && parts[3] === 'user') {
        filterType = 'double_user';
        targetYear = parts[4];
        amount = parseInt(parts[5]);
      } else if (parts[2] === 'year' && parts[3] === 'user') {
        filterType = 'year_user';
        targetYear = parts[4];
        amount = parseInt(parts[5]);
      } else if (parts[3] === 'method') {
        filterType = `${parts[2]}_method`;
        targetYear = parts[4];
        amount = parseInt(parts[5]);
      } else if (parts[4] === 'method') {
        filterType = `${parts[2]}_${parts[3]}_method`;
        targetYear = parts[5];
        amount = parseInt(parts[6]);
      }

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
        content: `Selected Year: **${selectedYear}**\nNow select a username pattern:`, 
        components: [row1, row2] 
      });
    }

    // --- /gen Account Generation Process ---
    if (interaction.isButton() && interaction.customId.startsWith('gen_')) {
      const parts = interaction.customId.split('_');
      let filterType = '';
      let targetYear = '';

      if (parts[1] === 'cross' && parts[2] === 'user') {
        filterType = 'cross_user';
        targetYear = parts[3];
      } else if (parts[1] === 'double' && parts[2] === 'user') {
        filterType = 'double_user';
        targetYear = parts[3];
      } else if (parts[1] === 'year' && parts[2] === 'user') {
        filterType = 'year_user';
        targetYear = parts[3];
      } else if (parts[2] === 'method') {
        filterType = `${parts[1]}_method`;
        targetYear = parts[3];
      } else if (parts[3] === 'method') {
        filterType = `${parts[1]}_${parts[2]}_method`;
        targetYear = parts[4];
      }

      const key = `gen_${targetYear}_${filterType}`;
      const db = getDB();
      const stock = db[key] || [];

      if (stock.length === 0) {
        return await interaction.editReply({ content: `❌ Out of stock for **${targetYear} - ${filterType}**. Please wait for new accounts to be added.`, components: [] });
      }

      const accountData = stock.shift();
      db[key] = stock;
      saveDB();

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
        db[key].unshift(accountData);
        saveDB();
        return await interaction.editReply({ content: '❌ Please open your DMs!', components: [] });
      }
    }

  } catch (err) {
    console.error('Interaction error:', err);
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: '❌ An error occurred while processing this command.', components: [] }).catch(() => {});
      } else {
        await interaction.reply({ content: '❌ An error occurred while processing this command.' }).catch(() => {});
      }
    } catch {}
  }
});

if (!TOKEN) {
  console.error("CRITICAL ERROR: DISCORD_TOKEN is not defined or empty!");
} else {
  console.log("Connecting to Discord... Token length:", TOKEN.length);
  client.login(TOKEN)
    .then(() => console.log("Discord login successful!"))
    .catch(err => {
      console.error("DISCORD CONNECTION ERROR DETAIL:", err);
    });
}
