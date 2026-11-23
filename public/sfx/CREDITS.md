# Sound credits

All recorded sounds here are CC0 (public domain) or under the Pixabay Content License: free to use and change, also commercially, no credit required. Credited anyway.

| Sounds | Source | Licence |
|---|---|---|
| Rifle and pistol shots, magazine in/out, charging handle, bolt and slide release, dry fire, selector (`rifle*`, `pistol*`, `mag*`, `rack`, `bolt*`, `click`, `selector*`, `lock`) | **The Free Firearm Sound Library** (AR-15 and Walther PPQ recordings), mirrored at https://github.com/buddingmonkey/FreeFirearmsSFXLibrary | CC0 |
| Doors, lock rattle, unlock, cuffs, wire snip (`door_*`, `locked*`, `unlock`, `cuff*`, `snip*`) | **RPG Audio** by Kenney (kenney.nl), via https://github.com/Boyquotes/kenney-rpg-audio-for-godot | CC0 |
| Door kicks, bullet impacts, grenade bounces, being hit, breaker clunk, footsteps (`kick*`, `impact*`, `clink*`, `hurt*`, `power*`, `step_*`) | **Impact Sounds** by Kenney, via https://github.com/Boyquotes/kenney-impact-sounds-for-godot | CC0 |
| Explosions, flashbang (`boom*`, `flashbang*`) | **Sci-Fi Sounds** by Kenney, via https://github.com/Boyquotes/kenney-sci-fi-sounds-for-godot | CC0 |
| Menu and confirmation tones (`ui*`, `ok`, `error`) | **Interface Sounds** by Kenney, via https://github.com/Calinou/kenney-interface-sounds | CC0 |
| Race-car engine (`engine_f1`) | **grandprix** by freesound_community, from Pixabay (the file was named freesound_community-grandprix-61253) | Pixabay Content License |

Cut, converted to mono MP3 and level-matched by `tools/build_sfx.py`; the engine is cut into a seamless 16 s loop by `tools/engine_loop.py`. Rain, thunder, smoke hiss, ear ringing and the night-vision whine are synthesised in `public/js/audio.js`.

## Hostage voices (`vo_c_*`)

| Sounds | Source | Licence |
|---|---|---|
| Sobbing, man (`vo_c_cry_m_*`) | **crying male** by freesound_community, from Pixabay (crying-male-103153) | Pixabay Content License |
| Sobbing, woman (`vo_c_cry_f_*`) | **woman sobbing** by Dragon Studio, from Pixabay (woman-sobbing-372482) | Pixabay Content License |
| Relieved sigh (`vo_c_sigh_*`) | **male sigh** by freesound_community, from Pixabay (male-sigh-6763) | Pixabay Content License |
| Cry when hit (`vo_c_die_*`) | **male death sound** by vinodadora, from Pixabay (male-death-sound-128357) | Pixabay Content License |
| "Help! Help!" (`vo_c_help_*`) | **help help** by u_q2b5lx2vqb, from Pixabay (help-help-322552) | Pixabay Content License |

Cut and level-matched by `tools/build_hostage_vo.py`. Each take has one voice; the other version (a woman's sigh and cry when hit,
a man's "help") is the same take pitch-shifted with its formants.
