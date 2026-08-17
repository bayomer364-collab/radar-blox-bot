const express = require('express');
const app = express();
const port = process.env.PORT || 10000;

app.get('/', (req, res) => {
  res.send('RadarBlox 7/24 Aktif!');
});

app.listen(port, () => {
  console.log(`Port ${port} üzerinde web sunucusu başarıyla başlatıldı.`);
});

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

const TOKEN = process.env.TOKEN;
const CLIENT_ID = '1538484436272676954';

const userGenCount = new Map();
const cooldowns = new Map();

// Genişletilmiş Kelime ve Kök Havuzu
const BASE_NAMES = [
  'andrew', 'anton', 'alex', 'shadow', 'viper', 'dragon', 'ghost', 'phantom',
  'blaze', 'storm', 'frost', 'knight', 'legend', 'master', 'nexus', 'cyber',
  'matrix', 'kestrel', 'valkyrie', 'dominus', 'sparkle', 'noble', 'solar',
  'lunar', 'zenith', 'vortex', 'specter', 'titan', 'reaper', 'hunter', 'rogue',
  'hero', 'sketch', 'stampy', 'denis', 'build', 'dan', 'mike', 'john', 'chris',
  'bloxxer', 'slayer', 'kral', 'darknes', 'zard', 'krip', 'vond', 'xX_shadow_Xx'
];

const commands = [
  new SlashCommandBuilder()
    .setName('gen')
    .setDescription('Starts the RadarBlox generator.')
];

const rest = new REST({ version: '10' }).setToken(TOKEN);

client.once('clientReady', async () => {
  console.log(`${client.user.tag} is online and ready!`);
  try {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log('Slash command (/gen) successfully registered.');
  } catch (error) {
    console.error('Error registering slash command:', error);
  }
});

client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isChatInputCommand() && interaction.commandName === 'gen') {
      const lastUsed = cooldowns.get(interaction.user.id);
      const now = Date.now();
      const cooldownAmount = 3 * 1000;

      if (lastUsed && (now - lastUsed < cooldownAmount)) {
        const timeLeft = ((cooldownAmount - (now - lastUsed)) / 1000).toFixed(1);
        return await interaction.reply({ 
          content: `⏳ **Anti-Spam active! Please wait ${timeLeft}s before generating again.**`, 
          flags: 64 
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
        components: [row]
      });
    }

    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('select_year_')) {
      const ownerId = interaction.customId.split('_')[2];

      if (interaction.user.id !== ownerId) {
        return await interaction.reply({ content: '❌ This menu is not for you! Run `/gen` to start your own.', flags: 64 });
      }

      const selectedYear = interaction.values[0];

      const btnNoNumber = new ButtonBuilder()
        .setCustomId(`gen_nonumber_${selectedYear}_${interaction.user.id}`)
        .setLabel('no_number_user')
        .setStyle(ButtonStyle.Primary);

      const btnYearUser = new ButtonBuilder()
        .setCustomId(`gen_yearuser_${selectedYear}_${interaction.user.id}`)
        .setLabel('year_user')
        .setStyle(ButtonStyle.Success);

      const btnDoubleUser = new ButtonBuilder()
        .setCustomId(`gen_doubleuser_${selectedYear}_${interaction.user.id}`)
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
      const filterType = parts[1]; // nonumber, yearuser, doubleuser
      const targetYear = parts[2];
      const ownerId = parts[3];

      if (interaction.user.id !== ownerId) {
        return await interaction.reply({ content: '❌ These buttons are not for you! Run `/gen` to start your own.', flags: 64 });
      }

      await interaction.deferUpdate();
      cooldowns.set(interaction.user.id, Date.now());

      const accountInfo = await findValidRobloxAccount(filterType, targetYear);

      if (!accountInfo) {
        await interaction.user.send({ 
          content: `❌ Could not find a valid account matching pattern **${filterType}** for year **${targetYear}** after multiple attempts. Please try again!` 
        });
        return await interaction.deleteReply().catch(() => {});
      }

      // Usage Count Güncelleme (Sayaç)
      const currentCount = (userGenCount.get(interaction.user.id) || 0) + 1;
      userGenCount.set(interaction.user.id, currentCount);

      const displayFilterName = filterType === 'nonumber' ? 'no_number_user' : (filterType === 'yearuser' ? 'year_user' : 'double_user');

      const embed = new EmbedBuilder()
        .setTitle('🔑 Account Generation')
        .setDescription('Your account name has been generated.')
        .setThumbnail(accountInfo.avatarUrl)
        .setColor('#00A2FF')
        .addFields(
          { name: '🌍 Selected Year', value: targetYear, inline: false },
          { name: '🛠️ Selected Method', value: displayFilterName, inline: false },
          { name: '👤 Usage Count', value: currentCount.toString(), inline: false },
          { name: '✅ Result', value: `Account name successfully generated:\n**${accountInfo.name}**`, inline: false },
          { name: '📅 Account Created', value: accountInfo.createdDate, inline: false },
          { name: '🚫 Banned?', value: accountInfo.isBanned ? 'Yes' : 'No', inline: false },
          { name: '💰 RAP', value: accountInfo.rapValue, inline: false },
          { name: '✅ Verified', value: accountInfo.isVerified ? 'Yes' : 'No', inline: false }
        );

      await interaction.user.send({ embeds: [embed] });
      await interaction.deleteReply().catch(() => {});
    }
  } catch (err) {
    console.error('Interaction error caught:', err);
  }
});

