const https = require('https');

const WEBHOOK_URL = 'https://radar-blox-bot.onrender.com/api/add-account';
const WEBHOOK_SECRET = 'GIZLI_SIFRE_12345';

// Roblox Yıllara Göre Doğru ID Aralıkları
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

const YEARS = Object.keys(YEAR_ID_RANGES);
const FILTERS = ['no_number_user', 'year_user', 'double_user'];

function getRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function fetchJSON(url) {
  return new Promise((resolve) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

// ESKİ KODUN REGEX (FİLTRELEME) MANTIĞI
function validateUsernameByFilter(username, filterType) {
  // Kesin kural: İsmin içinde alt çizgi (_) KESİNLİKLE OLMAYACAK
  if (/_/.test(username)) return false;

  // 1. no_number_user: İsimde hiç rakam olmamalı
  if (filterType === 'no_number_user') {
    return !/\d/.test(username);
  }

  // 2. year_user: İsmin herhangi bir yerinde 4 haneli yıl olmalı (örn: 1998, 2001, 2012)
  if (filterType === 'year_user') {
    return /(19\d{2}|20\d{2})/.test(username);
  }

  // 3. double_user: Çiftli tekrarlayan dizi olmalı (örn: 9090, 1212, 5050)
  if (filterType === 'double_user') {
    return /(\d{2})\1/.test(username);
  }

  return false;
}

// ROBLOX GERÇEK KULLANICI ID'LERİNİ TARAMA MANTIĞI
async function scanRandomRobloxAccount() {
  const targetYear = getRandom(YEARS);
  const targetFilter = getRandom(FILTERS);
  const range = YEAR_ID_RANGES[targetYear];

  // Rastgele ID seç
  const randomUserId = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;

  // Kullanıcı Detayını Çek
  const userDetails = await fetchJSON(`https://users.roblox.com/v1/users/${randomUserId}`);
  if (!userDetails || !userDetails.name) return;

  // Yıl Doğrulaması
  const createdDate = new Date(userDetails.created);
  const accountYear = createdDate.getFullYear().toString();
  if (accountYear !== targetYear) return;

  const username = userDetails.name;

  // Eski koddaki Regex mantığı ile ismi kontrol et
  if (!validateUsernameByFilter(username, targetFilter)) return;

  // Avatar Görselini Çek
  const avatarData = await fetchJSON(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${randomUserId}&size=150x150&format=Png&isCircular=false`);
  const avatarUrl = (avatarData && avatarData.data && avatarData.data[0]) ? avatarData.data[0].imageUrl : 'https://tr.rbxcdn.com/30day-avatar-headshot/150/150/Avatar/Png';

  const payload = JSON.stringify({
    secret: WEBHOOK_SECRET,
    targetYear: accountYear,
    filterType: targetFilter,
    accountData: {
      id: userDetails.id.toString(),
      name: username,
      createdDate: createdDate.toISOString().split('T')[0],
      isBanned: userDetails.isBanned || false,
      lastOnline: userDetails.isBanned ? 'Banned' : 'Active',
      inventoryInfo: 'Scanned (Public/Private)',
      avatarUrl: avatarUrl
    }
  });

  // Webhook ile Stoğa Gönder
  const webhookUrl = new URL(WEBHOOK_URL);
  const webhookOptions = {
    hostname: webhookUrl.hostname,
    port: 443,
    path: webhookUrl.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  };

  const req = https.request(webhookOptions, () => {});
  req.on('error', () => {});
  req.write(payload);
  req.end();

  console.log(`[GERÇEK GERÇEK HESAP BULUNDU] ${username} (${accountYear}) - Filtre: ${targetFilter}`);
}

// Hızlı tarama yapabilmesi için eşzamanlı döngü
setInterval(() => {
  scanRandomRobloxAccount().catch(() => {});
}, 100);
