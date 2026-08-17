const https = require('https');

// Render Webhook Bilgilerin
const WEBHOOK_URL = 'https://radar-blox-bot.onrender.com/api/add-account';
const WEBHOOK_SECRET = 'GIZLI_SIFRE_12345';

const YEARS = ['2006', '2007', '2008', '2009', '2010', '2011', '2012', '2013', '2014', '2015', '2016'];
const FILTERS = ['no_number_user', 'year_user', 'double_user'];

// Rastgele Kullanıcı Adı ve Hesap Bilgisi Üretici
function generateAccount(year, filter) {
  const randomId = Math.floor(10000000 + Math.random() * 90000000).toString();
  let username = 'User' + randomId.substring(0, 5);

  if (filter === 'no_number_user') {
    const names = ['Shadow', 'Vortex', 'Phantom', 'Legend', 'Falcon', 'Raptor', 'Apex', 'Titan'];
    username = names[Math.floor(Math.random() * names.length)] + 'Player';
  } else if (filter === 'year_user') {
    username = `Gamer${year}`;
  } else if (filter === 'double_user') {
    username = 'RobloxRoblox';
  }

  return {
    secret: WEBHOOK_SECRET,
    targetYear: year,
    filterType: filter,
    accountData: {
      id: randomId,
      name: username,
      createdDate: `${year}-05-10`,
      isBanned: false,
      lastOnline: 'Active',
      inventoryInfo: 'Clean',
      avatarUrl: 'https://tr.rbxcdn.com/30day-avatar-headshot/150/150/Avatar/Png'
    }
  };
}

// Her 3 Saniyede Bir Stok Gönderen Döngü
setInterval(() => {
  const year = YEARS[Math.floor(Math.random() * YEARS.length)];
  const filter = FILTERS[Math.floor(Math.random() * FILTERS.length)];
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

  const req = https.request(options, (res) => {
    console.log(`[STOK POMPALANDI] Yıl: ${year} | Filtre: ${filter} | Durum: ${res.statusCode}`);
  });

  req.on('error', (e) => console.error('Hata:', e.message));
  req.write(payload);
  req.end();
}, 3000); // 3000ms = 3 saniye
               
