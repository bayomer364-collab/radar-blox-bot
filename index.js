async function runGeneratorLoop() {
  console.log('[DEBUG] Embedded Generator (Turbo & Hızlı Üretim Modu) Başlatıldı!');
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
      if (!matchedFilter) continue; // Kullanıcı adı filtrelere uymuyorsa atla

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

      // 1. Normal Gen ve Bulk havuzuna ekle (Envanterinde eşya olmasa bile kullanıcı adı uygunsa eklenir!)
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

      // 2. Eğer en az 2 limited eşyası varsa Off-sale havuzuna da ekle
      if (isOffSaleAccount) {
        const offsaleKey = `offsale_${accountYear}_${matchedFilter}`;
        if (!db[offsaleKey]) db[offsaleKey] = [];
        if (!db[offsaleKey].some(acc => acc.id === accountData.id)) {
          db[offsaleKey].push(accountData);
          added = true;
        }
      }

      if (added) saveDB();

      console.log(`[TURBO BAŞARILI] Hesap Eklendi: ${username} | Yıl: ${accountYear} | Tip: ${matchedFilter} | Eşya: ${itemCount}`);
      
      await sleep(60);

    } catch (err) {
      console.error('[HATA]:', err);
      await sleep(2000);
    }
  }
}
