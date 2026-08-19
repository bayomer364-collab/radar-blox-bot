const https = require('https');

console.log('[DEBUG] Generator.js (Güncel Domain & Kesin Kurallı Mod) Başlatıldı!');

const WEBHOOK_URL = 'https://radar-blox-bot-production-d990.up.railway.app/api/add-account';
const WEBHOOK_SECRET = 'GIZLI_SIFRE_12345';

const YEAR_ID_RANGES = {
  '2006': 100000, '2007': 500000, '2008': 1500000, '2009': 3000000,
  '2010': 5000001, '2011': 13000001, '2012': 25000001, '2013': 40000001,
  '2014': 60000001, '2015': 80000001, '2016': 110000000
};

const YEARS = Object.keys(YEAR_ID_RANGES);
const addedAccountIds = new Set();
const scannedIds = new Set();

const TARGET_METHODS = [
  'year_user',
  'cross_user',
  'double_user',
  '2_number_user',
  '4_number_user',
  '123_method',
  '321_method'
];
let methodIndex = 0;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function fetchJSON(url) {
  return new Promise((resolve) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); } 
        catch (e) { resolve({ status: res.statusCode, data: null }); }
      });
    }).on('error', () => { resolve({ status: 500, data: null }); });
  });
}

function validateUsernameByFilter(username, targetMethod) {
  const lowerName = username.toLowerCase();

  switch (targetMethod) {
    case 'year_user':
      const yearMatch = lowerName.match(/(199\d|20[0-2]\d)/);
      if (yearMatch) {
        const yearVal = parseInt(yearMatch[1], 10);
        if (yearVal >= 1998 && yearVal <= 2026) return 'year_user';
      }
      return null;

    case 'cross_user':
      if (/^(\d{2,4})([a-z]+)\1(\2)?$/.test(lowerName) || 
          /^([a-z]+)(\d{2,4})\1(\2)?$/.test(lowerName) ||
          /^(\d{2,4})([a-z]+)\1([a-z]+)$/.test(lowerName) ||
          /^([a-z]+)(\d{2,4})([a-z]+)\2$/.test(lowerName)) {
        return 'cross_user';
      }
      return null;

    case 'double_user':
      if (/^[a-z]+(\d{2,4})\1{1,3}$/.test(lowerName)) {
        return 'double_user';
      }
      return null;

    case '2_number_user':
      if (/^[a-z]+\d{2}$/.test(lowerName)) {
        return '2_number_user';
      }
      return null;

    case '4_number_user':
      if (/^[a-z]+\d{4}$/.test(lowerName)) {
        return '4_number_user';
      }
      return null;

    case '123_method':
      if (/^[a-z]+(123|1234|123123|12341234)+$/.test(lowerName) || 
          /^(123|1234|123123)[a-z]+$/.test(lowerName)) {
        return '123_method';
      }
      return null;

    case '321_method':
      if (/^[a-z]+(321|321321)+$/.test(lowerName) || 
          /^(321|321321)[a-z]+$/.test(lowerName)) {
        return '321_method';
      }
      return null;

    default:
      return null;
  }
}

async function sendWebhook(payload) {
  return new Promise((resolve) => {
    const webhookUrl = new URL(WEBHOOK_URL);
    const req = https.request({
      hostname: webhookUrl.hostname, port: 443, path: webhookUrl.pathname,
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
    }, (res) => resolve(res.statusCode));
    req.on('error', () => resolve(500));
    req.write(payload);
    req.end();
  });
}

async function main() {
  while (true) {
    try {
      const currentMethod = TARGET_METHODS[methodIndex];

      const targetYear = YEARS[Math.floor(Math.random() * YEARS.length)];
      const randomOffset = Math.floor(Math.random() * 2000000); 
      const testId = YEAR_ID_RANGES[targetYear] + randomOffset;

      if (scannedIds.has(testId)) continue;
      scannedIds.add(testId);

      const res = await fetchJSON(`https://users.roblox.com/v1/users/${testId}`);
      if (res.status === 429) {
        await sleep(15000);
        continue;
      }
      if (!res.data || !res.data.name) {
        continue;
      }

      const accountIdStr = res.data.id.toString();
      if (addedAccountIds.has(accountIdStr)) continue;

      const username = res.data.name;
      
      const matchedFilter = validateUsernameByFilter(username, currentMethod);
      if (!matchedFilter) continue;

      methodIndex = (methodIndex + 1) % TARGET_METHODS.length;
      addedAccountIds.add(accountIdStr);

      let itemCount = 0;
      let isOffSaleAccount = false;

      fetchJSON(`https://inventory.roblox.com/v1/users/${testId}/assets/collectibles?limit=10`).then(inventoryRes => {
        if (inventoryRes.status === 200 && inventoryRes.data && inventoryRes.data.data) {
          itemCount = inventoryRes.data.data.length;
          if (itemCount >= 2) isOffSaleAccount = true;
        }
      }).catch(() => {});

      const avatarRes = await fetchJSON(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${testId}&size=150x150&format=Png&isCircular=false`);
      const avatarUrl = (avatarRes.data?.data?.[0]) ? avatarRes.data.data[0].imageUrl : 'https://tr.rbxcdn.com/30day-avatar-headshot/150/150/Avatar/Png';

      await sendWebhook(JSON.stringify({
        secret: WEBHOOK_SECRET,
        targetYear: new Date(res.data.created).getFullYear().toString(),
        filterType: matchedFilter,
        isOffSale: isOffSaleAccount,
        accountData: {
          id: accountIdStr,
          name: username,
          createdDate: res.data.created.split('T')[0],
          isBanned: res.data.isBanned || false,
          itemCount: itemCount,
          avatarUrl: avatarUrl
        }
      }));
      
      console.log(`[KESİN BAŞARILI] Metot: ${matchedFilter} | Hesap: ${username}`);
      
      await sleep(15);

    } catch (err) {
      console.error('[HATA]:', err);
      await sleep(2000);
    }
  }
}

main();
