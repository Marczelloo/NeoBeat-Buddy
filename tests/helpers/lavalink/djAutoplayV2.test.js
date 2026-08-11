const assert = require("node:assert");
const { beforeEach, describe, it } = require("node:test");

const { scoreCandidates } = require("../../../helpers/lavalink/candidateScoring");
const { buildSessionProfile } = require("../../../helpers/lavalink/sessionProfile");
const {
  cleanTrackInfo,
  applyCandidateMetadata,
  getAutoplayReference,
  partitionRankedCandidates,
  getMetadataFreeYouTubeMixFallbackCandidates,
  resolveMetadataFreeYouTubeMixFallback,
  resolveRankedCandidates,
  selectTagEnrichmentTargets,
  getStableFallbackAnchor,
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
    referenceGenres: [],
    referenceGenreFamilies: [],
    referenceFeatures: null,
    recentGenreFamilies: [],
    ...overrides,
  };
}

describe("DJ autoplay v2", () => {
  beforeEach(() => playbackState.clear());

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

  it("does not use the metadata-free YouTube Mix fallback when the session has a vibe anchor", () => {
    const directMix = candidate("Unknown Mix result", "Unknown uploader", "mix-anchor", { source: "youtube_mix" });
    directMix.track = track("Unknown Mix result", "Unknown uploader", "mix-anchor");
    const ranked = scoreCandidates([directMix], profile(), noSkips, GUILD_ID);

    assert.deepStrictEqual(
      getMetadataFreeYouTubeMixFallbackCandidates(
        ranked,
        profile({ referenceGenres: ["hip hop"], referenceGenreFamilies: ["hiphop"] })
      ),
      []
    );
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
});
