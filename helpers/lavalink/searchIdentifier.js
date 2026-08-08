const SEARCH_IDENTIFIER_PATTERN = /^(dzsearch|ytsearch|spsearch|scsearch|ytmsearch):\s*(.*)$/i;

function parseSearchIdentifier(value) {
  const identifier = String(value || "").trim();
  const match = identifier.match(SEARCH_IDENTIFIER_PATTERN);

  if (!match || !match[2].trim()) return null;

  return {
    source: match[1].toLowerCase(),
    query: match[2].trim(),
  };
}

module.exports = {
  SEARCH_IDENTIFIER_PATTERN,
  parseSearchIdentifier,
};
