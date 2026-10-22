#!/usr/bin/env bash
# The section mascots with the hero's porcelain head: whitened, clear-coated "Head" material (normal map kept, matte
# red mouth), from the originals in web/public/models/mascots/ → web/public/models/compressed/ (meshopt + WebP 1024).
# The Care Core tooth is glass instead (glass_tooth.py). Their studios (lights fitted to each artwork) are in
# web/src/components/MascotModel.tsx (LOOKS).
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
ALL=("${!NECK[@]}" tooth)
TMP="$(mktemp -d)"
for n in "${@:-${ALL[@]}}"; do
  if [ "$n" = tooth ]; then
    blender -b --python "$HERE/glass_tooth.py" -- "$ROOT/web/public/models/mascots/tooth.glb" "$TMP/tooth.glb" | grep -E "^GLASS"
  else
    # shellcheck disable=SC2086
    blender -b --python "$HEAD" -- "$ROOT/web/public/models/mascots/$n.glb" "$TMP/$n.glb" --neck "${NECK[$n]}" $COMMON ${EXTRA[$n]:-} \
      | grep -E "^HEAD|^WHITENED|^MOUTH|^SUIT"
  fi
  NODE_OPTIONS=--max-old-space-size=3072 npx --yes @gltf-transform/cli@4 optimize "$TMP/$n.glb" "$ROOT/web/public/models/compressed/$n.glb" \
    --compress meshopt --texture-compress webp --texture-size 1024 --simplify false --instance false --flatten false --join false | tail -1
done
rm -rf "$TMP"
