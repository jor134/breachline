// quest-store: room codes are 6 characters from an alphabet with no look-alikes (no I, O, 0 or 1): about a billion rooms, so a
// code cannot be guessed. The Worker refuses anything else (src/social.js ROOM_RE).
export const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const isRoomCode = s => typeof s === 'string' && s.length === 6 && [...s].every(c => CODE_CHARS.includes(c));
export const randomRoomCode = () => { const r = crypto.getRandomValues(new Uint8Array(6)); return [...r].map(b => CODE_CHARS[b % 32]).join(''); };
