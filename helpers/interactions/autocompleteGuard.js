const latestRequests = new Map();

function beginAutocompleteRequest(key) {
  const requestId = (latestRequests.get(key) || 0) + 1;
  latestRequests.set(key, requestId);
  return requestId;
}

function isLatestAutocompleteRequest(key, requestId) {
  return latestRequests.get(key) === requestId;
}

module.exports = {
  beginAutocompleteRequest,
  isLatestAutocompleteRequest,
};
