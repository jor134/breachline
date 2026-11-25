// Store-build additions to the VR menu: PLAYERS (mute anyone's voice; the room owner can also remove a player) and
// CREDITS (the attributions the licences ask for). Kept out of game.js so merges from main stay small: game.js only
// adds the two menu buttons, passes unknown panel actions to act(), and forwards the 'owner' / 'booted' room messages.
import { CREDITS } from './credits.js';
import { DBG, toggleDebug } from './debug.js';
import { WORDS, isCallsign, randomCallsign } from './callsigns.js';
import { makeUnlock } from './unlock.js';
import { makeSocial } from './social.js';
import { CODE_CHARS, isRoomCode, randomRoomCode } from './roomcode.js';
import { TEST } from './tester.js';

const PER_PAGE = 4, clip = (s, n = 60) => s.length > n ? s.slice(0, n - 1) + '…' : s;

export function makeStoreUI({ panel, S, voice, net, sfx, back, status, placeBoard, play, notify = status }) {
  try { S.music = localStorage.getItem('bl_music') !== '0'; } catch (e) { }
  const U = { owner: 0, page: 0, code: '', prev: null };
  const store = !!(window.__boot && window.__boot.store), unlock = makeUnlock(); U.unlock = unlock;
  // quest-store: friends and strangers. rel: what each player in the room is to me (friend / sent / got / blocked), from the room.
  // mmIds: players who came in through QUICK MATCH. Strangers start muted (both ways) unless they are friends; blocked players always.
  const social = makeSocial(unlock); U.social = social;
  Object.assign(U, { rel: {}, specs: [], watchCode: '', mmIds: [], open: false, unmuted: new Set(), auto: new Set(), mmJoin: 0, mmCode: '', created: '', pview: '', fpage: 0, fsel: null, fmsg: '', mmMsg: '' });
  try { U.hostOpen = localStorage.getItem('ych_open') !== '0'; } catch (e) { U.hostOpen = true; }   // rooms you make are open to terrorist players unless you turn it off
  let call = (() => { try { const c = localStorage.getItem('bl_name'); return isCallsign(c) ? c : randomCallsign(); } catch (e) { return randomCallsign(); } })();
  const saveCall = () => { try { localStorage.setItem('bl_name', call); } catch (e) { } };
  saveCall();
  const humans = () => [...S.officers.entries()].filter(([id, o]) => !o.bot && id !== S.me.id);

  U.menuButtons = () => [...(S.net === 'online' ? [['PLAYERS', 'st:players']] : [])];   // credits live on the main menu

  const nameOf = id => (S.officers.get(id) || {}).name || 'PLAYER';
  const isStranger = id => (U.mmIds.includes(id) || U.mmIds.includes(S.me.id)) && U.rel[id] !== 'friend';
  // strangers start muted, blocked players stay muted; what you change yourself in PLAYERS sticks
  function applyMutes() {
    for (const [id] of humans()) {
      const want = U.rel[id] === 'blocked' || (isStranger(id) && !U.unmuted.has(id));
      if (want && !voice.isPeerMuted(id)) { voice.mutePeer(id, true); U.auto.add(id); }
      else if (!want && U.auto.has(id)) { voice.mutePeer(id, false); U.auto.delete(id); }
    }
  }
  U.applyMutes = applyMutes;
  const tagOf = id => [id === U.owner ? 'room owner' : '', U.rel[id] === 'friend' ? 'friend' : '', U.mmIds.includes(id) ? 'quick match' : '', U.rel[id] === 'blocked' ? 'blocked' : '', voice.isPeerMuted(id) ? 'muted' : ''].filter(Boolean).join(', ');
  function showPlayers() {
    U.pview = 'players'; const list = humans(), mine = U.owner === S.me.id, lines = [], btns = [];
    if (!list.length) lines.push('Nobody else is in this room yet.');
    for (const [id, o] of list) { lines.push(clip(o.name + (tagOf(id) ? '  (' + tagOf(id) + ')' : ''))); btns.push([o.name, 'st:pl:' + id]); }
    if (U.specs.length) lines.push(U.specs.length + ' spectator' + (U.specs.length > 1 ? 's' : '') + ' watching (they cannot be heard).');
    lines.push('', 'Pick a player to mute, block or add as a friend.');
    lines.push(mine ? 'You own this room: you can remove players, and open it' : 'The room owner can remove players.', mine ? '   to strangers who play the terrorists (QUICK MATCH).' : 'To report a player, press the Meta button > Report.');
    if (mine) btns.push(['STRANGERS: ' + (U.open ? 'OPEN' : 'CLOSED'), 'st:open']);
    btns.push(['CLOSE', 'close']);
    panel.draw('PLAYERS', 'Room ' + S.room + (U.open ? '   ·   open to strangers' : ''), lines, btns);
  }
  function showPlayer(id) {
    const o = S.officers.get(id); if (!o || o.bot) return showPlayers(); U.pview = 'pl:' + id;
    const mine = U.owner === S.me.id, r = U.rel[id] || '', muted = voice.isPeerMuted(id), btns = [];
    const lines = [o.name + (tagOf(id) ? '  (' + tagOf(id) + ')' : ''), '',
      { friend: 'You are friends: you can join each other from PLAY ONLINE > FRIENDS.', sent: 'Friend request sent. They can accept it here or in FRIENDS.', got: o.name + ' wants to be friends.', blocked: 'Blocked: muted, and never matched with you again.' }[r] || 'Friends join each other\'s rooms without a code.',
      'Muting only changes what you hear.', 'To report a player, press the Meta button > Report.'];
    btns.push([(muted ? 'UNMUTE ' : 'MUTE ') + o.name, 'st:mute:' + id]);
    if (r === '' || r === 'got') btns.push([r === 'got' ? 'ACCEPT FRIEND REQUEST' : 'ADD FRIEND', 'st:addf:' + id]);
    if (r !== 'blocked') btns.push(['BLOCK ' + o.name, 'st:blk:' + id]);
    if (mine) btns.push(['REMOVE FROM ROOM', 'st:boot:' + id]);
    btns.push(['BACK', 'st:players']);
    panel.draw('PLAYER', 'Room ' + S.room, lines, btns);
  }
  const redrawPlayers = () => { if (!S.menu || !U.pview) return; if (U.pview === 'players') showPlayers(); else showPlayer(+U.pview.slice(3)); };

  function showCredits(p) {
    const pages = Math.ceil(CREDITS.length / PER_PAGE); U.page = (p + pages) % pages;
    const lines = [];
    for (const c of CREDITS.slice(U.page * PER_PAGE, U.page * PER_PAGE + PER_PAGE)) {
      lines.push(clip(c.use + ': "' + c.title + '"'));
      lines.push(clip('   by ' + c.by + ', ' + c.lic + (c.chg ? ', ' + c.chg : '')));
    }
    lines.push('', 'Full list with links: breachline credits page.');
    U.prev = S.panel === 'start' || ((S.panel === 'credits' || S.panel === 'tpad') && U.prev) ? 'start' : null;
    if (U.prev) { S.panel = 'credits'; placeBoard(); }   // (the test-mode pad, tpad, opens from these credits and comes back here)
    panel.draw('CREDITS', 'Page ' + (U.page + 1) + ' of ' + pages + (DBG.on ? '   ·   build ' + DBG.build + (social.acct ? '   ·   account ' + social.acct : '') : ''), lines, [['NEXT PAGE', 'st:credits:' + (U.page + 1)], ['DEBUG: ' + (DBG.on ? 'ON' : 'OFF'), 'st:debug'], ...(DBG.on ? [['TEST MODE: ' + (!TEST.ok ? 'ENTER CODE' : TEST.off ? 'OFF' : 'ON'), 'st:tester']] : []), U.prev ? ['BACK', 'st:back'] : ['CLOSE', 'close']]);
  }

  // which edition this headset is running, on the start menu, so a developer unlock is never mistaken for the demo
  U.edition = () => unlock.dev ? 'FULL GAME (developer unlock)' : unlock.owned ? 'FULL GAME' : unlock.gate ? 'DEMO' : 'FULL GAME';
  unlock.ready.then(() => { if (S.panel === 'start') U.showStart(); });
  // ---- the in-VR start menu (store build): callsign, voice, solo / online / tutorial ----
  U.showStart = () => {
    S.panel = 'start'; placeBoard(); panel.mesh.visible = true;
    panel.draw("YOU CAN'T HIDE", 'Callsign ' + call + '   ·   ' + U.edition(), [
      'Clear buildings, save hostages, disarm bombs.',
      'START MISSION: everyone plays online. Lead SWAT with AI',
      '   officers and friends, or join a SWAT team as a terrorist.',
      'Voice chat with your squad: ' + (voice.on ? 'ON' : 'OFF') + (voice.on && voice.err ? '  (' + voice.err.split(':')[0] + ')' : ''),
      'Point at a button and pull the trigger.',
    ], [['CALLSIGN: ' + call.split('-')[0], 'st:word'], ['NUMBER: ' + call.split('-')[1], 'st:num'], [voice.on && !voice.mic ? 'VOICE CHAT: ALLOW MIC' : 'VOICE CHAT: ' + (voice.on ? 'ON' : 'OFF'), 'st:voice'], ['MUSIC: ' + (S.music === false ? 'OFF' : 'ON'), 'st:music'], ...(S.mode === 'vr' ? [['BODY FIT', 'fit:open']] : []), ['TUTORIAL', 'st:tut'], ['CREDITS', 'st:credits:0'], ['START MISSION' + (social.requests.length ? '  (' + social.requests.length + ' FRIEND REQUEST' + (social.requests.length > 1 ? 'S' : '') + ')' : ''), 'st:mode']]);
  };
  // ---- the full game: what the demo leaves out, and Meta's purchase dialog ----
  function showBuy(why, from) {
    U.buyWhy = why; U.buyFrom = from; S.panel = 'buy'; placeBoard(); panel.mesh.visible = true;
    if (U.bought) return panel.draw('FULL GAME UNLOCKED', 'Thank you!', ['Every mission, online co-op and PvP, and the map editor', 'are yours on this account, on every headset.'], [['CONTINUE', 'st:nobuy']]);
    const what = { editor: 'The map editor is part of the full game.', map: 'This mission is part of the full game.' }[why] || '';
    const lines = [what, '', 'The demo: the mansion online, with friends and AI officers,', '   and any mission as a terrorist in someone else\'s room.', 'The full game adds:', '   the container terminal, Grand Prix, airport, casino tower,', '   stadium, club and winery to lead as SWAT, and the map editor.'];
    if (U.buyErr) lines.push('', /CANCEL/i.test(U.buyErr) ? 'The purchase was cancelled or is not available yet.' : 'The purchase did not go through: ' + clip(U.buyErr, 44));   // Meta answers RESULT_CANCELED both when you back out and when the item can't be sold yet
    if (!unlock.store) { lines.push('', 'Get You Can\'t Hide on the Meta Horizon Store to unlock it.'); return panel.draw('FULL GAME', 'Meta Horizon Store', lines, [['OK', 'st:nobuy']]); }
    panel.draw('FULL GAME', unlock.price ? 'One purchase, ' + unlock.price : 'One purchase', lines, [['BUY THE FULL GAME' + (unlock.price ? '  ' + unlock.price : ''), 'st:buy'], ['NOT NOW', 'st:nobuy']]);
  }
  const back2 = () => { try { back.lobby(); } catch (e) { } };
  // called by game.js before it starts a mission or opens the editor: true = blocked (the purchase panel is showing instead)
  U.gate = what => { if (what === 'editor' ? unlock.full() : unlock.mapOk(what)) return false; showBuy(what === 'editor' ? 'editor' : 'map', 'board'); return true; };
  U.lockTag = id => unlock.mapOk(id) ? '' : '   [FULL GAME]';
  // the game redraws its own panels twice a second; while the start menu is up it redraws this instead
  U.redraw = () => { if (S.panel === 'mode') showMode(); else if (S.panel === 'tpad') showTestPad(); else if (S.panel === 'buy') showBuy(U.buyWhy, U.buyFrom); else if (S.panel === 'friend') showFriendPad(); else if (S.panel === 'keypad') showKeypad(); else if (S.panel === 'start') U.showStart(); else if (S.panel === 'credits') showCredits(U.page); else if (S.panel === 'online') showOnline(); else if (S.panel === 'friends') showFriends(); else if (S.panel === 'friend1') showFriend1(); else if (S.panel === 'mm') showMatch(); };
  U.holdsPanel = () => ['start', 'mode', 'keypad', 'friend', 'buy', 'online', 'friends', 'friend1', 'mm', 'tpad'].includes(S.panel) || (S.panel === 'credits' && U.prev);

  // a 6-character room code typed on an on-panel keyboard (no system keyboard inside VR)
  function showKeypad(msg) {
    if (msg !== undefined) U.msg = msg; msg = U.msg;
    S.panel = 'keypad'; placeBoard(); panel.mesh.visible = true;
    if (panel.key === 'keypad' + U.code + (msg || '')) return;
    const g = panel.c.getContext('2d'); g.fillStyle = '#0c1118'; g.fillRect(0, 0, 1024, 768); g.strokeStyle = '#3a6ea5'; g.lineWidth = 6; g.strokeRect(6, 6, 1012, 756);
    g.textAlign = 'center'; g.fillStyle = '#e8eef5'; g.font = 'bold 56px sans-serif'; g.fillText('ROOM CODE', 512, 80);
    g.fillStyle = '#8fb4dc'; g.font = '28px sans-serif'; g.fillText(msg || 'Type a 6-character code: JOIN to play, WATCH to spectate, NEW to share.', 512, 126);
    g.fillStyle = '#7dffa0'; g.font = 'bold 72px monospace'; g.fillText((U.code + '______').slice(0, 6).split('').join(' '), 512, 222);
    const B = [], key = (text, act, x, y, w, col) => B.push({ x, y, w, h: 74, text, act, col });
    [...CODE_CHARS].forEach((k, i) => key(k, 'st:key:' + k, 59 + (i % 8) * 114, 262 + Math.floor(i / 8) * 84, 108, '#1f4a8a'));
    const ok = isRoomCode(U.code);
    key('BACK', 'st:oback', 60, 676, 160, '#39424e'); key('DEL', 'st:del', 230, 676, 150, '#39424e'); key('NEW', 'st:new', 390, 676, 150, '#39424e'); key('WATCH', 'st:watch', 550, 676, 170, ok ? '#1f4a8a' : '#2a3038'); key(ok ? 'JOIN ' + U.code : 'JOIN', 'st:join', 730, 676, 234, ok ? '#1f7a3d' : '#2a3038');
    for (const b of B) { g.fillStyle = b.col; g.fillRect(b.x, b.y, b.w, b.h); g.fillStyle = '#fff'; g.font = 'bold ' + (b.text.length > 8 ? 30 : 38) + 'px sans-serif'; g.fillText(b.text, b.x + b.w / 2, b.y + 51); }
    panel.btns = B; panel.key = 'keypad' + U.code + (msg || ''); panel.tex.needsUpdate = true;
  }
  // ---- START MISSION: everyone plays online ----
  // PLAY AS SWAT makes a room of your own (open to terrorist players unless you turned that off) and puts you in its training room:
  // AI officers fill the squad, friends join you from FRIENDS without a code, and the mission starts from the board as before.
  // PLAY AS TERRORIST is quick match. There is no solo mode: with no connection the game falls back to playing offline by itself.
  function showMode() {
    S.panel = 'mode'; placeBoard(); panel.mesh.visible = true;
    panel.draw('START MISSION', 'Callsign ' + call + '   ·   ' + U.edition(), [
      'PLAY AS SWAT: your own room. AI officers fill the squad,',
      '   friends join you, terrorist players may too' + (U.hostOpen ? '.' : ' (off).'),
      'PLAY AS TERRORIST: join a SWAT team\'s mission.',
      'JOIN A SQUAD: a friend\'s room or a room code.',
      ...(unlock.full() ? [] : ['Demo: the mansion as SWAT; any mission as a terrorist.']),
    ], [['PLAY AS SWAT', 'st:mine'], ['PLAY AS TERRORIST', 'st:qm'], ['JOIN A SQUAD' + (social.requests.length ? '  (' + social.requests.length + ' NEW)' : ''), 'st:online'], ["FRIEND'S MAP", 'st:fmain'], ['TERRORISTS: ' + (U.hostOpen ? 'WELCOME' : 'OFF'), 'st:hostopen'], ['BACK', 'st:back']]);
  }
  const playMine = () => { U.code = randomRoomCode(); U.created = U.code; try { localStorage.setItem('bl_room', U.code); } catch (e) { } go(false, false); };
  // ---- PLAY ONLINE: quick match, friends, room code ----
  const reqN = () => social.requests.length;
  function showOnline(msg) {
    if (msg !== undefined) U.omsg = msg; S.panel = 'online'; placeBoard(); panel.mesh.visible = true;
    const n = social.online();
    panel.draw('JOIN A SQUAD', 'Callsign ' + call, [
      'FRIENDS: join a friend\'s room, no code needed' + (social.ticket ? ' (' + n + ' online).' : '.'),
      'ROOM CODE: join your squad by its code.',
      'Strangers start muted. MENU > PLAYERS: mute, block, add friend.',
      ...(U.omsg ? ['', U.omsg] : []),
    ], [['FRIENDS' + (reqN() ? '  (' + reqN() + ' NEW)' : n ? '  (' + n + ' ONLINE)' : ''), 'st:fl:0'], ['ROOM CODE', 'st:code'], ['BACK', 'st:mode']]);
  }
  const PERF = 4;   // friends per page
  const entries = () => [...social.requests.map(r => ({ ...r, kind: 'req' })), ...social.friends.map(f => ({ ...f, kind: 'friend' }))];
  function showFriends(p) {
    if (p !== undefined) U.fpage = p; S.panel = 'friends'; placeBoard(); panel.mesh.visible = true;
    const all = entries(), pages = Math.max(1, Math.ceil(all.length / PERF)); U.fpage = ((U.fpage % pages) + pages) % pages;
    const page = all.slice(U.fpage * PERF, U.fpage * PERF + PERF), lines = [], btns = [];
    if (!social.ticket) lines.push('Friends are not available: ' + (social.err || 'signing in...'));
    else if (!all.length) lines.push('No friends yet.', '', 'To add someone you meet: in their room, MENU > PLAYERS,', 'pick them and press ADD FRIEND. They accept the same way,', 'or here in FRIENDS. Then you can join each other with no code.');
    for (const [i, e] of page.entries()) {
      lines.push(clip(e.call + '   ' + (e.kind === 'req' ? 'wants to be friends' : e.canJoin ? 'in a room: join or spectate' : e.inRoom ? 'in a full room: you can spectate' : e.online ? 'online' : 'offline')));
      btns.push([e.call + (e.kind === 'req' ? '  (REQUEST)' : e.canJoin ? '  JOIN' : ''), 'st:fsel:' + (U.fpage * PERF + i)]);
    }
    if (U.fmsg) lines.push('', U.fmsg);
    if (pages > 1) btns.push(['NEXT PAGE', 'st:fl:' + (U.fpage + 1)]);
    if (social.ticket) btns.push([U.forget ? 'YES, DELETE IT ALL' : 'DELETE MY FRIENDS DATA', 'st:forget']);
    btns.push(['BACK', 'st:ohome']);
    panel.draw('FRIENDS', social.ticket ? social.friends.length + ' friend' + (social.friends.length === 1 ? '' : 's') + ', ' + social.online() + ' online' + (pages > 1 ? '   ·   page ' + (U.fpage + 1) + ' of ' + pages : '') : 'Not signed in', lines, btns);
  }
  function showFriend1() {
    const e = U.fsel; if (!e) return showFriends(); S.panel = 'friend1'; placeBoard(); panel.mesh.visible = true;
    const fresh = entries().find(x => x.id === e.id && x.kind === e.kind) || e; U.fsel = fresh;
    if (fresh.kind === 'req') return panel.draw('FRIEND REQUEST', fresh.call, [fresh.call + ' wants to be friends.', 'Friends see when each other are online', 'and can join each other\'s rooms without a code.', ...(U.fmsg ? ['', U.fmsg] : [])], [['ACCEPT', 'st:facc'], ['DECLINE', 'st:fdec'], ['BLOCK', 'st:fblk'], ['BACK', 'st:fl']]);
    const state = fresh.canJoin ? 'In a room with a free place.' : fresh.inRoom ? 'In a room, but it is full.' : fresh.online ? 'Online, not in a room.' : 'Offline.';
    panel.draw('FRIEND', fresh.call, [state, '', 'REMOVE ends the friendship on both sides.', 'BLOCK also keeps you out of each other\'s games.', ...(U.fmsg ? ['', U.fmsg] : [])], [...(fresh.canJoin ? [['JOIN ' + fresh.call, 'st:fjoin']] : []), ...(fresh.inRoom ? [['SPECTATE ' + fresh.call, 'st:fwatch']] : []), ['REMOVE FRIEND', 'st:frem'], ['BLOCK', 'st:fblk'], ['BACK', 'st:fl']]);
  }
  // QUICK MATCH: ask for an open SWAT room every few seconds, for up to two minutes
  function showMatch() {
    S.panel = 'mm'; placeBoard(); panel.mesh.visible = true;
    const t = Math.round((Date.now() - U.mmStart) / 1000);
    if (U.mmMsg) return panel.draw('PLAY AS TERRORIST', 'Quick match', [U.mmMsg, '', 'Or lead SWAT yourself: START MISSION > PLAY AS SWAT.', 'Terrorist players can join your room.'], [['TRY AGAIN', 'st:qm'], ['PLAY AS SWAT', 'st:mine'], ['BACK', 'st:mode']]);
    panel.draw('QUICK MATCH', 'Terrorist   ·   ' + t + ' s', ['Looking for a SWAT team that wants terrorists...', '', 'You play a terrorist: lock and rig doors, take hostages,', 'and stop the SWAT team. Your side wins if they fail.', 'Strangers start muted. MENU > PLAYERS to unmute or block.'], [['CANCEL', 'st:mmstop']]);
  }
  function matchStep() {
    if (S.panel !== 'mm' || U.mmMsg) return;
    social.api('match').then(j => {
      if (S.panel !== 'mm' || U.mmMsg) return;
      if (j.room) { U.mmJoin = 1; U.mmCode = j.room; U.code = j.room; return go(false, false); }
      if (j.error) { U.mmMsg = 'Quick match is not available: ' + j.error; return showMatch(); }
      if (Date.now() - U.mmStart > 120000) { U.mmMsg = 'No SWAT team is looking for terrorists right now.'; return showMatch(); }
      showMatch(); U.mmTimer = setTimeout(matchStep, 3000);
    });
  }
  // presence: every 20 s, and when a menu that shows friends opens
  const hello = () => social.hello(call, U.room()).catch(() => { });
  social.onChange = more => { if (more) notify('FRIEND REQUEST: PLAY ONLINE > FRIENDS'); if (['online', 'friends', 'friend1', 'start'].includes(S.panel)) U.redraw(); };
  social.ready.then(hello); setInterval(hello, 20000);

  // quest-store: a friend's shared map, by its 8-digit code (mission board > FRIEND'S MAP). U.friendMap(code) is set by game.js:
  // it loads the map and resolves true, or false when no map has that code.
  U.fcode = ''; U.fmsg = '';
  function showFriendPad(msg) {
    if (msg !== undefined) U.fmsg = msg; msg = U.fmsg;
    S.panel = 'friend'; placeBoard(); panel.mesh.visible = true;
    if (panel.key === 'friend' + U.fcode + msg) return;
    const g = panel.c.getContext('2d'); g.fillStyle = '#0c1118'; g.fillRect(0, 0, 1024, 768); g.strokeStyle = '#3a6ea5'; g.lineWidth = 6; g.strokeRect(6, 6, 1012, 756);
    g.textAlign = 'center'; g.fillStyle = '#e8eef5'; g.font = 'bold 56px sans-serif'; g.fillText("FRIEND'S MAP", 512, 80);
    g.fillStyle = '#8fb4dc'; g.font = '28px sans-serif'; g.fillText(msg || 'Type the 8-digit code your friend got with SHARE in the map editor.', 512, 126);
    const d = (U.fcode + '________').slice(0, 8); g.fillStyle = '#7dffa0'; g.font = 'bold 72px monospace'; g.fillText(d.slice(0, 4).split('').join(' ') + '   ' + d.slice(4).split('').join(' '), 512, 222);
    const B = [], key = (text, act, x, y, w, col) => B.push({ x, y, w, h: 74, text, act, col });
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'DEL', '0', 'CLEAR'].forEach((k, i) => key(k, k === 'DEL' ? 'st:fdel' : k === 'CLEAR' ? 'st:fclr' : 'st:fkey:' + k, 222 + (i % 3) * 200, 262 + Math.floor(i / 3) * 86, 180, k.length > 1 ? '#39424e' : '#1f4a8a'));
    const ok = U.fcode.length === 8; key('BACK', 'st:fback', 60, 676, 300, '#39424e'); key(ok ? 'LOAD THIS MAP' : 'LOAD', 'st:fgo', 380, 676, 584, ok ? '#1f7a3d' : '#2a3038');
    for (const b of B) { g.fillStyle = b.col; g.fillRect(b.x, b.y, b.w, b.h); g.fillStyle = '#fff'; g.font = 'bold 38px sans-serif'; g.fillText(b.text, b.x + b.w / 2, b.y + 51); }
    panel.btns = B; panel.key = 'friend' + U.fcode + msg; panel.tex.needsUpdate = true;
  }
  // test mode: the TEST_CODE typed on a number pad (up to 12 digits)
  function showTestPad(msg) {
    if (msg !== undefined) U.tmsg = msg; msg = U.tmsg || '';
    S.panel = 'tpad'; placeBoard(); panel.mesh.visible = true; if (panel.key === 'tpad' + U.tcode + msg) return;
    const g = panel.c.getContext('2d'); g.fillStyle = '#0c1118'; g.fillRect(0, 0, 1024, 768); g.strokeStyle = '#a5823a'; g.lineWidth = 6; g.strokeRect(6, 6, 1012, 756);
    g.textAlign = 'center'; g.fillStyle = '#e8eef5'; g.font = 'bold 56px sans-serif'; g.fillText('TEST MODE', 512, 80);
    g.fillStyle = '#dcc48f'; g.font = '28px sans-serif'; g.fillText(msg || 'Type the test code to see maps that are not released yet.', 512, 126);
    g.fillStyle = '#ffd27d'; g.font = 'bold 64px monospace'; g.fillText(U.tcode.replace(/./g, '•') || '_', 512, 222);
    const B = [], key = (text, act, x, y, w, col) => B.push({ x, y, w, h: 74, text, act, col });
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'DEL', '0', 'CLEAR'].forEach((k, i) => key(k, k === 'DEL' ? 'st:tdel' : k === 'CLEAR' ? 'st:tclr' : 'st:tkey:' + k, 222 + (i % 3) * 200, 262 + Math.floor(i / 3) * 86, 180, k.length > 1 ? '#39424e' : '#5a4a1f'));
    key('BACK', 'st:tback', 60, 676, 300, '#39424e'); key('ENTER', 'st:tgo', 380, 676, 584, U.tcode.length >= 6 ? '#1f7a3d' : '#2a3038');
    for (const b of B) { g.fillStyle = b.col; g.fillRect(b.x, b.y, b.w, b.h); g.fillStyle = '#fff'; g.font = 'bold 38px sans-serif'; g.fillText(b.text, b.x + b.w / 2, b.y + 51); }
    panel.btns = B; panel.key = 'tpad' + U.tcode + msg; panel.tex.needsUpdate = true;
  }
  function go(solo, tut, watch) {
    S.panel = null; panel.mesh.visible = false;
    if (!solo && U.mmCode !== U.code) U.mmJoin = 0;
    U.watchCode = watch ? U.code : ''; voice.listenOnly = !!watch;   // spectators only listen: no microphone
    if (watch) { play(false, call, U.code, false); return; }
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
    // voice: OFF -> ON asks for the microphone straight away (in the store app that is Android's permission prompt), so the question
    // comes up here at the start, not in the middle of a mission. ON without a mic (refused or not asked yet) asks again.
    else if (what === 'music') { S.music = S.music === false; try { localStorage.setItem('bl_music', S.music ? '1' : '0'); } catch (e) { } U.showStart(); }
    else if (what === 'voice') {
      if (voice.on && voice.mic) { voice.setOn(false); return U.showStart(); }
      if (!voice.on) voice.setOn(true);
      status('Asking for the microphone...'); U.showStart();
      voice.startMic().then(ok => { if (ok) voice.unlock(); status(ok ? 'Microphone ready.' : voice.err); U.showStart(); });
    }
    else if (what === 'mine') playMine();
    else if (what === 'tut') go(true, true);
    else if (what === 'mode') showMode();
    else if (what === 'fmain') { if (!unlock.full()) return showBuy('editor', 'start'), true; U.fromMain = true; U.fcode = ''; showFriendPad(''); }
    else if (what === 'online') { U.omsg = ''; showOnline(); hello(); }
    else if (what === 'ohome') { clearTimeout(U.mmTimer); U.fmsg = ''; showOnline(''); }
    else if (what === 'code') { U.msg = ''; try { const c = localStorage.getItem('bl_room') || ''; U.code = isRoomCode(c) ? c : ''; } catch (e) { U.code = ''; } showKeypad(); }
    else if (what === 'oback') showOnline('');
    else if (what === 'hostopen') { U.hostOpen = !U.hostOpen; try { localStorage.setItem('ych_open', U.hostOpen ? '1' : '0'); } catch (e) { } showMode(); }
    else if (what === 'key') { if (U.code.length < 6) U.code += arg; showKeypad(''); }
    else if (what === 'del') { U.code = U.code.slice(0, -1); showKeypad(''); }
    else if (what === 'new') { U.code = randomRoomCode(); U.created = U.code; showKeypad('New room' + (U.hostOpen ? ', open to terrorist players' : '') + ': tell your squad ' + U.code + '.'); }
    else if (what === 'back') { U.prev = null; U.showStart(); }
    else if (what === 'tester') { if (!TEST.ok) { U.tcode = ''; showTestPad(''); } else { TEST.setOff(!TEST.off); status(TEST.off ? 'Test mode off: you see what players see.' : 'Test mode on: maps marked TEST are in the mission list.'); showCredits(U.page); } }
    else if (what === 'tkey') { if (U.tcode.length < 12) U.tcode += arg; showTestPad(''); }
    else if (what === 'tdel') { U.tcode = U.tcode.slice(0, -1); showTestPad(''); }
    else if (what === 'tclr') { U.tcode = ''; showTestPad(''); }
    else if (what === 'tback') { U.tcode = ''; showCredits(U.page); }
    else if (what === 'tgo') { if (U.tcode.length < 6) return showTestPad('The code has at least 6 digits.'), true; const c = U.tcode; U.tcode = ''; showTestPad('Checking...'); TEST.enter(c).then(j => { if (j.token) { status('Test mode on.'); if (S.net === 'online') sendTester(); showCredits(U.page); } else showTestPad(j.error || 'Could not check the code.'); }); }
    else if (what === 'watch') { if (isRoomCode(U.code)) go(false, false, true); else showKeypad('The room code has six characters.'); }
    else if (what === 'join') { if (isRoomCode(U.code)) go(false, false); else showKeypad('The room code has six characters.'); }
    else if (what === 'qm') { clearTimeout(U.mmTimer); U.mmMsg = ''; U.mmStart = Date.now(); showMatch(); matchStep(); }
    else if (what === 'mmstop') { clearTimeout(U.mmTimer); showMode(); }
    else if (what === 'fl') { U.fmsg = ''; U.forget = false; showFriends(arg === undefined ? U.fpage : +arg); hello(); }
    else if (what === 'forget') { if (!U.forget) { U.forget = true; U.fmsg = 'Deletes your friends, requests and blocks on our server. Press again.'; return showFriends(), true; }
      U.forget = false; social.api('forget').then(j => { social.friends = []; social.requests = []; U.fmsg = j.error || 'Deleted. Your friends list is empty now.'; showFriends(0); }); }
    else if (what === 'fsel') { U.fmsg = ''; U.fsel = entries()[+arg] || null; showFriend1(); }
    else if (what === 'facc' || what === 'fdec' || what === 'frem' || what === 'fblk') { const e = U.fsel; if (!e) return showFriends(), true;
      U.fmsg = '...'; showFriend1(); social.api({ facc: 'accept', fdec: 'decline', frem: 'remove', fblk: 'block' }[what], { id: e.id }).then(j => hello().then(() => { U.fmsg = j.error || { facc: 'You and ' + e.call + ' are now friends.', fdec: 'Request declined.', frem: e.call + ' removed.', fblk: e.call + ' blocked.' }[what]; if (what === 'facc' && !j.error) { U.fsel = { ...e, kind: 'friend' }; showFriend1(); } else showFriends(); })); }
    else if (what === 'fwatch') { const e = U.fsel; if (!e) return showFriends(), true; U.fmsg = 'Joining as a spectator...'; showFriend1(); social.api('join', { id: e.id, watch: true }).then(j => { if (j.room) { U.fmsg = ''; U.code = j.room; go(false, false, true); } else { U.fmsg = j.error || 'Could not spectate.'; showFriend1(); } }); }
    else if (what === 'fjoin') { const e = U.fsel; if (!e) return showFriends(), true; U.fmsg = 'Joining...'; showFriend1(); social.api('join', { id: e.id }).then(j => { if (j.room) { U.fmsg = ''; U.code = j.room; go(false, false); } else { U.fmsg = j.error || 'Could not join.'; showFriend1(); } }); }
    else if (what === 'buy') { unlock.buy().then(ok => { if (ok) { U.bought = true; sendPass(); showBuy(U.buyWhy, U.buyFrom); } }).catch(e => { U.buyErr = String(e && e.message || e); showBuy(U.buyWhy, U.buyFrom); }); }
    else if (what === 'nobuy') { U.bought = false; U.buyErr = ''; if (U.buyFrom === 'start') U.showStart(); else { S.panel = null; back2(); } }
    else if (what === 'friend') { if (!unlock.full()) return showBuy('editor', 'board'), true; U.fcode = ''; showFriendPad(''); }
    else if (what === 'fkey') { if (U.fcode.length < 8) U.fcode += arg; showFriendPad(''); }
    else if (what === 'fdel') { U.fcode = U.fcode.slice(0, -1); showFriendPad(''); }
    else if (what === 'fclr') { U.fcode = ''; showFriendPad(''); }
    else if (what === 'fback') { if (U.fromMain) { U.fromMain = false; return showMode(), true; } S.panel = null; back2(); }
    else if (what === 'fgo') { if (U.fcode.length !== 8) return showFriendPad('The code has eight digits.'), true; const c = U.fcode; showFriendPad('Loading...');
      (U.friendMap ? U.friendMap(c) : Promise.resolve(false)).then(ok => { if (!ok) return showFriendPad('No map has that code (or it was reported).');
        if (U.fromMain) { U.fromMain = false; playMine(); let n = 0; const t = setInterval(() => { if (U.started() || ++n > 40) { clearInterval(t); if (U.started()) U.friendMap(c); } }, 300); return; }   // from START MISSION: your own room, with that map picked
        S.panel = null; back2(); }); }
    else if (what === 'freport') { U.reportMap && U.reportMap(); }
    else if (what === 'players') showPlayers();
    else if (what === 'pl') showPlayer(+arg);
    else if (what === 'open') { if (U.owner === S.me.id) { U.open = !U.open; net.send({ t: 'open', v: U.open }); } showPlayers(); }
    else if (what === 'addf') { net.send({ t: 'friend', p: +arg }); status('Asking ' + nameOf(+arg) + '...'); }
    else if (what === 'blk') { const id = +arg; net.send({ t: 'block', p: id }); U.rel[id] = 'blocked'; U.unmuted.delete(id); applyMutes(); showPlayer(id); }
    else if (what === 'credits') showCredits(+arg || 0);
    else if (what === 'debug') { toggleDebug(); showCredits(U.page || 0); }
    else if (what === 'mute') { const id = +arg, m = !voice.isPeerMuted(id); voice.mutePeer(id, m); U.auto.delete(id); if (m) U.unmuted.delete(id); else U.unmuted.add(id); showPlayer(id); }
    else if (what === 'boot') { if (U.owner === S.me.id) net.send({ t: 'boot', p: +arg }); setTimeout(showPlayers, 400); }
    return true;
  };

  // room messages only the store Worker sends
  // sign in again (Meta is asked again) and hand the room the new pass, so a purchase counts without leaving the room
  const sendPass = () => social.refresh().then(() => { if (social.pass) try { net.send({ t: 'pass', fp: social.pass }); } catch (e) { } });
  // test mode: hand the room this headset's tester token (the socket can open before the token's check comes back)
  const sendTester = () => TEST.ready.then(() => { if (TEST.ok && TEST.token) try { net.send({ t: 'tester', tt: TEST.token }); } catch (e) { } });
  U.onMsg = m => {
    if (m.t === 'testonly') { const room = m.why || '?', tok = TEST.token ? TEST.token.slice(0, 14) + '...(' + TEST.token.length + ')' : 'none';
      TEST.recheck().then(j => notify('TEST MAP REFUSED. Room: ' + room + '. Server check: ' + (j.ok ? 'OK' : (j.why || j.error || 'no')) + '. Token ' + tok + (j.ok === false ? '. Type the test code again.' : ''))); status(TEST.ok ? 'Confirming test mode with the room... pick the mission again in a moment.' : 'That mission is in test mode: CREDITS > DEBUG ON > TEST MODE to play it.'); if (TEST.ok) { U.testAsk = true; sendTester(); } return true; }
    if (m.t === 'testerok') { if (U.testAsk) status('Test mode confirmed in this room: pick the test mission again.'); U.testAsk = false; return true; }
    // the room refused a mission pick: leading it needs the full game, and the server did not see a confirmed purchase
    if (m.t === 'locked') { if (!unlock.full()) { showBuy('map', 'board'); return true; }
      status('Your purchase could not be confirmed (' + (social.check || 'not checked') + '). Checking again...'); sendPass(); return true; }
    if (m.t === 'owner') { if (U.testWs !== net.ws) { U.testWs = net.ws; sendTester(); } U.owner = m.id; U.open = !!m.open; U.mmIds = m.mm || []; U.specs = m.specs || []; for (const id of U.specs) voice.mutePeer(id, true); applyMutes(); redrawPlayers(); if (m.id === S.me.id && U.created === S.room && U.hostOpen && !m.open && !U.sentOpen) { U.sentOpen = true; net.send({ t: 'open', v: true }); } return true; }
    if (m.t === 'booted') { status('The room owner removed you from that room.'); return true; }
    if (m.t === 'rel') { U.rel = m.m || {}; applyMutes(); redrawPlayers(); return true; }
    if (m.t === 'friendres') { const n = nameOf(m.p); status({ sent: 'Friend request sent to ' + n + '.', friend: 'You and ' + n + ' are now friends.', limit: 'Too many friend requests today.', full: 'A friends list is full (100).', noacct: n + ' cannot be added: no full game on their account.', no: n + ' cannot be added.' }[m.res] || 'Could not add ' + n + '.'); hello(); redrawPlayers(); return true; }
    if (m.t === 'friendreq') { notify(m.res === 'friend' ? 'NOW FRIENDS WITH ' + nameOf(m.p) : nameOf(m.p) + ' WANTS TO BE FRIENDS: MENU > PLAYERS'); hello(); return true; }
    if (m.t === 'specfull') { status('That room already has four spectators.'); return true; }
    if (m.t === 'mmgone') { status('That game stopped taking terrorists. Try QUICK MATCH again.'); notify('THAT GAME IS NO LONGER OPEN'); return true; }
    return false;
  };
  U.started = () => S.net === 'online' || S.net === 'solo' || S.net === 'lost';
  U.room = () => S.net === 'online' || S.net === 'lost' ? S.room : '';
  U.left = () => { S.mode = null; U.watchCode = ''; U.specs = []; U.mmJoin = 0; U.mmCode = ''; U.sentOpen = false; U.rel = {}; U.mmIds = []; U.auto.clear(); };
  // extra WebSocket query for a room: my ticket (account), a QUICK MATCH join (1; 2 when rejoining after a drop), and whether a
  // room I made is open to strangers
  U.specIds = () => U.specs;
  U.isOwner = () => !U.owner || U.owner === S.me.id || S.net !== 'online';   // online, the room owner picks the mission
  U.wsExtra = (room, rejoin) => social.wsParam() + TEST.wsParam() + (U.watchCode === room ? '&spec=1' : '') + (U.mmJoin && U.mmCode === room ? '&mm=' + (rejoin ? 2 : 1) : '') + (U.created === room && U.hostOpen ? '&open=1' : '');
  U.store = store;
  U.back = back;
  return U;
}
