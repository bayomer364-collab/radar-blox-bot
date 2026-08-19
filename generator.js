const https = require('https');

console.log('[DEBUG] Generator.js (Dual-Stock Modu) Başlatıldı!');

// DİKKAT: Buradaki domain adresini kendi Railway domain adresinle değiştirdiğinden emin ol!
const WEBHOOK_URL = 'https://radar-blox-bot-production.up.railway.app/api/add-account';
const WEBHOOK_SECRET = 'GIZLI_SIFRE_12345';

const YEAR_ID_RANGES = {
  '2006': 100000, '2007': 500000, '2008': 1500000, '2009': 3000000,
  '2010': 5000001, '2011': 13000001, '2012': 25000001, '2013': 40000001,
  '2014': 60000001, '2015': 80000001, '2016': 110000000
};

const YEARS = Object.keys(YEAR_ID_RANGES);
let currentIds = { ...YEAR_ID_RANGES };

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

// Filtre doğrulama mekanizması (Güncellenmiş Esnek Yapı)
function validateUsernameByFilter(username) {
  const lowerName = username.toLowerCase();

  // 1. cross_user kontrolü (İsmin başında/sonunda veya içinde tekrarlı kalıplar: örn. 123isim123, isim123isim vb.)
  const crossMatch = lowerName.match(/^([a-zA-Z0-9]{2,5}).*?\1$/) || lowerName.match(/^([a-zA-Z]{3,}).*?\1.*?\1$/);
  if (crossMatch && lowerName.length > crossMatch[1].length * 2) return 'cross_user';
  
  // 2. year_user kontrolü (Sadece sonda değil, ismin içinde de farklı sayılarla birleşik olabilir)
  if (/([a-zA-Z]+)(19\d{2}|20\d{2})(\d*)/.test(lowerName) || /([a-zA-Z]+)(\d{4,8})/.test(lowerName)) {
    return 'year_user';
  }
  
  // 3. double_user kontrolü
  if (/(\d{2})\1/.test(lowerName)) return 'double_user';

  // 4. 123_method kontrolü (123, 1234, 123123 gibi benzer biten veya başlayan kalıplar)
  if (/^(123|1234|123123|789|999)\d*$|^\d*(123|1234|123123|789|999)$/.test(lowerName)) return '123_method';

  // 5. 321_method kontrolü (321, 4321, 321321 gibi benzer geri sayım kalıpları)
  if (/^(321|4321|321321|543|876)\d*$|^\d*(321|4321|321321|543|876)$/.test(lowerName)) return '321_method';

  // 6. 2_number_method kontrolü
  const digits = lowerName.match(/\d/g);
  if (digits && digits.length === 2) return '2_number_method';

  // 7. 4_number_method kontrolü
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
      const testId = currentIds[targetYear] + Math.floor(Math.random() * 2000);
      currentIds[targetYear] += 2000; 

      const res = await fetchJSON(`https://users.roblox.com/v1/users/${testId}`);
      
      if (res.status === 429) {
        console.log('[UYARI] İstek sınırı (Rate limit) aşıldı! 30 saniye mola veriliyor...');
        await sleep(30000);
        continue;
      }

      if (!res.data || !res.data.name) {
        await sleep(200);
        continue;
      }

      const username = res.data.name;
      const matchedFilter = validateUsernameByFilter(username);
      
      if (!matchedFilter) continue;

      const avatarRes = await fetchJSON(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${testId}&size=150x150&format=Png&isCircular=false`);
      const avatarUrl = (avatarRes.data?.data?.[0]) ? avatarRes.data.data[0].imageUrl : 'https://tr.rbxcdn.com/30day-avatar-headshot/150/150/Avatar/Png';

      const webhookResponseCode = await sendWebhook(JSON.stringify({
        secret: WEBHOOK_SECRET,
        targetYear: new Date(res.data.created).getFullYear().toString(),
        filterType: matchedFilter,
        accountData: {
          id: res.data.id.toString(),
          name: username,
          createdDate: res.data.created.split('T')[0],
          isBanned: res.data.isBanned || false,
          lastOnline: res.data.isBanned ? 'Yasaklı' : 'Aktif',
          inventoryInfo: 'Herkese Açık',
          avatarUrl: avatarUrl
        }
      }));
      
      console.log(`[BAŞARILI] Hesap Bulundu ve Stoklara Eklendi: ${username} | Yıl: ${targetYear} | Format: ${matchedFilter} | Webhook Yanıt Kodu: ${webhookResponseCode}`);
      await sleep(500);

    } catch (err) {
      console.error('[HATA] Beklenmedik bir hata oluştu:', err);
      await sleep(5000);
    }
  }
}

main();
