#!/usr/bin/env bash
# The section mascots, porcelain (as build_porcelain.sh) and rigged (rig_mascots.py) → web/public/models/rig/.
# The glass tooth needs no rig (it only spins): it is copied from models/compressed/. The page's motions are
# MOTIONS in web/src/components/MascotModel.tsx.
#   usage: model/blender/mascots/build_rig.sh [name …]     (default: all)
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$HERE/../../.."
HEAD="$ROOT/model/blender/tripo/raw/head_material_raw.py"
COMMON="--largest --keep-normal --relative-tint --matte-mouth --dark-eyes --single-sided"
declare -A NECK=([guide]=0.53 [guide-left]=0.53 [butler]=0.53 [laptop]=0.53 [pin]=0.53 [scholar]=0.53 [vault]=0.53 [reading]=0.47 [heart]=0.55)
# laptop, pin, scholar, vault: their eye textures have no painted highlight (the others have)
declare -A EXTRA=([butler]="--black-suit" [pin]="--deep-blue --eye-glints" [laptop]="--eye-glints" [scholar]="--eye-glints" [vault]="--eye-glints")
OUT="$ROOT/web/public/models/rig"
mkdir -p "$OUT"
TMP="$(mktemp -d)"
for n in "${@:-${!NECK[@]} tooth}"; do
  if [ "$n" = tooth ]; then
    [ -f "$ROOT/web/public/models/compressed/tooth.glb" ] || "$HERE/build_porcelain.sh" tooth
    cp "$ROOT/web/public/models/compressed/tooth.glb" "$OUT/tooth.glb"
    continue
  fi
  # shellcheck disable=SC2086
  blender -b --python "$HEAD" -- "$ROOT/web/public/models/mascots/$n.glb" "$TMP/$n.head.glb" --neck "${NECK[$n]}" $COMMON ${EXTRA[$n]:-} \
    | grep -E "^HEAD|^GLINTS"
  blender -b --python "$HERE/rig_mascots.py" -- "$n" "$TMP/$n.head.glb" "$TMP/$n.glb" | grep -E "^RIG"
  NODE_OPTIONS=--max-old-space-size=3072 npx --yes @gltf-transform/cli@4 optimize "$TMP/$n.glb" "$OUT/$n.glb" \
    --compress meshopt --texture-compress webp --texture-size 1024 --simplify false --instance false --flatten false --join false | tail -1
done
rm -rf "$TMP"
