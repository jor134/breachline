// The full-game unlock. In the app installed from the Meta Horizon Store the Digital Goods service exists: listPurchases() says
// whether this account owns the 'full_game' add-on (checked every launch, so a purchase on another headset carries over), and
// PaymentRequest opens Meta's own purchase dialog. Anywhere else (the bare website, a copied APK) there is no service, so only
// the demo plays, unless this device was unlocked for development with ?dev=<creator code> (checked by the Worker).
import { STORE } from './config.js';

const get = k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, put = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { } };
const skuOf = p => p && (p.itemId || p.sku || p.itemID);

export function makeUnlock() {
  const U = { gate: STORE.gate === 'iap', owned: false, token: '', uid: '', devTok: get('bl_devtok') || '', dev: get('bl_dev') === '1', store: false, svc: null, price: '', err: '' };
  U.ready = (async () => {
    const code = new URLSearchParams(location.search).get('dev');
    if (code === 'off') { try { localStorage.removeItem('bl_dev'); localStorage.removeItem('bl_devtok'); localStorage.removeItem('bl_full'); } catch (e) { } U.dev = false; U.devTok = ''; history.replaceState(null, '', location.pathname); }   // ?dev=off: back to what a buyer sees
    else if (code) {
      try { const r = await fetch('api/unlock', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }) }); if (r.ok) { const j = await r.json().catch(() => ({})); put('bl_dev', '1'); U.dev = true; if (j.dev) { put('bl_devtok', j.dev); U.devTok = j.dev; } } } catch (e) { }
      history.replaceState(null, '', location.pathname);   // the code never stays in the address bar
    }
    if (typeof window.getDigitalGoodsService !== 'function') return;
    try {
      U.svc = await window.getDigitalGoodsService(STORE.billing); U.store = true;
      // the Meta user (app-scoped id): the server asks Meta whether this user owns the full game (needs the User ID grant in the Data Use Checkup; 0 = none)
      try { if (U.svc.getLoggedInUserId) { const id = String(await U.svc.getLoggedInUserId()); if (id && id !== '0') U.uid = id; } } catch (e) { }
      const mine = (await U.svc.listPurchases()).find(p => skuOf(p) === STORE.sku); U.owned = !!mine; put('bl_full', U.owned ? '1' : '0');
      if (mine && mine.purchaseToken) U.token = mine.purchaseToken;   // quest-store: the account for friends (js/store/social.js)
      const it = (await U.svc.getDetails([STORE.sku])).find(d => skuOf(d) === STORE.sku);
      if (it && it.price) U.price = new Intl.NumberFormat(undefined, { style: 'currency', currency: it.price.currency }).format(+it.price.value);
    } catch (e) { U.err = String(e && e.message || e); if (get('bl_full') === '1') U.owned = true; }   // offline: trust the last check
  })();
  U.full = () => !U.gate || U.owned || U.dev;
  U.mapOk = id => U.full() || STORE.demoMaps.includes(id);
  // Meta's purchase dialog. Resolves true once the add-on is owned.
  U.buy = async () => {
    if (!U.svc || typeof PaymentRequest !== 'function') return false;
    const req = new PaymentRequest([{ supportedMethods: STORE.billing, data: { sku: STORE.sku } }], { total: { label: 'Total', amount: { currency: 'USD', value: '0' } } });   // amounts are not used by Meta
    const res = await req.show(); await res.complete('success');   // complete() straight away, or the browser holds input until it times out
    try { const mine = (await U.svc.listPurchases()).find(p => skuOf(p) === STORE.sku); U.owned = !!mine; if (mine && mine.purchaseToken) U.token = mine.purchaseToken; } catch (e) { U.owned = !!(res.details && res.details.purchaseToken); if (U.owned) U.token = res.details.purchaseToken; }
    put('bl_full', U.owned ? '1' : '0'); return U.owned;
  };
  return U;
}
