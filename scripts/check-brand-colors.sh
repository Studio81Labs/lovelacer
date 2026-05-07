#!/usr/bin/env bash
#
# Lock packages/web/src to the four-ramp BRAND.md palette
# (amber + stone + forest + danger). Fails the build if any
# Tailwind built-in palette name leaks back in.
#
# To allow a one-off out-of-brand colour, add a per-line
# "<!-- brand: allow <reason> -->" HTML comment and refine
# this script to skip flagged lines. Strict by default.
#
set -euo pipefail

# Guard: if the search root disappears (refactor / restructure), fail loudly.
# A silent pass would let the brand-sweep slowly drift back to defaults
# unnoticed.
if [ ! -d packages/web/src ]; then
  echo "ERROR: packages/web/src not found — script needs updating." >&2
  exit 2
fi

PATTERN='(bg|text|border|ring|focus|hover|from|to|via|fill|stroke):?-?(focus:|hover:)?(bg|text|border|ring|from|to|via|fill|stroke)?-(brand|red|blue|green|gray|yellow|orange|pink|purple|indigo|teal|cyan|sky|emerald|rose|fuchsia|violet|lime|neutral|slate|zinc)-[0-9/]+'

if grep -rE "${PATTERN}" packages/web/src --include="*.vue" --include="*.ts"; then
  echo
  echo "ERROR: out-of-brand Tailwind color classes detected above."
  echo "P2-8 locked the palette to amber / stone / forest / danger only."
  echo "See docs/BRAND.md for the rules."
  echo
  echo "If you genuinely need an out-of-brand colour, add a per-line"
  echo "'<!-- brand: allow <reason> -->' comment and update this script"
  echo "to skip flagged lines."
  exit 1
fi

echo "brand-color check passed."
