const https = require('https');

console.log('[DEBUG] GitHub Actions için optimize edilmiş generator.js başlatıldı!');

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

function sendWebhook(payload) {
  return new Promise((resolve) => {
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
      webhookRes.on('end', () => resolve());
    });

    req.on('error', () => resolve());
    req.write(payload);
    req.end();
  });
}

async function scanBatch() {
  // GitHub her 15 dakikada bir çalıştırdığı için her çalıştırmada örneğin 50-60 istek atsın ve kapansın
  const ITERATIONS = 50; 

  for (let i = 0; i < ITERATIONS; i++) {
    const targetYear = YEARS[Math.floor(Math.random() * YEARS.length)];
    const testId = currentIds[targetYear];
    currentIds[targetYear]++;

    const res = await fetchJSON(`https://users.roblox.com/v1/users/${testId}`);
    
    if (res.status === 429) {
      console.log('[WARNING] Rate limit (429) algılandı, bu tur kısa kesiliyor...');
      await new Promise(resolve => setTimeout(resolve, 10000));
      break;
    }

    if (!res.data || !res.data.name) {
      await new Promise(resolve => setTimeout(resolve, 800)); // Boşsa hızlı geç
      continue;
    }

    const userDetails = res.data;
    const createdDate = new Date(userDetails.created);
    const accountYear = createdDate.getFullYear().toString();
    
    if (accountYear !== targetYear) {
      await new Promise(resolve => setTimeout(resolve, 800));
      continue;
    }

    const username = userDetails.name;
    const matchedFilter = validateUsernameByFilter(username);
    
    if (!matchedFilter) {
      await new Promise(resolve => setTimeout(resolve, 800));
      continue;
    }

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

    await sendWebhook(payload);
    console.log(`[VALID ACCOUNT FOUND] ${username} (${accountYear}) - Filter: ${matchedFilter} [ID: ${testId}]`);

    // İstekler arası küçük bir bekleme (GitHub IP'lerinin banlanmaması için)
    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  console.log('[DEBUG] Bu tur tarama tamamlandı, script güvenle kapanıyor.');
}

scanBatch();
