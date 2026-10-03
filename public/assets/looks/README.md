# Entity look images

Nano Banana high-tier stills under these folders become the live 3D look for
matching park entities. Procedural meshes stay as fallback; motion cycles keep
running (retargeted onto the look billboard / path tile).

## Paths

- `attraction/<attractionId>.png`
- `stall/<stallId>.png`
- `prop/<kind>.png` — `tree`, `bush`, `statue`, `flower`, `bin`, `bench`, `warehouse`, `path`, `gate`
- `staff/<role>.png` — `janitor`, `runner`, `mechanic`

Ids match the game catalog (`sky_coaster`, `balloon_vendor`, `inverted_coaster`, …).

Gate still: two openings + beam + two flags (`prop/gate.png`).
Inverted coaster still: car hangs under the track (`attraction/inverted_coaster.png`).
