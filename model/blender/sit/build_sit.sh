#!/usr/bin/env bash
# Rebuild the seated hero mascot from the raw seated Meshy export.
#   usage: model/blender/sit/build_sit.sh [meshy_seated.glb] [reference.png]
# Output: model/mascot/out_sit/mascot_sit.glb and mascot_sit.opt.glb (compressed, for the web)
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
MASCOT="$HERE/../../mascot"
SRC="${1:-$MASCOT/8d1400c274348ff18c8f22503de0ef2c.glb}"
REF="${2:-$MASCOT/meditate.png}"  # the art Meshy built the scan from
OUT="$MASCOT/out_sit"
mkdir -p "$OUT/inspect"
step() { echo "== $*"; }
step "front silhouette";   blender -b --factory-startup --python "$HERE/../inspect.py" -- "$SRC" "$OUT/inspect" >/dev/null
step "register reference"; python3 -I "$HERE/../register.py" "$OUT/inspect/front.png" "$REF" "$OUT/register.json" all
step "clean, face, arms, colours"
blender -b --factory-startup --python "$HERE/prep_sit.py" -- "$SRC" "$REF" "$OUT/register.json" "$OUT/prep.blend" \
  | grep -E "hand |face rim|face patch|interior|arms removed|side patch|small holes|labels|cut verts|thin lap|ironed|head smoothed|flipped|pinholes|fabric|speck|saved"
step "sleeves, gloves, face kit, rig, skin"
blender -b "$OUT/prep.blend" --python "$HERE/rig_sit.py" -- "$SRC" "$OUT/rig.blend" | grep -E "^arm |bones:|body:|saved"
step "animate + export"
blender -b "$OUT/rig.blend" --python "$HERE/anim_sit.py" -- "$OUT/mascot_sit.glb" "$OUT/anim.blend" | grep -E "^clip|exported"
step "compress for the web (meshopt: three.js/drei decode it without extra downloads)"
npx --yes @gltf-transform/cli@4 optimize "$OUT/mascot_sit.glb" "$OUT/mascot_sit.opt.glb" \
  --compress meshopt --texture-compress webp --simplify false --instance false --flatten false --join false | tail -1
echo "web copy: cp \"$OUT/mascot_sit.opt.glb\" web/public/mascot-sitting.glb"
