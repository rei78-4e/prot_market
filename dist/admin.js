'use strict';

let state = loadState();
let pendingPhoto = '';
const byId = (id) => document.getElementById(id);
const form = byId('register-form');

/* 選択肢 */
function optionLabel(seller) {
  const name = seller.name || '匿名';
  const room = seller.room ? ` / ${seller.room}` : '';
  const me = seller.id === state.me ? '（この端末）' : '';
  return `${name}${room}${me}`;
}

function fillSellerSelect(select, keep) {
  const current = keep ? select.value : '';
  select.innerHTML = Object.values(state.sellers)
    .map((seller) => `<option value="${esc(seller.id)}">${esc(optionLabel(seller))}</option>`)
    .join('');
  if (current && state.sellers[current]) select.value = current;
}

function fillTagSeller(selected) {
  const select = byId('tag-seller');
  const current = selected || select.value;
  fillSellerSelect(select, false);
  const target = current && state.sellers[current] ? current : defaultTagSeller();
  select.value = target;
}

function defaultTagSeller() {
  const withItems = Object.keys(state.sellers).find((id) => state.items.some((item) => item.sellerId === id));
  return withItems || state.me;
}

function fillBatterySeller() {
  const select = byId('battery-seller');
  const current = select.value;
  fillSellerSelect(select, false);
  select.value = current && state.sellers[current] ? current : state.me;
}

function renderTiers() {
  const fallback = CFG.tiers.includes(3) ? 3 : CFG.tiers[0];
  byId('tier-row').innerHTML = CFG.tiers
    .map((tier) => `<label class="tier"><input type="radio" name="tickets" value="${tier}"${tier === fallback ? ' checked' : ''}>${tier}枚</label>`)
    .join('');
}

function currentAward() {
  const kind = form.elements.kind.value;
  if (kind === 'hazard') return CFG.hazardTickets;
  return Number(form.elements.tickets.value) || 0;
}

function renderAward() {
  const kind = form.elements.kind.value;
  const award = currentAward();
  const tierField = byId('tier-field');
  if (tierField) tierField.hidden = kind === 'hazard';
  byId('award-preview').innerHTML = kind === 'hazard'
    ? `売る人に渡す引換券：<b>${award}枚</b> <span class="hazard-tag">1個につき</span>`
    : `売る人に渡す引換券：<b>${award}枚</b>`;
}

/* 乾電池の回収 */
function batteryGrams() {
  return Math.max(0, Math.round(Number(byId('battery-grams').value) || 0));
}

function renderBatteryPreview() {
  const grams = batteryGrams();
  const detail = grams > 0
    ? `${grams}g / ${CFG.batteryGramsPerTicket}gで1枚`
    : `${CFG.batteryGramsPerTicket}gで1枚`;
  byId('battery-preview').innerHTML = `引換券 <b>${batteryTickets(grams)}</b>枚 <span class="muted">${detail}</span>`;
}

byId('battery-grams').addEventListener('input', renderBatteryPreview);

byId('battery-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const grams = batteryGrams();
  if (grams <= 0) {
    toast('重さを入力してください');
    byId('battery-grams').focus();
    return;
  }
  if (batteryTickets(grams) < 1) {
    toast(`${CFG.batteryGramsPerTicket}g未満は引換券になりません`);
    byId('battery-grams').focus();
    return;
  }
  const sellerId = byId('battery-seller').value;
  if (!state.sellers[sellerId]) {
    toast('売る人を選んでください');
    return;
  }
  const item = {
    id: newId(),
    kind: 'battery',
    title: '乾電池',
    sellerId,
    image: PHOTO_BATTERY,
    grams,
    tickets: 0,
    hazard: true,
  };
  state.items.unshift(item);
  if (!persist(state)) {
    state.items.shift();
    toast('保存できませんでした');
    return;
  }
  byId('battery-grams').value = '';
  renderBatteryPreview();
  renderItems();
  renderHazards();
  fillTagSeller(byId('tag-seller').value);
  renderTag();
  toast(`乾電池 ${grams}g を登録しました（引換券${awardTickets(item)}枚）`);
});

/* 写真 */
function renderAdminPhoto() {
  const box = byId('admin-photo');
  box.innerHTML = pendingPhoto ? `<img src="${esc(pendingPhoto)}" alt="">` : '写真なし';
  box.classList.toggle('empty', !pendingPhoto);
}

