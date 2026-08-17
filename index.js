const { 
  Client, GatewayIntentBits, ActionRowBuilder, StringSelectMenuBuilder, 
  ButtonBuilder, ButtonStyle, EmbedBuilder, SlashCommandBuilder, REST, Routes 
} = require('discord.js');
const express = require('express');
const fs = require('fs');
const path = require('path');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = '1538484436272676954';
const DB_FILE = path.join(__dirname, 'accounts.json');
const ROLE_ID = '1538940771967700992';

function getDB() {
  if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, '{}');
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch (e) { return {}; }
}

function saveDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// Otomatik Stok (1.5s)
setInterval(() => {
  const db = getDB();
  const years = [2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016];
  const types = ['no_number', 'year_user', 'double_user'];
  const randomYear = years[Math.floor(Math.random() * years.length)];
  const randomType = types[Math.floor(Math.random() * types.length)];
  const key = `${randomYear}_${randomType}`;

  if (!db[key]) db[key] = [];
  if (db[key].length < 100) { 
      db[key].push({ id: Date.now(), name: `Acc_${randomYear}_${Math.floor(Math.random()*9999)}` });
      saveDB(db);
  }
}, 1500);

const commands = [
  new SlashCommandBuilder().setName('gen').setDescription('Starts the RadarBlox generator.'),
  new SlashCommandBuilder().setName('bulk-gen').setDescription('Generate multiple accounts.')
];

client.once('ready', async () => {
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
  console.log('Bot hazır!');
});

client.on('interactionCreate', async (interaction) => {
  // --- Hata önleyici: Her etkileşimi hemen defer et ---
  if (interaction.isButton() || interaction.isStringSelectMenu()) await interaction.deferUpdate().catch(() => {});

  // --- BULK-GEN ---
  if (interaction.isChatInputCommand() && interaction.commandName === 'bulk-gen') {
    if (!interaction.member.roles.cache.has(ROLE_ID)) return await interaction.reply({ content: '❌ Yetki yok.', ephemeral: true });
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`b_amt_5_${interaction.user.id}`).setLabel('5 Accounts').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`b_amt_10_${interaction.user.id}`).setLabel('10 Accounts').setStyle(ButtonStyle.Success)
    );
    await interaction.reply({ content: 'Select amount:', components: [row], ephemeral: true });
  }

  // Bulk Miktar -> Yıl Seçimi
  if (interaction.isButton() && interaction.customId.startsWith('b_amt_')) {
    const [_, __, amount, ownerId] = interaction.customId.split('_');
    if (interaction.user.id !== ownerId) return;
    const menu = new StringSelectMenuBuilder().setCustomId(`b_year_${amount}_${ownerId}`)
      .setPlaceholder('Select year').addOptions(Array.from({ length: 11 }, (_, i) => ({ label: `${2006 + i}`, value: `${2006 + i}` })));
    await interaction.editReply({ content: `Selected ${amount}. Choose year:`, components: [new ActionRowBuilder().addComponents(menu)] });
  }

  // Bulk Yıl -> Tip Seçimi (3 Butonlu)
  if (interaction.isStringSelectMenu() && interaction.customId.startsWith('b_year_')) {
    const [_, __, amount, ownerId] = interaction.customId.split('_');
    const year = interaction.values[0];
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`b_t_no_number_${amount}_${year}_${ownerId}`).setLabel('No Number').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`b_t_year_user_${amount}_${year}_${ownerId}`).setLabel('Year User').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`b_t_double_user_${amount}_${year}_${ownerId}`).setLabel('Double User').setStyle(ButtonStyle.Secondary)
    );
    await interaction.editReply({ content: `Year ${year} selected. Choose type:`, components: [row] });
  }

  // Bulk Tip -> İşlem
  if (interaction.isButton() && interaction.customId.startsWith('b_t_')) {
    const [_, __, type, amount, year, ownerId] = interaction.customId.split('_');
    const db = getDB();
    const key = `${year}_${type}`;
    if (!db[key] || db[key].length < amount) return await interaction.editReply({ content: '❌ Not enough stock!', components: [] });
    
    let accounts = [];
    for(let i=0; i<amount; i++) accounts.push(db[key].shift());
    saveDB(db);
    
    const embed = new EmbedBuilder().setTitle('✨ Bulk Generated').setDescription(accounts.map(a => `• ${a.name}`).join('\n'));
    await interaction.user.send({ embeds: [embed] }).catch(() => {});
    await interaction.editReply({ content: '✅ Check DMs!', components: [] });
  }

  // --- NORMAL GEN ---
  if (interaction.isChatInputCommand() && interaction.commandName === 'gen') {
    const menu = new StringSelectMenuBuilder().setCustomId(`gen_year_${interaction.user.id}`)
      .setPlaceholder('Select Year').addOptions(Array.from({ length: 11 }, (_, i) => ({ label: `${2006 + i}`, value: `${2006 + i}` })));
    await interaction.reply({ components: [new ActionRowBuilder().addComponents(menu)] });
  }

  if (interaction.isStringSelectMenu() && interaction.customId.startsWith('gen_year_')) {
    const ownerId = interaction.customId.split('_')[2];
    const year = interaction.values[0];
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`g_t_no_number_${year}_${ownerId}`).setLabel('no_number').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`g_t_year_user_${year}_${ownerId}`).setLabel('year_user').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`g_t_double_user_${year}_${ownerId}`).setLabel('double_user').setStyle(ButtonStyle.Secondary)
    );
    await interaction.editReply({ content: 'Select pattern:', components: [row] });
  }

  if (interaction.isButton() && interaction.customId.startsWith('g_t_')) {
    const [_, __, type, year, ownerId] = interaction.customId.split('_');
    const db = getDB();
    const key = `${year}_${type}`;
    if (!db[key] || db[key].length === 0) return await interaction.editReply({ content: '❌ No stock!', components: [] });
    
    const acc = db[key].shift();
    saveDB(db);
    await interaction.user.send({ content: `Account: ${acc.name}` }).catch(() => {});
    await interaction.editReply({ content: '✅ Sent to DMs!', components: [] });
  }
});

client.login(TOKEN);
