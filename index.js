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

// Genişletilmiş İsim / Kelime Havuzu
const BASE_NAMES = [
  'andrew', 'anton', 'alex', 'shadow', 'viper', 'dragon', 'ghost', 'phantom',
  'blaze', 'storm', 'frost', 'knight', 'legend', 'master', 'nexus', 'cyber',
  'matrix', 'kestrel', 'valkyrie', 'dominus', 'sparkle', 'noble', 'solar',
  'lunar', 'zenith', 'vortex', 'specter', 'titan', 'reaper', 'hunter', 'rogue',
  'hero', 'sketch', 'stampy', 'denis', 'build', 'dan', 'mike', 'john', 'chris'
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
        return await interaction.reply({ content: '❌ These buttons are not for you! Run `/gen` to start your own.', flags: 64 });
      }

      await interaction.deferUpdate();
      cooldowns.set(interaction.user.id, Date.now());

      // Sadece GERÇEK ve Doğru Yıl Olan Hesabı Bulma Döngüsü
      const accountInfo = await findValidRobloxAccount(filterType, targetYear);

      if (!accountInfo) {
        await interaction.user.send({ 
          content: `❌ Could not find a valid account matching pattern **${filterType}** for year **${targetYear}** after multiple attempts. Please try again!` 
        });
        return await interaction.deleteReply().catch(() => {});
      }

      const currentCount = (userGenCount.get(interaction.user.id) || 0) + 1;
      userGenCount.set(interaction.user.id, currentCount);

      const embed = new EmbedBuilder()
        .setTitle('🔑 Account Generation')
        .setDescription('Your account name has been generated.')
        .setThumbnail(accountInfo.avatarUrl)
        .setColor('#00A2FF')
        .addFields(
          { name: '🌍 Selected Year', value: targetYear, inline: false },
          { name: '🛠️ Selected Method', value: filterType, inline: false },
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

// İsim Formatlandırma
function generateExoticName(filterType, year) {
  const baseName = BASE_NAMES[Math.floor(Math.random() * BASE_NAMES.length)];

  if (filterType === 'no_number') {
    return baseName;
  }

  if (filterType === 'year_user') {
    const patterns = [
      `${baseName}${year}`,
      `${baseName}${year}${Math.floor(Math.random() * 90 + 10)}`,
      `${year}${baseName}`,
      `${baseName}${year}${year}`
    ];
    return patterns[Math.floor(Math.random() * patterns.length)];
  }

  if (filterType === 'double_user') {
    const doubleDigits = ['909090', '5050', '1212', '8080', '7070', '3030', '1122', '44', '55', '66', '77', '88', '99'];
    const selectedDouble = doubleDigits[Math.floor(Math.random() * doubleDigits.length)];

    const patterns = [
      `${baseName}${selectedDouble}`,
      `${selectedDouble}${baseName}${selectedDouble}`,
      `${baseName}${selectedDouble.slice(0, 4)}`,
      `${selectedDouble.slice(0, 4)}${baseName}`
    ];
    return patterns[Math.floor(Math.random() * patterns.length)];
  }

  return `${baseName}${year}`;
}

// Gerçek Hesap Arama Döngüsü
async function findValidRobloxAccount(filterType, targetYear) {
  const maxAttempts = 20;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidateName = generateExoticName(filterType, targetYear);
    
    try {
      const res = await axios.post('https://users.roblox.com/v1/usernames/users', {
        usernames: [candidateName],
        excludeBannedUsers: false
      }, { timeout: 2500 });

      if (res.data && res.data.data && res.data.data.length > 0) {
        const user = res.data.data[0];
        const userDetail = await axios.get(`https://users.roblox.com/v1/users/${user.id}`, { timeout: 2500 });

        const createdDateObj = new Date(userDetail.data.created);
        const createdYear = createdDateObj.getFullYear().toString();

        // SADECE VE SADECE seçilen yıl ile Roblox'taki gerçek açılış yılı birebir tutuyorsa kabul et!
        if (createdYear === targetYear) {
          const formattedDate = createdDateObj.toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
          });

          return {
            id: user.id,
            name: userDetail.data.name,
            createdDate: formattedDate,
            isBanned: userDetail.data.isBanned || false,
            isVerified: userDetail.data.hasVerifiedBadge || false,
            rapValue: '0',
            avatarUrl: `https://www.roblox.com/headshot-thumbnail/image?userId=${user.id}&width=150&height=150&format=png`
          };
        }
      }
    } catch (e) {
      // Hata alırsa sonraki denemeye geç
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