document.querySelectorAll('[data-pick]').forEach((button) => {
  button.addEventListener('click', () => byId(button.dataset.pick).click());
});

async function handlePhoto(input) {
  const file = input.files && input.files[0];
  input.value = '';
  if (!file) return;
  try {
    pendingPhoto = await photoFromFile(file);
    renderAdminPhoto();
  } catch (error) {
    toast(error.message);
  }
}

byId('admin-camera').addEventListener('change', (event) => handlePhoto(event.target));
byId('admin-file').addEventListener('change', (event) => handlePhoto(event.target));

form.addEventListener('change', (event) => {
  if (event.target.name === 'kind' || event.target.name === 'tickets') renderAward();
});

/* 登録 */
form.addEventListener('submit', (event) => {
  event.preventDefault();
  const title = clean(byId('admin-title').value, CFG.limits.title);
  if (!title) {
    toast('商品名を入力してください');
    byId('admin-title').focus();
    return;
  }
  if (!pendingPhoto) {
    toast('商品の写真を登録してください');
    return;
  }
  const sellerId = byId('seller-select').value;
  if (!state.sellers[sellerId]) {
    toast('売る人を選んでください');
    return;
  }
  const kind = form.elements.kind.value;
  const tickets = kind === 'hazard'
    ? CFG.hazardTickets
    : (Number(form.elements.tickets.value) || CFG.tiers[0]);
  const item = {
    id: newId(),
    title,
    sellerId,
    image: pendingPhoto,
    tickets,
    hazard: kind === 'hazard',
  };

  state.items.unshift(item);
  if (!persist(state)) {
    state.items.shift();
    toast('保存できませんでした。写真を小さくしてください。');
    return;
  }

  pendingPhoto = '';
  byId('admin-title').value = '';
  form.elements.kind.value = 'general';
  const fallback = CFG.tiers.includes(3) ? 3 : CFG.tiers[0];
  form.elements.tickets.value = String(fallback);
  renderAdminPhoto();
  renderAward();
  renderItems();
  renderHazards();
  fillTagSeller(byId('tag-seller').value);
  renderTag();
  toast('登録しました');
  byId('admin-title').focus();
});

/* 登録済みの商品・回収 */
function itemLabel(item) {
  return isBattery(item) ? `乾電池 ${item.grams}g` : item.title;
}

function itemRow(item) {
  const seller = state.sellers[item.sellerId];
  const tickets = awardTickets(item);
  const sellerLabel = seller ? (seller.name || '匿名') : '不明';
  const battery = isBattery(item);
  const meta = battery
    ? `<span class="hazard-tag">乾電池回収</span> ・ 引換券 ${tickets}枚（${CFG.batteryGramsPerTicket}gで1枚）`
    : item.hazard
      ? `<span class="hazard-tag">モバイルバッテリー</span> ・ 引換券 ${tickets}枚（1個につき）`
      : `一般物 ・ 引換券 ${tickets}枚`;
  return `<article class="admin-item">
    <img src="${esc(item.image)}" alt="" width="76" height="57" loading="lazy" decoding="async">
    <div class="admin-item-body">
      <p class="admin-item-title">${esc(itemLabel(item))}</p>
      <p class="muted">${esc(sellerLabel)} ・ ${meta}</p>
    </div>
    <div class="admin-item-actions">
      ${battery ? '' : `<button class="secondary" type="button" data-print="${esc(item.id)}">ラベル</button>`}
      <button class="danger" type="button" data-delete="${esc(item.id)}">削除</button>
    </div>
  </article>`;
}

function renderItems() {
  byId('item-count').textContent = `${state.items.length}点`;
  byId('admin-items').innerHTML = state.items.length
    ? state.items.map(itemRow).join('')
    : '<p class="muted">まだ登録がありません。</p>';
}

function renderHazards() {
  const items = state.items.filter((item) => item.hazard);
  byId('hazard-list').innerHTML = items.length
    ? items.map((item) => {
      const seller = state.sellers[item.sellerId];
      return `<li><img src="${esc(item.image)}" alt="" width="56" height="42" loading="lazy" decoding="async"><span>${esc(itemLabel(item))}</span><span class="muted">${esc(seller ? (seller.name || '匿名') : '不明')} ・ ${awardTickets(item)}枚</span></li>`;
    }).join('')
    : '<li class="muted">回収対象はありません。</li>';
}

