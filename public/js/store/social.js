// quest-store: friends (the client side of src/social.js). The account is the full-game purchase: unlock.js reads its token from
// Meta's Digital Goods service, /api/me turns it into a signed ticket, and the token itself is never stored or sent again.
// Without a purchase (the demo, or a development unlock) the account is a random id kept on the headset.
const get = k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, put = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { } };
export function makeSocial(unlock) {
  const So = { ticket: '', acct: '', friends: [], requests: [], err: '', onChange: null, seen: 0 };
  const devId = () => { let d = get('ych_devid'); if (!d) { d = 'dev:' + [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join(''); put('ych_devid', d); } return d; };
  So.signIn = async () => {
    // everyone has an account now (online play is free): the purchase where there is one, else an id kept on this headset. A headset
    // that started on the demo keeps its id after buying, so its friends stay
    await unlock.ready; const token = get('ych_devid') || unlock.token || devId();
    if (!token) { So.err = unlock.full() ? 'No purchase found on this account' : 'Friends come with the full game'; return false; }
    try { const r = await fetch('api/me', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token }) }), j = await r.json(); if (!j.ticket) { So.err = j.error || 'Friends are not available'; return false; } So.ticket = j.ticket; So.acct = j.acct || ''; So.err = ''; return true; }
    catch (e) { So.err = 'Offline'; return false; }
  };
  So.ready = So.signIn();
  So.api = async (path, body) => {
    await So.ready; if (!So.ticket) return { error: So.err || 'Not signed in' };
    try { const r = await fetch('api/social/' + path, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + So.ticket }, body: JSON.stringify(body || {}) }); return await r.json(); }
    catch (e) { return { error: 'Offline' }; }
  };
  // presence: who I am and which room I'm in; answers with my friends and friend requests
  So.hello = async (call, room) => { const j = await So.api('hello', { call, room }); if (j.friends) { const before = So.requests.length; So.friends = j.friends; So.requests = j.requests || []; So.seen = Date.now(); if (So.onChange) So.onChange(So.requests.length > before); } return j; };
  So.online = () => So.friends.filter(f => f.online).length;
  So.isFriend = id => So.friends.some(f => f.id === id);
  So.wsParam = () => So.ticket ? '&t=' + encodeURIComponent(So.ticket) : '';
  return So;
}
