const https = require('https');

console.log('[DEBUG] Generator.js (Hızlı & Düzeltilmiş Üretim Modu) Başlatıldı!');

const WEBHOOK_URL = 'https://radar-blox-bot-production.up.railway.app/api/add-account';
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
  '123_method',
  '321_method',
  '2_number_method',
  '4_number_method',
  'cross_user',
  'double_user',
  'year_user'
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

function validateUsernameByFilter(username) {
  const lowerName = username.toLowerCase();
  
  // 1. Düzeltilmiş Cross Method (Örn: 123isim123, isim123isim, 123isim123isim)
  const crossMatch = lowerName.match(/^(\d{2,4})([a-z]+)\1$/) || 
                     lowerName.match(/^([a-z]+)(\d{2,4})\1$/) || 
                     lowerName.match(/^(\d{2,4})([a-z]+)\1([a-z]+)$/) ||
                     lowerName.match(/^(\d{2,4})([a-z]+)\1\2$/);
  if (crossMatch) return 'cross_user';

  // 2. Double Method (Örn: acc123123, 123123acc, acc19981998)
  if (/([a-zA-Z]+)(\d{2,4})\2$/.test(lowerName) || /^(\d{2,4})\1([a-zA-Z]+)$/.test(lowerName)) return 'double_user';

  // 3. Year Method (1999 - 2026 arası esnek varyasyonlar)
  if (/\b(199\d|20[0-2]\d)\b/.test(lowerName) || /([a-zA-Z]+)(199\d|20[0-2]\d)(\d*)/.test(lowerName) || /([a-zA-Z]+)(\d{4,8})/.test(lowerName)) {
    const yearMatch = lowerName.match(/(199\d|20[0-2]\d)/);
    if (yearMatch) {
      const yearVal = parseInt(yearMatch[1], 10);
      if (yearVal >= 1999 && yearVal <= 2026) return 'year_user';
    }
  }

  // 4. 123 Method (123, 1234, 123123 vb. başta veya sonda)
  if (/^(123|1234|123123|789|999)\d*$|^\d*(123|1234|123123|789|999)$/.test(lowerName)) return '123_method';

  // 5. 321 Method (321, 4321, 321321 vb. başta veya sonda)
  if (/^(321|4321|321321|543|876)\d*$|^\d*(321|4321|321321|543|876)$/.test(lowerName)) return '321_method';

  // 6. Sayı Adedi Bazlı Filtreler
  const digits = lowerName.match(/\d/g);
  if (digits) {
    if (digits.length === 2 && !/(123|321)/.test(lowerName)) return '2_number_method';
    if (digits.length === 4 && !/(123|321)/.test(lowerName)) return '4_number_method';
  }

  return null;
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
      const currentDesiredMethod = TARGET_METHODS[methodIndex];

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
      const matchedFilter = validateUsernameByFilter(username);
      
      if (!matchedFilter || matchedFilter !== currentDesiredMethod) continue;

      methodIndex = (methodIndex + 1) % TARGET_METHODS.length;

      // HIZLANDIRMA: Boş hesapların da (itemCount: 0) sisteme hızlıca dahil edilmesi için envanter kontrolü yavaşlatmasın diye optimize edildi
      const inventoryRes = await fetchJSON(`https://inventory.roblox.com/v1/users/${testId}/assets/collectibles?limit=10`);
      let itemCount = 0;
      let isOffSaleAccount = false;

      if (inventoryRes.status === 200 && inventoryRes.data && inventoryRes.data.data) {
        itemCount = inventoryRes.data.data.length;
        if (itemCount >= 2) {
          isOffSaleAccount = true;
        }
      }

      addedAccountIds.add(accountIdStr);

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
      
      console.log(`[HIZLI ÜRETİM] Tip: ${matchedFilter} | Hesap: ${username} | Eşya: ${itemCount}`);
      
      // Hızın düşmemesi için bekleme süresi minimumda tutuldu
      await sleep(30);

    } catch (err) {
      console.error('[HATA]:', err);
      await sleep(2000);
    }
  }
}

main();
