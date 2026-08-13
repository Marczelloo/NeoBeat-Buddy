const assert = require("node:assert");
const { beforeEach, describe, it } = require("node:test");

const { hasReliableSessionVibe, scoreCandidates } = require("../../../helpers/lavalink/candidateScoring");
const { buildSessionProfile } = require("../../../helpers/lavalink/sessionProfile");
const {
  cleanTrackInfo,
  applyCandidateMetadata,
  getAutoplayReference,
  getTransitionQuality,
  partitionRankedCandidates,
  getMetadataFreeYouTubeMixFallbackCandidates,
  resolveMetadataFreeYouTubeMixFallback,
  resolveRankedCandidates,
  selectTagEnrichmentTargets,
  getStableFallbackAnchor,
  createStableAnchorProfile,
  getFallbackOriginAnchor,
  attachFallbackOrigin,
  getRelevantPlayableTrack,
  getProviderValidationIssue,
  resolveToPlayable,
} = require("../../../helpers/lavalink/smartAutoplay");
const { playbackState, pushTrackHistory, resolveEndedTrack } = require("../../../helpers/lavalink/state");

const GUILD_ID = "dj-v2-test";
const noSkips = { skippedArtists: {}, skippedGenres: {} };

function track(title, artist, identifier, options = {}) {
  return {
    track: `encoded-${identifier}`,
    info: { title, author: artist, identifier, length: options.duration || 180000, autoplayed: Boolean(options.autoplay) },
    userData: {
      autoplay: Boolean(options.autoplay),
      genres: options.genres || [],
      features: options.features || null,
      derivedFeatures: options.derivedFeatures || null,
      metadataConfidence: options.metadataConfidence || 0,
      metadataProvider: options.metadataProvider || null,
      metadataSources: options.metadataSources || [],
      releaseYear: options.releaseYear || null,
    },
  };
}

function candidate(title, artist, identifier, options = {}) {
  return {
    title,
    artist,
    identifier,
    duration: 180000,
    source: options.source || "lastfm_similar",
    genres: options.genres || [],
    features: options.features || null,
    derivedFeatures: options.derivedFeatures || null,
    metadataConfidence: options.metadataConfidence || 0,
    metadataProvider: options.metadataProvider || null,
    popularity: options.popularity || 0,
    similarity: options.similarity || 0,
    isFallback: Boolean(options.isFallback),
  };
}

function profile(overrides = {}) {
  return {
    totalTracks: 3,
    artistCounts: {},
    topArtists: [],
    topGenres: [],
    recentIdentifiers: [],
    cooldownTracks: [],
    recentTracks: [],
    recentAutoplayTracks: [],
    lastThreeArtists: [],
    avgDuration: 180000,
    avgTempo: null,
    avgFeatures: null,
    energyTrend: null,
    valenceTrend: null,
    energyTarget: null,
    valenceTarget: null,
    referenceGenres: [],
    referenceGenreFamilies: [],
    referenceFeatures: null,
    referenceMetadataConfidence: 0,
    recentGenreFamilies: [],
    ...overrides,
  };
}

