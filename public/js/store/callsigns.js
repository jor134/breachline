// Store build: players pick a callsign from this list plus a number (VIPER-27) instead of typing a name. There is no
// keyboard inside VR, and nobody can put abusive text over their head. The Worker accepts only names of this shape.
export const WORDS = ['ALPHA', 'BRAVO', 'CHARLIE', 'DELTA', 'ECHO', 'FOXTROT', 'GHOST', 'HAWK', 'JAGUAR', 'KILO', 'LANCER', 'MAVERICK',
  'NOMAD', 'ORBIT', 'PHANTOM', 'RAVEN', 'SABRE', 'TANGO', 'VIPER', 'WOLF', 'YANKEE', 'ZULU', 'COBRA', 'FALCON', 'GRIZZLY', 'HUNTER', 'ONYX', 'REAPER'];
export const isCallsign = s => typeof s === 'string' && /^[A-Z]+-\d{2}$/.test(s) && WORDS.includes(s.split('-')[0]);
export const cleanCallsign = s => isCallsign(s) ? s : 'OFFICER-' + String(Math.floor(Math.random() * 90) + 10);
export const randomCallsign = () => WORDS[Math.floor(Math.random() * WORDS.length)] + '-' + String(Math.floor(Math.random() * 90) + 10);