// Egzotik Kalıp Üreticisi
function generateSearchQuery(filterType) {
  const baseName = BASE_NAMES[Math.floor(Math.random() * BASE_NAMES.length)];

  if (filterType === 'nonumber') {
    return baseName;
  }

  if (filterType === 'yearuser') {
    const randomYear = Math.floor(Math.random() * (2016 - 1995 + 1)) + 1995;
    const randomSuffix = Math.floor(Math.random() * 90 + 10);
    const patterns = [
      `${baseName}${randomYear}`,
      `${baseName}${randomYear}${randomSuffix}`,
      `${randomYear}${baseName}`,
      `${baseName}${randomYear}${randomYear}`
    ];
    return patterns[Math.floor(Math.random() * patterns.length)];
  }

  if (filterType === 'doubleuser') {
    const doubleUnits = ['909090', '5050', '1212', '8080', '7070', '3030', '1122', '4444', '5555', '8888', '9999'];
    const chosenDouble = doubleUnits[Math.floor(Math.random() * doubleUnits.length)];

    const patterns = [
      `${baseName}${chosenDouble}`,
      `${chosenDouble}${baseName}${chosenDouble}`,
      `${baseName}${chosenDouble.slice(0, 4)}`,
      `${chosenDouble.slice(0, 4)}${baseName}`
    ];
    return patterns[Math.floor(Math.random() * patterns.length)];
  }

  return baseName;
}

// Akıllı & Gerçek Hesap Arama Döngüsü
async function findValidRobloxAccount(filterType, targetYear) {
  const maxAttempts = 15;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const searchQuery = generateSearchQuery(filterType);

    try {
      // Roblox Arama API'si üzerinden arama yap
      const searchRes = await axios.get(`https://users.roblox.com/v1/users/search?keyword=${encodeURIComponent(searchQuery)}&limit=10`, { timeout: 2500 });
      
      if (searchRes.data && searchRes.data.data && searchRes.data.data.length > 0) {
        const candidates = searchRes.data.data;

        for (const candidate of candidates) {
          const userDetail = await axios.get(`https://users.roblox.com/v1/users/${candidate.id}`, { timeout: 2000 }).catch(() => null);
          if (!userDetail || !userDetail.data) continue;

          const createdDateObj = new Date(userDetail.data.created);
          const createdYear = createdDateObj.getFullYear().toString();

          // Sadece seçilen hedef yıla UYAN gerçek hesabı al!
          if (createdYear === targetYear) {
            const formattedDate = createdDateObj.toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric'
            });

            return {
              id: candidate.id,
              name: userDetail.data.name,
              createdDate: formattedDate,
              isBanned: userDetail.data.isBanned || false,
              isVerified: userDetail.data.hasVerifiedBadge || false,
              rapValue: '0',
              avatarUrl: `https://www.roblox.com/headshot-thumbnail/image?userId=${candidate.id}&width=150&height=150&format=png`
            };
          }
        }
      }
    } catch (e) {
      // API Hatasında sonraki denemeye geç
    }
  }

  return null;
}

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err, origin) => {
  console.error('Uncaught Exception caught:', err, 'origin:', origin);
});

client.login(TOKEN);
