# Car models

`car.bin` (the sports car outside the mansion) is a simplified, geometry-only bake (no textures, no logos, interior removed, vertices welded) of
**Car Concept** by Eric Chadwick, (c) 2024 Darmstadt Graphics Group GmbH, from the Khronos glTF Sample Assets
(https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/CarConcept).

Licensed under Creative Commons Attribution 4.0 International (CC-BY 4.0): https://creativecommons.org/licenses/by/4.0/
Changes made: see `tools/bake_car.py`.


`pack.glb` (the parked cars on the casino, airport and Grand Prix maps): **Generic passenger car pack** by Comrade1280
(https://sketchfab.com/comrade1280), https://sketchfab.com/3d-models/generic-passenger-car-pack-20f9af9b8a404d5cb022ac6fe87f21f5,
CC BY 4.0. Changes: each car gathered with its wheels into one node in the game frame and the ground disc dropped (tools/car_pack.py),
textures re-encoded to JPEG at 512 px (tools/pack_glb.py).
