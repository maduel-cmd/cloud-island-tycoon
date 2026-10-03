# Entity look images

Nano Banana high-tier stills under these folders become the live 3D look for
matching park entities. Procedural meshes stay as fallback; motion cycles keep
running (retargeted onto the look billboard / path tile).

## Paths

- `attraction/<attractionId>.png`
- `stall/<stallId>.png`
- `prop/<kind>.png` — `tree`, `bush`, `statue`, `flower`, `bin`, `bench`, `warehouse`, `path`
- `staff/<role>.png` — `janitor`, `runner`, `mechanic`

Ids match the game catalog (`sky_coaster`, `balloon_vendor`, …).

## Skipped until replacements arrive

These stills exist in the pack but are **not** applied (wrong look):

- `gate.png` — must show two openings, not one arch (gate stays procedural)
- `inverted-coaster.png` — car must hang under the track (ride stays procedural)