function removeItem(id) {
  const item = state.items.find((i) => i.id === id);
  if (!item) return;
  if (!confirm(`「${itemLabel(item)}」を削除しますか？`)) return;
  const index = state.items.indexOf(item);
  state.items.splice(index, 1);
  if (!persist(state)) {
    state.items.splice(index, 0, item);
    toast('削除を保存できませんでした');
    return;
  }
  renderItems();
  renderHazards();
  renderTag();
  toast('削除しました');
}

byId('admin-items').addEventListener('click', (event) => {
  const del = event.target.closest('[data-delete]');
  if (del) {
    removeItem(del.dataset.delete);
    return;
  }
  const print = event.target.closest('[data-print]');
  if (print) {
    const item = state.items.find((i) => i.id === print.dataset.print);
    if (item) printBlock(labelHTML(item));
  }
});

/* 名札 */
function tagHTML(seller) {
  const items = Array.isArray(seller.mockItems)
    ? seller.mockItems
    : state.items.filter((item) => item.sellerId === seller.id);
  const photo = sellerPhoto(seller);
  const room = sellerRoom(seller);
  const contact = sellerContact(seller);
  const grid = items.slice(0, 8).map((item) => `<figure>
      <img src="${esc(item.image)}" alt="">
      <figcaption><span>${esc(item.title)}${isBattery(item) ? ` ${item.grams}g` : ''}${item.hazard ? '（回収）' : ''}</span><b>${awardTickets(item)}枚</b></figcaption>
    </figure>`).join('');
  return `<div class="tag">
    <p class="tag-kicker">めぐる団地 防災フリマ</p>
    <div class="tag-head">
      ${photo ? `<img class="tag-photo" src="${esc(photo)}" alt="">` : '<div class="tag-photo tag-photo-empty" aria-hidden="true"></div>'}
      <div class="tag-id">
        <p class="tag-name">${esc(sellerName(seller))}</p>
        ${room ? `<p class="tag-meta">${esc(room)}</p>` : ''}
        ${contact ? `<p class="tag-meta">${esc(contact)}</p>` : ''}
      </div>
    </div>
    <p class="tag-caption">この人が売ったもの</p>
    ${items.length ? `<div class="tag-grid">${grid}</div>${items.length > 8 ? `<p class="tag-more">ほか ${items.length - 8}点</p>` : ''}` : '<p class="muted">出品はありません。</p>'}
    <p class="tag-foot">受付で引換券を扱います。</p>
  </div>`;
}

let activeVirtualSeller = null;

function renderTag() {
  const select = byId('tag-seller');
  const seller = activeVirtualSeller || state.sellers[select.value];
  byId('tag-preview').innerHTML = seller ? tagHTML(seller) : '';
  byId('print-tag').disabled = !seller;
}

byId('tag-seller').addEventListener('change', () => {
  activeVirtualSeller = null;
  const status = byId('qr-scan-status');
  if (status) status.hidden = true;
  renderTag();
});

/* QRコード読み取り（仮想ユーザー表示モック・DB不要） */
const qrDialog = byId('qr-dialog');
const VIRTUAL_QR_USERS = [
  {
    id: 'virtual-1',
    label: 'やまさん（ニックネームのみ・住所非公開）',
    name: 'やまさん',
    room: '',
    contact: 'LINE: yama_danchi',
    photo: avatar('や'),
    consent: { name: true, room: false, contact: true, photo: true },
    mockItems: [
      { id: 'v1-1', title: 'キャンプ用ランタン', image: 'assets/item-2.webp', tickets: 5, hazard: false },
      { id: 'v1-2', title: 'モバイルバッテリー', image: PHOTO_BATTERY, tickets: 2, hazard: true },
    ],
  },
  {
    id: 'virtual-2',
    label: 'みき（ニックネーム＋階数のみ公開）',
    name: 'みき',
    room: '4階',
    contact: '',
    photo: avatar('み'),
    consent: { name: true, room: true, contact: false, photo: true },
    mockItems: [
      { id: 'v2-1', title: '絵本（3冊セット）', image: 'assets/item-6.webp', tickets: 3, hazard: false },
      { id: 'v2-2', title: '白いマグカップ', image: 'assets/item-1.webp', tickets: 2, hazard: false },
    ],
  },
  {
    id: 'virtual-3',
    label: '匿名希望の参加者（連絡先のみ公開）',
    name: '',
    room: '',
    contact: 'インターホン: 504呼び出し',
    photo: '',
    consent: { name: false, room: false, contact: true, photo: false },
    mockItems: [
      { id: 'v3-1', title: '平皿（22cm）', image: 'assets/item-4.webp', tickets: 3, hazard: false },
    ],
  },
];

