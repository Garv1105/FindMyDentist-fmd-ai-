#!/usr/bin/env bash
# The hero's un-rigged seated mascot: the raw Tripo export, lightened for the web.
#   usage: model/blender/tripo/raw/build_raw.sh [TRIS] [TEXTURE_SIZE] [OUT_NAME]
#   desktop (default): 400000 2048 mascot-sitting-raw.glb
#   phones / low-memory devices: 150000 1024 mascot-sitting-raw-mobile.glb
# 61.7 MB / 1.96M tris → web/public/mascot-sitting-raw.glb (~2.5 MB). Bump ?v= in web/src/components/hero/Mascot3D.tsx.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$HERE/../../../.."
SRC="$ROOT/model/mascot/tooth character 3d model sitting.glb"
TRIS="${1:-400000}"
TEX="${2:-2048}"
OUT="$ROOT/web/public/${3:-mascot-sitting-raw.glb}"
# set GT to a local gltf-transform binary to skip npx
GT="${GT:-npx --yes @gltf-transform/cli@4}"
TMP="$(mktemp -d)"
# 1. Blender decimation to 400k tris (keeps the engraved eye/brow lines clean; gltf-transform's simplify speckles them)
blender -b --python "$HERE/decimate_raw.py" -- "$SRC" "$TMP/dec.glb" "$TRIS" | grep -E "^TRIS"
# 2. centre it (the hero expects the model centred on the origin)
$GT center "$TMP/dec.glb" "$TMP/centred.glb" --pivot center | tail -1
# 3. fair the sculpted seam ridge / pit off the head, the face pinned, Tripo's normals kept where nothing moved
blender -b --python "$HERE/fair_head_raw.py" -- "$TMP/centred.glb" "$TMP/fixed.glb" | grep -E "^FAIR|^NORMALS"
# 4. the head as glossy white porcelain: whitened texels, its own clear-coated "Head" material (colour comes from the hero's lights)
blender -b --python "$HERE/head_material_raw.py" -- "$TMP/fixed.glb" "$TMP/head.glb" | grep -E "^HEAD|^WHITENED"
# 5. two forearm bones so the hero can bob the hands (looks identical at rest)
blender -b --python "$HERE/arms_raw.py" -- "$TMP/head.glb" "$TMP/armed.glb" | grep -E "^ARMS"
# 6. meshopt geometry + WebP textures (no further simplification)
NODE_OPTIONS=--max-old-space-size=3072 $GT optimize "$TMP/armed.glb" "$OUT" \
  --compress meshopt --texture-compress webp --texture-size "$TEX" --simplify false --instance false --flatten false --join false | tail -1
rm -rf "$TMP"
