'use strict';

/* めぐる団地 防災フリマ — 共通ロジック（DOM非依存の部分を中心に） */

const CFG = {
  key: 'meguru-v3',
  hazardRate: 1.5,          // 危険物の引換券倍率（変更はここだけ）
  tiers: [1, 2, 3, 5, 10],  // 受付で扱う引換券の5段階
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
  const base = Number(item && item.tickets);
  if (!Number.isFinite(base) || base <= 0) return 0;
  return Math.round(base * (item.hazard ? CFG.hazardRate : 1));
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
const PHOTO_SPRAY = hazardPhoto('回収：スプレー缶');

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
      { id: 'i7', title: 'モバイルバッテリー', sellerId: 's1', image: PHOTO_BATTERY, tickets: 5, hazard: true },
      { id: 'i8', title: 'スプレー缶', sellerId: 's4', image: PHOTO_SPRAY, tickets: 2, hazard: true },
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
