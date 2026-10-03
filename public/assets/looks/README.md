# Entity look images

Drop matching image files here to skin the live 3D park meshes.
Procedural silhouettes and motion cycles stay active; images are optional overlays.

## Paths

- `attraction/<attractionId>.png` (also `.webp` / `.jpg`)
- `stall/<stallId>.png`
- `prop/<kind>.png` — `tree`, `bush`, `statue`, `flower`, `bin`, `bench`
- `staff/<role>.png` — `janitor`, `runner`, `mechanic`

Ids match the game catalog (`sky_coaster`, `balloon_vendor`, …).
No files are invented in-repo; missing files keep procedural looks.
