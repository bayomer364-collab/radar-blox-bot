const https = require('https');

console.log('[DEBUG] Optimized Generator.js Başlatıldı - İsim Formatları Korundu!');

const WEBHOOK_URL = 'https://radar-blox-bot.onrender.com/api/add-account';
const WEBHOOK_SECRET = 'GIZLI_SIFRE_12345';

// Yıl aralıklarını biraz daha geniş tuttuk (ID'lerin boşluklarını daha iyi tarar)
const YEAR_ID_RANGES = {
  '2006': 100000, '2007': 500000, '2008': 1500000, '2009': 3000000,
  '2010': 5000001, '2011': 13000001, '2012': 25000001, '2013': 40000001,
  '2014': 60000001, '2015': 80000001, '2016': 110000000
};

const YEARS = Object.keys(YEAR_ID_RANGES);
// Rastgele değil, sıralı ama geniş adımlı tarama için state
let currentIds = { ...YEAR_ID_RANGES };

function fetchJSON(url) {
  return new Promise((resolve) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
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
  // --- İSİM ÜRETİM MANTIĞINI BOZMADIM (Aynı sistem devam ediyor) ---
  const crossMatch = username.match(/^([a-zA-Z0-9]{2,4}).*?\1$/);
  if (crossMatch && username.length > crossMatch[1].length * 2) return 'cross_user';
  if (/(19\d{2}|20\d{2})/.test(username)) return 'year_user';
  if (/(\d{2})\1/.test(username)) return 'double_user';
  return null;
}

async function sendWebhook(payload) {
  return new Promise((resolve) => {
    const webhookUrl = new URL(WEBHOOK_URL);
    const req = https.request({
      hostname: webhookUrl.hostname, port: 443, path: webhookUrl.pathname,
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
    }, () => resolve());
    req.on('error', () => resolve());
    req.write(payload);
    req.end();
  });
}

async function scanBatch() {
  // İSİM MANTIĞINI KORUYORUZ: Sadece ID atlama aralığını dinamik yapıyoruz (daha çok hesap taramak için)
  for (let i = 0; i < 150; i++) { // Iterasyonu 150 yaparak tarama gücünü artırdık
    const targetYear = YEARS[Math.floor(Math.random() * YEARS.length)];
    
    // Rastgele ID atlamalarıyla (1-5000 arası) çok daha geniş bir alanı tarar
    const testId = currentIds[targetYear] + Math.floor(Math.random() * 5000);
    currentIds[targetYear] += 5000; 

    const res = await fetchJSON(`https://users.roblox.com/v1/users/${testId}`);
    
    if (res.status === 429) {
      console.log('[WARNING] Rate limit! Kısa bir mola...');
      await new Promise(resolve => setTimeout(resolve, 20000));
      continue;
    }

    if (!res.data || !res.data.name) continue;

    const username = res.data.name;
    const matchedFilter = validateUsernameByFilter(username);
    
    if (!matchedFilter) continue;

    // Hesap bulundu!
    const avatarRes = await fetchJSON(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${testId}&size=150x150&format=Png&isCircular=false`);
    const avatarUrl = (avatarRes.data?.data?.[0]) ? avatarRes.data.data[0].imageUrl : 'https://tr.rbxcdn.com/30day-avatar-headshot/150/150/Avatar/Png';

    await sendWebhook(JSON.stringify({
      secret: WEBHOOK_SECRET,
      targetYear: new Date(res.data.created).getFullYear().toString(),
      filterType: matchedFilter,
      accountData: {
        id: res.data.id.toString(),
        name: username,
        createdDate: res.data.created.split('T')[0],
        isBanned: res.data.isBanned || false,
        lastOnline: res.data.isBanned ? 'Banned' : 'Active',
        inventoryInfo: 'Public',
        avatarUrl: avatarUrl
      }
    }));
    
    console.log(`[SUCCESS] Bulundu: ${username} | Format: ${matchedFilter}`);
    await new Promise(resolve => setTimeout(resolve, 800)); // Hızlı ama güvenli
  }
}

scanBatch();
