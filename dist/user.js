'use strict';

let state = loadState();
let pendingPhoto = state.sellers[state.me].photo || '';
const byId = (id) => document.getElementById(id);

/* タブ */
const tabs = [...document.querySelectorAll('.tabs [role="tab"]')];

function showTab(name, focus) {
  tabs.forEach((tab) => {
    const on = tab.dataset.tab === name;
    tab.setAttribute('aria-selected', String(on));
    tab.tabIndex = on ? 0 : -1;
    if (on && focus) tab.focus();
  });
  byId('panel-market').hidden = name !== 'market';
  byId('panel-profile').hidden = name !== 'profile';
}

tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => showTab(tab.dataset.tab));
  tab.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const step = event.key === 'ArrowRight' ? 1 : tabs.length - 1;
    const next = tabs[(index + step) % tabs.length];
    showTab(next.dataset.tab, true);
  });
});

/* 商品一覧 */
function faceHTML(seller) {
  const photo = sellerPhoto(seller);
  return photo
    ? `<img class="face" src="${esc(photo)}" alt="" width="20" height="20" loading="lazy" decoding="async">`
    : '';
}

function sellerLine(seller) {
  const room = sellerRoom(seller);
  return `<span class="seller">${faceHTML(seller)}<span class="seller-text">${esc(sellerName(seller))}${room ? `<span class="room">・${esc(room)}</span>` : ''}</span></span>`;
}

function itemCard(item) {
  const seller = state.sellers[item.sellerId] || {};
  const tickets = awardTickets(item);
  return `<button class="item-card" type="button" data-id="${esc(item.id)}">
    <span class="item-photo">${item.image ? `<img src="${esc(item.image)}" alt="" width="800" height="600" loading="lazy" decoding="async">` : ''}</span>
    <span class="item-body">
      <span class="item-title">${esc(item.title)}</span>
      ${sellerLine(seller)}
    </span>
    <span class="ticket" aria-label="引換券${tickets}枚"><b>${tickets}</b>枚</span>
  </button>`;
}

function renderMarket() {
  const items = state.items.filter((item) => !item.hazard);
  byId('items').innerHTML = items.map(itemCard).join('');
  byId('items-empty').hidden = items.length > 0;
}

function refreshSellerInMarket() {
  document.querySelectorAll('#items [data-id]').forEach((card) => {
    const item = state.items.find((i) => i.id === card.dataset.id);
    if (!item || item.sellerId !== state.me) return;
    const line = card.querySelector('.seller');
    const seller = state.sellers[item.sellerId];
    if (line && seller) line.outerHTML = sellerLine(seller);
  });
}

/* 詳細 */
const dialog = byId('item-dialog');

function openItem(id) {
  const item = state.items.find((i) => i.id === id);
  if (!item) return;
  const seller = state.sellers[item.sellerId] || {};
  const room = sellerRoom(seller);
  const contact = sellerContact(seller);
  byId('dialog-body').innerHTML = `
    ${item.image ? `<img class="dialog-photo" src="${esc(item.image)}" alt="" width="800" height="600">` : ''}
    <div class="dialog-info">
      <p class="kicker">引換券 ${awardTickets(item)}枚</p>
      <h2>${esc(item.title)}</h2>
      ${sellerLine(seller)}
      ${contact ? `<p class="contact">${esc(contact)}</p>` : ''}
      <p class="muted">会場の受付で引換券と交換してください。</p>
    </div>`;
  if (!dialog.open) dialog.showModal();
}

byId('items').addEventListener('click', (event) => {
  const card = event.target.closest('[data-id]');
  if (card) openItem(card.dataset.id);
});

dialog.addEventListener('click', (event) => {
  const rect = dialog.getBoundingClientRect();
  const outside = event.clientX < rect.left || event.clientX > rect.right
    || event.clientY < rect.top || event.clientY > rect.bottom;
  if (outside) dialog.close();
});

/* 個人情報 */
function renderPhotoPreview() {
  const box = byId('me-photo');
  box.innerHTML = pendingPhoto ? `<img src="${esc(pendingPhoto)}" alt="あなたの写真">` : '写真なし';
  box.classList.toggle('empty', !pendingPhoto);
}

function draftSeller() {
  return {
    id: state.me,
    name: clean(byId('me-name').value, CFG.limits.name),
    room: clean(byId('me-room').value, CFG.limits.room),
    contact: clean(byId('me-contact').value, CFG.limits.contact),
    photo: pendingPhoto,
    consent: {
      name: byId('c-name').checked,
      room: byId('c-room').checked,
      contact: byId('c-contact').checked,
      photo: byId('c-photo').checked,
    },
  };
}

function renderProfileQR() {
  const qrBox = byId('profile-qr');
  if (!qrBox) return;
  const draft = draftSeller();
  const payload = profilePayload(draft);
  const code = encodeProfileQR(draft);
  qrBox.innerHTML = qrSVG(code);
  qrBox.dataset.code = code;
  const rows = [
    ['表示名', payload.consent.name ? payload.name : '非公開（匿名の出品者）'],
    ['部屋・階', payload.consent.room ? payload.room : '非公開'],
    ['連絡先', payload.consent.contact ? payload.contact : '非公開'],
    ['顔写真', payload.consent.photo ? '公開する' : '非公開'],
  ];
  byId('qr-summary').innerHTML = rows
    .map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`)
    .join('');
  const link = byId('qr-open-admin');
  if (link) link.href = `admin.html?qr=${encodeURIComponent(code)}#tag-section`;
}

