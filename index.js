const { Client, GatewayIntentBits, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, SlashCommandBuilder, REST, Routes } = require('discord.js');
const express = require('express');
const fs = require('fs');
const path = require('path');
const https = require('https');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

// Configs
const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = '1538484436272676954';
const ROLE_ID = '1538940771967700992';
const DB_FILE = path.join(__dirname, 'accounts.json');

// Separate Cooldowns
const cooldownsGen = new Map();
const cooldownsBulk = new Map();

function getDB() {
  if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, '{}');
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

client.on('interactionCreate', async (interaction) => {
  // 1. Slash Command Cooldown Check
  if (interaction.isChatInputCommand()) {
    const now = Date.now();
    const isBulk = interaction.commandName === 'bulk-gen';
    const cooldownMap = isBulk ? cooldownsBulk : cooldownsGen;
    const timeLimit = isBulk ? 50000 : 25000;
    
    const lastUsed = cooldownMap.get(interaction.user.id);
    if (lastUsed && (now - lastUsed < timeLimit)) {
      const remaining = ((timeLimit - (now - lastUsed)) / 1000).toFixed(1);
      return await interaction.reply({ content: `⏱️ Please wait **${remaining}s** before using this command again.`, ephemeral: true });
    }
    cooldownMap.set(interaction.user.id, now);
    await interaction.deferReply({ ephemeral: false });
  }

  // 2. Handling Selection (The "Bug" Fix: Always use editReply)
  if (interaction.isStringSelectMenu()) {
    const customId = interaction.customId;
    
    if (customId.startsWith('select_year_')) {
      const selectedYear = interaction.values[0];
      const ownerId = customId.split('_')[2];
      
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`gen_cross_user_${selectedYear}_${ownerId}`).setLabel('cross_user').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`gen_year_user_${selectedYear}_${ownerId}`).setLabel('year_user').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`gen_double_user_${selectedYear}_${ownerId}`).setLabel('double_user').setStyle(ButtonStyle.Danger)
      );
      
      return await interaction.editReply({ content: `Selected Year: **${selectedYear}**\nNow, select a username pattern:`, components: [row] });
    }
  }

  // 3. Handling Buttons
  if (interaction.isButton()) {
    // [Gen Logic here remains same but ensure interaction.editReply is used]
    // ... (Your previous gen/bulk logic code)
  }
});

client.login(TOKEN);
