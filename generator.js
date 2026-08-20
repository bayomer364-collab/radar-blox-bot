function validateUsernameByFilter(username) {
  // İçinde hiç harf yoksa veya tamamen sayılardan oluşuyorsa KESİNLİKLE reddet!
  if (/^\d+$/.test(username) || !/[a-zA-Z]/.test(username)) {
    return null;
  }

  // 1. 321_method: Harf grubuyla başlayan ve 321, 321321, 321321321 şeklinde bitenler (Örn: isim321, kullaniciadi321321)
  if (/^[a-zA-Z]+(321)+$/i.test(username)) {
    return '321_method';
  }

  // 2. 123_method: Harf grubuyla başlayan ve 123, 123123, 123123123 veya 1234, 12341234 şeklinde bitenler
  if (/^[a-zA-Z]+(123|1234)+$/i.test(username)) {
    return '123_method';
  }

  // 3. year_user: Harf grubuyla başlayıp içinde yıl geçenler (Örn: isim1998, kullanici20007)
  if (/^[a-zA-Z]+.*(199[8-9]|20[0-2][0-6])\d*$/i.test(username)) {
    return 'year_user';
  }

  // 4. cross_user: Çapraz / tekrarlayan yapıdaki isimler (Örn: 123isim123, isim123isim123)
  if (/^(?:\d+[a-zA-Z]+\d+[a-zA-Z]+|[a-zA-Z]+\d+[a-zA-Z]+\d+)$/i.test(username) || /^(\d{2,3}[a-zA-Z]+)\1+$/i.test(username)) {
    return 'cross_user';
  }

  // 5. double_user: Çift basamaklı tekrarlayan sayılarla bitenler (Örn: isim9090, isim909090)
  if (/^[a-zA-Z]+(\d{2})\1+$/i.test(username)) {
    return 'double_user';
  }

  // 6. 2_number_method: Harf grubuyla başlayıp sonunda rastgele 2 sayı olanlar
  if (/^[a-zA-Z]+[a-zA-Z0-9]*\d{2}$/i.test(username)) {
    return '2_number_method';
  }

  // 7. 4_number_method: Harf grubuyla başlayıp sonunda rastgele 4 sayı olanlar
  if (/^[a-zA-Z]+[a-zA-Z0-9]*\d{4}$/i.test(username)) {
    return '4_number_method';
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
      if (addedAccountIds.has(accountIdStr)) continue;

      const username = res.data.name;
      const matchedFilter = validateUsernameByFilter(username);
      if (!matchedFilter) continue; 

      // Envanter kontrolü (Sadece Off-Sale / Eşyalı seçimi için)
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

      console.log(`[TURBO BAŞARILI] Hesap Eklendi: ${username} | Yıl: ${accountYear} | Tip: ${matchedFilter} | Eşya: ${itemCount}`);
      
      await sleep(60);

    } catch (err) {
      console.error('[HATA]:', err);
      await sleep(2000);
    }
  }
}
