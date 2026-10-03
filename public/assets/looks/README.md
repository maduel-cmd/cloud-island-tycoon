# Entity look images

Nano Banana high-tier stills under these folders become the live 3D look for
matching park entities. Procedural meshes stay as fallback; motion cycles keep
running (retargeted onto the look billboard / path tile).

## Paths

- `attraction/<attractionId>.png` — still body
- `stall/<stallId>.png`
- `prop/<kind>.png` — `tree`, `bush`, `statue`, `flower`, `bin`, `bench`, `warehouse`, `path`, `gate`
- `staff/<role>.png` — `janitor`, `runner`, `mechanic`

## Motion frames

Four-frame packs live beside the still:

- `attraction/<id>/{0,1,2,3}.png`
- `stall/<id>/{0,1,2,3}.png`
- `prop/<id>/{0,1,2,3}.png` — path frames texture path *tiles*, not a standing card
- `staff/<id>/{0,1,2,3}.png`

Ids match the game catalog (`sky_coaster`, `balloon_vendor`, `inverted_coaster`, …).

Gate still: two openings + beam + two flags (`prop/gate.png`); motion pack waves the flags.
Inverted coaster still: car hangs under the track (`attraction/inverted_coaster.png`);
no motion pack (sheet had only one matching hang frame).
Mini railway: motion pack from replacement 2x2 sheet (`attraction/mini_railway/{0..3}.png`).
Broken rides freeze on frame `0.png`.
