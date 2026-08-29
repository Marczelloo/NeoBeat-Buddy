<!-- Split out of README.md. -->

[← Back to the README](../README.md)

# Music, queue, and autoplay

## Search behavior

`/play` and Activity search accept normal queries and direct URLs. Direct URLs stay with their provider whenever Lavalink can resolve them. In automatic mode, MewBit prefers the configured default source (YouTube by default) and uses other enabled providers only when necessary.

The autocomplete UI is intentionally a fast suggestion layer. The final `/play` resolver performs a full provider search, so a submitted plain-text query may resolve to a better result than a stale or incomplete suggestion. Result cards and choices display the provider so users can choose deliberately.

Examples:

```text
/play query:Hit Em Up source:youtube
/play query:https://soundcloud.com/artist/track
/play query:https://open.spotify.com/track/...
/play query:artist - song prepend:true
```

## Queue order

The queue has two logical regions:

1. Tracks added by users, in their intended order.
2. Tracks prefetched by autoplay.

`Play now` starts or prepends according to the chosen action. `Add to queue` is appended after manual tracks and before autoplay tracks. This prevents autoplay from jumping ahead of a user's planned music without discarding the prepared transition.

## Autoplay behavior

Autoplay is designed to act like a conservative DJ rather than a random recommender:

- It reads the current track and recent listening window.
- It finds candidates from Last.fm, Deezer, available provider data, and (when explicitly enabled) Spotify.
- It normalizes titles and artists before checking history, so the same song from another provider, a reupload, a remaster tag, or a small punctuation difference is not treated as a new recommendation.
- When resolving a recommendation to playable audio, it verifies that the provider result still matches the canonical artist/title; a provider failure or unrelated result does not silently become the next song.
- It prefers compatible genre/vibe/tempo/energy signals and penalizes abrupt family changes. When Spotify audio features are unavailable, it uses Deezer's public catalog metadata as an additional tempo/loudness anchor and lowers confidence for candidates whose audio profile could not be verified.
- It uses a narrow exploration pool (four candidates within six score points by default) and a transition-quality gate, so variety cannot select a materially weaker song unless it has a clearly better tempo/mood bridge.
- YouTube channel suffixes such as `Vevo`, `Topic`, and `Official Artist Channel` are normalized before artist history and cooldown checks. Noisy Last.fm listener sentences, radio names, playlist fragments, and year tags are excluded from genre anchors.
- If only Deezer BPM/gain and genre cues are available, MewBit creates low-confidence catalog-derived energy/mood hints for tie-breaking. These are not treated as measured audio features; true waveform analysis still requires fetching/decoding the audio and is intentionally not part of the normal autoplay request path.
- It limits artist streaks, but does not ban a fitting artist permanently.
- It keeps manual listening history separate from autoplay history, treats manual tracks as the strongest taste signal, and inspects the next manual queue items before prefetching a recommendation.
- It keeps a separate manual taste fingerprint so autoplay recommendations cannot gradually rewrite the room's genre profile.
- After a configurable autoplay streak, it enforces a manual-anchor corridor and refuses candidates that contradict the queued/user-selected vibe; low-confidence drift candidates cannot enter the emergency same-artist lane.
- When a higher-quality transition exists, low-quality transitions are deferred; automatic artists are also limited within a rolling window while still remaining available as an emergency fallback.
- Provider results are validated again after resolution so an unrelated uploader, mashup, or unexpected edit does not masquerade as the requested recommendation.
- It preserves an already-good autoplay candidate rather than replacing it each time state updates.
- Derived Deezer catalog hints are included in the scorer as low-confidence continuity signals, not just logged metadata. Sparse active/manual anchors are enriched through a single cached community-metadata layer: Last.fm track/album/artist tags first, MusicBrainz verification second, and TheAudioDB only as a final genre/mood backfill. The scorer never treats a lone BPM/gain value as a reliable vibe anchor.
- If no metadata-backed candidate exists, MewBit only retries from a compatible, user-selected anchor with meaningful genre or multi-feature evidence. It never cascades through unverified autoplay fallbacks; a direct YouTube Mix result is the constrained last resort and must pass `AUTOPLAY_MIX_FALLBACK_MIN_SCORE`.

Spotify autoplay is optional (`USE_SPOTIFY_AUTOPLAY=false` by default). Spotify audio-features access is restricted for many Development Mode apps, so MewBit does not depend on it: Spotify metadata is opportunistic, while Last.fm, Deezer catalog metadata, provider-native signals, and the confidence-aware scorer remain usable without a higher Spotify tier.
