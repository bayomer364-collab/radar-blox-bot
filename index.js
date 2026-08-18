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
const https = require('https');
const http = require('http');

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
const DB_FILE = path.join(__dirname, 'accounts.json');

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
    if (err) console.error('Kayıt hatası:', err);
  });
}

// 1. EXPRESS WEBHOOK & HEALTH CHECK SERVER
const app = express();
app.use(express.json());

app.get('/', (req, res) => {
  res.status(200).send('Bot aktif ve çalışıyor!');
});

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.post('/api/add-account', (req, res) => {
  const { secret, targetYear, filterType, accountData } = req.body;
  console.log('Webhook alındı (Dual-Stock):', { targetYear, filterType, accountId: accountData?.id });

  if (secret !== WEBHOOK_SECRET) {
    console.warn('Geçersiz webhook şifresi (Yetkisiz)');
    return res.status(403).json({ error: 'Yetkisiz' });
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

  if (added) {
    saveDB();
  }

  return res.json({ success: true, genStockCount: db[genKey].length, bulkStockCount: db[bulkKey].length });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Webhook sunucusu ${PORT} portunda dinleniyor`);

  const SELF_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
  const clientModule = SELF_URL.startsWith('https') ? https : http;

  setInterval(() => {
    clientModule.get(SELF_URL, (res) => {
      res.on('data', () => {});
    }).on('error', () => {});
  }, 4 * 60 * 1000);
});

// 2. DISCORD BOT COMMANDS
const commands = [
  new SlashCommandBuilder().setName('gen').setDescription('Tekli premium hesap üretir.'),
  new SlashCommandBuilder().setName('bulk-gen').setDescription('Çoklu toplu premium hesap üretir.'),
  new SlashCommandBuilder().setName('stock').setDescription('Güncel detaylı havuz stoklarını gösterir.')
];

client.once('ready', async () => {
  console.log(`${client.user.tag} çevrimiçi ve hazır!`);
  try {
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log('Komutlar başarıyla yüklendi.');
  } catch (error) {
    console.error('Komut yükleme hatası:', error);
  }
});

client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const now = Date.now();
      const isBulk = interaction.commandName === 'bulk-gen';
      const cooldownMap = isBulk ? cooldownsBulk : cooldownsGen;
      const timeLimit = isBulk ? 50000 : 25000;

      const lastUsed = cooldownMap.get(interaction.user.id);
      if (lastUsed && (now - lastUsed < timeLimit)) {
        const remaining = ((timeLimit - (now - lastUsed)) / 1000).toFixed(1);
        return await interaction.reply({
          content: `⏱️ Bu komutu tekrar kullanabilmek için lütfen **${remaining}s** bekleyin.`,
          ephemeral: true
        });
      }

      if (interaction.commandName !== 'stock') {
        cooldownMap.set(interaction.user.id, now);
      }
      
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ ephemeral: true }).catch(() => {});
      }
    } else if (interaction.isButton() || interaction.isStringSelectMenu()) {
      // Güvenlik Kontrolü: Başkasının butonuna/menüsüne basmasını engelle
      const customIdParts = interaction.customId.split('_');
      const ownerId = customIdParts[customIdParts.length - 1];

      if (ownerId && ownerId !== interaction.user.id) {
        return await interaction.reply({ 
          content: '❌ Bu menüyü veya butonları yalnızca komutu çalıştıran kullanıcı kullanabilir!', 
          ephemeral: true 
        });
      }

      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferUpdate().catch(() => {});
      }
    }

    // --- /stock KOMUTU ---
    if (interaction.isChatInputCommand() && interaction.commandName === 'stock') {
      const db = getDB();
      const years = Array.from({ length: 11 }, (_, i) => (2006 + i).toString());
      const filterTypes = ['cross_user', 'double_user', 'year_user', '123_method', '321_method', '2_number_method', '4_number_method'];

      let genText = '';
      let bulkText = '';

      for (const year of years) {
        for (const filter of filterTypes) {
          const genCount = (db[`gen_${year}_${filter}`] || []).length;
          const bulkCount = (db[`bulk_${year}_${filter}`] || []).length;

          genText += `• **${year}** ${filter}: \`${genCount}\`\n`;
          bulkText += `• **${year}** ${filter}: \`${bulkCount}\`\n`;
        }
      }

      const embed = new EmbedBuilder()
        .setTitle('📊 Detaylı Stok Durumu')
        .setColor('#2F3136')
        .addFields(
          { name: '🔹 Gen Havuzu', value: genText.slice(0, 1024), inline: true },
          { name: '🔸 Bulk-Gen Havuzu', value: bulkText.slice(0, 1024), inline: true }
        )
        .setTimestamp();

      return await interaction.editReply({ embeds: [embed] });
    }

    // --- /gen KOMUTU ---
    if (interaction.isChatInputCommand() && interaction.commandName === 'gen') {
      const yearSelect = new StringSelectMenuBuilder()
        .setCustomId(`select_year_${interaction.user.id}`)
        .setPlaceholder('Hesap Açılış Yılını Seçin (2006 - 2016)')
        .addOptions(Array.from({ length: 11 }, (_, i) => {
          const year = (2006 + i).toString();
          return { label: year, value: year, description: `${year} yılında oluşturulan hesaplar` };
        }));

      return await interaction.editReply({
        content: 'Lütfen hesap açılış yılını seçin:',
        components: [new ActionRowBuilder().addComponents(yearSelect)]
      });
    }

    // --- /bulk-gen KOMUTU ---
    if (interaction.isChatInputCommand() && interaction.commandName === 'bulk-gen') {
      if (!interaction.member.roles.cache.has(ROLE_ID)) {
        return await interaction.editReply({ content: '❌ Bu komutu kullanabilmek için **Bulk-Gen Customer** rolüne sahip olmalısınız.' });
      }

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`bulk_amt_5_${interaction.user.id}`).setLabel('5 Hesap').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`bulk_amt_10_${interaction.user.id}`).setLabel('10 Hesap').setStyle(ButtonStyle.Success)
      );

      return await interaction.editReply({ content: 'Üretilecek miktarını seçin:', components: [row] });
    }

    // --- /bulk-gen Miktar Seçimi ---
    if (interaction.isButton() && interaction.customId.startsWith('bulk_amt_')) {
      const parts = interaction.customId.split('_');
      const amount = parts[2];
      const ownerId = parts[3];

      const yearSelect = new StringSelectMenuBuilder()
        .setCustomId(`bulk_year_${amount}_${interaction.user.id}`)
        .setPlaceholder('Hesap Açılış Yılını Seçin (2006 - 2016)')
        .addOptions(Array.from({ length: 11 }, (_, i) => {
          const year = (2006 + i).toString();
          return { label: year, value: year, description: `${year} yılında oluşturulan hesaplar` };
        }));

      return await interaction.editReply({
        content: `Seçilen Miktar: **${amount}**\nLütfen açılış yılını seçin:`,
        components: [new ActionRowBuilder().addComponents(yearSelect)]
      });
    }

    // --- /bulk-gen Yıl Seçimi ---
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('bulk_year_')) {
      const parts = interaction.customId.split('_');
      const amount = parts[2];
      const ownerId = parts[3];

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

      return await interaction.editReply({ content: `Seçilen Yıl: **${selectedYear}** | Miktar: **${amount}**\nLütfen kullanıcı adı desenini seçin:`, components: [row1, row2] });
    }

    // --- /bulk-gen Hesap Üretim Süreci ---
    if (interaction.isButton() && interaction.customId.startsWith('bulk_gen_')) {
      const parts = interaction.customId.split('_');
      let filterType = '';
      let targetYear = '';
      let amount = 0;
      let ownerId = '';

      if (parts[2] === 'cross' && parts[3] === 'user') {
        filterType = 'cross_user';
        targetYear = parts[4];
        amount = parseInt(parts[5]);
        ownerId = parts[6];
      } else if (parts[2] === 'double' && parts[3] === 'user') {
        filterType = 'double_user';
        targetYear = parts[4];
        amount = parseInt(parts[5]);
        ownerId = parts[6];
      } else if (parts[2] === 'year' && parts[3] === 'user') {
        filterType = 'year_user';
        targetYear = parts[4];
        amount = parseInt(parts[5]);
        ownerId = parts[6];
      } else if (parts[3] === 'method') {
        filterType = `${parts[2]}_method`;
        targetYear = parts[4];
        amount = parseInt(parts[5]);
        ownerId = parts[6];
      } else if (parts[4] === 'method') {
        filterType = `${parts[2]}_${parts[3]}_method`;
        targetYear = parts[5];
        amount = parseInt(parts[6]);
        ownerId = parts[7];
      }

      const key = `bulk_${targetYear}_${filterType}`;
      const db = getDB();
      const stock = db[key] || [];

      if (stock.length < amount) {
        return await interaction.editReply({ content: `❌ Toplu üretim için yeterli stok yok! Mevcut stok: **${stock.length}**`, components: [] });
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
        const isPublic = accountData.inventoryInfo ? accountData.inventoryInfo : 'Herkese Açık';
        const statusText = accountData.isBanned ? '🔴 Yasaklı' : '🟢 Aktif';
        
        return new EmbedBuilder()
          .setTitle(`👑 TOPLU PREMİUM HESAP #${index + 1}`)
          .setURL(`https://www.roblox.com/users/${accountData.id}/profile`)
          .setColor('#2F3136')
          .setThumbnail(accountData.avatarUrl)
          .addFields(
            { name: '👤 Kullanıcı Adı', value: `\`\`\`${accountData.name}\`\`\``, inline: false },
            { name: '📅 Oluşturulma Tarihi', value: `\`${accountData.createdDate}\``, inline: true },
            { name: '🛡️ Durum', value: statusText, inline: true },
            { name: '🌐 Son Aktivite', value: `\`${accountData.lastOnline || 'Çevrimdışı'}\``, inline: true },
            { name: '🎒 Envanter', value: `\`${isPublic}\``, inline: false }
          )
          .setFooter({ text: `RadarBlox Premium Toplu • Toplam Üretim: ${currentCount}`, iconURL: client.user.displayAvatarURL() })
          .setTimestamp();
      });

      try {
        await interaction.user.send({ embeds: embeds });
        await interaction.editReply({ content: '✅ Hesaplar başarıyla DM adresinize gönderildi!', components: [] });
      } catch (e) {
        await interaction.editReply({ content: '❌ Lütfen DM kutunuzu açın!', components: [] });
      }
    }

    // --- /gen Yıl Seçimi ---
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
        content: `Seçilen Yıl: **${selectedYear}**\nŞimdi bir kullanıcı adı deseni seçin:`, 
        components: [row1, row2] 
      });
    }

    // --- /gen Hesap Üretim Süreci ---
    if (interaction.isButton() && interaction.customId.startsWith('gen_')) {
      const parts = interaction.customId.split('_');
      let filterType = '';
      let targetYear = '';
      let ownerId = '';

      if (parts[1] === 'cross' && parts[2] === 'user') {
        filterType = 'cross_user';
        targetYear = parts[3];
        ownerId = parts[4];
      } else if (parts[1] === 'double' && parts[2] === 'user') {
        filterType = 'double_user';
        targetYear = parts[3];
        ownerId = parts[4];
      } else if (parts[1] === 'year' && parts[2] === 'user') {
        filterType = 'year_user';
        targetYear = parts[3];
        ownerId = parts[4];
      } else if (parts[2] === 'method') {
        filterType = `${parts[1]}_method`;
        targetYear = parts[3];
        ownerId = parts[4];
      } else if (parts[3] === 'method') {
        filterType = `${parts[1]}_${parts[2]}_method`;
        targetYear = parts[4];
        ownerId = parts[5];
      }

      const key = `gen_${targetYear}_${filterType}`;
      const db = getDB();
      const stock = db[key] || [];

      if (stock.length === 0) {
        return await interaction.editReply({ content: `❌ **${targetYear} - ${filterType}** için stok tükendi. Lütfen yeni hesapların eklenmesini bekleyin.`, components: [] });
      }

      const accountData = stock.shift();
      db[key] = stock;
      saveDB();

      const currentCount = (userGenCount.get(interaction.user.id) || 0) + 1;
      userGenCount.set(interaction.user.id, currentCount);

      const isPublic = accountData.inventoryInfo ? accountData.inventoryInfo : 'Herkese Açık';
      const statusText = accountData.isBanned ? '🔴 Yasaklı' : '🟢 Aktif';

      const embed = new EmbedBuilder()
        .setTitle('👑 PREMİUM HESAP ÜRETİLDİ')
        .setURL(`https://www.roblox.com/users/${accountData.id}/profile`)
        .setColor('#2F3136')
        .setThumbnail(accountData.avatarUrl)
        .addFields(
          { name: '👤 Kullanıcı Adı', value: `\`\`\`${accountData.name}\`\`\``, inline: false },
          { name: '📅 Oluşturulma Tarihi', value: `\`${accountData.createdDate}\``, inline: true },
          { name: '🛡️ Durum', value: statusText, inline: true },
          { name: '🌐 Son Aktivite', value: `\`${accountData.lastOnline || 'Çevrimdışı'}\``, inline: true },
          { name: '🎒 Envanter', value: `\`${isPublic}\``, inline: false }
        )
        .setFooter({ text: `RadarBlox Premium • Toplam Üretim: ${currentCount}`, iconURL: client.user.displayAvatarURL() })
        .setTimestamp();

      try {
        await interaction.user.send({ embeds: [embed] });
        await interaction.editReply({ content: '✅ Hesap başarıyla DM adresinize gönderildi!', components: [] });
      } catch (e) {
        db[key].unshift(accountData); // Hata olursa stoku geri ekle
        saveDB();
        return await interaction.editReply({ content: '❌ Lütfen DM kutunuzu açın!', components: [] });
      }
    }

  } catch (err) {
    console.error('Etkileşim hatası:', err);
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: '❌ Bu komut işlenirken bir hata oluştu.', components: [] }).catch(() => {});
      } else {
        await interaction.reply({ content: '❌ Bu komut işlenirken bir hata oluştu.', ephemeral: true }).catch(() => {});
      }
    } catch {}
  }
});

if (!TOKEN) {
  console.error("KRİTİK HATA: DISCORD_TOKEN tanımlı değil veya boş!");
} else {
  console.log("Discord'a bağlanılıyor... Token uzunluğu:", TOKEN.length);
  client.login(TOKEN)
    .then(() => console.log("Discord login başarılı!"))
    .catch(err => {
      console.error("DISCORD BAĞLANTI HATASI DETAYI:", err);
    });
}
