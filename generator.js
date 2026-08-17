const https = require('https');

console.log('[DEBUG] generator.js dosyası başarıyla yüklendi ve çalışıyor!');

const WEBHOOK_URL = 'https://radar-blox-bot.onrender.com/api/add-account';
const WEBHOOK_SECRET = 'GIZLI_SIFRE_12345';

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

let filterIndex = 0;

function getRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function fetchJSON(url) {
  return new Promise((resolve) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); } 
        catch (e) { resolve({ status: res.statusCode, data: null }); }
      });
    }).on('error', (err) => {
      resolve({ status: 500, data: null });
    });
  });
}

function validateUsernameByFilter(username, filterType) {
  if (/_/.test(username)) return false;

  if (filterType === 'no_number_user') {
    return !/\d/.test(username);
  }
  if (filterType === 'year_user') {
    return /(19\d{2}|20\d{2})/.test(username);
  }
  if (filterType === 'double_user') {
    return /(\d{2})\1/.test(username);
  }

  return false;
}

async function scanRandomRobloxAccount() {
  const targetYear = getRandom(YEARS);
  const targetFilter = FILTERS[filterIndex];
  filterIndex = (filterIndex + 1) % FILTERS.length;

  const range = YEAR_ID_RANGES[targetYear];
  const randomUserId = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;

  const res = await fetchJSON(`https://users.roblox.com/v1/users/${randomUserId}`);
  
  if (res.status === 429) {
    console.log('[RATE LIMIT] Roblox istek sınırı aşıldı!');
    return;
  }

  if (!res.data || !res.data.name) return;

  const userDetails = res.data;
  const createdDate = new Date(userDetails.created);
  const accountYear = createdDate.getFullYear().toString();
  if (accountYear !== targetYear) return;

  const username = userDetails.name;
  if (!validateUsernameByFilter(username, targetFilter)) return;

  const avatarRes = await fetchJSON(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${randomUserId}&size=150x150&format=Png&isCircular=false`);
  const avatarUrl = (avatarRes.data && avatarRes.data.data && avatarRes.data.data[0]) ? avatarRes.data.data[0].imageUrl : 'https://tr.rbxcdn.com/30day-avatar-headshot/150/150/Avatar/Png';

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
      console.log(`[WEBHOOK YANITI] Durum: ${webhookRes.statusCode}, Cevap: ${responseData}`);
    });
  });

  req.on('error', (err) => console.error('[WEBHOOK HATA]:', err.message));
  req.write(payload);
  req.end();

  console.log(`[GERÇEK HESAP BULUNDU] ${username} (${accountYear}) - Filtre: ${targetFilter}`);
}

// Her 1 saniyede bir tarama yapması için başlatıldı
setInterval(() => {
  scanRandomRobloxAccount().catch((err) => console.error('[TARAMA HATA]:', err));
}, 4000);
