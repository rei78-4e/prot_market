'use strict';

const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const store = new Map();
const ctx = {
  console,
  localStorage: {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => { store.set(key, String(value)); },
    removeItem: (key) => { store.delete(key); },
  },
  crypto: { randomUUID: () => 'fixed-id' },
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(__dirname + '/dist/app.js', 'utf8'), ctx);
const run = (code) => vm.runInContext(code, ctx);

/* 引換券 */
assert.deepEqual(run('CFG.tiers'), [1, 2, 3, 5, 10]);
assert.equal(run('CFG.hazardTickets'), 2);
assert.equal(run('awardTickets({tickets:3,hazard:false})'), 3);
assert.equal(run('awardTickets({tickets:3,hazard:true})'), 2);
assert.equal(run('awardTickets({tickets:1,hazard:true})'), 2);
assert.equal(run('awardTickets({tickets:10,hazard:true})'), 2);
assert.equal(run('awardTickets({tickets:0,hazard:true})'), 2);

/* 乾電池は50gで1枚（端数切り捨て） */
assert.equal(run('CFG.batteryGramsPerTicket'), 50);
assert.equal(run('batteryTickets(0)'), 0);
assert.equal(run('batteryTickets(49)'), 0);
assert.equal(run('batteryTickets(50)'), 1);
assert.equal(run('batteryTickets(99)'), 1);
assert.equal(run('batteryTickets(100)'), 2);
assert.equal(run('awardTickets({kind:"battery",grams:180,tickets:0,hazard:true})'), 3);
assert.equal(run('awardTickets({kind:"battery",grams:1000,tickets:10,hazard:true})'), 20, '乾電池は重量だけから計算する');

/* 初期データ */
const seed = run('seed()');
assert.equal(seed.items.filter((item) => !item.hazard).length, 6);
assert.equal(seed.items.filter((item) => item.hazard).length, 2);
assert(seed.items.every((item) => seed.sellers[item.sellerId]), '全商品に売る人がいる');
assert(seed.items.every((item) => item.image), '全商品に写真がある');
assert.equal(run('ticketTotal(seed(),"s1")'), 4, '一般物2枚＋モバイルバッテリー2枚');
assert.equal(run('ticketTotal(seed(),"s2")'), 9, '商品6枚＋乾電池180gで3枚');

/* オプトイン */
ctx.seller = {
  name: 'はるか', room: '203号室', contact: 'LINE: haruka', photo: 'assets/item-1.webp',
  consent: { name: false, room: false, contact: false, photo: false },
};
assert.equal(run('sellerName(seller)'), '匿名の出品者');
assert.equal(run('sellerRoom(seller)'), '');
assert.equal(run('sellerContact(seller)'), '');
assert.equal(run('sellerPhoto(seller)'), '');
run('seller.consent={name:true,room:true,contact:true,photo:true}');
assert.equal(run('sellerName(seller)'), 'はるか');
assert.equal(run('sellerRoom(seller)'), '203号室');
assert.equal(run('sellerContact(seller)'), 'LINE: haruka');
assert.equal(run('sellerPhoto(seller)'), 'assets/item-1.webp');
run('seller.name=""; seller.consent.name=true');
assert.equal(run('sellerName(seller)'), '匿名の出品者');

/* 保存データの正規化 */
ctx.dirty = {
  v: 3,
  me: 'me',
  sellers: { me: { id: 'me', name: '  あなた\u0000 ', consent: {} } },
  items: [
    { id: 'a', title: '白い\u0000マグ', sellerId: 'me', image: 'assets/item-1.webp', tickets: 7, hazard: 1 },
    { id: 'b', title: '存在しない人', sellerId: 'ghost', image: 'assets/item-2.webp', tickets: 5 },
    { id: 'a', title: '重複ID', sellerId: 'me', image: 'assets/item-2.webp', tickets: 1 },
  ],
};
const normalized = run('normalize(dirty)');
assert.equal(normalized.items.length, 1);
assert.equal(normalized.items[0].title, '白い マグ');
assert.equal(normalized.items[0].tickets, 1, '不正な枚数は最小段階に丸める');
assert.equal(normalized.items[0].hazard, true);
assert.equal(normalized.sellers.me.name, 'あなた');
assert.equal(normalized.me, 'me');

/* 乾電池レコードの正規化 */
ctx.battery = {
  v: 3,
  me: 'me',
  sellers: { me: { id: 'me', consent: {} } },
  items: [
    { id: 'bat', kind: 'battery', sellerId: 'me', grams: 180 },
    { id: 'bat2', kind: 'battery', sellerId: 'me', grams: 49 },
    { id: 'bat3', kind: 'battery', sellerId: 'me', grams: -20 },
  ],
};
const nb = run('normalize(battery)');
assert.equal(nb.items[0].kind, 'battery');
assert.equal(nb.items[0].title, '乾電池');
assert.equal(nb.items[0].grams, 180);
assert.equal(nb.items[0].hazard, true);
assert.equal(nb.items[0].tickets, 0);
assert(nb.items[0].image.startsWith('data:image/svg+xml'), '写真なしの乾電池にはデモ画像を補う');
ctx.nb = nb;
assert.equal(run('awardTickets(nb.items[0])'), 3);
assert.equal(nb.items[1].grams, 49);
assert.equal(nb.items[2].grams, 0);

/* 旧デモデータの除去 */
ctx.legacy = {
  v: 3,
  me: 'me',
  sellers: { me: { id: 'me', consent: {} } },
  items: [{ id: 'i8', title: '旧データ', sellerId: 'me', image: '', tickets: 3 }],
};
assert.equal(run('normalize(legacy).items.length'), 0, '旧デモデータ i8 を除去');

/* 保存と再読込 */
run('persist(seed())');
const loaded = run('loadState()');
assert.equal(loaded.v, 3);
assert.equal(loaded.items.length, 8);
assert(loaded.sellers[loaded.me], '自分のレコードがある');

console.log('PASS: ticket tiers, hazard fixed 2 tickets, battery 50g/ticket, opt-in visibility, normalization, persistence');
