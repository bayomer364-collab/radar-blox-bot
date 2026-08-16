const http = require('http');
http.createServer((req, res) => res.end('Bot aktif!')).listen(process.env.PORT || 3000);
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

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ],
});

// TOKEN AND CLIENT ID
const TOKEN = process.env.TOKEN;
const CLIENT_ID = '1538484436272676954';

// Memory Storage
const userGenCount = new Map();
const cooldowns = new Map();

// Optimized Roblox User ID Ranges per Year
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
});

client.on('interactionCreate', async (interaction) => {
  
  // 1. /gen Command
  if (interaction.isChatInputCommand() && interaction.commandName === 'gen') {
    const lastUsed = cooldowns.get(interaction.user.id);
    const now = Date.now();
    const cooldownAmount = 10 * 1000;

    if (lastUsed && (now - lastUsed < cooldownAmount)) {
      const timeLeft = ((cooldownAmount - (now - lastUsed)) / 1000).toFixed(1);
      return await interaction.reply({ 
        content: `⏳ **Anti-Spam active! Please wait ${timeLeft}s before generating again.**`, 
        ephemeral: true 
      });
    }

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

  // 2. Year Selection
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

  // 3. Button Click & Generation
  if (interaction.isButton() && interaction.customId.startsWith('gen_')) {
    const parts = interaction.customId.split('_');
    const filterType = `${parts[1]}_${parts[2]}`;
    const targetYear = parts[3];
    const ownerId = parts[4];

    if (interaction.user.id !== ownerId) {
      return await interaction.reply({ content: '❌ These buttons are not for you! Run `/gen` to start your own.', ephemeral: true });
    }

    cooldowns.set(interaction.user.id, Date.now());
    await interaction.update({ content: '⚡ **Scanning Roblox network at maximum speed...**', components: [] });

    try {
      const accountData = await ultraFastRobloxSearch(targetYear, filterType);

      const currentCount = (userGenCount.get(interaction.user.id) || 0) + 1;
      userGenCount.set(interaction.user.id, currentCount);

      // Görseldeki Tasarımın Birebir Arayüzü
      const embed = new EmbedBuilder()
        .setTitle('🔑 Account Generation')
        .setDescription('Your account name has been generated.')
        .setThumbnail(accountData.avatarUrl)
        .setColor('#00A2FF')
        .addFields(
          { name: '🌍 Selected Year', value: targetYear, inline: false },
          { name: '🛠️ Selected Method', value: filterType, inline: false },
          { name: '👤 Usage Count', value: currentCount.toString(), inline: false },
          { name: '✅ Result', value: `Account name successfully generated:\n**${accountData.name}**`, inline: false },
          { name: '📅 Account Created', value: accountData.createdDate, inline: false },
          { name: '🚫 Banned?', value: accountData.isBanned ? 'Yes' : 'No', inline: false },
          { name: '💰 RAP', value: accountData.rapValue, inline: false },
          { name: '✅ Verified', value: accountData.isVerified ? 'Yes' : 'No', inline: false }
        );

      await interaction.user.send({ embeds: [embed] });
      await interaction.deleteReply().catch(() => {});

    } catch (error) {
      console.error(error);
      await interaction.followUp({ content: '❌ Could not send DM! Please make sure your DMs are open.', ephemeral: true });
    }
  }
});

// Ultra-Fast Parallel Search (30 Concurrent Requests)
async function ultraFastRobloxSearch(targetYear, filterType) {
  const range = YEAR_ID_RANGES[targetYear] || { min: 1, max: 50000000 };

  while (true) {
    const batch = Array.from({ length: 30 }, () => 
      Math.floor(Math.random() * (range.max - range.min + 1)) + range.min
    );

    const promises = batch.map(async (userId) => {
      try {
        const res = await axios.get(`https://users.roblox.com/v1/users/${userId}`, { timeout: 1000 });
        const data = res.data;
        const accountYear = new Date(data.created).getFullYear().toString();

        if (accountYear !== targetYear) return null;

        const username = data.name;

        if (filterType === 'no_number' && /\d/.test(username)) return null;
        if (filterType === 'year_user' && !/(19\d{2}|20\d{2})/.test(username)) return null;
        if (filterType === 'double_user' && !/(\d{2})\1/.test(username)) return null;

        return data;
      } catch (err) {
        return null;
      }
    });

    const results = await Promise.all(promises);
    const matchedUser = results.find(u => u !== null);

    if (matchedUser) {
      const [rapValue, avatarData] = await Promise.all([
        getRAPValue(matchedUser.id),
        getAvatarUrl(matchedUser.id)
      ]);

      const formattedDate = new Date(matchedUser.created).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      });

      return {
        id: matchedUser.id,
        name: matchedUser.name,
        createdDate: formattedDate,
        isBanned: matchedUser.isBanned,
        isVerified: matchedUser.hasVerifiedBadge || false,
        rapValue: rapValue,
        avatarUrl: avatarData
      };
    }
  }
}

// RAP Scanner
async function getRAPValue(userId) {
  try {
    const res = await axios.get(`https://inventory.roblox.com/v1/users/${userId}/assets/collectibles?assetType=Hat&limit=100`, { timeout: 1000 });
    const items = res.data.data || [];
    
    let totalRAP = 0;
    items.forEach(item => {
      totalRAP += (item.recentAveragePrice || 0);
    });

    return totalRAP.toString();
  } catch {
    return '0';
  }
}

// Headshot Avatar URL Fetcher
async function getAvatarUrl(userId) {
  try {
    const res = await axios.get(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`, { timeout: 1000 });
    return res.data.data[0]?.imageUrl || `https://www.roblox.com/headshot-thumbnail/image?userId=${userId}&width=150&height=150&format=png`;
  } catch {
    return `https://www.roblox.com/headshot-thumbnail/image?userId=${userId}&width=150&height=150&format=png`;
  }
}

client.login(TOKEN);
