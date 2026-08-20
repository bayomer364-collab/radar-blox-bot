function validateUsernameByFilter(username) {
  // Tamamen boşsa veya yoksa reddet
  if (!username) {
    return null;
  }

  // 1. Önce en spesifik metodları (123 ve 321) kontrol et
  if (/(?:123|1234)+(?:123|1234)*$/i.test(username) || /123\d*/i.test(username)) {
    return '123_method';
  }
  if (/(?:321)+$/i.test(username) || /321/i.test(username)) {
    return '321_method';
  }

  // 2. year_user: İçinde 1998 ile 2026 arası yıl geçenler (Örn: Robloxvassel2012, isim20007)
  if (/(199[8-9]|20[0-2][0-6])\d*/i.test(username)) {
    return 'year_user';
  }

  // 3. cross_user: Çapraz / tekrarlayan yapıdaki isimler (Örn: 123isim123, isim123isim)
  if (/^(?:\d+[a-zA-Z]+\d+|\d+[a-zA-Z]+\d+[a-zA-Z]+\d*|[a-zA-Z]+\d+[a-zA-Z]+\d*)$/i.test(username) || /^(\d{2,3}[a-zA-Z]+)\1+$/i.test(username)) {
    return 'cross_user';
  }

  // 4. double_user: Çift basamaklı tekrarlayan sayılarla bitenler (Örn: isim9090, isim909090)
  if (/(\d{2})\1+$/i.test(username)) {
    return 'double_user';
  }

  // 5. 4_number_method: Sonunda rastgele 4 sayı olanlar
  if (/\d{4}$/.test(username)) {
    return '4_number_method';
  }

  // 6. 2_number_method: Sonunda rastgele 2 sayı olanlar
  if (/\d{2}$/.test(username)) {
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
        // İçinde en az 1 tane eşya/offsale olanlar için kural (İstrsen burayı >= 2 yapabilirsin)
        if (itemCount >= 1) {
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

      // 1. Normal Gen ve Bulk havuzuna ekle (0, 1 veya offsale fark etmeksizin tüm geçerli hesaplar eklenir)
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

      // 2. Off-sale havuzu kontrolü (SADECE içinde en az 1 eşya/offsale olanlar)
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
