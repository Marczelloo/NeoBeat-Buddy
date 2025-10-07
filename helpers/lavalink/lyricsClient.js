const cheerio = require("cheerio");
const fetch = require("node-fetch");
const Log = require("../logs/log");

const PAREN_CONTENT = /\([^)]*\)|\[[^\]]*\]/g;
const UNWANTED_TAGS =
  /\b(official|audio|video|lyric[s]?|visualizer|mv|hd|4k|explicit|clean|remastered|prod\.?|version)\b/gi;
const MULTISPACE = /\s+/g;
const MULTILINE_BLANKS = /\n{3,}/g;

const normalizeWhitespace = (value = "") => value.replace(MULTISPACE, " ").trim();
const stripAnnotations = (value = "") => normalizeWhitespace(value.replace(PAREN_CONTENT, ""));
const stripUnwantedTags = (value = "") => normalizeWhitespace(value.replace(UNWANTED_TAGS, " "));

function camelToWords(value = "") {
  return normalizeWhitespace(value.replace(/VEVO$/i, "").replace(/([a-z])([A-Z])/g, "$1 $2"));
}

function deriveArtist(trackInfo = {}) {
  const { author = "", title = "" } = trackInfo;
  const fromTitle = title.includes("-") ? title.split("-")[0] : "";
  const cleanedTitleArtist = stripUnwantedTags(stripAnnotations(fromTitle));

  if (cleanedTitleArtist) return cleanedTitleArtist;

  return camelToWords(author);
}

function deriveSongTitle(trackInfo = {}) {
  let { title = "" } = trackInfo;

  if (!title) return "";

  if (title.includes("-")) {
    title = title.split("-").slice(1).join("-");
  }

  return stripUnwantedTags(stripAnnotations(title));
}

function buildSearchTerm(trackInfo = {}) {
  const artist = deriveArtist(trackInfo);
  const songTitle = deriveSongTitle(trackInfo);

  if (artist && songTitle) return `${artist} ${songTitle}`.trim();

  return (artist || songTitle).trim();
}

function pickSongHit(hits, trackInfo) {
  const norm = (val) => (val || "").toLowerCase();
  const targetArtist = norm(deriveArtist(trackInfo));
  const targetTitle = norm(deriveSongTitle(trackInfo) || trackInfo?.title || trackInfo?.identifier);

  return (
    hits.find(({ type, result }) => {
      if (type !== "song" || result.lyrics_state !== "complete") return false;

      const primaryArtist = norm(result.primary_artist?.name);
      const resultTitle = norm(result.title);

      const artistMatch = !targetArtist || primaryArtist.includes(targetArtist) || targetArtist.includes(primaryArtist);

      const titleMatch = !targetTitle || resultTitle.includes(targetTitle) || targetTitle.includes(resultTitle);

      return artistMatch && titleMatch;
    }) || hits.find(({ type }) => type === "song")
  );
}

function extractFormattedLyrics($) {
  const sections = $('[data-lyrics-container="true"]')
    .map((_, el) => {
      const clone = $(el).clone();
      clone.find("br").replaceWith("\n");
      const raw = clone.text();
      const lines = raw
        .split("\n")
        .map((line) => normalizeWhitespace(line))
        .reduce((acc, line) => {
          if (!line) {
            if (acc.length && acc[acc.length - 1] !== "") {
              acc.push("");
            }
            return acc;
          }
          acc.push(line);
          return acc;
        }, []);

      return lines.join("\n").trim();
    })
    .get()
    .filter(Boolean);

  if (sections.length === 0) return null;

  let text = sections.join("\n\n");
  text = text.replace(MULTILINE_BLANKS, "\n\n").trim();

  const firstBracket = text.indexOf("[");
  if (firstBracket > 0) text = text.slice(firstBracket).trim();

  text = text.replace(/^lyrics\s*/i, "").trim();

  return text;
}

async function fetchLyricsFromGenius(searchTerm, trackInfo = {}) {
  const key = process.env.GENIUS_API_KEY;

  if (!key) return null;

  const search = await fetch(`https://api.genius.com/search?q=${encodeURIComponent(searchTerm)}`, {
    headers: { Authorization: `Bearer ${key}` },
  })
    .then((r) => r.json())
    .catch((err) => {
      Log.warning("Genius search failed", "", `query=${searchTerm}`, `error=${err?.message || err}`);
      return null;
    });

  const hit = pickSongHit(search?.response?.hits ?? [], trackInfo);

  if (!hit?.result?.url) return null;

  const html = await fetch(hit.result.url, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
  })
    .then((r) => r.text())
    .catch((err) => {
      Log.warning("Genius lyric page fetch failed", "", `url=${hit.result.url}`, `error=${err?.message || err}`);
      return null;
    });

  if (!html) return null;

  const $ = cheerio.load(html);
  const formatted = extractFormattedLyrics($);

  return formatted || null;
}

async function fetchLyrics(player, trackInfo = {}) {
  const searchTerm = buildSearchTerm(trackInfo);

  if (!searchTerm) {
    Log.warning("Lyrics search skipped", "", `guild=${player?.guildId || "unknown"}`, "reason=missing-metadata");
    return null;
  }

  const lyrics = await fetchLyricsFromGenius(searchTerm, trackInfo);

  if (lyrics) {
    Log.info("Lyrics fetched from Genius", "", `guild=${player.guildId}`, `query=${searchTerm}`);
    return { source: "genius", lyrics, url: null };
  }

  Log.warning("Lyrics not found", "", `guild=${player.guildId}`, `query=${searchTerm}`);

  return null;
}

module.exports = { fetchLyrics };
