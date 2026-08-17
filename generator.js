const https = require('https');

console.log('[DEBUG] generator.js başarıyla başlatıldı (Akıllı & Güvenli Tarama Modu)!');

const WEBHOOK_URL = 'https://radar-blox-bot.onrender.com/api/add-account';
const WEBHOOK_SECRET = 'GIZLI_SIFRE_12345';

const YEAR_ID_RANGES = {
  '2010': 5000001,
  '2011': 13000001,
  '2012': 25000001,
  '2013': 40000001,
  '2014': 60000001,
  '2015': 80000001
};

const YEARS = Object.keys(YEAR_ID_RANGES);
let currentIds = { ...YEAR_ID_RANGES };

function fetchJSON(url) {
  return new Promise((resolve) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); } 
        catch (e) { resolve({ status: res.statusCode, data: null }); }
      });
    }).on('error', () => {
      resolve({ status: 500, data: null });
    });
  });
}

function validateUsernameByFilter(username) {
  if (/_/.test(username)) return null;

  if (/(19\d{2}|20\d{2})/.test(username)) {
    return 'year_user';
  }
  if (/(\d{2})\1/.test(username)) {
    return 'double_user';
  }

  return null;
}

async function scanNext() {
  // Her adımda rastgele bir yıl seçerek isteklerin doğal görünmesini sağla
  const targetYear = YEARS[Math.floor(Math.random() * YEARS.length)];
  const testId = currentIds[targetYear];
  currentIds[targetYear]++; // Sıradaki ID'ye geç

  const res = await fetchJSON(`https://users.roblox.com/v1/users/${testId}`);
  
  // Rate limit (429) kontrolü
  if (res.status === 429) {
    console.log('[WARNING] Rate limit (429) algılandı, biraz bekleniyor...');
    return 5000; // 5 saniye mola ver
  }

  if (!res.data || !res.data.name) return 1500; // Hesap yoksa normal hızda devam et

  const userDetails = res.data;
  const createdDate = new Date(userDetails.created);
  const accountYear = createdDate.getFullYear().toString();
  
  if (accountYear !== targetYear) return 1500;

  const username = userDetails.name;
  const matchedFilter = validateUsernameByFilter(username);
  if (!matchedFilter) return 1500;

  const avatarRes = await fetchJSON(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${testId}&size=150x150&format=Png&isCircular=false`);
  const avatarUrl = (avatarRes.data && avatarRes.data.data && avatarRes.data.data[0]) ? avatarRes.data.data[0].imageUrl : 'https://tr.rbxcdn.com/30day-avatar-headshot/150/150/Avatar/Png';

  const payload = JSON.stringify({
    secret: WEBHOOK_SECRET,
    targetYear: accountYear,
    filterType: matchedFilter,
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

  const req = https.request(webhookOptions, (webhookRes) => {
    let responseData = '';
    webhookRes.on('data', chunk => responseData += chunk);
    webhookRes.on('end', () => {
      console.log(`[WEBHOOK RESPONSE] Status: ${webhookRes.statusCode}, Answer: ${responseData}`);
    });
  });

  req.on('error', (err) => console.error('[WEBHOOK ERROR]:', err.message));
  req.write(payload);
  req.end();

  console.log(`[VALID ACCOUNT FOUND] ${username} (${accountYear}) - Filter: ${matchedFilter} [ID: ${testId}]`);
  return 1500;
}

// Akıllı Döngü (İstekler arası dinamik ve güvenli bekleme süresi)
async function startLoop() {
  while (true) {
    try {
      const delay = await scanNext();
      // İstekler arasına bot korumasını atlatmak için rastgele milisaniye ekle (1.5 - 3 saniye arası)
      const randomJitter = Math.floor(Math.random() * 1500) + 1500;
      await new Promise(resolve => setTimeout(resolve, delay || randomJitter));
    } catch (err) {
      console.error('[SCAN LOOP ERROR]:', err);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
}

startLoop();
  
