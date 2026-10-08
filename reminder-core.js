// Lõi nhắc nhở dùng chung cho trang (index.html) và Service Worker (sw.js)
(function (g) {
  const DB = 'masterplan-db', ST = 'kv', GRACE_MIN = 180;
  const open = () => new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(ST);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  async function kvGet(k) {
    const db = await open();
    return new Promise((res, rej) => {
      const q = db.transaction(ST).objectStore(ST).get(k);
      q.onsuccess = () => res(q.result);
      q.onerror = () => rej(q.error);
    });
  }
  async function kvSet(k, v) {
    const db = await open();
    return new Promise((res, rej) => {
      const tx = db.transaction(ST, 'readwrite');
      tx.objectStore(ST).put(JSON.parse(JSON.stringify(v)), k);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  }
  const pad = n => String(n).padStart(2, '0');
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const pendingToday = plans => {
    const t = iso(new Date());
    return (plans || []).filter(p => t >= p.startDate && t <= p.endDate && !(p.completedDays || []).includes(t));
  };

  // Gọi show(title, body) nếu đến giờ nhắc và còn việc chưa check-in
  async function checkReminders(show) {
    const s = await kvGet('settings');
    if (!s || !s.enabled) return false;
    const now = new Date(), today = iso(now), mins = now.getHours() * 60 + now.getMinutes();
    let fired = (await kvGet('fired')) || {};
    Object.keys(fired).forEach(k => { if (!k.startsWith(today)) delete fired[k]; });
    let due = null;
    for (const t of (s.times || [])) {
      const m = /^(\d{2}):(\d{2})$/.exec(t || '');
      if (!m) continue;
      const tm = +m[1] * 60 + +m[2], key = today + '_' + t;
      if (mins >= tm && mins < tm + GRACE_MIN && !fired[key]) { fired[key] = 1; due = tm; }
    }
    await kvSet('fired', fired);
    if (due === null) return false;
    const pending = pendingToday(await kvGet('plans'));
    if (!pending.length) return false;
    const n = pending.length;
    const title = due < 12 * 60 ? `☀️ Hôm nay có ${n} mục tiêu cần thực hiện` : `🌙 Còn ${n} mục tiêu chưa check-in`;
    const lines = pending.slice(0, 3).map(p => '• ' + p.title);
    if (n > 3) lines.push(`…và ${n - 3} mục tiêu khác`);
    await show(title, lines.join('\n'));
    return true;
  }
  g.MP = { kvGet, kvSet, pendingToday, checkReminders };
})(self);
