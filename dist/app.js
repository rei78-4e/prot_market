'use strict';

/* めぐる団地 防災フリマ — 共通ロジック（DOM非依存の部分を中心に） */

const CFG = {
  key: 'meguru-v3',
  hazardTickets: 2,          // 危険物（モバイルバッテリー）は1個2枚
  tiers: [1, 2, 3, 5, 10],  // 一般物の引換券5段階
  batteryGramsPerTicket: 50, // 乾電池は50gで引換券1枚
  photoEdge: 1000,          // 保存する写真の長辺
  photoQuality: 0.78,
  limits: { title: 40, name: 24, room: 16, contact: 60 },
};

const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

function clean(v, max) {
  return String(v == null ? '' : v)
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function batteryTickets(grams) {
  const g = Number(grams);
  if (!Number.isFinite(g) || g <= 0) return 0;
  return Math.floor(g / CFG.batteryGramsPerTicket);
}

function isBattery(item) {
  return !!item && item.kind === 'battery';
}

function awardTickets(item) {
  if (isBattery(item)) return batteryTickets(item.grams);
  if (item && item.hazard) return CFG.hazardTickets;
  const base = Number(item && item.tickets);
  if (!Number.isFinite(base) || base <= 0) return 0;
  return base;
}

function ticketTotal(state, sellerId) {
  return state.items
    .filter((i) => i.sellerId === sellerId)
    .reduce((n, i) => n + awardTickets(i), 0);
}

function consented(seller, field) {
  return !!(seller && seller.consent && seller.consent[field]);
}

function sellerName(s) {
  return consented(s, 'name') && s.name ? s.name : '匿名の出品者';
}
function sellerRoom(s) {
  return consented(s, 'room') && s.room ? s.room : '';
}
function sellerContact(s) {
  return consented(s, 'contact') && s.contact ? s.contact : '';
}
function sellerPhoto(s) {
  return consented(s, 'photo') && s.photo ? s.photo : '';
}

/* 名札印刷用QRコード（モック・DB不要） */
function profilePayload(seller) {
  const s = seller || {};
  const c = s.consent || {};
  const name = c.name && s.name ? clean(s.name, CFG.limits.name) : '';
  const room = c.room && s.room ? clean(s.room, CFG.limits.room) : '';
  const contact = c.contact && s.contact ? clean(s.contact, CFG.limits.contact) : '';
  const photo = !!(c.photo && s.photo);
  return {
    v: 1,
    id: clean(s.id || 'me', 24) || 'me',
    name,
    room,
    contact,
    photo,
    consent: {
      name: !!name,
      room: !!room,
      contact: !!contact,
      photo,
    },
  };
}

function encodeProfileQR(seller) {
  const json = JSON.stringify(profilePayload(seller));
  const utf8 = unescape(encodeURIComponent(json));
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let out = '';
  for (let i = 0; i < utf8.length; i += 3) {
    const b0 = utf8.charCodeAt(i);
    const b1 = i + 1 < utf8.length ? utf8.charCodeAt(i + 1) : 0;
    const b2 = i + 2 < utf8.length ? utf8.charCodeAt(i + 2) : 0;
    const n = (b0 << 16) | (b1 << 8) | b2;
    out += chars[(n >> 18) & 63] + chars[(n >> 12) & 63];
    if (i + 1 < utf8.length) out += chars[(n >> 6) & 63];
    if (i + 2 < utf8.length) out += chars[n & 63];
  }
  return 'MEGURU1:' + out;
}

function decodeProfileQR(raw) {
  const text = String(raw || '').trim();
  const body = text.startsWith('MEGURU1:') ? text.slice(8) : text;
  if (!body) return null;
  try {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    const cleanBody = body.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    let utf8 = '';
    for (let i = 0; i < cleanBody.length; i += 4) {
      const c0 = chars.indexOf(cleanBody[i]);
      const c1 = chars.indexOf(cleanBody[i + 1]);
      const c2 = i + 2 < cleanBody.length ? chars.indexOf(cleanBody[i + 2]) : 0;
      const c3 = i + 3 < cleanBody.length ? chars.indexOf(cleanBody[i + 3]) : 0;
      if (c0 < 0 || c1 < 0 || c2 < 0 || c3 < 0) return null;
      const n = (c0 << 18) | (c1 << 12) | (c2 << 6) | c3;
      utf8 += String.fromCharCode((n >> 16) & 255);
      if (i + 2 < cleanBody.length) utf8 += String.fromCharCode((n >> 8) & 255);
      if (i + 3 < cleanBody.length) utf8 += String.fromCharCode(n & 255);
    }
    const data = JSON.parse(decodeURIComponent(escape(utf8)));
    if (!data || typeof data !== 'object') return null;
    return profilePayload({
      id: data.id,
      name: data.name,
      room: data.room,
      contact: data.contact,
      photo: data.photo ? '1' : '',
      consent: data.consent || {
        name: !!data.name,
        room: !!data.room,
        contact: !!data.contact,
        photo: !!data.photo,
      },
    });
  } catch {
    return null;
  }
}

function qrSVG(text) {
  const size = 25;
  const grid = Array.from({ length: size }, () => Array(size).fill(null));
  const placeFinder = (r0, c0) => {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const r = r0 + dr;
        const c = c0 + dc;
        if (r < 0 || r >= size || c < 0 || c >= size) continue;
        const inOuter = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6;
        const onBorder = dr === 0 || dr === 6 || dc === 0 || dc === 6;
        const inInner = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
        grid[r][c] = inOuter && (onBorder || inInner);
      }
    }
  };
  placeFinder(0, 0);
  placeFinder(0, size - 7);
  placeFinder(size - 7, 0);
  for (let i = 8; i < size - 8; i++) {
    grid[6][i] = i % 2 === 0;
    grid[i][6] = i % 2 === 0;
  }
  for (let dr = -2; dr <= 2; dr++) {
    for (let dc = -2; dc <= 2; dc++) {
      const onEdge = Math.abs(dr) === 2 || Math.abs(dc) === 2;
      grid[18 + dr][18 + dc] = onEdge || (dr === 0 && dc === 0);
    }
  }
  let h1 = 2166136261 >>> 0;
  let h2 = 16777619 >>> 0;
  const str = String(text || '');
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 16777619) >>> 0;
    h2 = Math.imul(h2 ^ (code + i * 31), 2246822519) >>> 0;
  }
  let state = (h1 ^ h2) || 1;
  const rects = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (grid[r][c] === null) {
        const mix = str.charCodeAt((r * size + c) % Math.max(1, str.length)) || 7;
        state = (Math.imul(state ^ mix, 1664525) + 1013904223) >>> 0;
        grid[r][c] = ((state >>> 11) & 1) === 1;
      }
      if (grid[r][c]) rects.push(`<rect x="${c + 2}" y="${r + 2}" width="1" height="1"/>`);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size + 4} ${size + 4}" shape-rendering="crispEdges" role="img" aria-label="名札印刷用QRコード"><rect width="${size + 4}" height="${size + 4}" fill="#ffffff"/><g fill="#111111">${rects.join('')}</g></svg>`;
}

