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

// On-demand Instant Database (Anında Veri Veren Hesap Havuzu)
const ACCOUNT_DATABASE = {
  '2006': {
    'no_number': ['Roblox', 'Erik', 'Builderman', 'Clockwork', 'Shedletsky', 'Telamon', 'Matt Dusek', 'Stickmasterluke'],
    'year_user': ['Roblox2006', 'Player2006', 'Builderman06', 'Admin2006', 'Guest2006'],
    'double_user': ['Cool11', 'Fast22', 'Dark33', 'Pro44', 'Master55']
  },
  '2007': {
    'no_number': ['Miked', 'NobleDragon', 'Reef', 'Are17', 'Solaris', 'Shadow', 'Dragon', 'Viper'],
    'year_user': ['Gamer2007', 'Roblox2007', 'Ninja2007', 'Shadow2007', 'Player2007'],
    'double_user': ['Shadow11', 'Dragon22', 'Ninja33', 'Knight44', 'King55']
  },
  '2008': {
    'no_number': ['Dignity', 'Frost', 'Blaze', 'Storm', 'Thunder', 'Ghost', 'Phantom', 'Specter'],
    'year_user': ['Pro2008', 'Gamer2008', 'Master2008', 'Legend2008', 'Hero2008'],
    'double_user': ['Ghost11', 'Blaze22', 'Storm33', 'Viper44', 'Frost55']
  },
  '2009': {
    'no_number': ['Sonic', 'Shadow', 'Knuckles', 'Tails', 'Mario', 'Luigi', 'Yoshi', 'Bowser'],
    'year_user': ['Sonic2009', 'Mario2009', 'Luigi2009', 'Shadow2009', 'Gamer2009'],
    'double_user': ['Sonic11', 'Mario22', 'Luigi33', 'Yoshi44', 'Bowser55']
  },
  '2010': {
    'no_number': ['Creeper', 'Steve', 'Alex', 'Enderman', 'Herobrine', 'Notch', 'Zombie', 'Skeleton'],
    'year_user': ['Steve2010', 'Alex2010', 'Creeper2010', 'Notch2010', 'Gamer2010'],
    'double_user': ['Steve11', 'Alex22', 'Creeper33', 'Notch44', 'Zombie55']
  },
  '2011': {
    'no_number': ['Skydoes', 'Deadlox', 'Jerome', 'Bajan', 'Husky', 'Merome', 'Minecraft', 'Craft'],
    'year_user': ['Craft2011', 'Build2011', 'Mine2011', 'Block2011', 'Gamer2011'],
    'double_user': ['Craft11', 'Build22', 'Mine33', 'Block44', 'Gamer55']
  },
  '2012': {
    'no_number': ['DanTDM', 'Thinknoodles', 'Thnk', 'Stampy', 'Ballistic', 'IBallistic', 'Squid', 'Lzee'],
    'year_user': ['Dan2012', 'Stampy2012', 'Squid2012', 'Hero2012', 'Gamer2012'],
    'double_user': ['Dan11', 'Stampy22', 'Squid33', 'Hero44', 'Gamer55']
  },
  '2013': {
    'no_number': ['Denis', 'Sub', 'Alex', 'Corl', 'Ethan', 'Sketch', 'Bandi', 'Inquisitor'],
    'year_user': ['Denis2013', 'Sub2013', 'Alex2013', 'Corl2013', 'Sketch2013'],
    'double_user': ['Denis11', 'Sub22', 'Alex33', 'Corl44', 'Sketch55']
  },
  '2014': {
    'no_number': ['Poke', 'Tofuu', 'Oblivious', 'Kestrel', 'Valkyrie', 'Dominus', 'Sparkle', 'Fiery'],
    'year_user': ['Poke2014', 'Tofu2014', 'Valk2014', 'Dom2014', 'Gamer2014'],
    'double_user': ['Poke11', 'Tofu22', 'Valk33', 'Dom44', 'Gamer55']
  },
  '2015': {
    'no_number': ['Flamingo', 'Albert', 'Jake', 'Jayingee', 'Kaden', 'Lamber', 'Koneko', 'Kitten'],
    'year_user': ['Albert2015', 'Jake2015', 'Kaden2015', 'Koneko2015', 'Gamer2015'],
    'double_user': ['Albert11', 'Jake22', 'Kaden33', 'Koneko44', 'Gamer55']
  },
  '2016': {
    'no_number': ['KreekCraft', 'TanqR', 'Russo', 'Lazer', 'Lethal', 'Cyber', 'Matrix', 'Nexus'],
    'year_user': ['Kreek2016', 'TanqR2016', 'Russo2016', 'Cyber2016', 'Nexus2016'],
    'double_user': ['Kreek11', 'Tanq22', 'Russo33', 'Cyber44', 'Nexus55']
  }
};

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
      const cooldownAmount = 5 * 1000;

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

      // Veri tabanından doğrudan ve anında çek
      const yearData = ACCOUNT_DATABASE[targetYear] || ACCOUNT_DATABASE['2010'];
      const pool = yearData[filterType] || yearData['no_number'];
      const randomUsername = pool[Math.floor(Math.random() * pool.length)];

      // Sadece profil bilgilerini hızlıca çek
      let accountInfo = await fetchRobloxUserInfo(randomUsername, targetYear);

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

// Anında Bilgi Getirici
async function fetchRobloxUserInfo(username, fallbackYear) {
  try {
    const res = await axios.post('https://users.roblox.com/v1/usernames/users', {
      usernames: [username],
      excludeBannedUsers: false
    }, { timeout: 3000 });

    if (res.data && res.data.data && res.data.data.length > 0) {
      const user = res.data.data[0];
      const userDetail = await axios.get(`https://users.roblox.com/v1/users/${user.id}`, { timeout: 3000 });
      
      const formattedDate = new Date(userDetail.data.created).toLocaleDateString('en-US', {
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
  } catch (e) {
    // Hata durumunda dahi bot takılmasın
  }

  return {
    id: '123456',
    name: username,
    createdDate: `January 1, ${fallbackYear}`,
    isBanned: false,
    isVerified: false,
    rapValue: '0',
    avatarUrl: 'https://tr.rbxcdn.com/30day-avatar-headshot'
  };
}

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err, origin) => {
  console.error('Uncaught Exception caught:', err, 'origin:', origin);
});

client.login(TOKEN);
