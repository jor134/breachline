// Debug mode (credits page button, off by default, remembered on this headset): shows the build number on the credits page,
// the CPU readout on the in-game menu, and the menu's mic button.
export const DBG = { on: false, build: '' };
try { DBG.on = localStorage.getItem('ych_debug') === '1'; } catch (e) { }
export function toggleDebug() { DBG.on = !DBG.on; try { localStorage.setItem('ych_debug', DBG.on ? '1' : '0'); } catch (e) { } return DBG.on; }
