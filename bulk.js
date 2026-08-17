const { 
  SlashCommandBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  StringSelectMenuBuilder, 
  EmbedBuilder 
} = require('discord.js');
const fs = require('fs');
const path = require('path');

const ROLE_ID = 'BURAYA_ROL_ID_YAZ'; // "Bulk-Gen Customer" rol ID'sini buraya yaz
const DB_FILE = path.join(__dirname, 'accounts.json');

function getDB() {
  if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, '{}');
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch (e) { return {}; }
}

function saveDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('bulk-gen')
    .setDescription('Generate multiple Roblox accounts at once'),

  async handleInteraction(interaction, userGenCount) {
    // 1. Slash Komut Tetiklendiğinde
    if (interaction.isChatInputCommand() && interaction.commandName === 'bulk-gen') {
      if (!interaction.member.roles.cache.has(ROLE_ID)) {
        return await interaction.reply({ 
          content: '❌ You need the **Bulk-Gen Customer** role to use this command.', 
          ephemeral: true 
        });
      }

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`bulk_amt_5_${interaction.user.id}`).setLabel('5 Accounts').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`bulk_amt_10_${interaction.user.id}`).setLabel('10 Accounts').setStyle(ButtonStyle.Success)
      );

      await interaction.reply({ 
        content: 'Please select the amount of accounts you want to generate:', 
        components: [row], 
        ephemeral: true 
      });
    }

    // 2. Miktar Butonlarına Basıldığında
    if (interaction.isButton() && interaction.customId.startsWith('bulk_amt_')) {
      const parts = interaction.customId.split('_');
      const amount = parts[2];
      const ownerId = parts[3];

      if (interaction.user.id !== ownerId) return;

      const yearSelect = new StringSelectMenuBuilder()
        .setCustomId(`bulk_year_${amount}_${interaction.user.id}`)
        .setPlaceholder('Select Account Creation Year (2006 - 2016)')
        .addOptions(Array.from({ length: 11 }, (_, i) => {
          const year = (2006 + i).toString();
          return { label: year, value: year, description: `Accounts created in ${year}` };
        }));

      await interaction.update({ 
        content: `You selected **${amount} Accounts**. Now select the creation year:`, 
        components: [new ActionRowBuilder().addComponents(yearSelect)] 
      });
    }

    // 3. Yıl Seçimi Yapıldığında ve Hesapların DM'e Gönderilmesinde
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('bulk_year_')) {
      const parts = interaction.customId.split('_');
      const amount = parseInt(parts[2]);
      const ownerId = parts[3];

      if (interaction.user.id !== ownerId) return;

      const selectedYear = interaction.values[0];
      await interaction.update({ content: '🔍 **Fetching accounts from stock... Please wait.**', components: [] });

      const db = getDB();
      // Tüm desen kategorilerindeki ilgili yıla ait stokları topla
      const categories = [`${selectedYear}_no_number`, `${selectedYear}_year_user`, `${selectedYear}_double_user`];
      let availableAccounts = [];

      for (const cat of categories) {
        if (db[cat] && db[cat].length > 0) {
          while (db[cat].length > 0 && availableAccounts.length < amount) {
            availableAccounts.push(db[cat].shift());
          }
        }
        if (availableAccounts.length === amount) break;
      }

      saveDB(db);

      if (availableAccounts.length < amount) {
        return await interaction.followUp({ 
          content: `❌ Not enough stock! Required: ${amount}, Available: ${availableAccounts.length}. Try again later.`, 
          ephemeral: true 
        });
      }

      const currentCount = (userGenCount.get(interaction.user.id) || 0) + amount;
      userGenCount.set(interaction.user.id, currentCount);

      const accountsText = availableAccounts
        .map(acc => `• **${acc.name}** | Year: \`${selectedYear}\` | [Profile](https://www.roblox.com/users/${acc.id}/profile)`)
        .join('\n');

      const embed = new EmbedBuilder()
        .setTitle(`✨ RADARBLOX BULK ACCOUNTS GENERATED (${amount})`)
        .setColor('#2B2D31')
        .setDescription(accountsText)
        .setFooter({ text: `RadarBlox Generator • Total Generations by you: ${currentCount}` })
        .setTimestamp();

      try {
        await interaction.user.send({ embeds: [embed] });
        await interaction.followUp({ content: '✅ Bulk accounts generated! Check your DMs.', ephemeral: true });
      } catch (e) {
        await interaction.followUp({ content: '❌ Failed to send DM! Please ensure your DMs are open.', ephemeral: true });
      }
    }
  }
};