let currentVirtualIndex = 0;
let scanTimer = null;
let detectTimer = null;
let cameraStream = null;
const scanCanvas = document.createElement('canvas');

/* 中身をデコードせず、QR特有の1:1:3:1:1ファインダーパターン（切り出しシンボル）を画像から検出 */
function checkRatio11311(counts) {
  const total = counts[0] + counts[1] + counts[2] + counts[3] + counts[4];
  if (total < 7) return false;
  const unit = total / 7;
  const maxVar = unit * 0.72;
  return (
    Math.abs(unit - counts[0]) < maxVar &&
    Math.abs(unit - counts[1]) < maxVar &&
    Math.abs(3 * unit - counts[2]) < 3 * maxVar &&
    Math.abs(unit - counts[3]) < maxVar &&
    Math.abs(unit - counts[4]) < maxVar
  );
}

function detectQRFinderInFrame(video) {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return false;
  const w = 160;
  const h = Math.max(90, Math.round((vh / vw) * w));
  scanCanvas.width = w;
  scanCanvas.height = h;
  const ctx = scanCanvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(video, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  const lum = new Uint8Array(w * h);
  let sum = 0;
  for (let i = 0, p = 0; i < lum.length; i++, p += 4) {
    const y = (data[p] * 77 + data[p + 1] * 150 + data[p + 2] * 29) >> 8;
    lum[i] = y;
    sum += y;
  }
  const thresh = (sum / lum.length) * 0.88;
  const isDark = (x, y) => lum[y * w + x] < thresh;

  const verifyVertical = (cx, cy, maxCount) => {
    const v = [0, 0, 0, 0, 0];
    let y = cy;
    while (y >= 0 && isDark(cx, y)) { v[2]++; y--; }
    if (y < 0) return false;
    while (y >= 0 && !isDark(cx, y) && v[1] <= maxCount) { v[1]++; y--; }
    if (y < 0 || v[1] > maxCount) return false;
    while (y >= 0 && isDark(cx, y) && v[0] <= maxCount) { v[0]++; y--; }
    if (v[0] > maxCount) return false;

    y = cy + 1;
    while (y < h && isDark(cx, y)) { v[2]++; y++; }
    if (y >= h) return false;
    while (y < h && !isDark(cx, y) && v[3] <= maxCount) { v[3]++; y++; }
    if (y >= h || v[3] > maxCount) return false;
    while (y < h && isDark(cx, y) && v[4] <= maxCount) { v[4]++; y++; }
    if (v[4] > maxCount) return false;
    return checkRatio11311(v);
  };

  const centers = [];
  for (let y = 4; y < h - 4; y += 2) {
    const counts = [0, 0, 0, 0, 0];
    let state = 0;
    for (let x = 0; x < w; x++) {
      if (isDark(x, y)) {
        if ((state & 1) === 1) state++;
        counts[state]++;
      } else if (state === 0 && counts[0] === 0) {
        continue;
      } else {
        if ((state & 1) === 0) {
          if (state === 4) {
            if (checkRatio11311(counts)) {
              const cx = Math.round(x - counts[4] - counts[3] - counts[2] / 2);
              const maxC = counts[2];
              if (cx >= 0 && cx < w && verifyVertical(cx, y, maxC)) {
                if (!centers.some((c) => Math.hypot(c.x - cx, c.y - y) < 12)) {
                  centers.push({ x: cx, y });
                  if (centers.length >= 2) return true;
                }
              }
            }
            counts[0] = counts[2];
            counts[1] = counts[3];
            counts[2] = counts[4];
            counts[3] = 1;
            counts[4] = 0;
            state = 3;
          } else {
            state++;
            counts[state]++;
          }
        } else {
          counts[state]++;
        }
      }
    }
  }
  return false;
}

async function startCameraStream() {
  const video = byId('qr-video');
  const frame = byId('qr-mock-frame');
  if (!video || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return false;
  if (cameraStream) return true;
  try {
    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
    } catch {
      cameraStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    }
    video.srcObject = cameraStream;
    video.hidden = false;
    if (frame) frame.classList.add('over-video');
    await video.play().catch(() => {});
    startQRDetectionLoop();
    return true;
  } catch {
    cameraStream = null;
    video.hidden = true;
    if (frame) frame.classList.remove('over-video');
    return false;
  }
}

function startQRDetectionLoop() {
  clearInterval(detectTimer);
  const video = byId('qr-video');
  const vf = byId('qr-viewfinder');
  const stateText = byId('qr-mock-state');
  let nativeDetector = null;
  if (typeof window.BarcodeDetector === 'function') {
    try {
      nativeDetector = new window.BarcodeDetector({ formats: ['qr_code'] });
    } catch {
      nativeDetector = null;
    }
  }
  if (vf) vf.classList.add('scanning');
  if (stateText) stateText.textContent = 'カメラにQRコードをかざしてください…';

  detectTimer = setInterval(async () => {
    if (!cameraStream || !video || video.readyState < 2) return;
    let found = false;
    if (nativeDetector) {
      try {
        const codes = await nativeDetector.detect(video);
        if (codes && codes.length > 0) found = true;
      } catch {
        /* フォールバックとして自前のファインダー検出を使う */
      }
    }
    if (!found) {
      found = detectQRFinderInFrame(video);
    }
    if (found) {
      clearInterval(detectTimer);
      detectTimer = null;
      const user = VIRTUAL_QR_USERS[currentVirtualIndex];
      if (vf) vf.classList.remove('scanning');
      if (stateText) stateText.textContent = `QRコードを認識しました！ ${user.label}`;
      setTimeout(() => {
        if (qrDialog && qrDialog.open) applyVirtualUser(user, false);
      }, 500);
    }
  }, 160);
}

function stopCameraStream() {
  clearTimeout(scanTimer);
  clearInterval(detectTimer);
  detectTimer = null;
  const video = byId('qr-video');
  const frame = byId('qr-mock-frame');
  if (cameraStream) {
    cameraStream.getTracks().forEach((track) => track.stop());
    cameraStream = null;
  }
  if (video) {
    video.srcObject = null;
    video.hidden = true;
  }
  if (frame) frame.classList.remove('over-video');
}

function selectVirtualUser(index, delayMs) {
  currentVirtualIndex = ((index % VIRTUAL_QR_USERS.length) + VIRTUAL_QR_USERS.length) % VIRTUAL_QR_USERS.length;
  const user = VIRTUAL_QR_USERS[currentVirtualIndex];
  const code = encodeProfileQR(user);
  const frame = byId('qr-mock-frame');
  const stateText = byId('qr-mock-state');
  const vf = byId('qr-viewfinder');
  if (frame) frame.innerHTML = qrSVG(code);
  if (vf) vf.classList.add('scanning');
  clearTimeout(scanTimer);
  if (cameraStream) {
    if (stateText) stateText.textContent = `カメラにQRコードをかざしてください（選択中：${user.name || '匿名'}）`;
    if (!detectTimer) startQRDetectionLoop();
  } else {
    if (stateText) stateText.textContent = 'QRコードをスキャン中…';
    scanTimer = setTimeout(() => {
      if (vf) vf.classList.remove('scanning');
      if (stateText) stateText.textContent = `読み取り完了：${user.label}`;
    }, delayMs || 900);
  }
  renderQRPresets();
}

function renderQRPresets() {
  const box = byId('qr-presets');
  if (!box) return;
  box.innerHTML = VIRTUAL_QR_USERS.map((user, idx) => {
    const code = encodeProfileQR(user);
    const p = profilePayload(user);
    const meta = [
      p.consent.name ? `表示名:${p.name}` : '表示名:非公開',
      p.consent.room ? `部屋・階:${p.room}` : '部屋・階:非公開',
      p.consent.contact ? `連絡先:${p.contact}` : '連絡先:非公開',
    ].join(' / ');
    const active = idx === currentVirtualIndex ? ' active' : '';
    return `<button type="button" class="qr-preset-btn${active}" data-vindex="${idx}">
      <span class="qr-preset-mini">${qrSVG(code)}</span>
      <span class="qr-preset-text">
        <b>${esc(user.label)}</b>
        <small>${esc(meta)}</small>
      </span>
    </button>`;
  }).join('');
}

function applyVirtualUser(user, scroll) {
  activeVirtualSeller = user;
  renderTag();
  const status = byId('qr-scan-status');
  if (status) {
    status.textContent = `QR読み取り（モック）：仮想ユーザー「${sellerName(user)}」の個人情報を表示中（DB保存なし）`;
    status.hidden = false;
  }
  if (qrDialog && qrDialog.open) qrDialog.close();
  toast(`QRコードから仮想ユーザー「${sellerName(user)}」を読み取りました`);
  if (scroll) {
    const section = byId('tag-section');
    if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

if (byId('open-qr-scan') && qrDialog) {
  byId('open-qr-scan').addEventListener('click', async () => {
    if (!qrDialog.open) qrDialog.showModal();
    selectVirtualUser(currentVirtualIndex, 1600);
    const hasCam = await startCameraStream();
    if (hasCam) selectVirtualUser(currentVirtualIndex, 1600);
  });

  qrDialog.addEventListener('close', stopCameraStream);

  byId('qr-next-btn').addEventListener('click', () => {
    selectVirtualUser(currentVirtualIndex + 1, 1000);
  });

  byId('qr-apply-btn').addEventListener('click', () => {
    applyVirtualUser(VIRTUAL_QR_USERS[currentVirtualIndex], false);
  });

  qrDialog.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-vindex]');
    if (btn) {
      const idx = Number(btn.dataset.vindex) || 0;
      selectVirtualUser(idx, 600);
      applyVirtualUser(VIRTUAL_QR_USERS[idx], false);
      return;
    }
    const rect = qrDialog.getBoundingClientRect();
    const outside = event.clientX < rect.left || event.clientX > rect.right
      || event.clientY < rect.top || event.clientY > rect.bottom;
    if (outside) qrDialog.close();
  });
}

