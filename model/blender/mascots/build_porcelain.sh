#!/usr/bin/env bash
# The section mascots with the hero's porcelain head, from the originals in web/public/models/mascots/:
#   subdivide.py (one Catmull-Clark level: smooth silhouettes; grey hard props kept crisp) →
#   head_material_raw.py (whitened, clear-coated "Head" material, normal map kept, matte red mouth, black eyes) →
#   [RIG=1: rig_mascots.py] → WebP 95 textures → meshopt
# → web/public/models/compressed/ (unrigged), or with RIG=1 → web/public/models/rig/ (what the site loads; see
# build_rig.sh). The Care Core tooth is glass instead (glass_tooth.py, never rigged: it only spins). Their studios
# (lights fitted to each artwork) are in web/src/components/MascotModel.tsx (LOOKS).
#   usage: model/blender/mascots/build_porcelain.sh [name …]     (default: every model below)
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$HERE/../../.."
HEAD="$ROOT/model/blender/tripo/raw/head_material_raw.py"
COMMON="--largest --keep-normal --relative-tint --matte-mouth --dark-eyes --single-sided"
# world height of each head's underside (the models are 0.98 tall, feet at 0; the seated reader's head sits lower);
# the pin's location marker touches the head, so it gets the glossy head material too (it is glossy in its artwork)
declare -A NECK=([guide]=0.53 [guide-left]=0.53 [butler]=0.53 [laptop]=0.53 [pin]=0.53 [scholar]=0.53 [vault]=0.53 [reading]=0.47 [heart]=0.55)
# laptop, pin, scholar, vault: their eye textures have no painted highlight (the others have)
declare -A EXTRA=([butler]="--black-suit" [pin]="--deep-blue --eye-glints" [laptop]="--eye-glints" [scholar]="--eye-glints" [vault]="--eye-glints")
if [ -n "${RIG:-}" ]; then OUT="$ROOT/web/public/models/rig"; else OUT="$ROOT/web/public/models/compressed"; fi
mkdir -p "$OUT"
ALL=("${!NECK[@]}" tooth)
TMP="$(mktemp -d)"
for n in "${@:-${ALL[@]}}"; do
  blender -b --python "$HERE/subdivide.py" -- "$ROOT/web/public/models/mascots/$n.glb" "$TMP/$n.sub.glb" | grep -E "^SUBDIV"
  if [ "$n" = tooth ]; then
    blender -b --python "$HERE/glass_tooth.py" -- "$TMP/$n.sub.glb" "$TMP/$n.glb" | grep -E "^GLASS"
  else
    # shellcheck disable=SC2086
    blender -b --python "$HEAD" -- "$TMP/$n.sub.glb" "$TMP/$n.glb" --neck "${NECK[$n]}" $COMMON ${EXTRA[$n]:-} \
      | grep -E "^HEAD|^GLINTS|^MOUTH|^SUIT"
    if [ -n "${RIG:-}" ]; then
      blender -b --python "$HERE/rig_mascots.py" -- "$n" "$TMP/$n.glb" "$TMP/$n.rig.glb" | grep -E "^RIG"
      mv "$TMP/$n.rig.glb" "$TMP/$n.glb"
    fi
  fi
  # textures first (a separate webp pass would drop meshopt), at 95: the face, eyes and lines stay crisp
  npx --yes @gltf-transform/cli@4 webp "$TMP/$n.glb" "$TMP/$n.webp.glb" --quality 95 | tail -1
  NODE_OPTIONS=--max-old-space-size=3072 npx --yes @gltf-transform/cli@4 optimize "$TMP/$n.webp.glb" "$OUT/$n.glb" \
    --compress meshopt --texture-compress false --texture-size 1024 --simplify false --instance false --flatten false --join false | tail -1
done
rm -rf "$TMP"
