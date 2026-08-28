# Artwork

| File | Use | Notes |
|---|---|---|
| `operator.webp` | Landing close section | Cat-ear silhouette at a console, single cyan rim light. Measured YAVG 18/255, peak 21. |

Generated artwork. No third-party rights attach to this.

## Why there is only one file

The hero used to be a photographic plate (`hero-ground.webp`, a near-black
speaker cone). It has been replaced by `src/landing/HeroField.jsx`, which draws
the avatar's own composition — a thin ring and a symmetric waveform — as
deterministic SVG. Two reasons, in order of weight:

1. It is about this product. The photograph was atmosphere that could have sat
   behind any audio brand; the ring and the waveform are the Discord avatar.
2. It is roughly 4 KB of markup against 21 KB of image, it scales without a
   raster ceiling, and it can move.

`src/landing/SectionRule.jsx` and `src/landing/RingField.jsx` extend the same
vocabulary down the page, so the lower sections are held by drawn geometry
rather than by more image files.

The original PNGs and the unused variants live in `docs/art-source/`, outside
`public/`, because Vite copies everything under `public/` into the build — the
variants were adding 14 MB to a landing page. `operator.webp` is WebP at
quality 72; measured luminance is unchanged from the PNG original (YAVG 18,
peak 21).