/* ラベル */
function labelHTML(item) {
  const seller = state.sellers[item.sellerId] || {};
  const room = sellerRoom(seller);
  return `<div class="label">
    <img class="label-photo" src="${esc(item.image)}" alt="">
    <div class="label-body">
      <p class="label-kicker">めぐる団地 防災フリマ${item.hazard ? ' ・ モバイルバッテリー（回収）' : ''}</p>
      <h1>${esc(item.title)}</h1>
      <p class="label-ticket">引換券 <b>${awardTickets(item)}</b>枚${item.hazard ? '（1個につき）' : ''}</p>
      <p class="label-seller">売った人：${esc(sellerName(seller))}${room ? ` / ${esc(room)}` : ''}</p>
      <p class="label-note">受付で引換券と交換してください。</p>
    </div>
  </div>`;
}

/* 印刷 */
function printBlock(html) {
  byId('print-area').innerHTML = html;
  document.body.classList.add('printing');
  window.print();
}

window.addEventListener('afterprint', () => {
  document.body.classList.remove('printing');
  byId('print-area').innerHTML = '';
});

byId('print-tag').addEventListener('click', () => {
  const seller = activeVirtualSeller || state.sellers[byId('tag-seller').value];
  if (seller) printBlock(tagHTML(seller));
});