/* デモ用のプレースホルダー画像（外部通信なし・無彩色） */
function avatar(label) {
  const ch = esc(String(label || '').slice(0, 1) || '氏');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="#e5e5e5"/><text x="60" y="64" text-anchor="middle" dominant-baseline="central" font-family="sans-serif" font-size="52" font-weight="700" fill="#404040">${ch}</text></svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

function hazardPhoto(label) {
  const text = esc(label);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="#eeeeee"/><rect x="16" y="16" width="368" height="268" fill="none" stroke="#cccccc" stroke-width="2"/><text x="200" y="150" text-anchor="middle" dominant-baseline="central" font-family="sans-serif" font-size="28" font-weight="700" fill="#555555">${text}</text></svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

const PHOTO_BATTERY = hazardPhoto('回収：電池類');

function blankSeller(id) {
  return {
    id,
    name: '',
    room: '',
    contact: '',
    photo: '',
    consent: { name: false, room: false, contact: false, photo: false },
  };
}

function seed() {
  return {
    v: 3,
    me: 'me',
    sellers: {
      me: blankSeller('me'),
      s1: {
        id: 's1', name: '田中 はるか', room: '203号室', contact: 'LINE: haruka_203',
        photo: avatar('田'),
        consent: { name: true, room: true, contact: false, photo: true },
      },
      s2: {
        id: 's2', name: '佐藤 まこと', room: '105号室', contact: '',
        photo: '',
        consent: { name: true, room: false, contact: false, photo: false },
      },
      s3: {
        id: 's3', name: '', room: '302号室', contact: '',
        photo: '',
        consent: { name: false, room: false, contact: false, photo: false },
      },
      s4: {
        id: 's4', name: '鈴木 ゆうこ', room: '302号室', contact: 'Messenger: @yuko',
        photo: avatar('鈴'),
        consent: { name: true, room: true, contact: true, photo: true },
      },
    },
    items: [
      { id: 'i1', title: 'マグカップ（白）', sellerId: 's2', image: 'assets/item-1.webp', tickets: 3, hazard: false },
      { id: 'i2', title: '小型リュック（カーキ）', sellerId: 's4', image: 'assets/item-2.webp', tickets: 5, hazard: false },
      { id: 'i3', title: 'ハードカバー本', sellerId: 's1', image: 'assets/item-3.webp', tickets: 2, hazard: false },
      { id: 'i4', title: '平皿（22cm）', sellerId: 's4', image: 'assets/item-4.webp', tickets: 5, hazard: false },
      { id: 'i5', title: '鉢植え（ポトス）', sellerId: 's2', image: 'assets/item-5.webp', tickets: 3, hazard: false },
      { id: 'i6', title: '絵本', sellerId: 's3', image: 'assets/item-6.webp', tickets: 2, hazard: false },
      { id: 'i7', title: 'モバイルバッテリー', sellerId: 's1', image: PHOTO_BATTERY, tickets: 2, hazard: true },
      { id: 'i9', kind: 'battery', title: '乾電池', sellerId: 's2', image: PHOTO_BATTERY, grams: 180, tickets: 0, hazard: true },
    ],
  };
}

function normalize(raw) {
  const out = { v: 3, me: 'me', sellers: {}, items: [] };
  const sellers = raw && raw.sellers && typeof raw.sellers === 'object' ? raw.sellers : {};
  for (const [id, s] of Object.entries(sellers)) {
    if (!s || typeof s !== 'object') continue;
    out.sellers[id] = {
      id,
      name: clean(s.name, CFG.limits.name),
      room: clean(s.room, CFG.limits.room),
      contact: clean(s.contact, CFG.limits.contact),
      photo: typeof s.photo === 'string' && /^(data:image\/|assets\/)/.test(s.photo) ? s.photo : '',
      consent: {
        name: !!(s.consent && s.consent.name),
        room: !!(s.consent && s.consent.room),
        contact: !!(s.consent && s.consent.contact),
        photo: !!(s.consent && s.consent.photo),
      },
    };
  }
  if (typeof raw?.me === 'string' && out.sellers[raw.me]) out.me = raw.me;
  else out.me = Object.keys(out.sellers)[0] || 'me';
  if (!out.sellers[out.me]) out.sellers[out.me] = blankSeller(out.me);

  const seen = new Set();
  for (const it of Array.isArray(raw?.items) ? raw.items : []) {
    if (!it || typeof it !== 'object') continue;
    const id = String(it.id || '');
    if (!id || seen.has(id) || !out.sellers[it.sellerId]) continue;
    seen.add(id);
    const tier = Number(it.tickets);
    const kind = it.kind === 'battery' ? 'battery' : 'general';
    const grams = kind === 'battery' ? Math.min(99999, Math.max(0, Math.round(Number(it.grams) || 0))) : 0;
    out.items.push({
      id,
      kind,
      title: kind === 'battery' ? '乾電池' : (clean(it.title, CFG.limits.title) || '無題の商品'),
      sellerId: it.sellerId,
      image: typeof it.image === 'string' && /^(data:image\/|assets\/)/.test(it.image)
        ? it.image
        : (kind === 'battery' ? PHOTO_BATTERY : ''),
      tickets: kind === 'battery' ? 0 : (CFG.tiers.includes(tier) ? tier : CFG.tiers[0]),
      grams,
      hazard: kind === 'battery' ? true : !!it.hazard,
    });
  }
  /* 旧デモデータの i8 を除去 */
  out.items = out.items.filter((item) => item.id !== 'i8');
  return out;
}

function loadState() {
  let raw = null;
  try {
    raw = JSON.parse(localStorage.getItem(CFG.key) || 'null');
  } catch {
    raw = null;
  }
  if (!raw || raw.v !== 3) return normalize(seed());
  return normalize(raw);
}

function persist(state) {
  try {
    localStorage.setItem(CFG.key, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

function newId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return 'i-' + crypto.randomUUID();
  }
  return 'i-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/* 画像を長辺1000pxのJPEGに縮小してlocalStorageを守る */
function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('画像を読み込めませんでした'));
    };
    img.src = url;
  });
}

async function photoFromFile(file) {
  if (!file) throw new Error('画像が選ばれていません');
  if (!/^image\//.test(file.type)) throw new Error('画像ファイルを選んでください');
  if (file.size > 20 * 1024 * 1024) throw new Error('20MB以下の画像を選んでください');
  const img = await loadImage(file);
  const edge = Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height);
  const scale = Math.min(1, CFG.photoEdge / edge);
  const w = Math.max(1, Math.round((img.naturalWidth || img.width) * scale));
  const h = Math.max(1, Math.round((img.naturalHeight || img.height) * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', CFG.photoQuality);
}

function toast(message) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 3200);
}
