# Artwork

| File | Use | Notes |
|---|---|---|
| `hero-ground.webp` | Landing hero background | Near-black speaker cone. Measured YAVG 20/255, peak 25 — dark enough to carry white text and the cyan caret above it. |
| `operator.webp` | Landing close section | Cat-ear silhouette at a console, single cyan rim light. Measured YAVG 18/255, peak 21. |
| *(moved)* `docs/art-source/` | Source material | The Discord avatar the brand mark was derived from. Not used on the page directly — its three simultaneous accent colours would break the rule that cyan, magenta and violet each carry one meaning. |


Generated artwork. No third-party rights attach to these.

Only the two files above ship. The original PNGs and the unused variants live
in `docs/art-source/`, outside `public/`, because Vite copies everything under
`public/` into the build — the variants were adding 14 MB to a landing page.
Both shipped files are WebP at quality 72; measured luminance is unchanged
from the PNG originals (YAVG 20 and 18, peaks 25 and 21).