/* 初期化・同期 */
function sync() {
  state = loadState();
  fillSellerSelect(byId('seller-select'), true);
  fillBatterySeller();
  fillTagSeller(byId('tag-seller').value);
  renderItems();
  renderHazards();
  renderTag();
}

window.addEventListener('storage', (event) => {
  if (event.key === CFG.key) sync();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  const latest = loadState();
  if (JSON.stringify(latest) !== JSON.stringify(state)) {
    state = latest;
    sync();
  }
});

byId('reset').addEventListener('click', () => {
  if (!confirm('このブラウザーの登録・プロフィールを消して、初期データに戻しますか？')) return;
  try {
    localStorage.removeItem(CFG.key);
  } catch {
    /* 保存領域に触れない環境ではそのまま再読込 */
  }
  location.reload();
});

renderTiers();
fillSellerSelect(byId('seller-select'), false);
fillBatterySeller();
fillTagSeller(defaultTagSeller());
renderAward();
renderBatteryPreview();
renderAdminPhoto();
renderItems();
renderHazards();
renderTag();

const qrParam = new URLSearchParams(location.search).get('qr');
if (qrParam) {
  const decoded = decodeProfileQR(qrParam);
  if (decoded && (decoded.name || decoded.room || decoded.contact || decoded.photo)) {
    applyVirtualUser({
      id: 'virtual-custom',
      label: decoded.name || 'QRの参加者',
      name: decoded.name,
      room: decoded.room,
      contact: decoded.contact,
      photo: decoded.photo ? avatar(decoded.name || '氏') : '',
      consent: decoded.consent,
      mockItems: VIRTUAL_QR_USERS[0].mockItems,
    }, true);
  } else {
    applyVirtualUser(VIRTUAL_QR_USERS[0], true);
  }
}
