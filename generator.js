function validateUsernameByFilter(username) {
  // Tamamen boşsa veya yoksa reddet
  if (!username) {
    return null;
  }

  // 1. 123_method: Gerçekçi isimler + 123 ve katları (Örn: isim123, isim123123, 123isim123)
  if (/^[a-zA-Z]+\d*(?:123)+$/i.test(username) || /^123[a-zA-Z]+\d*(?:123)*$/i.test(username)) {
    return '123_method';
  }

  // 2. 321_method: Gerçekçi isimler + 321 ve katları (Örn: isim321, isim321321, 321isim321)
  if (/^[a-zA-Z]+\d*(?:321)+$/i.test(username) || /^321[a-zA-Z]+\d*(?:321)*$/i.test(username)) {
    return '321_method';
  }

  // 3. year_user: Gerçekçi isimler + Yıl kombinasyonları (Örn: dave362010, robloxvassel2012, isim2004)
  if (/^[a-zA-Z]+\d*(199[8-9]|20[0-2][0-6])\d*$/i.test(username) || /^(199[8-9]|20[0-2][0-6])[a-zA-Z]+\d*$/i.test(username)) {
    return 'year_user';
  }

  // 4. cross_user: İstediğin çapraz ve harf/sayı geçişli yapılar (Örn: 123isim123, isim123isim, 3ashley3737 tarzı)
  if (/^(?:\d+[a-zA-Z]+\d+|\d+[a-zA-Z]+\d+[a-zA-Z]+\d*|[a-zA-Z]+\d+[a-zA-Z]+\d*)$/i.test(username)) {
    return 'cross_user';
  }

  // 5. double_user: Ekran görüntülerindeki gibi (Örn: Brianna1414, soccerstar999999, KingAce10101)
  if (/^[a-zA-Z]+(\d{2})\1+$/i.test(username) || /^[a-zA-Z]+\d*(\d)\1{3,}$/i.test(username) || /^[a-zA-Z]+\d{2,4}$/i.test(username)) {
    if (/\d{4}$/.test(username) && !/(\d{2})\1$/.test(username)) {
      // Eğer düz 4 haneliyse 4_number_method'a bırakması için burada yakalamıyoruz
    } else {
      return 'double_user';
    }
  }

  // 6. 4_number_method: Sonunda rastgele 4 sayı olanlar
  if (/^[a-zA-Z]+\d{4}$/.test(username)) {
    return '4_number_method';
  }

  // 7. 2_number_method: Sonunda rastgele 2 sayı olanlar
  if (/^[a-zA-Z]+\d{2}$/.test(username)) {
    return '2_number_method';
  }

  return null;
}

async function runGeneratorLoop() {
  console.log('[DEBUG] Embedded Generator (Turbo & Yüksek Hız Modu) Başlatıldı!');
  let pendingSaves = 0;

  while (true) {
    try {
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
      
      // KESİN ÇÖZÜM: Aynı hesabın tekrar stoğa basılmasını önleyen kontrol
      if (addedAccountIds.has(accountIdStr)) continue;

      const username = res.data.name;
      const matchedFilter = validateUsernameByFilter(username);
      if (!matchedFilter) continue; 

      // Envanter kontrolü
      const inventoryRes = await fetchJSON(`https://inventory.roblox.com/v1/users/${testId}/assets/collectibles?limit=10`);
      let itemCount = 0;
      let isOffSaleAccount = false;

      if (inventoryRes.status === 200 && inventoryRes.data && inventoryRes.data.data) {
        itemCount = inventoryRes.data.data.length;
        if (itemCount >= 1) {
          isOffSaleAccount = true;
        }
      }

      // Hesap ID'sini işlendi olarak ekle ki bir daha asla taranmasın/basılmasın
      addedAccountIds.add(accountIdStr);

      const avatarRes = await fetchJSON(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${testId}&size=150x150&format=Png&isCircular=false`);
      const avatarUrl = (avatarRes.data?.data?.[0]) ? avatarRes.data.data[0].imageUrl : 'https://tr.rbxcdn.com/30day-avatar-headshot/150/150/Avatar/Png';

      const accountYear = new Date(res.data.created).getFullYear().toString();
      const db = getDB();
      
      const accountData = {
        id: accountIdStr,
        name: username,
        createdDate: res.data.created.split('T')[0],
        isBanned: res.data.isBanned || false,
        itemCount: itemCount,
        avatarUrl: avatarUrl
      };

      let added = false;

      // 1. Normal Gen ve Bulk havuzuna ekle
      const genKey = `gen_${accountYear}_${matchedFilter}`;
      const bulkKey = `bulk_${accountYear}_${matchedFilter}`;

      if (!db[genKey]) db[genKey] = [];
      if (!db[bulkKey]) db[bulkKey] = [];

      if (!db[genKey].some(acc => acc.id === accountData.id)) {
        db[genKey].push(accountData);
        added = true;
      }
      if (!db[bulkKey].some(acc => acc.id === accountData.id)) {
        db[bulkKey].push(accountData);
        added = true;
      }

      // 2. Off-sale havuzu kontrolü
      if (isOffSaleAccount) {
        const offsaleKey = `offsale_${accountYear}_${matchedFilter}`;
        if (!db[offsaleKey]) db[offsaleKey] = [];
        if (!db[offsaleKey].some(acc => acc.id === accountData.id)) {
          db[offsaleKey].push(accountData);
          added = true;
        }
      }

      if (added) {
        pendingSaves++;
        if (pendingSaves >= 5) {
          saveDB();
          pendingSaves = 0;
        }
      }

      console.log(`[TURBO BAŞARILI] Hesap Eklendi: ${username} | Yıl: ` + accountYear + ` | Tip: ${matchedFilter} | Eşya: ${itemCount}`);
      
      await sleep(60);

    } catch (err) {
      console.error('[HATA]:', err);
      await sleep(2000);
    }
  }
}