describe("DJ autoplay v2", () => {
  beforeEach(() => playbackState.clear());

  it("keeps manual taste separate from the current autoplay transition", () => {
    const manual = track("Manual pick", "Listener Artist", "manual-rnb", { genres: ["rnb"] });
    const autoplayOne = track("Autoplay one", "Radio Artist", "auto-metal-1", {
      autoplay: true,
      genres: ["metal"],
    });
    const autoplayTwo = track("Autoplay two", "Radio Artist", "auto-metal-2", {
      autoplay: true,
      genres: ["metal"],
    });

    playbackState.set(GUILD_ID, {
      history: [manual, autoplayOne],
      manualHistory: [manual],
      autoplayHistory: [{ track: autoplayOne }],
    });

    const session = buildSessionProfile(GUILD_ID, autoplayTwo);

    assert.deepStrictEqual(session.manualTasteGenres.map(({ genre }) => genre), ["rnb"]);
    assert.deepStrictEqual(session.manualTasteGenreFamilies, ["rnb"]);
    assert.deepStrictEqual(session.referenceGenreFamilies, ["metal"]);
    assert.strictEqual(session.referenceIsAutoplay, true);
    assert.strictEqual(session.autoplayStreak, 2);
  });

  it("hard-rejects a sparse candidate outside the manual taste corridor", () => {
    const [ranked] = scoreCandidates(
      [candidate("Metal detour", "New Artist", "metal-detour", { genres: ["metal"], similarity: 0.95 })],
      profile({
        manualAnchorRecords: [{ track: track("Manual pick", "Listener Artist", "manual-rnb"), type: "played" }],
        manualTasteGenres: [{ genre: "rnb", count: 1, weight: 1 }],
        manualTasteGenreFamilies: ["rnb"],
        referenceGenres: ["metal"],
        referenceGenreFamilies: ["metal"],
        referenceIsAutoplay: true,
        autoplayStreak: 2,
      }),
      noSkips,
      GUILD_ID
    );

    assert.strictEqual(ranked.hardRejected, true);
    assert.strictEqual(ranked.rejectionReason, "manual-anchor-drift");
    assert.ok(ranked.scoringDetails.includes("manualAnchor:-1000(unverified-drift)"));
  });

  it("prevents a low-confidence artist-tag bridge from drifting after the first autoplay step", () => {
    const manual = track("Loser", "Tame Impala", "tame-loser", {
      genres: ["neo-psychedelia", "psychedelic pop", "synth funk"],
      metadataConfidence: 0.68,
      metadataProvider: "lastfm-track",
    });
    const [ranked] = scoreCandidates(
      [candidate("BOY IN RED", "Isaiah Rashad", "isaiah", {
        genres: ["jazz rap", "hiphop", "southern hiphop"],
        similarity: 0.7,
        metadataConfidence: 0.42,
        metadataProvider: "lastfm-artist",
      })],
      profile({
        manualAnchorRecords: [{ track: manual, type: "played", weight: 1 }],
        manualTasteGenres: manual.userData.genres.map((genre) => ({ genre, count: 1, weight: 1 })),
        manualTasteGenreFamilies: ["rock", "pop", "rnb"],
        referenceGenres: ["neo-soul", "funk", "jazz rap"],
        referenceGenreFamilies: ["rnb", "jazz", "hiphop"],
        referenceMetadataConfidence: 0.68,
        referenceMetadataProvider: "lastfm-track",
        referenceIsAutoplay: true,
        autoplayStreak: 1,
      }),
      noSkips,
      GUILD_ID
    );

    assert.strictEqual(ranked.hardRejected, true);
    assert.strictEqual(ranked.manualAnchorEvidence, false);
  });

  it("rebuilds the transition reference around the stable manual anchor", () => {
    const anchor = track("Loser", "Tame Impala", "stable-tame", {
      genres: ["neo-psychedelia", "psychedelic pop"],
      features: { tempo: 120, energy: 0.6 },
      metadataConfidence: 0.68,
      metadataProvider: "lastfm-track",
    });
    const fallback = createStableAnchorProfile(
      profile({
        referenceGenres: ["jazz rap"],
        referenceGenreFamilies: ["hiphop", "jazz"],
        referenceTitleRaw: "BOY IN RED",
        autoplayStreak: 2,
      }),
      anchor
    );

    assert.strictEqual(fallback.referenceTitleRaw, "Loser");
    assert.deepStrictEqual(fallback.referenceGenres, ["neo-psychedelia", "psychedelic pop"]);
    assert.deepStrictEqual(fallback.referenceFeatures, { tempo: 120, energy: 0.6 });
    assert.strictEqual(fallback.referenceMetadataProvider, "lastfm-track");
    assert.strictEqual(fallback.referenceIsManual, true);
  });

  it("does not let an impossible catalog year corrupt the session average", () => {
    const invalid = track("Bad catalog metadata", "Artist", "bad-year", { releaseYear: 1 });
    playbackState.set(GUILD_ID, { history: [], manualHistory: [] });

    const session = buildSessionProfile(GUILD_ID, invalid);
    assert.strictEqual(session.avgYear, null);
  });

  it("defers an artist that already fills the autoplay rolling window", () => {
    const [ranked] = scoreCandidates(
      [candidate("Another good song", "Repeat Artist", "repeat-artist-4", { genres: ["pop"], similarity: 0.8 })],
      profile({
        referenceGenres: ["pop"],
        referenceGenreFamilies: ["pop"],
        referenceIsAutoplay: true,
        recentAutoplayArtists: ["Repeat Artist", "Other Artist", "Repeat Artist", "Third Artist", "Repeat Artist"],
        lastThreeArtists: ["Other Artist", "Third Artist", "Fresh Artist"],
      }),
      noSkips,
      GUILD_ID
    );

    assert.strictEqual(ranked.hardRejected, false);
    assert.strictEqual(ranked.deferred, true);
    assert.strictEqual(ranked.deferredReason, "artist-window-3");
  });

  it("treats Last.fm similarity as a positive signal, not catalog popularity", () => {
    const ranked = scoreCandidates(
      [
        candidate("Close match", "Similar Artist", "similar", { similarity: 0.95 }),
        candidate("Popular but weak", "Other Artist", "popular", { source: "deezer_recommendations", popularity: 80 }),
      ],
      profile(),
      noSkips,
      GUILD_ID
    );

    assert.strictEqual(ranked[0].identifier, "similar");
    assert.ok(ranked[0].scoringDetails.some((detail) => detail.startsWith("similarity:+")));
    assert.ok(!ranked[0].scoringDetails.some((detail) => detail.includes("overplayed")));
  });

  it("rejects an unqualified fallback when the room already has a genre anchor", () => {
    const [ranked] = scoreCandidates(
      [candidate("Unknown fallback", "Unknown uploader", "unsafe", { source: "youtube_search", isFallback: true })],
      profile({ referenceGenres: ["hip hop"], referenceGenreFamilies: ["hiphop"] }),
      noSkips,
      GUILD_ID
    );

    assert.strictEqual(ranked.hardRejected, true);
    assert.strictEqual(ranked.rejectionReason, "fallback-without-vibe-signal");
  });

  it("rejects an unverified provider candidate when a trusted genre anchor exists", () => {
    const [ranked] = scoreCandidates(
      [candidate("Random provider pick", "Unknown uploader", "unverified", { source: "deezer_recommendations" })],
      profile({ referenceGenres: ["rnb"], referenceGenreFamilies: ["rnb"] }),
      noSkips,
      GUILD_ID
    );

    assert.strictEqual(ranked.hardRejected, true);
    assert.strictEqual(ranked.rejectionReason, "unverified-provider-candidate");
  });

  it("rejects an unverified provider candidate even when the reference has no genre tags", () => {
    const [ranked] = scoreCandidates(
      [candidate("Random provider pick", "Unknown uploader", "untagged-provider", { source: "deezer_recommendations" })],
      profile(),
      noSkips,
      GUILD_ID
    );

    assert.strictEqual(ranked.hardRejected, true);
    assert.strictEqual(ranked.rejectionReason, "unverified-provider-candidate");
  });

  it("uses direct YouTube Mix tracks only for a completely metadata-free room", () => {
    const directMix = candidate("Obscure meme follow-up", "Meme Uploader", "mix-direct", { source: "youtube_mix" });
    directMix.track = track("Obscure meme follow-up", "Meme Uploader", "mix-direct");
    const providerResult = candidate("Unverified provider", "Other uploader", "provider", { source: "deezer_recommendations" });
    const ranked = scoreCandidates([directMix, providerResult], profile(), noSkips, GUILD_ID);

    assert.deepStrictEqual(
      getMetadataFreeYouTubeMixFallbackCandidates(ranked, profile()).map((item) => item.identifier),
      ["mix-direct"]
    );
  });

  it("keeps a direct YouTube Mix fallback when catalog candidates fail in an anchored session", () => {
    const directMix = candidate("Unknown Mix result", "Unknown uploader", "mix-anchor", { source: "youtube_mix" });
    directMix.track = track("Unknown Mix result", "Unknown uploader", "mix-anchor");
    const anchoredProfile = profile({ referenceGenres: ["hip hop"], referenceGenreFamilies: ["hiphop"] });
    const ranked = scoreCandidates([directMix], anchoredProfile, noSkips, GUILD_ID);

    assert.deepStrictEqual(
      getMetadataFreeYouTubeMixFallbackCandidates(ranked, anchoredProfile).map((item) => item.identifier),
      ["mix-anchor"]
    );
  });

  it("does not let the direct Mix fallback cross a known incompatible genre family", () => {
    const directMix = candidate("Metal detour", "Unknown uploader", "mix-metal", {
      source: "youtube_mix",
      genres: ["death metal"],
      metadataConfidence: 0.42,
      metadataProvider: "lastfm-artist",
    });
    directMix.track = track("Metal detour", "Unknown uploader", "mix-metal");
    const anchoredProfile = profile({
      referenceGenres: ["hip hop"],
      referenceGenreFamilies: ["hiphop"],
      manualTasteGenreFamilies: ["hiphop"],
    });
    const ranked = scoreCandidates([directMix], anchoredProfile, noSkips, GUILD_ID);

    assert.deepStrictEqual(getMetadataFreeYouTubeMixFallbackCandidates(ranked, anchoredProfile), []);
  });

  it("resolves a direct metadata-free YouTube Mix candidate without broad search", async () => {
    const directMix = candidate("Rare meme follow-up", "Meme Uploader", "mix-playable", { source: "youtube_mix" });
    directMix.track = track("Rare meme follow-up", "Meme Uploader", "mix-playable");

    const selected = await resolveMetadataFreeYouTubeMixFallback([directMix], profile(), noSkips, GUILD_ID);

    assert.strictEqual(selected.info.identifier, "mix-playable");
  });

  it("does not let metadata-free YouTube Mix bypass duplicate, variant, or artist-streak guards", () => {
    const duplicate = candidate("Already played", "Meme Artist", "mix-duplicate", { source: "youtube_mix" });
    duplicate.track = track("Already played", "Meme Artist", "mix-duplicate");
    const alternate = candidate("Obscure meme (Nightcore)", "Meme Artist", "mix-nightcore", { source: "youtube_mix" });
    alternate.track = track("Obscure meme (Nightcore)", "Meme Artist", "mix-nightcore");
    const deferred = candidate("Third in a row", "Meme Artist", "mix-deferred", { source: "youtube_mix" });
    deferred.track = track("Third in a row", "Meme Artist", "mix-deferred");

    const ranked = scoreCandidates(
      [duplicate, alternate, deferred],
      profile({
        recentIdentifiers: ["mix-duplicate"],
        lastThreeArtists: ["Other Artist", "Meme Artist", "Meme Artist"],
      }),
      noSkips,
      GUILD_ID
    );

    assert.deepStrictEqual(getMetadataFreeYouTubeMixFallbackCandidates(ranked, profile()).map((item) => item.identifier), []);
  });

  it("keeps an anchorless metadata-free Mix lane alive after the drift guard starts", () => {
    const mix = candidate("Rare follow-up", "Meme Uploader", "mix-continuation", { source: "youtube_mix" });
    mix.track = track("Rare follow-up", "Meme Uploader", "mix-continuation");
    const anchor = track("Obscure original", "Obscure Artist", "obscure-origin");
    const session = profile({
      autoplayStreak: 3,
      manualAnchorRecords: [{ track: anchor, type: "played" }],
      manualTasteGenres: [],
      manualTasteGenreFamilies: [],
    });

    const ranked = scoreCandidates([mix], session, noSkips, GUILD_ID);

    assert.strictEqual(ranked[0].hardRejected, false);
    assert.strictEqual(ranked[0].fallbackOnly, true);
    assert.deepStrictEqual(getMetadataFreeYouTubeMixFallbackCandidates(ranked, session).map((item) => item.identifier), ["mix-continuation"]);
  });

  it("allows a trusted consecutive same-artist continuation with a soft penalty", () => {
    const [ranked] = scoreCandidates(
      [candidate("Different song", "Same Artist", "same-artist-next", { similarity: 0.95 })],
      profile({ lastThreeArtists: ["Other Artist", "Another Artist", "Same Artist - Topic"] }),
      noSkips,
      GUILD_ID
    );

    assert.ok(ranked.scoringDetails.includes("diversity:-10(consecutive-trusted)"));
    assert.strictEqual(ranked.hardRejected, false);
  });

  it("defers a third consecutive artist when a safe alternative exists", () => {
    const ranked = scoreCandidates(
      [
        candidate("Third in a row", "Same Artist", "same-artist-third", { similarity: 0.95 }),
        candidate("Safe detour", "Different Artist", "different-artist", { similarity: 0.8 }),
      ],
      profile({ lastThreeArtists: ["Other Artist", "Same Artist", "Same Artist"] }),
      noSkips,
      GUILD_ID
    );

    const thirdTrack = ranked.find((item) => item.identifier === "same-artist-third");
    const pools = partitionRankedCandidates(ranked);
    assert.strictEqual(thirdTrack.deferred, true);
    assert.strictEqual(thirdTrack.deferredReason, "artist-streak-3");
    assert.ok(thirdTrack.scoringDetails.includes("diversity:defer(artist-streak-3)"));
    assert.ok(pools.safe.some((item) => item.identifier === "different-artist"));
    assert.ok(pools.deferred.some((item) => item.identifier === "same-artist-third"));
  });

  it("selects a safe candidate before a higher-scoring deferred artist streak", async () => {
    const deferred = candidate("Third in a row", "Same Artist", "same-artist-third");
    deferred.track = track("Third in a row", "Same Artist", "same-artist-third");
    deferred.score = 999;
    deferred.deferred = true;
    deferred.deferredReason = "artist-streak-3";

    const safe = candidate("Safe detour", "Different Artist", "different-artist");
    safe.track = track("Safe detour", "Different Artist", "different-artist");
    safe.score = 10;

    const selected = await resolveRankedCandidates([deferred, safe], GUILD_ID, "test");
    assert.strictEqual(selected.info.identifier, "different-artist");

    const emergency = await resolveRankedCandidates([deferred], GUILD_ID, "test", { deferredOnly: true });
    assert.strictEqual(emergency.info.identifier, "same-artist-third");
  });

  it("canonicalizes noisy YouTube metadata before asking Last.fm", () => {
    assert.deepStrictEqual(
      cleanTrackInfo("The Weeknd - Save Your Tears (Official Music Video)", "TheWeekndVEVO"),
      { cleanTitle: "Save Your Tears", searchArtist: "The Weeknd" }
    );
  });

  it("uses the title prefix when YouTube reports a known uploader channel instead of the artist", () => {
    assert.deepStrictEqual(
      cleanTrackInfo("Quebonafide - BUBBLETEA (CLEAN)", "Clean Songs PL"),
      { cleanTitle: "BUBBLETEA", searchArtist: "Quebonafide" }
    );
  });

  it("does not resolve a base autoplay candidate to an acoustic provider result", () => {
    const selected = getRelevantPlayableTrack(
      [
        track("Pink Pony Club (Acoustic)", "Chappell Roan", "acoustic"),
        track("Pink Pony Club", "Chappell Roan", "original"),
      ],
      "Chappell Roan Pink Pony Club"
    );

    assert.strictEqual(selected.info.identifier, "original");
  });

  it("rejects a direct provider track when it unexpectedly resolves to an alternate version", async () => {
    const selected = await resolveToPlayable(
      {
        ...candidate("Pink Pony Club", "Chappell Roan", "expected-original"),
        track: track("Pink Pony Club (Acoustic)", "Chappell Roan", "provider-acoustic"),
      },
      GUILD_ID
    );

    assert.strictEqual(selected, null);
  });

  it("rejects an automatic candidate that is itself an alternate version", async () => {
    const selected = await resolveToPlayable(
      {
        ...candidate("Pink Pony Club (Acoustic)", "Chappell Roan", "acoustic-candidate"),
        track: track("Pink Pony Club (Acoustic)", "Chappell Roan", "provider-acoustic"),
      },
      GUILD_ID
    );

    assert.strictEqual(selected, null);
  });

  it("caps genre influence so repeated raw tags cannot beat stronger similarity", () => {
    const ranked = scoreCandidates(
      [
        candidate("Many tags", "Genre Artist", "tag-heavy", {
          genres: ["pop", "pop", "synth pop", "electropop", "2020s", "favorite"],
          similarity: 0.2,
        }),
        candidate("Direct match", "Similar Artist", "similar", {
          genres: ["pop"],
          similarity: 0.9,
        }),
      ],
      profile({ topGenres: [{ genre: "pop", count: 5, weight: 1 }] }),
      noSkips,
      GUILD_ID
    );

    const tagHeavy = ranked.find((item) => item.identifier === "tag-heavy");
    assert.ok(tagHeavy.scoringDetails.some((detail) => detail.includes("genre:+") && detail.includes("capped")));
    assert.strictEqual(ranked[0].identifier, "similar");
  });

  it("does not let a generic genre tag outweigh a much stronger similarity signal", () => {
    const ranked = scoreCandidates(
      [
        candidate("Weak pop match", "Genre Artist", "weak-pop", { genres: ["pop"], similarity: 0.1 }),
        candidate("Strong related match", "Similar Artist", "strong-related", { similarity: 0.9 }),
      ],
      profile({ topGenres: [{ genre: "pop", count: 5, weight: 1 }], referenceGenres: ["pop"], referenceGenreFamilies: ["pop"] }),
      noSkips,
      GUILD_ID
    );

    assert.strictEqual(ranked[0].identifier, "strong-related");
  });

  it("removes ChoppedNotSlopped metadata before asking Last.fm", () => {
    assert.deepStrictEqual(
      cleanTrackInfo("Metro Boomin - Around Me (feat. Don Toliver) [ChoppedNotSlopped] (Official Audio)", "Metro Boomin"),
      { cleanTitle: "Around Me (feat. Don Toliver)", searchArtist: "Metro Boomin" }
    );
  });

  it("keeps the canonical candidate identity for the following autoplay cycle", () => {
    const resolved = track("Around Me (feat. Don Toliver) [ChoppedNotSlopped]", "Metro Boomin - Topic", "around-me");
    applyCandidateMetadata(resolved, candidate("Around Me (feat. Don Toliver)", "Metro Boomin", "around-me", { genres: ["hip hop"] }));

    assert.deepStrictEqual(getAutoplayReference(resolved), {
      cleanTitle: "Around Me (feat. Don Toliver)",
      searchArtist: "Metro Boomin",
    });
    assert.deepStrictEqual(resolved.userData.autoplayReference, {
      title: "Around Me (feat. Don Toliver)",
      artist: "Metro Boomin",
    });
  });

  it("balances Last.fm tag lookups across recommendation providers", () => {
    const targets = selectTagEnrichmentTargets(
      [
        candidate("Deezer 1", "Deezer Artist 1", "dz-1", { source: "deezer_recommendations" }),
        candidate("Deezer 2", "Deezer Artist 2", "dz-2", { source: "deezer_recommendations" }),
        candidate("Mix 1", "Mix Artist 1", "mix-1", { source: "youtube_mix" }),
        candidate("Mix 2", "Mix Artist 2", "mix-2", { source: "youtube_mix" }),
      ],
      2
    );

    assert.deepStrictEqual(
      targets.map((item) => item.source),
      ["deezer_recommendations", "youtube_mix"]
    );
  });

  it("finds one prior stable anchor without reusing the failed reference", () => {
    const stable = track("Escape From LA", "The Weeknd", "escape", { genres: ["synthpop"] });
    applyCandidateMetadata(stable, candidate("Escape From LA", "The Weeknd", "escape", { genres: ["synthpop"] }));
    const failedReference = track("Around Me [ChoppedNotSlopped]", "Metro Boomin - Topic", "around", { genres: ["hip hop"] });
    applyCandidateMetadata(
      failedReference,
      candidate("Around Me", "Metro Boomin", "around", { genres: ["hip hop"] })
    );

    const fallback = getStableFallbackAnchor(
      { recentTracks: [stable, failedReference], topGenres: [{ genre: "synthpop", count: 2 }] },
      failedReference
    );
    assert.strictEqual(fallback, stable);
  });

  it("does not treat a lone BPM reading as a stable session vibe anchor", () => {
    const sparseManual = track("Manual but sparse", "Listener", "manual-sparse", {
      features: { tempo: 122 },
      metadataConfidence: 0.45,
    });
    const failedReference = track("Unknown autoplay", "Uploader", "failed-auto", { autoplay: true });
    const session = profile({
      recentTracks: [sparseManual, failedReference],
      referenceFeatures: { tempo: 122 },
      referenceMetadataConfidence: 0.45,
    });

    assert.strictEqual(hasReliableSessionVibe(session), false);
    assert.strictEqual(getStableFallbackAnchor(session, failedReference), null);
  });

  it("does not reuse an autoplay track as a catalog fallback anchor", () => {
    const manual = track("Manual source", "Listener", "manual-source", { genres: ["synthpop"] });
    const previousAutoplay = track("Unverified continuation", "Radio", "auto-previous", {
      autoplay: true,
      genres: ["synthpop"],
    });
    const failedReference = track("Failed continuation", "Radio", "auto-failed", { autoplay: true });
    const session = profile({
      recentTracks: [manual, previousAutoplay, failedReference],
      referenceGenres: ["synthpop"],
      referenceGenreFamilies: ["electronic", "pop"],
    });

    assert.strictEqual(getStableFallbackAnchor(session, failedReference), manual);
  });

  it("does not classify a lone BPM match as a high-quality transition", () => {
    const quality = getTransitionQuality(
      candidate("Tempo coincidence", "Different Artist", "tempo-only", {
        features: { tempo: 120 },
      }),
      profile({
        referenceFeatures: { tempo: 121 },
        referenceMetadataConfidence: 0.45,
      })
    );
    assert.ok(quality < 6);
  });

  it("hard-rejects a genre jump even when a fallback is popular", () => {
    const [ranked] = scoreCandidates(
      [candidate("Heavy detour", "Metal Artist", "metal", { source: "deezer_recommendations", genres: ["metalcore"], popularity: 80 })],
      profile({
        referenceGenres: ["trap"],
        referenceGenreFamilies: ["hiphop"],
        topGenres: [{ genre: "trap", count: 3, weight: 1 }],
      }),
      noSkips,
      GUILD_ID
    );

    assert.strictEqual(ranked.hardRejected, true);
    assert.strictEqual(ranked.rejectionReason, "incompatible-genre-family");
  });

  it("keeps a manual genre anchor when autoplay tracks start to drift", () => {
    const manual = track("Manual rap", "Listener", "manual", { genres: ["hip hop"] });
    const firstAuto = track("Auto metal 1", "Bot", "auto-1", { autoplay: true, genres: ["metal"] });
    const secondAuto = track("Auto metal 2", "Bot", "auto-2", { autoplay: true, genres: ["metal"] });
    playbackState.set(GUILD_ID, { history: [manual, firstAuto, secondAuto], autoplayHistory: [] });

    const session = buildSessionProfile(GUILD_ID, manual);
    assert.strictEqual(session.topGenres[0].genre, "hiphop");
  });

  it("remembers manual tracks and pending manual queue items as autoplay anchors", () => {
    const manual = track("Manual rap", "Listener", "manual-anchor", { genres: ["hip hop"] });
    const currentAutoplay = track("Autoplay rap", "Radio Artist", "auto-current", {
      autoplay: true,
      genres: ["hip hop"],
    });
    const queuedManual = track("Queued pop", "Listener", "manual-queued", { genres: ["pop"] });
    playbackState.set(GUILD_ID, { history: [manual], manualHistory: [manual], autoplayHistory: [] });

    const session = buildSessionProfile(GUILD_ID, currentAutoplay, { pendingManualTracks: [queuedManual] });

    assert.strictEqual(session.autoplayStreak, 1);
    assert.strictEqual(session.pendingManualTracks[0].info.identifier, "manual-queued");
    assert.strictEqual(session.manualAnchorRecords[0].type, "queued");
    assert.ok(session.manualAnchorGenreFamilies.includes("hiphop"));
  });

  it("rejects a candidate that contradicts the upcoming manual queue", () => {
    const manual = track("Manual rap", "Listener", "manual-queue-anchor", { genres: ["hip hop"] });
    const currentAutoplay = track("Autoplay rap", "Radio Artist", "auto-queue-current", {
      autoplay: true,
      genres: ["hip hop"],
    });
    const queuedManual = track("Queued rap", "Listener", "manual-queue-next", { genres: ["hip hop"] });
    playbackState.set(GUILD_ID, { history: [manual], manualHistory: [manual], autoplayHistory: [] });
    const session = buildSessionProfile(GUILD_ID, currentAutoplay, { pendingManualTracks: [queuedManual] });

    const [ranked] = scoreCandidates(
      [candidate("Metal detour", "Metal Artist", "metal-detour", { genres: ["metal"], similarity: 0.9 })],
      session,
      noSkips,
      GUILD_ID
    );

    assert.strictEqual(ranked.hardRejected, true);
    assert.strictEqual(ranked.rejectionReason, "queued-manual-vibe-mismatch");
  });

  it("rejects a provider mirror or mashup that changes the resolved artist lane", () => {
    const issue = getProviderValidationIssue(
      candidate("Ej, mała!", "club2020", "club-candidate"),
      track("club2020 - Ej, mała! ale to Usher - Yeah!", "grabovski", "club-mashup")
    );

    assert.strictEqual(issue, "unexpected-mashup-or-edit");
  });

  it("blocks a provider variant of a track that appeared much earlier in the session", () => {
    const oldTrack = track("Hit Em Up", "2Pac", "youtube-old", { genres: ["hip hop"] });
    const filler = Array.from({ length: 55 }, (_, index) => track(`Song ${index}`, `Artist ${index}`, `id-${index}`));
    playbackState.set(GUILD_ID, { history: [oldTrack, ...filler], autoplayHistory: [] });

    const session = buildSessionProfile(GUILD_ID, track("Reference", "Another Artist", "reference"));
    const [ranked] = scoreCandidates(
      [candidate("Hit 'Em Up (Official Audio)", "2Pac - Topic", "soundcloud-new", { source: "lastfm_similar", similarity: 0.99 })],
      session,
      noSkips,
      GUILD_ID
    );

    assert.strictEqual(ranked.hardRejected, true);
    assert.ok(ranked.scoringDetails.includes("duplicate:-1000(title)"));
  });

  it("blocks Save Your Tears from Deezer after Poru loses the YouTube trackEnd argument", () => {
    const youtubeOriginal = track("Save Your Tears", "The Weeknd - Topic", "youtube-save", {
      genres: ["synthpop", "pop"],
    });
    playbackState.set(GUILD_ID, { history: [], autoplayHistory: [], currentTrack: youtubeOriginal });

    const stateAtTrackEnd = playbackState.get(GUILD_ID);
    pushTrackHistory(GUILD_ID, resolveEndedTrack(null, stateAtTrackEnd.currentTrack));

    const firstAutoplay = track("In Your Eyes", "The Weeknd", "youtube-in-your-eyes", {
      autoplay: true,
      genres: ["synthpop", "pop"],
    });
    const session = buildSessionProfile(GUILD_ID, firstAutoplay);
    const [ranked] = scoreCandidates(
      [
        candidate("Save Your Tears", "The Weeknd", "deezer-save", {
          source: "deezer_recommendations",
          genres: ["synthpop", "pop"],
        }),
      ],
      session,
      noSkips,
      GUILD_ID
    );

    assert.strictEqual(ranked.hardRejected, true);
    assert.strictEqual(ranked.rejectionReason, "recent-duplicate");
    assert.ok(ranked.scoringDetails.includes("duplicate:-1000(title)"));
  });

  it("rejects a verified large BPM jump even inside one specific genre lane", () => {
    const [ranked] = scoreCandidates(
      [
        candidate("Far tempo detour", "Synth Artist", "tempo-detour", {
          genres: ["synthpop"],
          features: { tempo: 160, energy: 0.65, valence: 0.55 },
          metadataConfidence: 1,
          metadataProvider: "spotify",
          similarity: 0.9,
        }),
      ],
      profile({
        referenceGenres: ["synthpop"],
        referenceGenreFamilies: ["electronic", "pop"],
        referenceFeatures: { tempo: 105, energy: 0.62, valence: 0.57 },
        referenceMetadataConfidence: 1,
      }),
      noSkips,
      GUILD_ID
    );

    assert.strictEqual(ranked.hardRejected, true);
    assert.strictEqual(ranked.rejectionReason, "transition-corridor");
    assert.ok(ranked.scoringDetails.some((detail) => detail.startsWith("corridor:-1000(tempo:")));
  });

  it("rejects a verified energy cliff while preserving the genre lane", () => {
    const [ranked] = scoreCandidates(
      [
        candidate("Energy cliff", "Synth Artist", "energy-detour", {
          genres: ["synthpop"],
          features: { tempo: 112, energy: 0.1, valence: 0.56 },
          metadataConfidence: 1,
          metadataProvider: "spotify",
          similarity: 0.9,
        }),
      ],
      profile({
        referenceGenres: ["synthpop"],
        referenceGenreFamilies: ["electronic", "pop"],
        referenceFeatures: { tempo: 110, energy: 0.7, valence: 0.58 },
        referenceMetadataConfidence: 1,
      }),
      noSkips,
      GUILD_ID
    );

    assert.strictEqual(ranked.hardRejected, true);
    assert.strictEqual(ranked.rejectionReason, "transition-corridor");
    assert.ok(ranked.scoringDetails.some((detail) => detail.includes("energy:")));
  });

  it("does not leave a known specific genre lane on one broad-family signal alone", () => {
    const [ranked] = scoreCandidates(
      [
        candidate("Indie detour", "Indie Artist", "specific-lane-detour", {
          genres: ["indie rock", "pop"],
          features: { tempo: 111 },
          metadataConfidence: 0.45,
          metadataProvider: "deezer",
          similarity: 0.9,
        }),
      ],
      profile({
        referenceGenres: ["synthpop", "pop"],
        referenceGenreFamilies: ["electronic", "pop"],
        referenceFeatures: { tempo: 110, energy: 0.62, valence: 0.55 },
        referenceMetadataConfidence: 1,
      }),
      noSkips,
      GUILD_ID
    );

    assert.strictEqual(ranked.hardRejected, true);
    assert.strictEqual(ranked.rejectionReason, "transition-corridor");
    assert.ok(ranked.scoringDetails.includes("corridor:-1000(specific-genre-floor)"));
  });

  it("rewards a specific genre bridge over an equally similar broad family match", () => {
    const ranked = scoreCandidates(
      [
        candidate("Specific bridge", "Synth Artist", "specific", {
          genres: ["synthpop"],
          features: { tempo: 110, energy: 0.62, valence: 0.55 },
          metadataConfidence: 1,
          metadataProvider: "spotify",
          similarity: 0.72,
        }),
        candidate("Broad bridge", "Electronic Artist", "broad", {
          genres: ["electronic"],
          features: { tempo: 110, energy: 0.62, valence: 0.55 },
          metadataConfidence: 1,
          metadataProvider: "spotify",
          similarity: 0.72,
        }),
      ],
      profile({
        referenceGenres: ["synthpop", "electronic"],
        referenceGenreFamilies: ["electronic", "pop"],
        referenceFeatures: { tempo: 110, energy: 0.62, valence: 0.55 },
        referenceMetadataConfidence: 1,
      }),
      noSkips,
      GUILD_ID
    );

    assert.strictEqual(ranked[0].identifier, "specific");
    assert.ok(ranked[0].scoringDetails.includes("transition:specific-bridge"));
  });

  it("keeps the original fallback anchor across repeated metadata-free Mix selections", () => {
    const anchor = track("Rare Meme", "Original Artist", "origin", { genres: [] });
    const firstMix = attachFallbackOrigin(track("Mix follow-up", "Uploader", "mix-one"), anchor);
    const secondMix = attachFallbackOrigin(track("Another Mix follow-up", "Uploader", "mix-two"), getFallbackOriginAnchor(firstMix));

    assert.deepStrictEqual(getFallbackOriginAnchor(secondMix).info, getFallbackOriginAnchor(firstMix).info);
    assert.strictEqual(getFallbackOriginAnchor(secondMix).info.identifier, "origin");
  });
});
