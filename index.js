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
const TOKEN = 'BURAYA_BOT_TOKENINI_YAPIŞTIR';
const CLIENT_ID = '1538484436272676954';

// User Generation Counter Memory
const userGenCount = new Map();

// Accurate Roblox User ID Ranges by Creation Year (2006 - 2016)
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
    if (interaction.user.id !== ownerId) return;

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

    if (interaction.user.id !== ownerId) return;

    await interaction.update({ content: '🔍 **Searching for matching Roblox account... Please wait.**', components: [] });

    try {
      const accountData = await findRobloxAccountUntilFound(targetYear, filterType);
      const currentCount = (userGenCount.get(interaction.user.id) || 0) + 1;
      userGenCount.set(interaction.user.id, currentCount);

      const embed = new EmbedBuilder()
        .setTitle(`✨ RADARBLOX PREMIUM ACCOUNT GENERATED`)
        .setURL(`https://www.roblox.com/users/${accountData.id}/profile`)
        .setColor('#2B2D31')
        .setThumbnail(accountData.avatarUrl)
        .addFields(
          { name: '👤 Username', value: `\`${accountData.name}\``, inline: true },
          { name: '📅 Creation Date', value: `\`${accountData.createdDate}\``, inline: true }
        )
        .setImage(accountData.avatarUrl)
        .setFooter({ text: `RadarBlox Generator • Total Generations by you: ${currentCount}` })
        .setTimestamp();

      await interaction.user.send({ embeds: [embed] });
      await interaction.deleteReply().catch(() => {});
    } catch (error) {
      console.error(error);
      await interaction.followUp({ content: '❌ DM gönderilemedi! Lütfen gizlilik ayarlarını kontrol et.', ephemeral: true });
    }
  }
});

async function findRobloxAccountUntilFound(targetYear, filterType) {
  const range = YEAR_ID_RANGES[targetYear] || { min: 1, max: 50000000 };
  const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36' };

  while (true) {
    const randomUserId = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
    try {
      const res = await axios.get(`https://users.roblox.com/v1/users/${randomUserId}`, { headers });
      const data = res.data;
      if (new Date(data.created).getFullYear().toString() !== targetYear) continue;

      const username = data.name;
      if (filterType === 'no_number' && /\d/.test(username)) continue;
      if (filterType === 'year_user' && !/(19\d{2}|20\d{2})/.test(username)) continue;
      if (filterType === 'double_user' && !/(\d{2})\1/.test(username)) continue;

      let avatarUrl = `https://www.roblox.com/headshot-thumbnail/image?userId=${data.id}&width=420&height=420&format=png`;
      try {
        const thumbRes = await axios.get(`https://thumbnails.roblox.com/v1/users/avatar?userIds=${data.id}&size=720x720&format=Png&isCircular=false`, { headers });
        if (thumbRes.data.data[0]?.imageUrl) avatarUrl = thumbRes.data.data[0].imageUrl;
      } catch (e) {}

      return {
        id: data.id,
        name: data.name,
        createdDate: new Date(data.created).toISOString().split('T')[0],
        avatarUrl: avatarUrl
      };
    } catch (err) {
      await new Promise(r => setTimeout(r, 50));
      continue;
    }
  }
}

client.login(TOKEN);
