#!/usr/bin/env bash
# Rebuild the rigged, animated standing mascot from the raw Tripo export.
#   usage: model/blender/tripo/build_tripo.sh [tripo.glb]
# Output: model/mascot/out_tripo/mascot_tripo.glb and mascot_tripo.opt.glb (compressed, for the web).
# The decimation is cached in out_tripo/dec.blend (delete it after replacing the source model).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
MASCOT="$HERE/../../mascot"
SRC="${1:-$MASCOT/tooth character 3d model.glb}"
OUT="$MASCOT/out_tripo"
mkdir -p "$OUT"
step() { echo "== $*"; }
step "decimate, flatten the face, cut the mittens, colours"
blender -b --factory-startup --python "$HERE/prep_tripo.py" -- "$SRC" "$OUT" \
  | grep -E "decimated|hand |cap |face |head |twin|colour|clean-up|open edges|white island|saved"
step "gloves, face kit, skeleton, skin"
blender -b "$OUT/prep.blend" --python "$HERE/rig_tripo.py" -- "$OUT" | grep -E "glove|bones:|proxy|sleeve|leg verts|shoe|saved"
step "animate + export"
blender -b "$OUT/rig.blend" --python "$HERE/anim_tripo.py" -- "$OUT/mascot_tripo.glb" "$OUT/anim.blend" \
  | grep -E "^clip|exported"
step "compress for the web (meshopt: three.js/drei decode it without extra downloads)"
npx --yes @gltf-transform/cli@4 optimize "$OUT/mascot_tripo.glb" "$OUT/mascot_tripo.opt.glb" \
  --compress meshopt --texture-compress webp --simplify false --instance false --flatten false --join false | tail -1
echo "web copy: cp \"$OUT/mascot_tripo.opt.glb\" model/wed3D/public/mascot-tripo.glb"
