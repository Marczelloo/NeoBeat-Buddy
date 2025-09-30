const { lyricsEmbed } = require("../embeds");

const MAX_EMBED_DESCRIPTION = 1900;
const MAX_EMBEDS = 10;

function chunkLyrics(text, chunkSize = MAX_EMBED_DESCRIPTION) 
{
  if (!text) return [];

  const lines = text.split("\n");
  const chunks = [];
  let current = "";

  const flush = () => {
    if (current) {
      chunks.push(current);
      current = "";
    }
  };

  for (const rawLine of lines) 
  {
    const line = rawLine.trimEnd();
    const candidate = current ? `${current}\n${line}` : line;

    if (candidate.length <= chunkSize) 
    {
      current = candidate;
      continue;
    }

    flush();

    if (!line) 
    {
      continue;
    }

    if (line.length <= chunkSize) 
    {
      current = line;
      continue;
    }

    for (let i = 0; i < line.length; i += chunkSize) 
    {
      chunks.push(line.slice(i, i + chunkSize));
    }
  }

  flush();
  
  return chunks;
}

function buildLyricsResponse({ text, provider, trackTitle }) 
{
  const chunks = chunkLyrics(text);

  if (chunks.length === 0) 
  {
    return { embeds: [], content: undefined };
  }

  const totalPages = chunks.length;
  const visibleChunks = chunks.slice(0, MAX_EMBEDS);

  const embeds = visibleChunks.map((chunk, index) => {
    const pageLabel = totalPages > 1 ? `Page ${index + 1}/${totalPages}` : null;
    const footerParts = [provider ? `Provider - ${provider}` : null, pageLabel].filter(Boolean);
    const footer = footerParts.length ? footerParts.join(' | ') : undefined;
    const title = totalPages > 1 ? `${trackTitle} (Part ${index + 1})` : trackTitle;

    return lyricsEmbed(`Lyrics - ${title}`, chunk, footer);
  });

  const content = chunks.length > MAX_EMBEDS
    ? `Showing the first ${MAX_EMBEDS} parts out of ${chunks.length}.`
    : undefined;

  return { embeds, content };
}

module.exports = {
  MAX_EMBED_DESCRIPTION,
  MAX_EMBEDS,
  chunkLyrics,
  buildLyricsResponse,
};