function fillForm() {
  const seller = state.sellers[state.me];
  byId('me-name').value = seller.name;
  byId('me-room').value = seller.room;
  byId('me-contact').value = seller.contact;
  byId('c-name').checked = seller.consent.name;
  byId('c-room').checked = seller.consent.room;
  byId('c-contact').checked = seller.consent.contact;
  byId('c-photo').checked = seller.consent.photo;
  pendingPhoto = seller.photo || '';
  renderPhotoPreview();
  renderProfileQR();
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
    renderPhotoPreview();
    renderProfileQR();
    byId('save-state').textContent = '写真を選びました。保存してください。';
  } catch (error) {
    toast(error.message);
  }
}

byId('camera-input').addEventListener('change', (event) => handlePhoto(event.target));
byId('file-input').addEventListener('change', (event) => handlePhoto(event.target));

byId('photo-clear').addEventListener('click', () => {
  pendingPhoto = '';
  renderPhotoPreview();
  renderProfileQR();
  byId('save-state').textContent = '写真を削除しました。保存してください。';
});

byId('profile-form').addEventListener('input', renderProfileQR);
byId('profile-form').addEventListener('change', renderProfileQR);

byId('qr-copy').addEventListener('click', async () => {
  const code = byId('profile-qr').dataset.code || encodeProfileQR(draftSeller());
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(code);
      toast('QRコードのデータ文字列をコピーしました');
      return;
    }
  } catch {
    /* クリップボード非対応時はフォールバック */
  }
  toast(`QRデータ: ${code.slice(0, 28)}…`);
});

byId('profile-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const seller = state.sellers[state.me];
  const name = clean(byId('me-name').value, CFG.limits.name);
  const room = clean(byId('me-room').value, CFG.limits.room);
  const contact = clean(byId('me-contact').value, CFG.limits.contact);
  const consent = {
    name: byId('c-name').checked,
    room: byId('c-room').checked,
    contact: byId('c-contact').checked,
    photo: byId('c-photo').checked,
  };
  const warnings = [];
  if (consent.name && !name) {
    consent.name = false;
    byId('c-name').checked = false;
    warnings.push('表示名が空のため、名前の表示をオフにしました');
  }
  if (consent.room && !room) {
    consent.room = false;
    byId('c-room').checked = false;
    warnings.push('部屋・階が空のため、表示をオフにしました');
  }
  if (consent.contact && !contact) {
    consent.contact = false;
    byId('c-contact').checked = false;
    warnings.push('連絡先が空のため、表示をオフにしました');
  }
  if (consent.photo && !pendingPhoto) {
    consent.photo = false;
    byId('c-photo').checked = false;
    warnings.push('写真がないため、顔写真の表示をオフにしました');
  }

  const snapshot = JSON.stringify(seller);
  seller.name = name;
  seller.room = room;
  seller.contact = contact;
  seller.photo = pendingPhoto;
  seller.consent = consent;

  if (!persist(state)) {
    Object.assign(seller, JSON.parse(snapshot));
    toast('保存できませんでした。写真の容量を減らしてください。');
    return;
  }
  byId('save-state').textContent = '保存しました';
  renderProfileQR();
  renderSummary();
  refreshSellerInMarket();
  toast(warnings.length ? warnings[0] : '保存しました');
});

/* 引換券と出品 */
function renderSummary() {
  const mine = state.items.filter((item) => item.sellerId === state.me);
  const total = ticketTotal(state, state.me);
  byId('header-tickets').innerHTML = `引換券 <b>${total}</b>枚`;
  byId('my-tickets').textContent = String(total);
  byId('my-count').textContent = `出品・回収 ${mine.length}件`;
  byId('my-items').innerHTML = mine.length
    ? mine.map((item) => {
      const label = isBattery(item)
        ? `乾電池 ${item.grams}g <em class="hazard-tag">回収</em>`
        : `${esc(item.title)}${item.hazard ? ' <em class="hazard-tag">危険物</em>' : ''}`;
      return `<li><span>${label}</span><b>${awardTickets(item)}枚</b></li>`;
    }).join('')
    : '<li class="muted">まだ出品はありません。</li>';
}

/* 別タブ（運営画面）の変更を反映 */
function sync() {
  state = loadState();
  renderMarket();
  renderSummary();
}

window.addEventListener('storage', (event) => {
  if (event.key === CFG.key) sync();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  const latest = loadState();
  if (JSON.stringify(latest) !== JSON.stringify(state)) {
    state = latest;
    renderMarket();
    renderSummary();
  }
});

/* 初期表示 */
fillForm();
renderMarket();
renderSummary();
if (location.hash === '#profile') showTab('profile');
