const https = require('https');

const WEBHOOK_URL = 'https://radar-blox-bot.onrender.com/api/add-account';
const WEBHOOK_SECRET = 'GIZLI_SIFRE_12345';

const YEARS = ['2006', '2007', '2008', '2009', '2010', '2011', '2012', '2013', '2014', '2015', '2016'];
const FILTERS = ['no_number_user', 'year_user', 'double_user'];

const VOWELS = ['a', 'e', 'i', 'o', 'u'];
const CONSONANTS = ['b', 'c', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm', 'n', 'p', 'r', 's', 't', 'v', 'w', 'x', 'y', 'z'];

function getRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomDigits(len) {
  let res = '';
  for (let i = 0; i < len; i++) res += Math.floor(Math.random() * 10);
  return res;
}

function generateRandomSyllableName(minLen = 3, maxLen = 6) {
  const len = Math.floor(Math.random() * (maxLen - minLen + 1)) + minLen;
  let name = '';
  for (let i = 0; i < len; i++) {
    name += (i % 2 === 0) ? getRandom(CONSONANTS) : getRandom(VOWELS);
  }
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function createPossibleUsername(year, filter) {
  const baseName = generateRandomSyllableName();

  if (filter === 'no_number_user') {
    const part2 = generateRandomSyllableName(3, 4);
    return `${baseName}${part2.toLowerCase()}`;
  } else if (filter === 'double_user') {
    const num2 = getRandomDigits(2);
    const num3 = getRandomDigits(3);
    const style = Math.floor(Math.random() * 3);
    if (style === 0) return `${baseName}${num2}${num2}`;
    if (style === 1) return `${baseName}${num3}${num3}`;
    return `${num2}${baseName.toLowerCase()}${num2}`;
  } else if (filter === 'year_user') {
    const style = Math.floor(Math.random() * 2);
    if (style === 0) return `${baseName}${year}`;
    return `${baseName.toLowerCase()}${year}${getRandomDigits(1)}`;
  }
  return `${baseName}${year}`;
}

// HTTP İSTEKLERİ İÇİN YARDIMCI FONKSİYON
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

// ROBLOX API SORGULAMA VE DOĞRULAMA
async function checkAndSendAccount() {
  const targetYear = getRandom(YEARS);
  const filterType = getRandom(FILTERS);
  const username = createPossibleUsername(targetYear, filterType);

  // 1. Roblox Users API'den Kullanıcı Adını Sorgula
  const userSearch = await fetchJSON(`https://users.roblox.com/v1/usernames/users`, {
    method: 'POST'
  });

  // POST isteği için https.request kullanımı
  const postData = JSON.stringify({ usernames: [username], excludeBannedUsers: false });
  
  const options = {
    hostname: 'users.roblox.com',
    path: '/v1/usernames/users',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
      'User-Agent': 'Mozilla/5.0'
    }
  };

  const robloxUser = await new Promise((resolve) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (parsed && parsed.data && parsed.data.length > 0) {
            resolve(parsed.data[0]);
          } else {
            resolve(null);
          }
        } catch (e) { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.write(postData);
    req.end();
  });

  // HESAP ROBLOX'TA YOKSA İŞLEMİ İPTAL ET (STOĞA EKLEME)
  if (!robloxUser || !robloxUser.id) {
    return;
  }

  // 2. Hesap Detaylarını Roblox'tan Çek
  const userDetails = await fetchJSON(`https://users.roblox.com/v1/users/${robloxUser.id}`);
  if (!userDetails) return;

  // Kayıt yılı eşleşmiyorsa stoğa alma
  const createdDate = new Date(userDetails.created);
  const accountYear = createdDate.getFullYear().toString();
  if (accountYear !== targetYear) return;

  // 3. Avatar Görselini Çek
  const avatarData = await fetchJSON(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${robloxUser.id}&size=150x150&format=Png&isCircular=false`);
  const avatarUrl = (avatarData && avatarData.data && avatarData.data[0]) ? avatarData.data[0].imageUrl : 'https://tr.rbxcdn.com/30day-avatar-headshot/150/150/Avatar/Png';

  const payload = JSON.stringify({
    secret: WEBHOOK_SECRET,
    targetYear: accountYear,
    filterType: filterType,
    accountData: {
      id: robloxUser.id.toString(),
      name: robloxUser.name,
      createdDate: createdDate.toISOString().split('T')[0],
      isBanned: userDetails.isBanned || false,
      lastOnline: userDetails.isBanned ? 'Banned' : 'Active',
      inventoryInfo: 'Public Inventory',
      avatarUrl: avatarUrl
    }
  });

  // 4. Webhook İle Sunucuya Gönder
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

  console.log(`[GERÇEK HESAP BULUNDU] ${robloxUser.name} (${accountYear}) stoğa eklendi.`);
}

// Her 3 saniyede bir arama yap
setInterval(() => {
  checkAndSendAccount().catch(() => {});
}, 3000);
  
