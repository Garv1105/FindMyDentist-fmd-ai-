#!/usr/bin/env bash
# The FMD AI assistant mascot → web/public/models/assistant.glb: the guide built exactly as build_porcelain.sh builds
# it (same source, subdivision, porcelain head and texture settings), with rig_assistant.py's rig, face shapes and clips
# in place of rig_mascots.py's light rig.   usage: model/blender/mascots/build_assistant.sh
# Phones: DECIMATE=40000 OUT_NAME=assistant-mobile.glb …  (the smoothed surface reduced before the head and rig). GT=<local gltf-transform> skips npx.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$HERE/../../.."
TMP="$(mktemp -d)"
GT="${GT:-npx --yes @gltf-transform/cli@4}"
OUT="$ROOT/web/public/models/${OUT_NAME:-assistant.glb}"
blender -b --python "$HERE/subdivide.py" -- "$ROOT/web/public/models/mascots/guide.glb" "$TMP/sub.glb" | grep -E "^SUBDIV"
if [ -n "${DECIMATE:-}" ]; then
  blender -b --python "$ROOT/model/blender/tripo/raw/decimate_raw.py" -- "$TMP/sub.glb" "$TMP/dec.glb" "$DECIMATE" | grep -E "^TRIS"
  mv "$TMP/dec.glb" "$TMP/sub.glb"
fi
blender -b --python "$ROOT/model/blender/tripo/raw/head_material_raw.py" -- "$TMP/sub.glb" "$TMP/mat.glb" --neck 0.53 \
  --largest --keep-normal --relative-tint --matte-mouth --dark-eyes --single-sided | grep -E "^HEAD|^MOUTH"
blender -b --python "$HERE/rig_assistant.py" -- "$TMP/mat.glb" "$TMP/rig.glb" | grep -E "^RIG|^EYE|^MOUTH|^SHAPE|^EXPORTED"
$GT webp "$TMP/rig.glb" "$TMP/webp.glb" --quality 95 | tail -1
NODE_OPTIONS=--max-old-space-size=3072 $GT optimize "$TMP/webp.glb" "$OUT" \
  --compress meshopt --texture-compress false --texture-size 1024 --simplify false --instance false --flatten false --join false | tail -1
rm -rf "$TMP"
