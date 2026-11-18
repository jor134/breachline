// Store-build additions to the VR menu: PLAYERS (mute anyone's voice; the room owner can also remove a player) and
// CREDITS (the attributions the licences ask for). Kept out of game.js so merges from main stay small: game.js only
// adds the two menu buttons, passes unknown panel actions to act(), and forwards the 'owner' / 'booted' room messages.
import { CREDITS } from './credits.js';
import { WORDS, isCallsign, randomCallsign } from './callsigns.js';
import { makeUnlock } from './unlock.js';

const PER_PAGE = 4, clip = (s, n = 60) => s.length > n ? s.slice(0, n - 1) + '…' : s;

export function makeStoreUI({ panel, S, voice, net, sfx, back, status, placeBoard, play }) {
  const U = { owner: 0, page: 0, code: '', prev: null };
  const store = !!(window.__boot && window.__boot.store), unlock = makeUnlock(); U.unlock = unlock;
  let call = (() => { try { const c = localStorage.getItem('bl_name'); return isCallsign(c) ? c : randomCallsign(); } catch (e) { return randomCallsign(); } })();
  const saveCall = () => { try { localStorage.setItem('bl_name', call); } catch (e) { } };
  saveCall();
  const humans = () => [...S.officers.entries()].filter(([id, o]) => !o.bot && id !== S.me.id);

  U.menuButtons = () => [...(S.net === 'online' ? [['PLAYERS', 'st:players']] : []), ['CREDITS', 'st:credits:0']];

  function showPlayers() {
    const list = humans(), mine = U.owner === S.me.id, lines = [], btns = [];
    if (!list.length) lines.push('Nobody else is in this room yet.');
    for (const [id, o] of list) {
      const muted = voice.isPeerMuted(id);
      lines.push(clip(o.name + (muted ? '  (muted)' : '') + (id === U.owner ? '  (room owner)' : '')));
      btns.push([(muted ? 'UNMUTE ' : 'MUTE ') + o.name, 'st:mute:' + id]);
      if (mine) btns.push(['REMOVE ' + o.name, 'st:boot:' + id]);
    }
    lines.push('', 'Muting only changes what you hear.', mine ? 'You own this room: REMOVE sends a player out.' : 'The room owner can remove players.', 'To report a player, press the Meta button > Report.');
    btns.push(['CLOSE', 'close']);
    panel.draw('PLAYERS', 'Room ' + S.room, lines, btns);
  }

  function showCredits(p) {
    const pages = Math.ceil(CREDITS.length / PER_PAGE); U.page = (p + pages) % pages;
    const lines = [];
    for (const c of CREDITS.slice(U.page * PER_PAGE, U.page * PER_PAGE + PER_PAGE)) {
      lines.push(clip(c.use + ': "' + c.title + '"'));
      lines.push(clip('   by ' + c.by + ', ' + c.lic + (c.chg ? ', ' + c.chg : '')));
    }
    lines.push('', 'Full list with links: breachline credits page.');
    U.prev = S.panel === 'start' || (S.panel === 'credits' && U.prev) ? 'start' : null; if (U.prev) { S.panel = 'credits'; placeBoard(); }
    panel.draw('CREDITS', 'Page ' + (U.page + 1) + ' of ' + pages, lines, [['NEXT PAGE', 'st:credits:' + (U.page + 1)], U.prev ? ['BACK', 'st:back'] : ['CLOSE', 'close']]);
  }

  // ---- the in-VR start menu (store build): callsign, voice, solo / online / tutorial ----
  U.showStart = () => {
    S.panel = 'start'; placeBoard(); panel.mesh.visible = true;
    panel.draw("YOU CAN'T HIDE", 'Callsign ' + call, [
      'Clear buildings, save hostages, disarm bombs.',
      'PLAY SOLO: you lead three AI officers.',
      'PLAY ONLINE: up to four players on a room code,',
      '   AI officers fill the empty places.',
      'Voice chat with your squad: ' + (voice.on ? 'ON' : 'OFF') + (voice.on && voice.err ? '  (' + voice.err.split(':')[0] + ')' : ''),
      'Point at a button and pull the trigger.',
    ], [['CALLSIGN: ' + call.split('-')[0], 'st:word'], ['NUMBER: ' + call.split('-')[1], 'st:num'], ['VOICE CHAT: ' + (voice.on ? 'ON' : 'OFF'), 'st:voice'], ['TUTORIAL', 'st:tut'], ['PLAY ONLINE', 'st:online'], ['CREDITS', 'st:credits:0'], ['PLAY SOLO', 'st:solo']]);
  };
  // ---- the full game: what the demo leaves out, and Meta's purchase dialog ----
  function showBuy(why, from) {
    U.buyWhy = why; U.buyFrom = from; S.panel = 'buy'; placeBoard(); panel.mesh.visible = true;
    if (U.bought) return panel.draw('FULL GAME UNLOCKED', 'Thank you!', ['Every mission, online co-op and PvP, and the map editor', 'are yours on this account, on every headset.'], [['CONTINUE', 'st:nobuy']]);
    const what = { online: 'Online play is part of the full game.', editor: 'The map editor is part of the full game.', map: 'This mission is part of the full game.' }[why] || '';
    const lines = [what, '', 'The demo: the training facility and the mansion, solo.', 'The full game adds:', '   the container terminal, Grand Prix, airport and casino tower,', '   online co-op and PvP for up to four players,', '   and the map editor.'];
    if (U.buyErr) lines.push('', 'The purchase did not go through: ' + clip(U.buyErr, 44));
    if (!unlock.store) { lines.push('', 'Get You Can\'t Hide on the Meta Horizon Store to unlock it.'); return panel.draw('FULL GAME', 'Meta Horizon Store', lines, [['OK', 'st:nobuy']]); }
    panel.draw('FULL GAME', unlock.price ? 'One purchase, ' + unlock.price : 'One purchase', lines, [['BUY THE FULL GAME' + (unlock.price ? '  ' + unlock.price : ''), 'st:buy'], ['NOT NOW', 'st:nobuy']]);
  }
  const back2 = () => { try { back.lobby(); } catch (e) { } };
  // called by game.js before it starts a mission or opens the editor: true = blocked (the purchase panel is showing instead)
  U.gate = what => { if (what === 'editor' ? unlock.full() : unlock.mapOk(what)) return false; showBuy(what === 'editor' ? 'editor' : 'map', 'board'); return true; };
  U.lockTag = id => unlock.mapOk(id) ? '' : '   [FULL GAME]';
  // the game redraws its own panels twice a second; while the start menu is up it redraws this instead
  U.redraw = () => { if (S.panel === 'buy') showBuy(U.buyWhy, U.buyFrom); else if (S.panel === 'keypad') showKeypad(); else if (S.panel === 'start') U.showStart(); else if (S.panel === 'credits') showCredits(U.page); };
  U.holdsPanel = () => S.panel === 'start' || S.panel === 'keypad' || S.panel === 'buy' || (S.panel === 'credits' && U.prev);

  // a 4-digit room code typed on a keypad (no system keyboard inside VR)
  function showKeypad(msg) {
    if (msg !== undefined) U.msg = msg; msg = U.msg;
    S.panel = 'keypad'; placeBoard(); panel.mesh.visible = true;
    if (panel.key === 'keypad' + U.code + (msg || '')) return;
    const g = panel.c.getContext('2d'); g.fillStyle = '#0c1118'; g.fillRect(0, 0, 1024, 768); g.strokeStyle = '#3a6ea5'; g.lineWidth = 6; g.strokeRect(6, 6, 1012, 756);
    g.textAlign = 'center'; g.fillStyle = '#e8eef5'; g.font = 'bold 56px sans-serif'; g.fillText('PLAY ONLINE', 512, 80);
    g.fillStyle = '#8fb4dc'; g.font = '28px sans-serif'; g.fillText(msg || 'Type your squad\'s room code, or NEW for a fresh one to share.', 512, 126);
    g.fillStyle = '#7dffa0'; g.font = 'bold 72px monospace'; g.fillText((U.code + '____').slice(0, 4).split('').join(' '), 512, 222);
    const B = [], key = (text, act, x, y, w, col) => B.push({ x, y, w, h: 74, text, act, col });
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'DEL', '0', 'NEW'];
    keys.forEach((k, i) => key(k, k === 'DEL' ? 'st:del' : k === 'NEW' ? 'st:new' : 'st:key:' + k, 222 + (i % 3) * 200, 262 + Math.floor(i / 3) * 86, 180, k.length > 1 ? '#39424e' : '#1f4a8a'));
    key('BACK', 'st:back', 60, 676, 300, '#39424e'); key(U.code.length === 4 ? 'JOIN ROOM ' + U.code : 'JOIN', 'st:join', 380, 676, 584, U.code.length === 4 ? '#1f7a3d' : '#2a3038');
    for (const b of B) { g.fillStyle = b.col; g.fillRect(b.x, b.y, b.w, b.h); g.fillStyle = '#fff'; g.font = 'bold 38px sans-serif'; g.fillText(b.text, b.x + b.w / 2, b.y + 51); }
    panel.btns = B; panel.key = 'keypad' + U.code + (msg || ''); panel.tex.needsUpdate = true;
  }
  function go(solo, tut) {
    S.panel = null; panel.mesh.visible = false;
    play(solo, call, solo ? 'SOLO' : U.code, tut);   // connect first: the microphone prompt below can take the headset out of VR
    if (!solo && voice.on) voice.permission().then(st => {
      if (st !== 'granted') status('The headset leaves VR to ask for the microphone. Press ENTER VR to go back to room ' + U.code + '.');
      return voice.startMic();
    }).then(() => voice.unlock()).catch(() => { });   // refused: you can still hear the squad
  }

  // returns true when it handled the action
  U.act = act => {
    if (!act || !act.startsWith('st:')) return false;
    const [, what, arg] = act.split(':'); sfx.click();
    if (what === 'word') { const [w, n] = call.split('-'); call = WORDS[(WORDS.indexOf(w) + 1) % WORDS.length] + '-' + n; saveCall(); U.showStart(); }
    else if (what === 'num') { call = call.split('-')[0] + '-' + String(Math.floor(Math.random() * 90) + 10); saveCall(); U.showStart(); }
    else if (what === 'voice') { voice.setOn(!voice.on); U.showStart(); }
    else if (what === 'solo') go(true, false);
    else if (what === 'tut') go(true, true);
    else if (what === 'online' && !unlock.full()) showBuy('online', 'start');
    else if (what === 'online') { U.msg = ''; try { U.code = (localStorage.getItem('bl_room') || '').replace(/\D/g, '').slice(0, 4); } catch (e) { U.code = ''; } showKeypad(); }
    else if (what === 'key') { if (U.code.length < 4) U.code += arg; showKeypad(''); }
    else if (what === 'del') { U.code = U.code.slice(0, -1); showKeypad(''); }
    else if (what === 'new') { U.code = String(Math.floor(Math.random() * 9000) + 1000); showKeypad('New room: tell your squad the code ' + U.code + '.'); }
    else if (what === 'back') { U.prev = null; U.showStart(); }
    else if (what === 'join') { if (U.code.length === 4) go(false, false); else showKeypad('The room code has four digits.'); }
    else if (what === 'buy') { unlock.buy().then(ok => { if (ok) { U.bought = true; showBuy(U.buyWhy, U.buyFrom); } }).catch(e => { U.buyErr = String(e && e.message || e); showBuy(U.buyWhy, U.buyFrom); }); }
    else if (what === 'nobuy') { U.bought = false; U.buyErr = ''; if (U.buyFrom === 'start') U.showStart(); else { S.panel = null; back2(); } }
    else if (what === 'players') showPlayers();
    else if (what === 'credits') showCredits(+arg || 0);
    else if (what === 'mute') { const id = +arg; voice.mutePeer(id, !voice.isPeerMuted(id)); showPlayers(); }
    else if (what === 'boot') { if (U.owner === S.me.id) net.send({ t: 'boot', p: +arg }); setTimeout(showPlayers, 400); }
    return true;
  };

  // room messages only the store Worker sends
  U.onMsg = m => {
    if (m.t === 'owner') { U.owner = m.id; return true; }
    if (m.t === 'booted') { status('The room owner removed you from that room.'); return true; }
    return false;
  };
  U.started = () => S.net === 'online' || S.net === 'solo' || S.net === 'lost';
  U.room = () => S.net === 'online' || S.net === 'lost' ? S.room : '';
  U.left = () => { S.mode = null; };
  U.store = store;
  U.back = back;
  return U;
}
