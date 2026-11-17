// Store-build additions to the VR menu: PLAYERS (mute anyone's voice; the room owner can also remove a player) and
// CREDITS (the attributions the licences ask for). Kept out of game.js so merges from main stay small: game.js only
// adds the two menu buttons, passes unknown panel actions to act(), and forwards the 'owner' / 'booted' room messages.
import { CREDITS } from './credits.js';

const PER_PAGE = 4, clip = (s, n = 60) => s.length > n ? s.slice(0, n - 1) + '…' : s;

export function makeStoreUI({ panel, S, voice, net, sfx, back, status }) {
  const U = { owner: 0, page: 0 };
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
    panel.draw('CREDITS', 'Page ' + (U.page + 1) + ' of ' + pages, lines, [['NEXT PAGE', 'st:credits:' + (U.page + 1)], ['CLOSE', 'close']]);
  }

  // returns true when it handled the action
  U.act = act => {
    if (!act || !act.startsWith('st:')) return false;
    const [, what, arg] = act.split(':'); sfx.click();
    if (what === 'players') showPlayers();
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
  U.back = back;
  return U;
}
