const https = require('https');

console.log('[DEBUG] generator.js akıllı filtreleme moduyla başlatıldı!');

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

// Kullanıcı adının hangi kategoriye ait olduğunu tam olarak analiz eden fonksiyon
function validateUsernameByFilter(username) {
  if (/_/.test(username)) return null;

  // 1. Kriter: İçinde 19xx veya 20xx geçiyor mu? -> year_user
  if (/(19\d{2}|20\d{2})/.test(username)) {
    return 'year_user';
  }
  // 2. Kriter: Yan yana aynı iki rakam var mı? (örn: xx55, aa99) -> double_user
  if (/(\d{2})\1/.test(username)) {
    return 'double_user';
  }

  return null;
}

async function scanNext() {
  const targetYear = YEARS[Math.floor(Math.random() * YEARS.length)];
  const testId = currentIds[targetYear];
  currentIds[targetYear]++; // Sıradaki ID'ye geç

  const res = await fetchJSON(`https://users.roblox.com/v1/users/${testId}`);
  
  if (res.status === 429) {
    console.log('[WARNING] Rate limit (429) algılandı, biraz bekleniyor...');
    return 15000;
  }

  if (!res.data || !res.data.name) return 2000; // Hesap yoksa hızlıca sonrakine geç

  const userDetails = res.data;
  const createdDate = new Date(userDetails.created);
  const accountYear = createdDate.getFullYear().toString();
  
  if (accountYear !== targetYear) return 2000;

  const username = userDetails.name;
  
  // İsim kurallara uyuyor mu diye kontrol et (boşa kürek çekmemek için filtre süzgeci)
  const matchedFilter = validateUsernameByFilter(username);
  if (!matchedFilter) return 2000; // Filtreye uymuyorsa es geç

  // Filtreye uydu! Avatarı çek ve ilgili kategoriye gönder
  const avatarRes = await fetchJSON(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${testId}&size=150x150&format=Png&isCircular=false`);
  const avatarUrl = (avatarRes.data && avatarRes.data.data && avatarRes.data.data[0]) ? avatarRes.data.data[0].imageUrl : 'https://tr.rbxcdn.com/30day-avatar-headshot/150/150/Avatar/Png';

  const payload = JSON.stringify({
    secret: WEBHOOK_SECRET,
    targetYear: accountYear,
    filterType: matchedFilter, // Doğru metoda (year_user veya double_user) yollanıyor
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
  return 3000;
}

async function startLoop() {
  while (true) {
    try {
      const delay = await scanNext();
      await new Promise(resolve => setTimeout(resolve, delay));
    } catch (err) {
      console.error('[SCAN LOOP ERROR]:', err);
      await new Promise(resolve => setTimeout(resolve, 3500));
    }
  }
}

startLoop();
                     
