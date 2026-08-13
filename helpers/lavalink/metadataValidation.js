function normalizeReleaseYear(value, now = new Date()) {
  const year = Number.parseInt(String(value || "").slice(0, 4), 10);
  const maximum = now.getUTCFullYear() + 1;
  return Number.isInteger(year) && year >= 1900 && year <= maximum ? year : null;
}

module.exports = {
  normalizeReleaseYear,
};
