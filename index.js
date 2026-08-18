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

// Prevent bot crashes due to unhandled promise rejections
process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
});

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = '1538484436272676954';
const WEBHOOK_SECRET = 'GIZLI_SIFRE_12345';
const DB_FILE = path.join(__dirname, 'accounts.json');
const ROLE_ID = '1538940771967700992';

const userGenCount = new Map();

// Spam Protection Cooldown Map (10 Seconds)
const cooldowns = new Map();
const COOLDOWN_TIME = 10 * 1000;

function getDB() {
  if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, '{}');
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch (e) { return {}; }
}

function saveDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// 1. EXPRESS WEBHOOK SERVER
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
    console.log(`[WEBHOOK RECEIVED] Account added to layer ${key}. Total: ${db[key].length}`);
  }

  return res.json({ success: true, stockCount: db[key].length });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Webhook server listening on port ${PORT}`));

// 2. DISCORD BOT COMMANDS
const commands = [
  new SlashCommandBuilder().setName('gen').setDescription('Starts the RadarBlox generator.'),
  new SlashCommandBuilder().setName('bulk-gen').setDescription('Generate multiple accounts.')
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
    // --- 10 SECONDS COOLDOWN & DEFER ---
    if (interaction.isChatInputCommand()) {
      const now = Date.now();
      const userCooldown = cooldowns.get(interaction.user.id);

      if (userCooldown && (now - userCooldown < COOLDOWN_TIME)) {
        const remaining = ((COOLDOWN_TIME - (now - userCooldown)) / 1000).toFixed(1);
        return await interaction.reply({
          content: `⏱️ Please wait **${remaining}s** before using generator commands again.`,
          ephemeral: true
        });
      }

      cooldowns.set(interaction.user.id, now);
      
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ ephemeral: false }).catch(() => {});
      }
    } else if (interaction.isButton() || interaction.isStringSelectMenu()) {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferUpdate().catch(() => {});
      }
    }

    // --- /gen COMMAND (2006 - 2016 arası) ---
    if (interaction.isChatInputCommand() && interaction.commandName === 'gen') {
      const yearSelect = new StringSelectMenuBuilder()
        .setCustomId(`select_year_${interaction.user.id}`)
        .setPlaceholder('Select Account Creation Year (2006 - 2016)')
        .addOptions(Array.from({ length: 11 }, (_, i) => {
          const year = (2006 + i).toString();
          return { label: year, value: year, description: `Accounts created in ${year}` };
        }));

      return await interaction.editReply({
        content: 'Please select the creation year for the account:',
        components: [new ActionRowBuilder().addComponents(yearSelect)]
      });
    }

    // --- /bulk-gen COMMAND (2006 - 2016 arası) ---
    if (interaction.isChatInputCommand() && interaction.commandName === 'bulk-gen') {
      if (!interaction.member.roles.cache.has(ROLE_ID)) {
        return await interaction.editReply({ content: '❌ You need the **Bulk-Gen Customer** role to use this command.' });
      }

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`bulk_amt_5_${interaction.user.id}`).setLabel('5 Accounts').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`bulk_amt_10_${interaction.user.id}`).setLabel('10 Accounts').setStyle(ButtonStyle.Success)
      );

      return await interaction.editReply({ content: 'Select amount to generate:', components: [row] });
    }

    // --- /bulk-gen Amount Selection ---
    if (interaction.isButton() && interaction.customId.startsWith('bulk_amt_')) {
      const parts = interaction.customId.split('_');
      const amount = parts[2];
      const ownerId = parts[3];

      if (interaction.user.id !== ownerId) {
        return await interaction.followUp({ content: '❌ You cannot interact with someone else\'s command menu.', ephemeral: true });
      }

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
      const ownerId = parts[3];

      if (interaction.user.id !== ownerId) {
        return await interaction.followUp({ content: '❌ You cannot interact with someone else\'s command menu.', ephemeral: true });
      }

      const selectedYear = interaction.values[0];
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`bulk_gen_cross_user_${selectedYear}_${amount}_${interaction.user.id}`).setLabel('cross_user').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`bulk_gen_year_user_${selectedYear}_${amount}_${interaction.user.id}`).setLabel('year_user').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`bulk_gen_double_user_${selectedYear}_${amount}_${interaction.user.id}`).setLabel('double_user').setStyle(ButtonStyle.Danger)
      );

      return await interaction.editReply({ content: `Selected Year: **${selectedYear}** | Amount: **${amount}**\nPlease select username pattern:`, components: [row] });
    }

    // --- /bulk-gen Account Generation Process ---
    if (interaction.isButton() && interaction.customId.startsWith('bulk_gen_')) {
      const parts = interaction.customId.split('_');
      // Desteklenen filtre türü ismini doğru parse et (cross_user veya year_user veya double_user)
      let filterType = '';
      let targetYear = '';
      let amount = 0;
      let ownerId = '';

      if (parts[2] === 'cross' && parts[3] === 'user') {
        filterType = 'cross_user';
        targetYear = parts[4];
        amount = parseInt(parts[5]);
        ownerId = parts[6];
      } else {
        filterType = `${parts[2]}_${parts[3]}`;
        targetYear = parts[4];
        amount = parseInt(parts[5]);
        ownerId = parts[6];
      }

      if (interaction.user.id !== ownerId) {
        return await interaction.followUp({ content: '❌ You cannot interact with someone else\'s command menu.', ephemeral: true });
      }

      const key = `${targetYear}_${filterType}`;
      const db = getDB();
      const stock = db[key] || [];

      if (stock.length < amount) {
        return await interaction.editReply({ content: `❌ Not enough stock for this category! Current stock: **${stock.length}**`, components: [] });
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
        await interaction.editReply({ content: '✅ Accounts successfully sent to your DMs!', components: [] });
      } catch (e) {
        await interaction.editReply({ content: '❌ Please open your DMs!', components: [] });
      }
    }

    // --- /gen Year Selection ---
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('select_year_')) {
      const ownerId = interaction.customId.split('_')[2];
      
      if (interaction.user.id !== ownerId) {
        return await interaction.followUp({ content: '❌ You cannot interact with someone else\'s command menu.', ephemeral: true });
      }

      const selectedYear = interaction.values[0];
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`gen_cross_user_${selectedYear}_${interaction.user.id}`).setLabel('cross_user').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`gen_year_user_${selectedYear}_${interaction.user.id}`).setLabel('year_user').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`gen_double_user_${selectedYear}_${interaction.user.id}`).setLabel('double_user').setStyle(ButtonStyle.Danger)
      );

      return await interaction.editReply({ content: `Selected Year: **/gen year: ${selectedYear}**\nPlease select username pattern:`, components: [row] });
    }

    // --- /gen Account Generation Process ---
    if (interaction.isButton() && interaction.customId.startsWith('gen_')) {
      const parts = interaction.customId.split('_');
      let filterType = '';
      let targetYear = '';
      let ownerId = '';

      if (parts[1] === 'cross' && parts[2] === 'user') {
        filterType = 'cross_user';
        targetYear = parts[3];
        ownerId = parts[4];
      } else {
        filterType = `${parts[1]}_${parts[2]}`;
        targetYear = parts[3];
        ownerId = parts[4];
      }

      if (interaction.user.id !== ownerId) {
        return await interaction.followUp({ content: '❌ You cannot interact with someone else\'s command menu.', ephemeral: true });
      }

      const key = `${targetYear}_${filterType}`;
      const db = getDB();
      const stock = db[key] || [];

      if (stock.length === 0) {
        return await interaction.editReply({ content: `❌ No stock available for this category right now!`, components: [] });
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
        await interaction.editReply({ content: '✅ Account successfully sent to your DMs!', components: [] });
      } catch (e) {
        await interaction.editReply({ content: '❌ Please open your DMs!', components: [] });
      }
    }
  } catch (err) {
    console.error('Interaction error:', err);
  }
});

client.login(TOKEN);
