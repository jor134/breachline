// quest-store: test mode. Maps (and later features) marked `test: true` are hidden from everyone but testers. You become a
// tester on a headset by typing the TEST_CODE (a Worker secret, digits) in CREDITS > DEBUG ON > TESTER; the Worker answers with a
// signed token kept on the headset (90 days). Rooms check the token too, so nobody else can pick a test map online.
// Note: the map code itself still ships with the site, so test mode hides unfinished maps; it cannot keep them secret.
import { MAPS } from '../core/level.js';
const get = k => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }, put = (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch (e) { } };
export const TEST = { token: get('ych_tester'), off: get('ych_testoff') === '1', ok: false };
TEST.on = () => TEST.ok && !TEST.off;
TEST.isTest = id => !!(MAPS[id] && MAPS[id].test);
TEST.shown = id => !TEST.isTest(id) || TEST.on();
TEST.wsParam = () => TEST.token && TEST.ok ? '&tt=' + encodeURIComponent(TEST.token) : '';
TEST.setOff = off => { TEST.off = !!off; put('ych_testoff', off ? '1' : ''); };
const post = (path, body) => fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json()).catch(() => ({ error: 'Offline' }));
// is the saved token still good?
TEST.ready = TEST.token ? post('api/tester/check', { token: TEST.token }).then(j => { TEST.ok = !!j.ok; if (j.ok === false) { TEST.token = ''; put('ych_tester', ''); } return TEST.ok; }) : Promise.resolve(false);
TEST.enter = code => post('api/tester', { code }).then(j => { if (j.token) { TEST.token = j.token; TEST.ok = true; TEST.setOff(false); put('ych_tester', j.token); } return j; });
TEST.leave = () => { TEST.token = ''; TEST.ok = false; put('ych_tester', ''); };
