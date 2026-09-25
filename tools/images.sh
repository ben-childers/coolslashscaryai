#!/usr/bin/env bash
# tools/images.sh — regenerate the web derivatives the artwork gallery serves.
#
# Kam's originals land in assets/ as full-resolution PNGs (4–13 MB each). They
# are the archive; nothing on the site links to them directly. This writes two
# WebP sizes per piece into assets/gallery/ — a 1100px grid tile and a 2000px
# version the lightbox fetches only when someone clicks. Together the whole
# gallery is ~2.8 MB instead of ~47 MB.
#
# Sources are the "source" field of each piece in data/artwork.json, so adding
# artwork means editing that file and re-running this. Needs ImageMagick.
set -euo pipefail
cd "$(dirname "$0")/.."

command -v convert >/dev/null || { echo "ImageMagick 'convert' not found."; exit 1; }
mkdir -p assets/gallery

node -e '
  const a = require("./data/artwork.json");
  a.forEach(c => c.pieces.forEach(p => console.log(p.source + "\t" + p.slug)));
' | while IFS=$'\t' read -r src slug; do
  [ -f "$src" ] || { echo "missing source: $src"; exit 1; }
  convert "$src" -resize '1100x1100>' -strip -quality 82 -define webp:method=6 "assets/gallery/$slug.webp"
  convert "$src" -resize '2000x2000>' -strip -quality 88 -define webp:method=6 "assets/gallery/$slug-full.webp"
  echo "  $slug"
done

# The bio headshot is not a gallery piece, but it is the single largest file in
# the repo (13 MB) shown at 180px. Keep it small too.
convert assets/kam-clark-headshot.png -resize '560x560>' -strip -quality 85 \
  -define webp:method=6 assets/gallery/kam-clark-headshot.webp

echo "Wrote $(ls assets/gallery/*.webp | wc -l | tr -d ' ') files, $(du -sh assets/gallery | cut -f1) total."
