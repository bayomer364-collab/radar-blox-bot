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

// Rastgele, okunabilir hece/harf jeneratörü (Hiçbir kelimeye bağlı değil, sonsuz kombinasyon)
function generateRandomSyllableName(minLen = 4, maxLen = 7) {
  const len = Math.floor(Math.random() * (maxLen - minLen + 1)) + minLen;
  let name = '';
  for (let i = 0; i < len; i++) {
    name += (i % 2 === 0) ? getRandom(CONSONANTS) : getRandom(VOWELS);
  }
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function generateAccount(year, filter) {
  const randomId = Math.floor(10000000 + Math.random() * 89999999).toString();
  let username = '';
  const baseName = generateRandomSyllableName();

  // 1. Sadece Harflerden Oluşan İsimler (no_number_user)
  if (filter === 'no_number_user') {
    const part2 = generateRandomSyllableName(3, 5);
    username = `${baseName}${part2.toLowerCase()}`;
  } 

  // 2. Çift / Tekrarlayan Sayılı İsimler (double_user)
  else if (filter === 'double_user') {
    const num2 = getRandomDigits(2);
    const num3 = getRandomDigits(3);
    const style = Math.floor(Math.random() * 5);

    if (style === 0) username = `${baseName}${num2}${num2}`;           // örn: Hxvord9090
    else if (style === 1) username = `${baseName}${num3}${num3}`;     // örn: Sedric121212
    else if (style === 2) username = `${num2}${baseName.toLowerCase()}${num2}`; // örn: 12dani12
    else if (style === 3) username = `${baseName}${num3}${baseName.toLowerCase()}`; // örn: Aiden123aiden
    else username = `${num3}${baseName.toLowerCase()}${num3}`;        // örn: 123bob123
  } 

  // 3. Seçilen Yıla Uygun İsimler (year_user)
  else if (filter === 'year_user') {
    const style = Math.floor(Math.random() * 4);

    if (style === 0) username = `${baseName}${year}`;                  // örn: Robloxvassel2012
    else if (style === 1) username = `${baseName.toLowerCase()}${year}${getRandomDigits(2)}`; // örn: deer200131
    else if (style === 2) username = `${baseName}${year}${year}`;      // örn: King19981998
    else username = `${baseName}${year}${getRandomDigits(1)}`;        // örn: Halis20007
  }

  // Roblox Profil / Avatar Görsel Linki
  const avatarUrl = `https://tr.rbxcdn.com/30day-avatar-headshot/150/150/Avatar/Png`;

  return {
    secret: WEBHOOK_SECRET,
    targetYear: year,
    filterType: filter,
    accountData: {
      id: randomId,
      name: username,
      createdDate: `${year}-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}`,
      isBanned: false,
      lastOnline: 'Active',
      inventoryInfo: 'Public Inventory',
      avatarUrl: avatarUrl
    }
  };
}

setInterval(() => {
  const year = getRandom(YEARS);
  const filter = getRandom(FILTERS);
  const payload = JSON.stringify(generateAccount(year, filter));

  const url = new URL(WEBHOOK_URL);
  const options = {
    hostname: url.hostname,
    port: 443,
    path: url.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  };

  const req = https.request(options, () => {});
  req.on('error', () => {});
  req.write(payload);
  req.end();
}, 3000);
