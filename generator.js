const https = require('https');

console.log('[DEBUG] Generator.js (Turbo & Hızlı Üretim Modu) Başlatıldı!');

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
  const crossMatch = lowerName.match(/^([a-zA-Z0-9]{2,5}).*?\1$/) || lowerName.match(/^([a-zA-Z]{3,}).*?\1.*?\1$/);
  if (crossMatch && lowerName.length > crossMatch[1].length * 2) return 'cross_user';
  if (/([a-zA-Z]+)(19\d{2}|20\d{2})(\d*)/.test(lowerName) || /([a-zA-Z]+)(\d{4,8})/.test(lowerName)) return 'year_user';
  if (/(\d{2})\1/.test(lowerName)) return 'double_user';
  if (/^(123|1234|123123|789|999)\d*$|^\d*(123|1234|123123|789|999)$/.test(lowerName)) return '123_method';
  if (/^(321|4321|321321|543|876)\d*$|^\d*(321|4321|321321|543|876)$/.test(lowerName)) return '321_method';
  const digits = lowerName.match(/\d/g);
  if (digits && digits.length === 2) return '2_number_method';
  if (digits && digits.length === 4) return '4_number_method';
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
      const targetYear = YEARS[Math.floor(Math.random() * YEARS.length)];
      const randomOffset = Math.floor(Math.random() * 2000000); 
      const testId = YEAR_ID_RANGES[targetYear] + randomOffset;

      if (scannedIds.has(testId)) continue;
      scannedIds.add(testId);

      const res = await fetchJSON(`https://users.roblox.com/v1/users/${testId}`);
      if (res.status === 429) {
        await sleep(15000); // Rate limit durumunda bekleme süresini optimize ettik
        continue;
      }
      if (!res.data || !res.data.name) {
        continue; // Boş hesaplarda fazladan beklemeyi (sleep) kaldırarak hızı artırdık
      }

      const accountIdStr = res.data.id.toString();
      if (addedAccountIds.has(accountIdStr)) continue;

      const username = res.data.name;
      const matchedFilter = validateUsernameByFilter(username);
      if (!matchedFilter) continue;

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
      
      if (isOffSaleAccount || itemCount > 0) {
        console.log(`[TURBO BAŞARILI] ${isOffSaleAccount ? 'OFF-SALE' : 'EŞYALI'} Hesap: ${username} | Eşya: ${itemCount} | Tip: ${matchedFilter}`);
      }
      
      // HIZLANDIRMA: İstekler arası bekleme süresini 400ms'den 60ms'ye düşürdük
      await sleep(60);

    } catch (err) {
      console.error('[HATA]:', err);
      await sleep(2000);
    }
  }
}

main();
